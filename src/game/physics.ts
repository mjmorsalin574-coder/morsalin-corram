import Matter from 'matter-js';
import type { CoinSnapshot, CoinType } from '../types/game';
import {
  BOARD_CENTER,
  COIN_RADIUS,
  FIXED_DT_MS,
  INNER_MAX,
  INNER_MIN,
  POCKETS,
  POCKET_CAPTURE_RADIUS,
  POCKET_OFFSET,
  REST_SPEED_THRESHOLD,
  STRIKER_RADIUS,
} from './constants';

export interface PieceBodyMeta {
  id: string;
  coinType: CoinType;
}

export interface PhysicsWorld {
  engine: Matter.Engine;
  pieces: Map<number, PieceBodyMeta>; // Matter body.id -> metadata
  strikerBody: Matter.Body;
}

export function createCarromPhysicsWorld(
  rack: CoinSnapshot[],
  strikerX: number,
  strikerY: number
): PhysicsWorld {
  const engine = Matter.Engine.create({
    gravity: { x: 0, y: 0, scale: 0 },
    positionIterations: 14,
    velocityIterations: 10,
  });

  const pieces = new Map<number, PieceBodyMeta>();
  const wallOpts: Matter.IChamferableBodyDefinition = {
    isStatic: true,
    restitution: 0.84,
    friction: 0.02,
    frictionStatic: 0.02,
    label: 'cushion',
  };

  // Leave corner pocket mouths open (~50 units from each inner corner) with rounded rail ends
  const mouthGap = POCKET_OFFSET * 2 - 4; // 50
  const straightSpan = INNER_MAX - INNER_MIN - mouthGap * 2; // 572
  const wallThickness = 48;
  const halfThick = wallThickness / 2;

  const railOpts: Matter.IChamferableBodyDefinition = {
    ...wallOpts,
    chamfer: { radius: 8 },
  };

  const walls: Matter.Body[] = [
    // Top rail
    Matter.Bodies.rectangle(
      BOARD_CENTER,
      INNER_MIN - halfThick,
      straightSpan,
      wallThickness,
      railOpts
    ),
    // Bottom rail
    Matter.Bodies.rectangle(
      BOARD_CENTER,
      INNER_MAX + halfThick,
      straightSpan,
      wallThickness,
      railOpts
    ),
    // Left rail
    Matter.Bodies.rectangle(
      INNER_MIN - halfThick,
      BOARD_CENTER,
      wallThickness,
      straightSpan,
      railOpts
    ),
    // Right rail
    Matter.Bodies.rectangle(
      INNER_MAX + halfThick,
      BOARD_CENTER,
      wallThickness,
      straightSpan,
      railOpts
    ),
    // Outer perimeter containment walls (fail-safe so no body can ever escape the frame)
    Matter.Bodies.rectangle(BOARD_CENTER, INNER_MIN - 56, 800, 32, wallOpts),
    Matter.Bodies.rectangle(BOARD_CENTER, INNER_MAX + 56, 800, 32, wallOpts),
    Matter.Bodies.rectangle(INNER_MIN - 56, BOARD_CENTER, 32, 800, wallOpts),
    Matter.Bodies.rectangle(INNER_MAX + 56, BOARD_CENTER, 32, 800, wallOpts),
  ];

  // Continuous curved pocket backstops behind each corner pocket bridging cleanly to the straight rails
  for (const pocket of POCKETS) {
    const isLeft = pocket.x < BOARD_CENTER;
    const isTop = pocket.y < BOARD_CENTER;
    const baseAngle = Math.atan2(isTop ? -1 : 1, isLeft ? -1 : 1);
    const backRadius = 36;
    for (let s = -3; s <= 3; s++) {
      const a = baseAngle + s * 0.28;
      const bx = pocket.x + Math.cos(a) * backRadius;
      const by = pocket.y + Math.sin(a) * backRadius;
      walls.push(
        Matter.Bodies.circle(bx, by, 9, {
          ...wallOpts,
          restitution: 0.62,
        })
      );
    }
  }

  Matter.Composite.add(engine.world, walls);

  // Add coins
  for (const coin of rack) {
    const body = createCoinBody(coin.type, coin.x, coin.y);
    pieces.set(body.id, { id: coin.id, coinType: coin.type });
    Matter.Composite.add(engine.world, body);
  }

  // Add striker
  const strikerBody = createStrikerBody(strikerX, strikerY);
  pieces.set(strikerBody.id, { id: 'striker', coinType: 'striker' });
  Matter.Composite.add(engine.world, strikerBody);

  return { engine, pieces, strikerBody };
}

export function createCoinBody(
  type: Exclude<CoinType, 'striker'>,
  x: number,
  y: number
): Matter.Body {
  return Matter.Bodies.circle(x, y, COIN_RADIUS, {
    restitution: 0.88,
    friction: 0.015,
    frictionStatic: 0.02,
    frictionAir: 0.0112, // tuned for brisk, natural Carrom board glide at 240Hz
    density: type === 'queen' ? 0.0022 : 0.002,
    slop: 0.01,
    label: `coin_${type}`,
  });
}

export function createStrikerBody(x: number, y: number): Matter.Body {
  return Matter.Bodies.circle(x, y, STRIKER_RADIUS, {
    restitution: 0.89,
    friction: 0.012,
    frictionStatic: 0.015,
    frictionAir: 0.0102,
    density: 0.0026, // ~2.5x heavier total mass than a coin due to larger radius & higher density
    slop: 0.01,
    label: 'striker',
  });
}

export interface PocketedEvent {
  body: Matter.Body;
  meta: PieceBodyMeta;
  pocketId: (typeof POCKETS)[number]['id'];
  pocketX: number;
  pocketY: number;
}

export function detectPocketedBodies(world: PhysicsWorld): PocketedEvent[] {
  const events: PocketedEvent[] = [];
  const bodies = Matter.Composite.allBodies(world.engine.world);
  const captureSq = POCKET_CAPTURE_RADIUS * POCKET_CAPTURE_RADIUS;

  for (const body of bodies) {
    if (body.isStatic) continue;
    for (const pocket of POCKETS) {
      const dx = body.position.x - pocket.x;
      const dy = body.position.y - pocket.y;
      if (dx * dx + dy * dy <= captureSq) {
        const meta = world.pieces.get(body.id);
        if (!meta) break;
        Matter.Composite.remove(world.engine.world, body);
        events.push({
          body,
          meta,
          pocketId: pocket.id,
          pocketX: pocket.x,
          pocketY: pocket.y,
        });
        break;
      }
    }
  }
  return events;
}

const dynamicScratch: Matter.Body[] = [];

export function stepPhysics(world: PhysicsWorld): void {
  Matter.Engine.update(world.engine, FIXED_DT_MS);

  // Rigid-disc non-overlap projection (uses Body.translate to preserve Verlet velocity without adding energy)
  const allBodies = Matter.Composite.allBodies(world.engine.world);
  dynamicScratch.length = 0;
  for (let i = 0; i < allBodies.length; i++) {
    if (!allBodies[i].isStatic) {
      dynamicScratch.push(allBodies[i]);
    }
  }

  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < dynamicScratch.length; i++) {
      const a = dynamicScratch[i];
      const rA = a.id === world.strikerBody.id ? STRIKER_RADIUS : COIN_RADIUS;
      for (let j = i + 1; j < dynamicScratch.length; j++) {
        const b = dynamicScratch[j];
        const rB = b.id === world.strikerBody.id ? STRIKER_RADIUS : COIN_RADIUS;
        const minD = rA + rB;
        const dx = b.position.x - a.position.x;
        const dy = b.position.y - a.position.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < minD * minD && distSq > 1e-8) {
          const dist = Math.sqrt(distSq);
          const overlap = (minD - dist) * 0.5;
          const nx = dx / dist;
          const ny = dy / dist;
          Matter.Body.translate(a, { x: -nx * overlap, y: -ny * overlap });
          Matter.Body.translate(b, { x: nx * overlap, y: ny * overlap });
        }
      }
    }
  }

  // Natural dry-powder Coulomb friction + strict board containment
  const minSafe = INNER_MIN + 10;
  const maxSafe = INNER_MAX - 10;
  const restSq = REST_SPEED_THRESHOLD * REST_SPEED_THRESHOLD;
  const slowSq = 0.28 * 0.28;

  for (let i = 0; i < dynamicScratch.length; i++) {
    const b = dynamicScratch[i];
    // Safety containment clamp (prevents any extreme collision from escaping bounds)
    if (
      b.position.x < minSafe ||
      b.position.x > maxSafe ||
      b.position.y < minSafe ||
      b.position.y > maxSafe
    ) {
      Matter.Body.setPosition(b, {
        x: Math.max(minSafe, Math.min(maxSafe, b.position.x)),
        y: Math.max(minSafe, Math.min(maxSafe, b.position.y)),
      });
    }

    const vx = b.velocity.x;
    const vy = b.velocity.y;
    const speedSq = vx * vx + vy * vy;
    if (speedSq === 0) continue;

    if (speedSq < restSq) {
      Matter.Body.setVelocity(b, { x: 0, y: 0 });
      Matter.Body.setAngularVelocity(b, 0);
    } else {
      const speed = Math.sqrt(speedSq);
      const decel = b.id === world.strikerBody.id ? 0.00145 : 0.00175;
      let scale = Math.max(0, (speed - decel) / speed);
      if (speedSq < slowSq) {
        scale *= 0.985;
      }
      Matter.Body.setVelocity(b, { x: vx * scale, y: vy * scale });
    }
  }
}

export function areAllBodiesSettled(world: PhysicsWorld): boolean {
  const allBodies = Matter.Composite.allBodies(world.engine.world);
  for (const b of allBodies) {
    if (b.isStatic) continue;
    if (
      Math.abs(b.velocity.x) > REST_SPEED_THRESHOLD ||
      Math.abs(b.velocity.y) > REST_SPEED_THRESHOLD
    ) {
      return false;
    }
  }
  return true;
}

export function isStrikerPositionClear(
  world: PhysicsWorld,
  x: number,
  y: number
): boolean {
  const allBodies = Matter.Composite.allBodies(world.engine.world);
  const minDist = STRIKER_RADIUS + COIN_RADIUS + 1.5;
  const minDistSq = minDist * minDist;

  for (const b of allBodies) {
    if (b.isStatic || b.id === world.strikerBody.id) continue;
    const dx = b.position.x - x;
    const dy = b.position.y - y;
    if (dx * dx + dy * dy < minDistSq) {
      return false;
    }
  }
  return true;
}

export function findOpenStrikerX(
  world: PhysicsWorld,
  preferredX: number,
  y: number,
  minX: number,
  maxX: number
): number {
  const clamped = Math.max(minX, Math.min(maxX, preferredX));
  if (isStrikerPositionClear(world, clamped, y)) return clamped;

  for (let offset = 6; offset <= maxX - minX; offset += 6) {
    const right = clamped + offset;
    if (right <= maxX && isStrikerPositionClear(world, right, y)) return right;
    const left = clamped - offset;
    if (left >= minX && isStrikerPositionClear(world, left, y)) return left;
  }
  return clamped;
}

export function findOpenCenterPlacement(
  world: PhysicsWorld,
  radius = COIN_RADIUS
): { x: number; y: number } {
  const allBodies = Matter.Composite.allBodies(world.engine.world);
  const candidates: Array<{ x: number; y: number }> = [{ x: BOARD_CENTER, y: BOARD_CENTER }];

  for (let ring = 1; ring <= 8; ring++) {
    const dist = ring * (radius * 2 + 2.5);
    const steps = 6 * ring;
    for (let s = 0; s < steps; s++) {
      const a = (s / steps) * Math.PI * 2;
      candidates.push({
        x: BOARD_CENTER + Math.cos(a) * dist,
        y: BOARD_CENTER + Math.sin(a) * dist,
      });
    }
  }

  for (const c of candidates) {
    let clear = true;
    for (const b of allBodies) {
      if (b.isStatic) continue;
      const otherR = b.id === world.strikerBody.id ? STRIKER_RADIUS : COIN_RADIUS;
      const minD = radius + otherR + 1.5;
      const dx = b.position.x - c.x;
      const dy = b.position.y - c.y;
      if (dx * dx + dy * dy < minD * minD) {
        clear = false;
        break;
      }
    }
    if (clear) return c;
  }

  return { x: BOARD_CENTER, y: BOARD_CENTER };
}
