import Matter from 'matter-js';
import React, { useEffect, useImperativeHandle, useRef } from 'react';
import { soundEngine } from '../audio/soundEngine';
import type {
  AIDifficulty,
  BoardTheme,
  CoinStyle,
  CoinType,
  GameMode,
  GameSettings,
  PlayerSide,
  QueenState,
  StrikerStyle,
} from '../types/game';
import { planAIShot } from '../game/ai';
import {
  BASELINE_MAX_X,
  BASELINE_MIN_X,
  BASELINE_P1_Y,
  BASELINE_P2_Y,
  BOARD_CENTER,
  BOARD_SIZE,
  FIXED_DT_MS,
  MAX_PULL_DISTANCE,
  MAX_STRIKER_SPEED,
  MIN_PULL_DISTANCE,
  createInitialRack,
} from '../game/constants';
import {
  areAllBodiesSettled,
  createCarromPhysicsWorld,
  createCoinBody,
  detectPocketedBodies,
  findOpenCenterPlacement,
  findOpenStrikerX,
  isStrikerPositionClear,
  stepPhysics,
  type PhysicsWorld,
} from '../game/physics';
import {
  CarromBoardRenderer,
  type AimOverlayState,
  type PocketAnim,
  type PowderParticle,
  type RenderCoin,
} from '../game/renderer';
import { evaluateCarromTurn } from '../game/rules';

export interface CarromCanvasHandle {
  setStrikerX: (x: number) => void;
  resetBoardForRound: (startingPlayer: PlayerSide) => void;
  nudgeStriker: (deltaX: number) => void;
}

export interface BoardLiveState {
  activePlayer: PlayerSide;
  phase: 'AIMING' | 'SHOOTING' | 'AI_THINKING';
  strikerX: number;
  positionClear: boolean;
  p1Remaining: number;
  p2Remaining: number;
  p1Due: number;
  p2Due: number;
  p1Penalties: number;
  p2Penalties: number;
  queenState: QueenState;
  powerPercent: number;
}

interface CarromCanvasProps {
  previewMode?: boolean;
  isPaused: boolean;
  gameMode: GameMode;
  difficulty: AIDifficulty;
  p1Name: string;
  p2Name: string;
  theme: BoardTheme;
  strikerStyle: StrikerStyle;
  coinStyle: CoinStyle;
  settings: GameSettings;
  rotatedForP2: boolean;
  onStateChange: (state: BoardLiveState) => void;
  onTurnResolved: (info: {
    nextPlayer: PlayerSide;
    message: string;
    tone: 'neutral' | 'good' | 'queen' | 'foul';
    p1CoinsPocketedByTurn: number;
    practiceCoinsPocketedByTurn: number;
    foulByP1: boolean;
    foulByP2: boolean;
    queenCoveredByP1: boolean;
    roundWinner: PlayerSide | null;
    roundReason?: string;
    p1Remaining: number;
    p2Remaining: number;
    p1Penalties: number;
    p2Penalties: number;
    queenState: QueenState;
  }) => void;
}

export const CarromCanvas = React.forwardRef<CarromCanvasHandle, CarromCanvasProps>(
  function CarromCanvas(
    {
      previewMode = false,
      isPaused,
      gameMode,
      difficulty,
      p1Name,
      p2Name,
      theme,
      strikerStyle,
      coinStyle,
      settings,
      rotatedForP2,
      onStateChange,
      onTurnResolved,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const rendererRef = useRef<CarromBoardRenderer | null>(null);

    // Keep latest props in refs so the 60fps loop never restarts on state changes
    const propsRef = useRef({
      previewMode,
      isPaused,
      gameMode,
      difficulty,
      p1Name,
      p2Name,
      theme,
      strikerStyle,
      coinStyle,
      settings,
      rotatedForP2,
      onStateChange,
      onTurnResolved,
    });
    propsRef.current = {
      previewMode,
      isPaused,
      gameMode,
      difficulty,
      p1Name,
      p2Name,
      theme,
      strikerStyle,
      coinStyle,
      settings,
      rotatedForP2,
      onStateChange,
      onTurnResolved,
    };

    // Mutable simulation state
    const simRef = useRef<{
      world: PhysicsWorld | null;
      activePlayer: PlayerSide;
      phase: 'AIMING' | 'SHOOTING' | 'AI_THINKING';
      queenState: QueenState;
      p1Remaining: number;
      p2Remaining: number;
      p1Due: number;
      p2Due: number;
      p1Penalties: number;
      p2Penalties: number;
      roundOver: boolean;
      pocketedThisTurn: CoinType[];
      strikerPocketedThisTurn: boolean;
      strikerVisible: boolean;
      strikerX: number;
      strikerY: number;
      aimActive: boolean;
      aimAngle: number;
      aimPower: number;
      activePointerId: number | null;
      baselinePointerId: number | null;
      pocketAnims: PocketAnim[];
      particles: PowderParticle[];
      hitFlash: number;
      settleFrames: number;
      aiTimers: number[];
    }>({
      world: null,
      activePlayer: 'p1',
      phase: 'AIMING',
      queenState: 'ON_BOARD',
      p1Remaining: 9,
      p2Remaining: 9,
      p1Due: 0,
      p2Due: 0,
      p1Penalties: 0,
      p2Penalties: 0,
      roundOver: false,
      pocketedThisTurn: [],
      strikerPocketedThisTurn: false,
      strikerVisible: true,
      strikerX: BOARD_CENTER,
      strikerY: BASELINE_P1_Y,
      aimActive: false,
      aimAngle: -Math.PI / 2,
      aimPower: 0,
      activePointerId: null,
      baselinePointerId: null,
      pocketAnims: [],
      particles: Array.from({ length: 64 }, () => ({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
        size: 2,
      })),
      hitFlash: 0,
      settleFrames: 0,
      aiTimers: [],
    });

    const clearAiTimers = () => {
      for (const id of simRef.current.aiTimers) {
        window.clearTimeout(id);
      }
      simRef.current.aiTimers = [];
    };

    const emitLiveState = () => {
      const s = simRef.current;
      const clear =
        s.world && s.strikerVisible
          ? isStrikerPositionClear(s.world, s.strikerX, s.strikerY)
          : true;
      propsRef.current.onStateChange({
        activePlayer: s.activePlayer,
        phase: s.phase,
        strikerX: s.strikerX,
        positionClear: clear,
        p1Remaining: s.p1Remaining,
        p2Remaining: s.p2Remaining,
        p1Due: s.p1Due,
        p2Due: s.p2Due,
        p1Penalties: s.p1Penalties,
        p2Penalties: s.p2Penalties,
        queenState: s.queenState,
        powerPercent: s.aimActive ? Math.round(s.aimPower * 100) : 0,
      });
    };

    const spawnParticles = (x: number, y: number, count: number, speedScale: number) => {
      if (!propsRef.current.settings.powderFx) return;
      const pool = simRef.current.particles;
      let spawned = 0;
      for (let i = 0; i < pool.length && spawned < count; i++) {
        if (!pool[i].active) {
          const a = Math.random() * Math.PI * 2;
          const spd = (0.4 + Math.random() * 1.8) * speedScale;
          pool[i].active = true;
          pool[i].x = x;
          pool[i].y = y;
          pool[i].vx = Math.cos(a) * spd;
          pool[i].vy = Math.sin(a) * spd;
          pool[i].maxLife = 0.28 + Math.random() * 0.22;
          pool[i].life = pool[i].maxLife;
          pool[i].size = 1.4 + Math.random() * 2.1;
          spawned++;
        }
      }
    };

    const attachCollisionSounds = (world: PhysicsWorld) => {
      Matter.Events.on(world.engine, 'collisionStart', (event) => {
        if (propsRef.current.previewMode) return;
        for (const pair of event.pairs) {
          const { bodyA, bodyB } = pair;
          const relVx = bodyA.velocity.x - bodyB.velocity.x;
          const relVy = bodyA.velocity.y - bodyB.velocity.y;
          const impact = Math.hypot(relVx, relVy) * 2;
          if (impact < 0.7) continue;

          const isWall = bodyA.isStatic || bodyB.isStatic;
          const isStriker =
            bodyA.id === world.strikerBody.id || bodyB.id === world.strikerBody.id;
          soundEngine.playClack(
            impact,
            isWall ? 'wall' : isStriker ? 'striker' : 'coin'
          );

          if (impact > 3.5) {
            const cx = isWall
              ? (bodyA.isStatic ? bodyB.position.x : bodyA.position.x)
              : (bodyA.position.x + bodyB.position.x) * 0.5;
            const cy = isWall
              ? (bodyA.isStatic ? bodyB.position.y : bodyA.position.y)
              : (bodyA.position.y + bodyB.position.y) * 0.5;
            spawnParticles(cx, cy, Math.min(8, Math.round(impact * 0.6)), Math.min(2.2, impact * 0.16));
          }
          if (impact > 11 && isStriker) {
            simRef.current.hitFlash = 0.8;
          }
        }
      });
    };

    const destroyCurrentWorld = () => {
      const prev = simRef.current.world;
      if (!prev) return;
      Matter.Events.off(prev.engine, 'collisionStart');
      Matter.Composite.clear(prev.engine.world, false);
      Matter.Engine.clear(prev.engine);
      prev.pieces.clear();
      simRef.current.world = null;
    };

    const initWorld = (startingPlayer: PlayerSide) => {
      clearAiTimers();
      destroyCurrentWorld();
      const s = simRef.current;
      const rack = createInitialRack();
      const sy = startingPlayer === 'p1' ? BASELINE_P1_Y : BASELINE_P2_Y;
      const world = createCarromPhysicsWorld(rack, BOARD_CENTER, sy);
      attachCollisionSounds(world);

      s.world = world;
      s.activePlayer = startingPlayer;
      s.phase = 'AIMING';
      s.queenState = 'ON_BOARD';
      s.p1Remaining = 9;
      s.p2Remaining = 9;
      s.p1Due = 0;
      s.p2Due = 0;
      s.p1Penalties = 0;
      s.p2Penalties = 0;
      s.roundOver = false;
      s.pocketedThisTurn = [];
      s.strikerPocketedThisTurn = false;
      s.strikerVisible = true;
      s.strikerX = BOARD_CENTER;
      s.strikerY = sy;
      s.aimActive = false;
      s.aimPower = 0;
      s.activePointerId = null;
      s.baselinePointerId = null;
      s.pocketAnims = [];
      s.settleFrames = 0;
      s.hitFlash = 0;

      emitLiveState();
      maybeTriggerAI();
    };

    const scheduleAI = () => {
      const s = simRef.current;
      if (!s.world || propsRef.current.previewMode) return;
      if (propsRef.current.gameMode !== 'VS_CPU' || s.activePlayer !== 'p2') return;
      if (propsRef.current.isPaused) return;

      clearAiTimers();
      s.phase = 'AI_THINKING';
      emitLiveState();

      const plan = planAIShot(
        s.world,
        propsRef.current.difficulty,
        s.queenState,
        s.p2Remaining
      );

      // Step 1: Slide striker smoothly to chosen X
      const t1 = window.setTimeout(() => {
        if (!simRef.current.world || propsRef.current.isPaused) return;
        simRef.current.strikerX = plan.strikerX;
        simRef.current.strikerY = plan.strikerY;
        Matter.Body.setPosition(simRef.current.world.strikerBody, {
          x: plan.strikerX,
          y: plan.strikerY,
        });
        simRef.current.aimActive = true;
        simRef.current.aimAngle = plan.aimAngle;
        simRef.current.aimPower = plan.powerRatio;
        emitLiveState();
      }, 190);

      // Step 2: Execute shot after crisp aim windup
      const t2 = window.setTimeout(() => {
        if (!simRef.current.world || propsRef.current.isPaused) return;
        fireStriker(plan.vx, plan.vy);
      }, 480);

      s.aiTimers.push(t1, t2);
    };

    const maybeTriggerAI = () => {
      const s = simRef.current;
      if (
        !propsRef.current.previewMode &&
        !propsRef.current.isPaused &&
        propsRef.current.gameMode === 'VS_CPU' &&
        s.activePlayer === 'p2' &&
        s.phase === 'AIMING'
      ) {
        scheduleAI();
      }
    };

    const fireStriker = (vx: number, vy: number) => {
      const s = simRef.current;
      if (!s.world) return;
      soundEngine.unlock();
      s.aimActive = false;
      s.aimPower = 0;
      s.phase = 'SHOOTING';
      s.pocketedThisTurn = [];
      s.strikerPocketedThisTurn = false;
      s.settleFrames = 0;

      Matter.Body.setVelocity(s.world.strikerBody, { x: vx, y: vy });
      const speed = Math.hypot(vx, vy);
      const powerRatio = Math.min(1, speed / MAX_STRIKER_SPEED);
      soundEngine.playStrikerShot(powerRatio);
      if (speed > 2) {
        spawnParticles(s.strikerX, s.strikerY, 6, 1.4);
      }
      emitLiveState();
    };

    const placeStrikerForTurn = (nextPlayer: PlayerSide) => {
      const s = simRef.current;
      if (!s.world) return;

      const baselineY = nextPlayer === 'p1' ? BASELINE_P1_Y : BASELINE_P2_Y;
      const openX = findOpenStrikerX(
        s.world,
        BOARD_CENTER,
        baselineY,
        BASELINE_MIN_X,
        BASELINE_MAX_X
      );

      // Re-add striker to world if it had been pocketed
      const bodies = Matter.Composite.allBodies(s.world.engine.world);
      if (!bodies.some((b) => b.id === s.world!.strikerBody.id)) {
        Matter.Composite.add(s.world.engine.world, s.world.strikerBody);
      }

      Matter.Body.setPosition(s.world.strikerBody, { x: openX, y: baselineY });
      Matter.Body.setVelocity(s.world.strikerBody, { x: 0, y: 0 });
      Matter.Body.setAngularVelocity(s.world.strikerBody, 0);

      s.activePlayer = nextPlayer;
      s.strikerX = openX;
      s.strikerY = baselineY;
      s.strikerVisible = true;
      s.aimActive = false;
      s.aimPower = 0;
      s.activePointerId = null;
      s.baselinePointerId = null;
      s.phase = 'AIMING';
      emitLiveState();
      maybeTriggerAI();
    };

    useImperativeHandle(ref, () => ({
      setStrikerX(x: number) {
        const s = simRef.current;
        if (!s.world || s.phase !== 'AIMING') return;
        if (propsRef.current.gameMode === 'VS_CPU' && s.activePlayer === 'p2') return;
        const clamped = Math.max(BASELINE_MIN_X, Math.min(BASELINE_MAX_X, x));
        s.strikerX = clamped;
        Matter.Body.setPosition(s.world.strikerBody, { x: clamped, y: s.strikerY });
        emitLiveState();
      },
      nudgeStriker(deltaX: number) {
        const s = simRef.current;
        if (!s.world || s.phase !== 'AIMING') return;
        if (propsRef.current.gameMode === 'VS_CPU' && s.activePlayer === 'p2') return;
        const clamped = Math.max(
          BASELINE_MIN_X,
          Math.min(BASELINE_MAX_X, s.strikerX + deltaX)
        );
        s.strikerX = clamped;
        Matter.Body.setPosition(s.world.strikerBody, { x: clamped, y: s.strikerY });
        emitLiveState();
      },
      resetBoardForRound(startingPlayer: PlayerSide) {
        initWorld(startingPlayer);
      },
    }));

    // Initialize world & renderer once
    useEffect(() => {
      rendererRef.current = new CarromBoardRenderer();
      initWorld('p1');
      return () => {
        clearAiTimers();
        destroyCurrentWorld();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Resume AI if unpaused during AI turn
    useEffect(() => {
      if (!isPaused && simRef.current.phase === 'AI_THINKING') {
        scheduleAI();
      } else if (isPaused) {
        clearAiTimers();
        if (simRef.current.phase === 'AI_THINKING') {
          simRef.current.aimActive = false;
          simRef.current.aimPower = 0;
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPaused]);

    // Keyboard shortcuts for desktop accessibility (Left/Right move striker, Esc cancels aim)
    useEffect(() => {
      const onKeyDown = (e: KeyboardEvent) => {
        const s = simRef.current;
        if (propsRef.current.previewMode || propsRef.current.isPaused) return;
        if (s.phase !== 'AIMING') return;
        if (propsRef.current.gameMode === 'VS_CPU' && s.activePlayer === 'p2') return;

        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
          e.preventDefault();
          const nx = Math.max(BASELINE_MIN_X, s.strikerX - 10);
          s.strikerX = nx;
          if (s.world) Matter.Body.setPosition(s.world.strikerBody, { x: nx, y: s.strikerY });
          emitLiveState();
        } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
          e.preventDefault();
          const nx = Math.min(BASELINE_MAX_X, s.strikerX + 10);
          s.strikerX = nx;
          if (s.world) Matter.Body.setPosition(s.world.strikerBody, { x: nx, y: s.strikerY });
          emitLiveState();
        }
      };

      const onBlur = () => {
        simRef.current.aimActive = false;
        simRef.current.aimPower = 0;
        simRef.current.activePointerId = null;
        simRef.current.baselinePointerId = null;
      };

      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('blur', onBlur);
      return () => {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('blur', onBlur);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Track square container CSS size via ResizeObserver instead of layout-thrashing every frame
    const containerSizeRef = useRef(0);
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const updateSize = () => {
        const rect = el.getBoundingClientRect();
        containerSizeRef.current = Math.floor(Math.min(rect.width, rect.height));
      };
      updateSize();
      if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(updateSize);
        ro.observe(el);
        return () => ro.disconnect();
      }
      window.addEventListener('resize', updateSize);
      return () => window.removeEventListener('resize', updateSize);
    }, []);

    // Main 60FPS Fixed-Timestep Simulation & Canvas Render Loop
    useEffect(() => {
      let rafId = 0;
      let lastTime = performance.now();
      let accumulator = 0;
      const renderCoinsScratch: RenderCoin[] = [];

      const loop = (now: number) => {
        rafId = window.requestAnimationFrame(loop);

        const rawDtSec = Math.min((now - lastTime) / 1000, 0.05);
        lastTime = now;

        const canvas = canvasRef.current;
        const renderer = rendererRef.current;
        const s = simRef.current;
        const p = propsRef.current;

        if (!canvas || !renderer || !s.world) return;

        // Resize canvas cleanly to square container at devicePixelRatio (capped by graphicsQuality)
        const cssSize = containerSizeRef.current;
        if (cssSize > 0) {
          const maxDpr = p.settings.graphicsQuality === 'balanced' ? 1.4 : 2.5;
          const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
          const targetW = Math.round(cssSize * dpr);
          if (canvas.width !== targetW || canvas.height !== targetW) {
            canvas.width = targetW;
            canvas.height = targetW;
            canvas.style.width = `${cssSize}px`;
            canvas.style.height = `${cssSize}px`;
          }

          // Update physics when shooting & not paused
          if (!p.previewMode && !p.isPaused && s.phase === 'SHOOTING') {
            accumulator += rawDtSec * 1000;
            let substeps = 0;
            while (accumulator >= FIXED_DT_MS && substeps < 16) {
              stepPhysics(s.world);
              accumulator -= FIXED_DT_MS;
              substeps++;

              const pocketedEvents = detectPocketedBodies(s.world);
              for (const ev of pocketedEvents) {
                s.pocketAnims.push({
                  type: ev.meta.coinType,
                  startX: ev.body.position.x,
                  startY: ev.body.position.y,
                  pocketX: ev.pocketX,
                  pocketY: ev.pocketY,
                  progress: 0,
                });

                if (ev.meta.coinType === 'striker') {
                  s.strikerVisible = false;
                  s.strikerPocketedThisTurn = true;
                  soundEngine.playFoul();
                } else {
                  s.pocketedThisTurn.push(ev.meta.coinType);
                  soundEngine.playPocket(ev.meta.coinType === 'queen');
                }
              }
            }

            // Check if all pieces have come to rest
            if (areAllBodiesSettled(s.world)) {
              s.settleFrames++;
              if (s.settleFrames >= 3) {
                if (p.gameMode === 'PRACTICE') {
                  const whiteHit = s.pocketedThisTurn.filter((c) => c === 'white').length;
                  const blackHit = s.pocketedThisTurn.filter((c) => c === 'black').length;
                  const queenHit = s.pocketedThisTurn.includes('queen');
                  const totalHit = s.pocketedThisTurn.length;

                  s.p1Remaining = Math.max(0, s.p1Remaining - whiteHit);
                  s.p2Remaining = Math.max(0, s.p2Remaining - blackHit);
                  if (queenHit) s.queenState = 'COVERED_P1';

                  const allCleared =
                    s.p1Remaining === 0 &&
                    s.p2Remaining === 0 &&
                    s.queenState !== 'ON_BOARD';

                  const practiceMsg = allCleared
                    ? 'Full rack cleared! Setting up a fresh board...'
                    : totalHit > 0
                    ? `Pocketed ${totalHit} ${totalHit === 1 ? 'coin' : 'coins'}! Line up your next shot.`
                    : s.strikerPocketedThisTurn
                    ? 'Practice shot — striker returned to baseline.'
                    : 'Nice try — adjust angle or power and shoot again.';

                  p.onTurnResolved({
                    nextPlayer: 'p1',
                    message: practiceMsg,
                    tone: queenHit ? 'queen' : totalHit > 0 ? 'good' : 'neutral',
                    p1CoinsPocketedByTurn: 0,
                    practiceCoinsPocketedByTurn: totalHit,
                    foulByP1: false,
                    foulByP2: false,
                    queenCoveredByP1: false,
                    roundWinner: null,
                    p1Remaining: s.p1Remaining,
                    p2Remaining: s.p2Remaining,
                    p1Penalties: 0,
                    p2Penalties: 0,
                    queenState: s.queenState,
                  });

                  if (allCleared) {
                    initWorld('p1');
                  } else {
                    placeStrikerForTurn('p1');
                  }
                } else {
                  // Resolve turn via pure competitive Carrom rules engine
                  const outcome = evaluateCarromTurn({
                    activePlayer: s.activePlayer,
                    queenStateBefore: s.queenState,
                    p1RemainingBefore: s.p1Remaining,
                    p2RemainingBefore: s.p2Remaining,
                    p1DueBefore: s.p1Due,
                    p2DueBefore: s.p2Due,
                    pocketedThisTurn: s.pocketedThisTurn,
                    strikerPocketed: s.strikerPocketedThisTurn,
                    activeName: s.activePlayer === 'p1' ? p.p1Name : p.p2Name,
                    opponentName: s.activePlayer === 'p1' ? p.p2Name : p.p1Name,
                  });

                  // Return any penalty / due / uncovered coins to center
                  for (const ret of outcome.coinsToReturn) {
                    const spot = findOpenCenterPlacement(s.world);
                    const newBody = createCoinBody(ret.type, spot.x, spot.y);
                    const uid = `${ret.type}_ret_${Date.now()}_${Math.random()}`;
                    s.world.pieces.set(newBody.id, { id: uid, coinType: ret.type });
                    Matter.Composite.add(s.world.engine.world, newBody);
                  }

                  const prevQueen = s.queenState;
                  s.queenState = outcome.queenState;
                  s.p1Remaining = Math.max(
                    0,
                    Math.min(9, s.p1Remaining - outcome.p1PocketedDelta)
                  );
                  s.p2Remaining = Math.max(
                    0,
                    Math.min(9, s.p2Remaining - outcome.p2PocketedDelta)
                  );
                  s.p1Due = outcome.p1DueAfter;
                  s.p2Due = outcome.p2DueAfter;

                  const foulByP1 = s.activePlayer === 'p1' && outcome.foulCommitted;
                  const foulByP2 = s.activePlayer === 'p2' && outcome.foulCommitted;
                  if (foulByP1) s.p1Penalties += 1;
                  if (foulByP2) s.p2Penalties += 1;

                  const p1CoinsPocketedByTurn =
                    s.activePlayer === 'p1'
                      ? s.pocketedThisTurn.filter((c) => c === 'white').length
                      : 0;
                  const queenCoveredByP1 =
                    prevQueen !== 'COVERED_P1' && outcome.queenState === 'COVERED_P1';

                  p.onTurnResolved({
                    nextPlayer: outcome.nextPlayer,
                    message: outcome.message,
                    tone: outcome.tone,
                    p1CoinsPocketedByTurn,
                    practiceCoinsPocketedByTurn: 0,
                    foulByP1,
                    foulByP2,
                    queenCoveredByP1,
                    roundWinner: outcome.roundWinner,
                    roundReason: outcome.roundReason,
                    p1Remaining: s.p1Remaining,
                    p2Remaining: s.p2Remaining,
                    p1Penalties: s.p1Penalties,
                    p2Penalties: s.p2Penalties,
                    queenState: s.queenState,
                  });

                  if (outcome.roundWinner) {
                    s.roundOver = true;
                    s.phase = 'AIMING';
                    s.strikerVisible = false;
                    emitLiveState();
                  } else {
                    placeStrikerForTurn(outcome.nextPlayer);
                  }
                }
              }
            } else {
              s.settleFrames = 0;
            }
          } else {
            accumulator = 0;
          }

          // Update pocket animations & pooled powder particles
          for (let i = s.pocketAnims.length - 1; i >= 0; i--) {
            s.pocketAnims[i].progress += rawDtSec * 6.5;
            if (s.pocketAnims[i].progress >= 1) {
              s.pocketAnims.splice(i, 1);
            }
          }

          for (const pt of s.particles) {
            if (!pt.active) continue;
            pt.x += pt.vx * (rawDtSec * 60);
            pt.y += pt.vy * (rawDtSec * 60);
            pt.vx *= 0.92;
            pt.vy *= 0.92;
            pt.life -= rawDtSec;
            if (pt.life <= 0) pt.active = false;
          }

          if (s.hitFlash > 0) {
            s.hitFlash = Math.max(0, s.hitFlash - rawDtSec * 4.5);
          }

          // Gather render snapshots into reusable scratch array
          renderCoinsScratch.length = 0;
          const bodies = Matter.Composite.allBodies(s.world.engine.world);
          for (let i = 0; i < bodies.length; i++) {
            const b = bodies[i];
            if (b.isStatic || b.id === s.world.strikerBody.id) continue;
            const meta = s.world.pieces.get(b.id);
            if (!meta || meta.coinType === 'striker') continue;
            renderCoinsScratch.push({
              id: meta.id,
              type: meta.coinType,
              x: b.position.x,
              y: b.position.y,
              angle: b.angle,
            });
          }

          const isAI = p.gameMode === 'VS_CPU' && s.activePlayer === 'p2';
          const canShoot = !p.previewMode && !p.isPaused && s.phase === 'AIMING' && !isAI;
          const posClear =
            s.strikerVisible && s.world
              ? isStrikerPositionClear(s.world, s.strikerX, s.strikerY)
              : true;

          const aimOverlay: AimOverlayState = {
            active: s.aimActive,
            isAI,
            strikerX: s.strikerX,
            strikerY: s.strikerY,
            angle: s.aimAngle,
            powerRatio: s.aimPower,
            positionClear: posClear,
            canShoot,
          };

          const ctx = canvas.getContext('2d');
          if (ctx) {
            renderer.renderFrame(
              ctx,
              cssSize,
              dpr,
              p.theme,
              p.strikerStyle,
              p.coinStyle,
              renderCoinsScratch,
              {
                x: s.world.strikerBody.position.x,
                y: s.world.strikerBody.position.y,
                angle: s.world.strikerBody.angle,
                visible: s.strikerVisible,
              },
              aimOverlay,
              p.settings.aimGuide,
              s.pocketAnims,
              s.particles,
              s.hitFlash
            );
          }
        }
      };

      rafId = window.requestAnimationFrame(loop);
      return () => window.cancelAnimationFrame(rafId);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Convert client pointer event to 800x800 board coordinates
    const toBoardCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: BOARD_CENTER, y: BOARD_CENTER };
      const rect = canvas.getBoundingClientRect();
      let bx = ((e.clientX - rect.left) / rect.width) * BOARD_SIZE;
      let by = ((e.clientY - rect.top) / rect.height) * BOARD_SIZE;
      if (propsRef.current.rotatedForP2) {
        bx = BOARD_SIZE - bx;
        by = BOARD_SIZE - by;
      }
      return { x: bx, y: by };
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const p = propsRef.current;
      const s = simRef.current;
      if (
        p.previewMode ||
        p.isPaused ||
        !s.world ||
        s.roundOver ||
        !s.strikerVisible ||
        s.phase !== 'AIMING'
      ) {
        return;
      }
      if (p.gameMode === 'VS_CPU' && s.activePlayer === 'p2') return;
      // Multi-touch guard: ignore secondary touches while already aiming or sliding baseline
      if (s.activePointerId !== null || s.baselinePointerId !== null) return;

      soundEngine.unlock();
      const pt = toBoardCoords(e);
      const distToStriker = Math.hypot(pt.x - s.strikerX, pt.y - s.strikerY);

      // Touching along the active baseline away from striker -> direct smooth baseline drag
      if (
        distToStriker > 50 &&
        Math.abs(pt.y - s.strikerY) <= 38 &&
        pt.x >= BASELINE_MIN_X - 28 &&
        pt.x <= BASELINE_MAX_X + 28
      ) {
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // Ignore if unsupported
        }
        s.baselinePointerId = e.pointerId;
        const clampedX = Math.max(BASELINE_MIN_X, Math.min(BASELINE_MAX_X, pt.x));
        s.strikerX = clampedX;
        Matter.Body.setPosition(s.world.strikerBody, { x: clampedX, y: s.strikerY });
        soundEngine.playUiTick();
        emitLiveState();
        return;
      }

      // Check striker overlap before starting aim drag
      if (!isStrikerPositionClear(s.world, s.strikerX, s.strikerY)) {
        soundEngine.playFoul();
        emitLiveState();
        return;
      }

      // Start slingshot pull from near the striker
      if (distToStriker <= 94) {
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // Ignore if unsupported
        }
        s.activePointerId = e.pointerId;
        s.baselinePointerId = null;
        s.aimActive = true;
        s.aimPower = 0;
        emitLiveState();
      }
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const s = simRef.current;

      if (s.baselinePointerId === e.pointerId && s.world && s.phase === 'AIMING') {
        const pt = toBoardCoords(e);
        const clampedX = Math.max(BASELINE_MIN_X, Math.min(BASELINE_MAX_X, pt.x));
        s.strikerX = clampedX;
        Matter.Body.setPosition(s.world.strikerBody, { x: clampedX, y: s.strikerY });
        emitLiveState();
        return;
      }

      if (!s.aimActive || s.activePointerId !== e.pointerId) return;

      const pt = toBoardCoords(e);
      const pullDX = s.strikerX - pt.x;
      const pullDY = s.strikerY - pt.y;
      const pullDist = Math.hypot(pullDX, pullDY);

      if (pullDist < MIN_PULL_DISTANCE) {
        s.aimPower = 0;
      } else {
        s.aimAngle = Math.atan2(pullDY, pullDX);
        s.aimPower = Math.min(
          1,
          (pullDist - MIN_PULL_DISTANCE) / (MAX_PULL_DISTANCE - MIN_PULL_DISTANCE)
        );
      }
      emitLiveState();
    };

    const handlePointerUpOrCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const s = simRef.current;

      if (s.baselinePointerId === e.pointerId) {
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          // Ignore if already released
        }
        s.baselinePointerId = null;
        emitLiveState();
        return;
      }

      if (!s.aimActive || s.activePointerId !== e.pointerId) return;

      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore if already released
      }

      const power = s.aimPower;
      const angle = s.aimAngle;
      s.aimActive = false;
      s.aimPower = 0;
      s.activePointerId = null;

      if (e.type === 'pointerup' && power > 0.04 && s.world) {
        if (isStrikerPositionClear(s.world, s.strikerX, s.strikerY)) {
          const speed = (0.16 + power * 0.84) * MAX_STRIKER_SPEED;
          fireStriker(Math.cos(angle) * speed, Math.sin(angle) * speed);
          return;
        }
      }

      emitLiveState();
    };

    return (
      <div
        ref={containerRef}
        className="relative flex h-full w-full items-center justify-center select-none"
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUpOrCancel}
          onPointerCancel={handlePointerUpOrCancel}
          onContextMenu={(e) => {
            e.preventDefault();
            simRef.current.aimActive = false;
            simRef.current.aimPower = 0;
            simRef.current.activePointerId = null;
            emitLiveState();
          }}
          className={`touch-none rounded-[22px] shadow-[0_28px_72px_rgba(0,0,0,0.82),0_0_44px_rgba(59,130,246,0.1)] transition-transform duration-200 ${
            rotatedForP2 ? 'rotate-180' : 'rotate-0'
          } ${previewMode ? 'pointer-events-none' : 'cursor-crosshair'}`}
        />
      </div>
    );
  }
);
