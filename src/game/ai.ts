import Matter from 'matter-js';
import type { AIDifficulty, QueenState } from '../types/game';
import {
  BASELINE_MAX_X,
  BASELINE_MIN_X,
  BASELINE_P2_Y,
  BOARD_CENTER,
  COIN_RADIUS,
  INNER_MAX,
  INNER_MIN,
  MAX_STRIKER_SPEED,
  POCKETS,
  POCKET_CAPTURE_RADIUS,
  STRIKER_RADIUS,
} from './constants';
import { isStrikerPositionClear, type PhysicsWorld } from './physics';

export interface AIShotPlan {
  strikerX: number;
  strikerY: number;
  vx: number;
  vy: number;
  aimAngle: number;
  powerRatio: number;
  shotKind?: 'direct' | 'bank' | 'break';
}

interface CoinItem {
  id: number;
  type: 'white' | 'black' | 'queen';
  x: number;
  y: number;
}

interface CandidateShot {
  strikerX: number;
  vx: number;
  vy: number;
  angle: number;
  power: number;
  score: number;
  shotKind: 'direct' | 'bank' | 'break';
}

function segmentCircleHit(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  r: number
): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-6) return false;
  const t = Math.max(0, Math.min(1, ((cx - ax) * dx + (cy - ay) * dy) / lenSq));
  const px = ax + t * dx;
  const py = ay + t * dy;
  const distSq = (cx - px) * (cx - px) + (cy - py) * (cy - py);
  return distSq < r * r;
}

function isPathClear(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  clearanceRadius: number,
  allCoins: CoinItem[],
  ignoreId: number
): boolean {
  for (const c of allCoins) {
    if (c.id === ignoreId) continue;
    if (segmentCircleHit(x1, y1, x2, y2, c.x, c.y, clearanceRadius)) {
      return false;
    }
  }
  return true;
}

function computeScratchPenalty(
  sx: number,
  sy: number,
  ghostX: number,
  ghostY: number,
  shotDirX: number,
  shotDirY: number,
  dirPX: number,
  dirPY: number,
  cutAlignment: number,
  difficulty: AIDifficulty
): number {
  if (difficulty === 'easy') return 0;

  let penalty = 0;
  // 1. Follow-through pocket hazard (straight or near-straight shots can drag striker into target pocket)
  if (cutAlignment > 0.86) {
    const followX = ghostX + shotDirX * 360;
    const followY = ghostY + shotDirY * 360;
    for (const p of POCKETS) {
      if (segmentCircleHit(ghostX, ghostY, followX, followY, p.x, p.y, POCKET_CAPTURE_RADIUS + 4)) {
        penalty += difficulty === 'hard' ? 120 : 80;
      }
    }
  }

  // 2. Post-impact tangent deflection hazard (cut shots deflect striker perpendicular to line of centers)
  if (difficulty === 'hard' && cutAlignment < 0.96) {
    // Tangent vector perpendicular to impact normal (dirPX, dirPY) aligned with incoming shotDir
    const dot = shotDirX * dirPX + shotDirY * dirPY;
    let tanX = shotDirX - dot * dirPX;
    let tanY = shotDirY - dot * dirPY;
    const tanLen = Math.hypot(tanX, tanY);
    if (tanLen > 1e-4) {
      tanX /= tanLen;
      tanY /= tanLen;
      const tanEndX = ghostX + tanX * 320;
      const tanEndY = ghostY + tanY * 320;
      for (const p of POCKETS) {
        if (segmentCircleHit(ghostX, ghostY, tanEndX, tanEndY, p.x, p.y, POCKET_CAPTURE_RADIUS + 2)) {
          penalty += 95;
        }
      }
    }
  }

  // 3. Immediate pocket mouth along initial striker path
  for (const p of POCKETS) {
    if (segmentCircleHit(sx, sy, ghostX, ghostY, p.x, p.y, POCKET_CAPTURE_RADIUS + 3)) {
      penalty += difficulty === 'hard' ? 140 : 75;
    }
  }

  return penalty;
}

export function planAIShot(
  world: PhysicsWorld,
  difficulty: AIDifficulty,
  queenState: QueenState,
  p2Remaining: number
): AIShotPlan {
  const coins: CoinItem[] = [];
  const bodies = Matter.Composite.allBodies(world.engine.world);

  for (const b of bodies) {
    if (b.isStatic || b.id === world.strikerBody.id) continue;
    const meta = world.pieces.get(b.id);
    if (!meta || meta.coinType === 'striker') continue;
    coins.push({
      id: b.id,
      type: meta.coinType,
      x: b.position.x,
      y: b.position.y,
    });
  }

  // Decide valid target coins under classic Carrom rules
  const targets = coins.filter((c) => {
    if (queenState === 'PENDING_P2') return c.type === 'black';
    if (queenState === 'ON_BOARD' && p2Remaining === 1) return c.type === 'queen';
    if (c.type === 'black') return true;
    if (c.type === 'queen' && queenState === 'ON_BOARD' && p2Remaining >= 1) return true;
    return false;
  });

  // Sample legal striker X positions along top baseline (granularity varies by difficulty)
  const sampleXs: number[] = [];
  const step = difficulty === 'hard' ? 12 : difficulty === 'medium' ? 24 : 48;
  for (let x = BASELINE_MIN_X; x <= BASELINE_MAX_X; x += step) {
    if (isStrikerPositionClear(world, x, BASELINE_P2_Y)) {
      sampleXs.push(x);
    }
  }
  if (sampleXs.length === 0) {
    sampleXs.push(BOARD_CENTER);
  }

  const candidates: CandidateShot[] = [];
  const impactDist = COIN_RADIUS + STRIKER_RADIUS;
  const railMin = INNER_MIN + STRIKER_RADIUS;
  const railMax = INNER_MAX - STRIKER_RADIUS;

  for (const target of targets) {
    for (const pocket of POCKETS) {
      const toPocketX = pocket.x - target.x;
      const toPocketY = pocket.y - target.y;
      const distToPocket = Math.hypot(toPocketX, toPocketY);
      if (distToPocket < 5) continue;

      const dirPX = toPocketX / distToPocket;
      const dirPY = toPocketY / distToPocket;

      // Ghost ball impact center
      const ghostX = target.x - dirPX * impactDist;
      const ghostY = target.y - dirPY * impactDist;

      // Ensure ghost point is inside playable boundaries
      if (
        ghostX < railMin ||
        ghostX > railMax ||
        ghostY < railMin ||
        ghostY > railMax
      ) {
        continue;
      }

      const coinToPocketClear = isPathClear(
        target.x,
        target.y,
        pocket.x,
        pocket.y,
        COIN_RADIUS * 1.92,
        coins,
        target.id
      );
      if (!coinToPocketClear && difficulty !== 'easy') continue;

      // A. Direct Shot Evaluation
      for (const sx of sampleXs) {
        const shotDX = ghostX - sx;
        const shotDY = ghostY - BASELINE_P2_Y;
        const shotDist = Math.hypot(shotDX, shotDY);
        if (shotDist < 12) continue;

        const shotDirX = shotDX / shotDist;
        const shotDirY = shotDY / shotDist;

        // Cut angle dot product: 1.0 = dead straight, 0 = 90 degree thin cut
        const cutAlignment = shotDirX * dirPX + shotDirY * dirPY;
        if (cutAlignment < (difficulty === 'easy' ? 0.2 : 0.3)) continue;

        const strikerToGhostClear = isPathClear(
          sx,
          BASELINE_P2_Y,
          ghostX,
          ghostY,
          STRIKER_RADIUS + COIN_RADIUS - 2.5,
          coins,
          target.id
        );
        if (!strikerToGhostClear && difficulty !== 'easy') continue;

        const scratchRiskPenalty = computeScratchPenalty(
          sx,
          BASELINE_P2_Y,
          ghostX,
          ghostY,
          shotDirX,
          shotDirY,
          dirPX,
          dirPY,
          cutAlignment,
          difficulty
        );

        let score =
          cutAlignment * 102 -
          distToPocket * 0.085 -
          shotDist * 0.038 +
          (coinToPocketClear ? 38 : -35) +
          (strikerToGhostClear ? 14 : -40) -
          scratchRiskPenalty;

        if (target.type === 'queen') {
          score += queenState === 'ON_BOARD' && p2Remaining <= 5 ? 30 : 8;
        }
        if (queenState === 'PENDING_P2' && target.type === 'black') {
          score += 34;
        }

        const basePower = Math.min(
          0.96,
          Math.max(0.45, 0.43 + (shotDist + distToPocket) / 980 + (1 - cutAlignment) * 0.25)
        );
        const speed = basePower * MAX_STRIKER_SPEED;
        const angle = Math.atan2(shotDY, shotDX);

        candidates.push({
          strikerX: sx,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          angle,
          power: basePower,
          score,
          shotKind: 'direct',
        });
      }

      // B. True Geometric Cushion Bank Shots (Medium: bottom rail; Hard: bottom + left + right rails)
      if (difficulty !== 'easy' && coinToPocketClear) {
        const railsToTry: Array<'bottom' | 'left' | 'right'> =
          difficulty === 'hard' ? ['bottom', 'left', 'right'] : ['bottom'];

        for (const rail of railsToTry) {
          for (const sx of sampleXs) {
            let bounceX = 0;
            let bounceY = 0;
            let mirrorX = ghostX;
            let mirrorY = ghostY;

            if (rail === 'bottom') {
              bounceY = railMax;
              mirrorY = 2 * bounceY - ghostY;
              const dyTotal = mirrorY - BASELINE_P2_Y;
              if (dyTotal <= 40) continue;
              const t = (bounceY - BASELINE_P2_Y) / dyTotal;
              bounceX = sx + (mirrorX - sx) * t;
              // Keep clear of bottom corner pocket mouths
              if (bounceX < INNER_MIN + 62 || bounceX > INNER_MAX - 62) continue;
            } else if (rail === 'left') {
              bounceX = railMin;
              mirrorX = 2 * bounceX - ghostX;
              const dxTotal = mirrorX - sx;
              if (Math.abs(dxTotal) < 30 || dxTotal >= 0) continue;
              const t = (bounceX - sx) / dxTotal;
              bounceY = BASELINE_P2_Y + (mirrorY - BASELINE_P2_Y) * t;
              if (bounceY < INNER_MIN + 62 || bounceY > INNER_MAX - 62) continue;
            } else {
              bounceX = railMax;
              mirrorX = 2 * bounceX - ghostX;
              const dxTotal = mirrorX - sx;
              if (Math.abs(dxTotal) < 30 || dxTotal <= 0) continue;
              const t = (bounceX - sx) / dxTotal;
              bounceY = BASELINE_P2_Y + (mirrorY - BASELINE_P2_Y) * t;
              if (bounceY < INNER_MIN + 62 || bounceY > INNER_MAX - 62) continue;
            }

            const leg1Dist = Math.hypot(bounceX - sx, bounceY - BASELINE_P2_Y);
            const leg2DX = ghostX - bounceX;
            const leg2DY = ghostY - bounceY;
            const leg2Dist = Math.hypot(leg2DX, leg2DY);
            if (leg1Dist < 24 || leg2Dist < 16) continue;

            const bankDirX = leg2DX / leg2Dist;
            const bankDirY = leg2DY / leg2Dist;
            const cutAlignment = bankDirX * dirPX + bankDirY * dirPY;
            if (cutAlignment < 0.42) continue;

            const leg1Clear = isPathClear(
              sx,
              BASELINE_P2_Y,
              bounceX,
              bounceY,
              STRIKER_RADIUS + COIN_RADIUS - 2,
              coins,
              target.id
            );
            if (!leg1Clear) continue;

            const leg2Clear = isPathClear(
              bounceX,
              bounceY,
              ghostX,
              ghostY,
              STRIKER_RADIUS + COIN_RADIUS - 2,
              coins,
              target.id
            );
            if (!leg2Clear) continue;

            const scratchRiskPenalty = computeScratchPenalty(
              bounceX,
              bounceY,
              ghostX,
              ghostY,
              bankDirX,
              bankDirY,
              dirPX,
              dirPY,
              cutAlignment,
              difficulty
            );

            // Bank shots carry slight natural difficulty discount vs clean direct shots
            let score =
              cutAlignment * 88 -
              distToPocket * 0.08 -
              (leg1Dist + leg2Dist) * 0.035 +
              22 -
              scratchRiskPenalty;

            if (target.type === 'queen') {
              score += queenState === 'ON_BOARD' && p2Remaining <= 5 ? 24 : 5;
            }
            if (queenState === 'PENDING_P2' && target.type === 'black') {
              score += 28;
            }

            const totalTravel = leg1Dist + leg2Dist + distToPocket;
            const basePower = Math.min(
              0.98,
              Math.max(0.56, (0.47 + totalTravel / 920) * 1.12)
            );
            const speed = basePower * MAX_STRIKER_SPEED;
            const launchAngle = Math.atan2(bounceY - BASELINE_P2_Y, bounceX - sx);

            candidates.push({
              strikerX: sx,
              vx: Math.cos(launchAngle) * speed,
              vy: Math.sin(launchAngle) * speed,
              angle: launchAngle,
              power: basePower,
              score,
              shotKind: 'bank',
            });
          }
        }
      }
    }
  }

  // C. Smart Cluster Break / Positional Fallback Shot when no clean pocket shot exists
  if (candidates.length === 0) {
    const target = targets[0] ?? coins[0];
    const sx = sampleXs[Math.floor(sampleXs.length / 2)];
    if (target) {
      // If coin sits behind top baseline, use a clean bottom-cushion rebound toward it
      const useBottomBank = target.y < BASELINE_P2_Y + 35 && difficulty !== 'easy';
      const aimX = target.x;
      const aimY = useBottomBank ? 2 * railMax - target.y : target.y;
      const angle = Math.atan2(aimY - BASELINE_P2_Y, aimX - sx);
      const power = difficulty === 'hard' ? 0.84 : 0.76;
      const speed = power * MAX_STRIKER_SPEED;
      return {
        strikerX: sx,
        strikerY: BASELINE_P2_Y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        aimAngle: angle,
        powerRatio: power,
        shotKind: useBottomBank ? 'bank' : 'break',
      };
    }
    return {
      strikerX: sx,
      strikerY: BASELINE_P2_Y,
      vx: 0,
      vy: MAX_STRIKER_SPEED * 0.8,
      aimAngle: Math.PI / 2,
      powerRatio: 0.8,
      shotKind: 'break',
    };
  }

  candidates.sort((a, b) => b.score - a.score);

  let chosen = candidates[0];
  if (difficulty === 'easy') {
    const pool = candidates.slice(0, Math.min(5, candidates.length));
    chosen = pool[Math.floor(Math.random() * pool.length)];
  } else if (difficulty === 'medium') {
    const pool = candidates.slice(0, Math.min(2, candidates.length));
    chosen = pool[Math.floor(Math.random() * pool.length)];
  }

  // Apply difficulty-calibrated angular & power precision
  const maxJitterDeg = difficulty === 'hard' ? 0.35 : difficulty === 'medium' ? 1.6 : 4.8;
  const jitterRad = ((Math.random() * 2 - 1) * maxJitterDeg * Math.PI) / 180;
  const powerJitter =
    difficulty === 'hard'
      ? 1 + (Math.random() * 0.03 - 0.015)
      : difficulty === 'medium'
      ? 1 + (Math.random() * 0.1 - 0.05)
      : 1 + (Math.random() * 0.24 - 0.12);

  const finalAngle = chosen.angle + jitterRad;
  const finalPower = Math.max(0.32, Math.min(1, chosen.power * powerJitter));
  const finalSpeed = finalPower * MAX_STRIKER_SPEED;

  return {
    strikerX: chosen.strikerX,
    strikerY: BASELINE_P2_Y,
    vx: Math.cos(finalAngle) * finalSpeed,
    vy: Math.sin(finalAngle) * finalSpeed,
    aimAngle: finalAngle,
    powerRatio: finalPower,
    shotKind: chosen.shotKind,
  };
}
