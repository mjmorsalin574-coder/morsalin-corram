import type { CoinSnapshot } from '../types/game';

export const BOARD_SIZE = 800;
export const FRAME_THICKNESS = 64;
export const INNER_MIN = FRAME_THICKNESS; // 64
export const INNER_MAX = BOARD_SIZE - FRAME_THICKNESS; // 736
export const INNER_SIZE = INNER_MAX - INNER_MIN; // 672
export const BOARD_CENTER = BOARD_SIZE / 2; // 400

export const POCKET_OFFSET = 27;
export const POCKET_RADIUS = 26.5;
export const POCKET_CAPTURE_RADIUS = 23.5;

export const POCKETS = [
  { id: 'tl', x: INNER_MIN + POCKET_OFFSET, y: INNER_MIN + POCKET_OFFSET },
  { id: 'tr', x: INNER_MAX - POCKET_OFFSET, y: INNER_MIN + POCKET_OFFSET },
  { id: 'bl', x: INNER_MIN + POCKET_OFFSET, y: INNER_MAX - POCKET_OFFSET },
  { id: 'br', x: INNER_MAX - POCKET_OFFSET, y: INNER_MAX - POCKET_OFFSET },
] as const;

export const COIN_RADIUS = 15.2;
export const STRIKER_RADIUS = 21.2;

export const BASELINE_MIN_X = 186;
export const BASELINE_MAX_X = 614;
export const BASELINE_P1_Y = 634;
export const BASELINE_P2_Y = 166;
export const BASELINE_CIRCLE_RADIUS = 15.5;

export const CENTER_CIRCLE_OUTER = 74;
export const CENTER_CIRCLE_INNER = 18;

// Fixed 240Hz physics timestep eliminates break-shot compression overlap and tunneling
export const FIXED_DT_MS = 1000 / 240;
export const MAX_STRIKER_SPEED = 11.4;
export const MIN_PULL_DISTANCE = 18;
export const MAX_PULL_DISTANCE = 138;
export const REST_SPEED_THRESHOLD = 0.068;

export const CHAMPIONSHIP_TARGET_POINTS = 25;

export function createInitialRack(): CoinSnapshot[] {
  const coins: CoinSnapshot[] = [];
  const spacing = COIN_RADIUS * 2 + 0.7;

  // Center Red Queen
  coins.push({
    id: 'queen',
    type: 'queen',
    x: BOARD_CENTER,
    y: BOARD_CENTER,
  });

  // Ring 1: 6 coins alternating White and Black
  let whiteIdx = 1;
  let blackIdx = 1;
  for (let i = 0; i < 6; i++) {
    const angle = (-90 + i * 60) * (Math.PI / 180);
    const type = i % 2 === 0 ? 'white' : 'black';
    const id = type === 'white' ? `w${whiteIdx++}` : `b${blackIdx++}`;
    coins.push({
      id,
      type,
      x: BOARD_CENTER + Math.cos(angle) * spacing,
      y: BOARD_CENTER + Math.sin(angle) * spacing,
    });
  }

  // Ring 2: 12 coins in classic Y-formation (6 Whites + 6 Blacks)
  // Corners (0, 2, 4, 6, 8, 10) at distance 2 * spacing; edge midpoints at sqrt(3) * spacing
  for (let i = 0; i < 12; i++) {
    const angleDeg = -90 + i * 30;
    const angle = angleDeg * (Math.PI / 180);
    const isCorner = i % 2 === 0;
    const dist = isCorner ? spacing * 2 : spacing * Math.sqrt(3);
    // Classic Carrom Y: corners at -90, 30, 150 (i = 0, 4, 8) are white; remaining corners + alternating pattern yield 6W + 6B
    let type: 'white' | 'black';
    if (isCorner) {
      type = i % 4 === 0 ? 'white' : 'black';
    } else {
      // Midpoints: i = 1, 3, 5, 7, 9, 11 -> 3 white, 3 black
      type = i === 1 || i === 7 || i === 11 ? 'black' : 'white';
    }
    const id = type === 'white' ? `w${whiteIdx++}` : `b${blackIdx++}`;
    coins.push({
      id,
      type,
      x: BOARD_CENTER + Math.cos(angle) * dist,
      y: BOARD_CENTER + Math.sin(angle) * dist,
    });
  }

  return coins;
}
