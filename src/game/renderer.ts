import type {
  AimGuideMode,
  BoardTheme,
  CoinStyle,
  CoinType,
  StrikerStyle,
} from '../types/game';
import {
  BASELINE_CIRCLE_RADIUS,
  BASELINE_MAX_X,
  BASELINE_MIN_X,
  BASELINE_P1_Y,
  BASELINE_P2_Y,
  BOARD_CENTER,
  BOARD_SIZE,
  CENTER_CIRCLE_INNER,
  CENTER_CIRCLE_OUTER,
  COIN_RADIUS,
  FRAME_THICKNESS,
  INNER_MAX,
  INNER_MIN,
  INNER_SIZE,
  POCKETS,
  POCKET_RADIUS,
  STRIKER_RADIUS,
} from './constants';

export interface RenderCoin {
  id: string;
  type: Exclude<CoinType, 'striker'>;
  x: number;
  y: number;
  angle: number;
}

export interface PocketAnim {
  type: CoinType;
  startX: number;
  startY: number;
  pocketX: number;
  pocketY: number;
  progress: number; // 0 -> 1
}

export interface PowderParticle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

export interface AimOverlayState {
  active: boolean;
  isAI: boolean;
  strikerX: number;
  strikerY: number;
  angle: number; // shot travel direction
  powerRatio: number; // 0..1
  positionClear: boolean;
  canShoot: boolean;
}

export class CarromBoardRenderer {
  private boardCache: HTMLCanvasElement | null = null;
  private cachedThemeId = '';
  private cachedScale = 0;

  private ensureBoardCache(theme: BoardTheme, pixelScale: number): HTMLCanvasElement {
    const scale = Math.max(1, Math.min(3, pixelScale));
    if (
      this.boardCache &&
      this.cachedThemeId === theme.id &&
      Math.abs(this.cachedScale - scale) < 0.05
    ) {
      return this.boardCache;
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(BOARD_SIZE * scale);
    canvas.height = Math.round(BOARD_SIZE * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    ctx.scale(scale, scale);
    this.drawStaticBoard(ctx, theme);

    this.boardCache = canvas;
    this.cachedThemeId = theme.id;
    this.cachedScale = scale;
    return canvas;
  }

  private drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }

  private drawStaticBoard(ctx: CanvasRenderingContext2D, theme: BoardTheme) {
    // 1. Outer wooden frame with beveled lighting
    const frameGrad = ctx.createLinearGradient(0, 0, BOARD_SIZE, BOARD_SIZE);
    frameGrad.addColorStop(0, theme.frameHighlight);
    frameGrad.addColorStop(0.45, theme.frameInner);
    frameGrad.addColorStop(1, theme.frameOuter);

    this.drawRoundedRect(ctx, 4, 4, BOARD_SIZE - 8, BOARD_SIZE - 8, 34);
    ctx.fillStyle = frameGrad;
    ctx.fill();

    // Subtle wood grain lines across the outer frame
    ctx.save();
    this.drawRoundedRect(ctx, 4, 4, BOARD_SIZE - 8, BOARD_SIZE - 8, 34);
    ctx.clip();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.14)';
    ctx.lineWidth = 1.4;
    for (let i = -BOARD_SIZE; i < BOARD_SIZE * 2; i += 14) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.bezierCurveTo(
        i + 40,
        BOARD_SIZE * 0.33,
        i - 30,
        BOARD_SIZE * 0.66,
        i + 20,
        BOARD_SIZE
      );
      ctx.stroke();
    }
    ctx.restore();

    // Outer frame bevel highlight & corner brass brackets
    this.drawRoundedRect(ctx, 8, 8, BOARD_SIZE - 16, BOARD_SIZE - 16, 30);
    ctx.strokeStyle = 'rgba(255, 240, 200, 0.14)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner gold inlay border around playing field
    this.drawRoundedRect(
      ctx,
      INNER_MIN - 4,
      INNER_MIN - 4,
      INNER_SIZE + 8,
      INNER_SIZE + 8,
      10
    );
    ctx.strokeStyle = theme.inlayGold;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 2. Playing surface (wooden birch/maple/ebony deck)
    ctx.save();
    this.drawRoundedRect(ctx, INNER_MIN, INNER_MIN, INNER_SIZE, INNER_SIZE, 6);
    ctx.clip();

    ctx.fillStyle = theme.surfaceBase;
    ctx.fillRect(INNER_MIN, INNER_MIN, INNER_SIZE, INNER_SIZE);

    // Subtle organic woodgrain texture on deck
    ctx.strokeStyle = theme.surfaceGrain;
    ctx.lineWidth = 1.2;
    ctx.globalAlpha = 0.5;
    for (let y = INNER_MIN; y <= INNER_MAX; y += 9) {
      ctx.beginPath();
      ctx.moveTo(INNER_MIN, y);
      ctx.bezierCurveTo(
        INNER_MIN + INNER_SIZE * 0.33,
        y + Math.sin(y * 0.04) * 3.5,
        INNER_MIN + INNER_SIZE * 0.66,
        y - Math.cos(y * 0.03) * 3.5,
        INNER_MAX,
        y
      );
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Warm studio radial lighting & rail edge inner shadow
    const vignette = ctx.createRadialGradient(
      BOARD_CENTER,
      BOARD_CENTER,
      INNER_SIZE * 0.18,
      BOARD_CENTER,
      BOARD_CENTER,
      INNER_SIZE * 0.72
    );
    vignette.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
    vignette.addColorStop(1, theme.surfaceVignette);
    ctx.fillStyle = vignette;
    ctx.fillRect(INNER_MIN, INNER_MIN, INNER_SIZE, INNER_SIZE);

    // Inner cushion shadow around border
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.lineWidth = 8;
    ctx.strokeRect(INNER_MIN, INNER_MIN, INNER_SIZE, INNER_SIZE);

    // 3. Traditional Carrom Board Markings
    this.drawBoardMarkings(ctx, theme);

    // 4. Four Corner Pockets
    for (const p of POCKETS) {
      // Brass/leather rim ring
      ctx.beginPath();
      ctx.arc(p.x, p.y, POCKET_RADIUS + 3.5, 0, Math.PI * 2);
      ctx.fillStyle = theme.pocketRim;
      ctx.fill();

      // Deep pocket cup gradient
      const pGrad = ctx.createRadialGradient(
        p.x - 3,
        p.y - 3,
        4,
        p.x,
        p.y,
        POCKET_RADIUS
      );
      pGrad.addColorStop(0, '#050302');
      pGrad.addColorStop(0.75, theme.pocketHole);
      pGrad.addColorStop(1, '#261810');
      ctx.beginPath();
      ctx.arc(p.x, p.y, POCKET_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = pGrad;
      ctx.fill();

      // Subtle inner pocket rim highlight
      ctx.beginPath();
      ctx.arc(p.x, p.y, POCKET_RADIUS - 1, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 220, 150, 0.15)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    ctx.restore();

    // Mitered wooden frame joinery lines at the 4 corners
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.lineWidth = 2;
    const miterCoords: Array<[number, number, number, number]> = [
      [14, 14, INNER_MIN - 4, INNER_MIN - 4],
      [BOARD_SIZE - 14, 14, INNER_MAX + 4, INNER_MIN - 4],
      [14, BOARD_SIZE - 14, INNER_MIN - 4, INNER_MAX + 4],
      [BOARD_SIZE - 14, BOARD_SIZE - 14, INNER_MAX + 4, INNER_MAX + 4],
    ];
    for (const [x1, y1, x2, y2] of miterCoords) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.restore();

    // Decorative brass studs on the 4 wooden rail midpoints
    const studOffsets = [
      [BOARD_CENTER, FRAME_THICKNESS * 0.45],
      [BOARD_CENTER, BOARD_SIZE - FRAME_THICKNESS * 0.45],
      [FRAME_THICKNESS * 0.45, BOARD_CENTER],
      [BOARD_SIZE - FRAME_THICKNESS * 0.45, BOARD_CENTER],
    ];
    for (const [sx, sy] of studOffsets) {
      ctx.beginPath();
      ctx.arc(sx, sy, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = theme.inlayGold;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(sx - 1, sy - 1, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.fill();
    }
  }

  private drawBoardMarkings(ctx: CanvasRenderingContext2D, theme: BoardTheme) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Center outer circle & 8-point traditional star mandala
    ctx.beginPath();
    ctx.arc(BOARD_CENTER, BOARD_CENTER, CENTER_CIRCLE_OUTER, 0, Math.PI * 2);
    ctx.strokeStyle = theme.lineInk;
    ctx.lineWidth = 2.2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(BOARD_CENTER, BOARD_CENTER, CENTER_CIRCLE_OUTER - 5, 0, Math.PI * 2);
    ctx.strokeStyle = theme.lineAccent;
    ctx.lineWidth = 1.3;
    ctx.stroke();

    // 8-point lotus/star motif inside center circle
    const petals = 8;
    for (let i = 0; i < petals; i++) {
      const a = (i * Math.PI * 2) / petals;
      const tipX = BOARD_CENTER + Math.cos(a) * (CENTER_CIRCLE_OUTER - 7);
      const tipY = BOARD_CENTER + Math.sin(a) * (CENTER_CIRCLE_OUTER - 7);
      const leftA = a - Math.PI / petals;
      const rightA = a + Math.PI / petals;
      const midR = CENTER_CIRCLE_INNER + 12;

      ctx.beginPath();
      ctx.moveTo(
        BOARD_CENTER + Math.cos(leftA) * midR,
        BOARD_CENTER + Math.sin(leftA) * midR
      );
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(
        BOARD_CENTER + Math.cos(rightA) * midR,
        BOARD_CENTER + Math.sin(rightA) * midR
      );
      ctx.closePath();
      ctx.fillStyle = i % 2 === 0 ? theme.lineAccent : theme.lineInk;
      ctx.globalAlpha = i % 2 === 0 ? 0.22 : 0.14;
      ctx.fill();
      ctx.globalAlpha = 0.72;
      ctx.strokeStyle = i % 2 === 0 ? theme.lineAccent : theme.lineInk;
      ctx.lineWidth = 1.1;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Center Queen dot
    ctx.beginPath();
    ctx.arc(BOARD_CENTER, BOARD_CENTER, CENTER_CIRCLE_INNER, 0, Math.PI * 2);
    ctx.fillStyle = theme.lineAccent;
    ctx.globalAlpha = 0.85;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(BOARD_CENTER, BOARD_CENTER, CENTER_CIRCLE_INNER - 4, 0, Math.PI * 2);
    ctx.strokeStyle = theme.inlayGold;
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // 4 Baselines (Top, Bottom, Left, Right)
    const drawBaseline = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      perpX: number,
      perpY: number
    ) => {
      const halfBand = BASELINE_CIRCLE_RADIUS;
      // Outer baseline line
      ctx.beginPath();
      ctx.moveTo(x1 + perpX * halfBand, y1 + perpY * halfBand);
      ctx.lineTo(x2 + perpX * halfBand, y2 + perpY * halfBand);
      ctx.strokeStyle = theme.lineInk;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Inner baseline line
      ctx.beginPath();
      ctx.moveTo(x1 - perpX * halfBand, y1 - perpY * halfBand);
      ctx.lineTo(x2 - perpX * halfBand, y2 - perpY * halfBand);
      ctx.strokeStyle = theme.lineInk;
      ctx.lineWidth = 1.3;
      ctx.stroke();

      // End circles
      for (const [cx, cy] of [
        [x1, y1],
        [x2, y2],
      ]) {
        ctx.beginPath();
        ctx.arc(cx, cy, BASELINE_CIRCLE_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = theme.surfaceBase;
        ctx.fill();
        ctx.strokeStyle = theme.lineInk;
        ctx.lineWidth = 1.8;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, BASELINE_CIRCLE_RADIUS - 4.5, 0, Math.PI * 2);
        ctx.fillStyle = theme.lineAccent;
        ctx.fill();
      }
    };

    // Bottom (P1), Top (P2), Left, Right baselines
    drawBaseline(BASELINE_MIN_X, BASELINE_P1_Y, BASELINE_MAX_X, BASELINE_P1_Y, 0, 1);
    drawBaseline(BASELINE_MIN_X, BASELINE_P2_Y, BASELINE_MAX_X, BASELINE_P2_Y, 0, -1);
    drawBaseline(BASELINE_P2_Y, BASELINE_MIN_X, BASELINE_P2_Y, BASELINE_MAX_X, -1, 0);
    drawBaseline(BASELINE_P1_Y, BASELINE_MIN_X, BASELINE_P1_Y, BASELINE_MAX_X, 1, 0);

    // 4 Diagonal Foul Arrows pointing toward pockets
    for (const p of POCKETS) {
      const dirX = p.x < BOARD_CENTER ? -1 : 1;
      const dirY = p.y < BOARD_CENTER ? -1 : 1;
      const startX = BOARD_CENTER + dirX * 104;
      const startY = BOARD_CENTER + dirY * 104;
      const endX = p.x - dirX * 48;
      const endY = p.y - dirY * 48;

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = theme.lineInk;
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // Decorative curved foul arc near pocket
      const arcCenterX = endX - dirX * 14;
      const arcCenterY = endY - dirY * 14;
      const baseAngle = Math.atan2(dirY, dirX);
      ctx.beginPath();
      ctx.arc(arcCenterX, arcCenterY, 26, baseAngle - 1.15, baseAngle + 1.15);
      ctx.strokeStyle = theme.lineInk;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Arrowheads at start & end of arc
      const tipAngle = Math.atan2(endY - startY, endX - startX);
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(
        endX - Math.cos(tipAngle - 0.4) * 11,
        endY - Math.sin(tipAngle - 0.4) * 11
      );
      ctx.moveTo(endX, endY);
      ctx.lineTo(
        endX - Math.cos(tipAngle + 0.4) * 11,
        endY - Math.sin(tipAngle + 0.4) * 11
      );
      ctx.strokeStyle = theme.lineAccent;
      ctx.lineWidth = 1.7;
      ctx.stroke();
    }

    ctx.restore();
  }

  public renderFrame(
    ctx: CanvasRenderingContext2D,
    canvasCssSize: number,
    dpr: number,
    theme: BoardTheme,
    strikerStyle: StrikerStyle,
    coinStyle: CoinStyle,
    coins: RenderCoin[],
    striker: { x: number; y: number; angle: number; visible: boolean },
    aim: AimOverlayState,
    aimGuide: AimGuideMode,
    pocketAnims: PocketAnim[],
    particles: PowderParticle[],
    hitFlash: number
  ) {
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvasCssSize, canvasCssSize);

    const scale = canvasCssSize / BOARD_SIZE;
    const boardImg = this.ensureBoardCache(theme, scale * dpr);

    // Draw cached wooden board
    ctx.drawImage(boardImg, 0, 0, canvasCssSize, canvasCssSize);

    // Scale into 800x800 logical coordinates
    ctx.scale(scale, scale);

    // Active baseline highlight rail when player is positioning
    if (aim.canShoot && !aim.isAI) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(BASELINE_MIN_X, aim.strikerY);
      ctx.lineTo(BASELINE_MAX_X, aim.strikerY);
      ctx.strokeStyle = theme.inlayGold;
      ctx.globalAlpha = 0.25;
      ctx.lineWidth = BASELINE_CIRCLE_RADIUS * 1.9;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();
    }

    // Draw pocket drop animations
    for (const anim of pocketAnims) {
      const ease = 1 - Math.pow(1 - anim.progress, 2);
      const x = anim.startX + (anim.pocketX - anim.startX) * ease;
      const y = anim.startY + (anim.pocketY - anim.startY) * ease;
      const s = Math.max(0.15, 1 - ease * 0.85);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(s, s);
      ctx.globalAlpha = Math.max(0, 1 - ease * 0.7);
      if (anim.type === 'striker') {
        this.drawStrikerShape(ctx, 0, 0, 0, strikerStyle);
      } else {
        this.drawCoinShape(ctx, 0, 0, 0, anim.type, coinStyle);
      }
      ctx.restore();
    }

    // Draw board coins
    for (const coin of coins) {
      this.drawCoinShape(ctx, coin.x, coin.y, coin.angle, coin.type, coinStyle);
    }

    // Draw aim trajectory & pull ring behind/around striker
    if (aim.active) {
      this.drawAimGuide(ctx, aim, aimGuide, coins);
    }

    // Draw striker
    if (striker.visible) {
      if (!aim.positionClear && aim.canShoot) {
        // Blocked overlap warning ring
        ctx.save();
        ctx.beginPath();
        ctx.arc(striker.x, striker.y, STRIKER_RADIUS + 6, 0, Math.PI * 2);
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.restore();
      } else if (aim.canShoot && !aim.active && !aim.isAI) {
        // Subtle ready halo
        ctx.save();
        ctx.beginPath();
        ctx.arc(striker.x, striker.y, STRIKER_RADIUS + 5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(212, 155, 53, 0.55)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }

      this.drawStrikerShape(ctx, striker.x, striker.y, striker.angle, strikerStyle);
    }

    // Draw powder particles
    for (const p of particles) {
      if (!p.active) continue;
      const alpha = Math.max(0, p.life / p.maxLife) * 0.55;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 248, 232, ${alpha.toFixed(3)})`;
      ctx.fill();
    }

    // Subtle impact flash border
    if (hitFlash > 0.01) {
      ctx.fillStyle = `rgba(255, 242, 200, ${(hitFlash * 0.06).toFixed(3)})`;
      ctx.fillRect(INNER_MIN, INNER_MIN, INNER_SIZE, INNER_SIZE);
    }

    ctx.restore();
  }

  private drawCoinShape(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    angle: number,
    type: Exclude<CoinType, 'striker'>,
    coinStyle: CoinStyle
  ) {
    ctx.save();
    ctx.translate(x, y);

    // Drop shadow
    ctx.beginPath();
    ctx.arc(1.8, 2.6, COIN_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
    ctx.fill();

    ctx.rotate(angle);

    // Coin body
    const grad = ctx.createRadialGradient(-4, -4, 2, 0, 0, COIN_RADIUS);
    const stops =
      type === 'white'
        ? coinStyle.whiteColors
        : type === 'black'
        ? coinStyle.blackColors
        : coinStyle.queenColors;
    grad.addColorStop(0, stops[0]);
    grad.addColorStop(0.68, stops[1]);
    grad.addColorStop(1, stops[2]);

    ctx.beginPath();
    ctx.arc(0, 0, COIN_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Outer edge bevel
    ctx.strokeStyle =
      type === 'white'
        ? coinStyle.whiteStroke
        : type === 'black'
        ? coinStyle.blackStroke
        : coinStyle.queenStroke;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Carved concentric tournament ridges
    ctx.beginPath();
    ctx.arc(0, 0, COIN_RADIUS * 0.68, 0, Math.PI * 2);
    ctx.strokeStyle =
      type === 'white'
        ? coinStyle.whiteRidge
        : type === 'black'
        ? coinStyle.blackRidge
        : coinStyle.queenRidge;
    ctx.lineWidth = 1.1;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, COIN_RADIUS * 0.36, 0, Math.PI * 2);
    ctx.stroke();

    if (type === 'queen') {
      ctx.beginPath();
      ctx.arc(0, 0, 2.8, 0, Math.PI * 2);
      ctx.fillStyle = coinStyle.queenGem;
      ctx.fill();
    }

    ctx.restore();
  }

  private drawStrikerShape(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    angle: number,
    style: StrikerStyle
  ) {
    ctx.save();
    ctx.translate(x, y);

    // Shadow
    ctx.beginPath();
    ctx.arc(2.4, 3.4, STRIKER_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
    ctx.fill();

    ctx.rotate(angle);

    // Disc base
    const grad = ctx.createRadialGradient(-5, -5, 3, 0, 0, STRIKER_RADIUS);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.18, style.bodyColor);
    grad.addColorStop(1, style.bodyColor);

    ctx.beginPath();
    ctx.arc(0, 0, STRIKER_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = style.bodyColor;
    ctx.fill();

    // Specular sheen
    ctx.beginPath();
    ctx.arc(0, 0, STRIKER_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.globalAlpha = 0.35;
    ctx.fill();
    ctx.globalAlpha = 1;

    // Outer rim ring
    ctx.beginPath();
    ctx.arc(0, 0, STRIKER_RADIUS - 1.5, 0, Math.PI * 2);
    ctx.strokeStyle = style.rimColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Pattern engraving
    ctx.strokeStyle = style.accentColor;
    ctx.fillStyle = style.accentColor;

    if (style.pattern === 'rings') {
      ctx.beginPath();
      ctx.arc(0, 0, STRIKER_RADIUS * 0.62, 0, Math.PI * 2);
      ctx.lineWidth = 1.6;
      ctx.stroke();
    } else if (style.pattern === 'compass') {
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 4, Math.sin(a) * 4);
        ctx.lineTo(Math.cos(a) * (STRIKER_RADIUS * 0.72), Math.sin(a) * (STRIKER_RADIUS * 0.72));
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    } else if (style.pattern === 'lotus') {
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 8.5, Math.sin(a) * 8.5, 4.2, 0, Math.PI * 2);
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    } else if (style.pattern === 'star') {
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const r = i % 2 === 0 ? STRIKER_RADIUS * 0.7 : STRIKER_RADIUS * 0.34;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.lineWidth = 1.4;
      ctx.stroke();
    } else {
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.arc(0, 0, STRIKER_RADIUS * 0.65, a - 0.35, a + 0.35);
        ctx.lineWidth = 2.4;
        ctx.stroke();
      }
    }

    // Center core
    ctx.beginPath();
    ctx.arc(0, 0, STRIKER_RADIUS * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = style.coreColor;
    ctx.fill();

    ctx.restore();
  }

  private drawAimGuide(
    ctx: CanvasRenderingContext2D,
    aim: AimOverlayState,
    guideMode: AimGuideMode,
    coins: RenderCoin[]
  ) {
    const { strikerX, strikerY, angle, powerRatio } = aim;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);

    const powerColor =
      powerRatio <= 0.04
        ? '#94a3b8'
        : powerRatio < 0.45
        ? '#e5b84b'
        : powerRatio < 0.8
        ? '#f59e0b'
        : '#ef4444';

    ctx.save();

    // 1. Cancel-zone inner ring & radial shot power meter arc around striker
    const meterRadius = STRIKER_RADIUS + 14;
    ctx.beginPath();
    ctx.arc(strikerX, strikerY, meterRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 4;
    ctx.stroke();

    if (powerRatio > 0.04) {
      ctx.beginPath();
      ctx.arc(
        strikerX,
        strikerY,
        meterRadius,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * powerRatio
      );
      ctx.strokeStyle = powerColor;
      ctx.lineWidth = 4.5;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // Outer tension ring & pull-handle vector indicator behind striker
    const pullRadius = STRIKER_RADIUS + 16 + powerRatio * 52;
    ctx.beginPath();
    ctx.arc(strikerX, strikerY, pullRadius, 0, Math.PI * 2);
    ctx.strokeStyle = powerColor;
    ctx.globalAlpha = 0.28;
    ctx.lineWidth = 2;
    ctx.stroke();

    const pullX = strikerX - dx * pullRadius;
    const pullY = strikerY - dy * pullRadius;
    ctx.beginPath();
    ctx.moveTo(strikerX, strikerY);
    ctx.lineTo(pullX, pullY);
    ctx.strokeStyle = powerColor;
    ctx.globalAlpha = 0.88;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(pullX, pullY, 7.5, 0, Math.PI * 2);
    ctx.fillStyle = powerColor;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(pullX, pullY, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#fff9eb';
    ctx.fill();

    // 2. Forward aim ray, directional arrowhead & ghost collision preview
    if (guideMode !== 'off' && powerRatio > 0.04) {
      const maxRay = guideMode === 'full' ? 660 : 195;
      let hitDist = maxRay;
      let hitCoin: RenderCoin | null = null;
      let hitWallNormalX = 0;
      let hitWallNormalY = 0;

      const minBound = INNER_MIN + STRIKER_RADIUS;
      const maxBound = INNER_MAX - STRIKER_RADIUS;
      if (dx > 1e-5) {
        const d = (maxBound - strikerX) / dx;
        if (d < hitDist) {
          hitDist = d;
          hitWallNormalX = -1;
          hitWallNormalY = 0;
        }
      } else if (dx < -1e-5) {
        const d = (minBound - strikerX) / dx;
        if (d < hitDist) {
          hitDist = d;
          hitWallNormalX = 1;
          hitWallNormalY = 0;
        }
      }
      if (dy > 1e-5) {
        const d = (maxBound - strikerY) / dy;
        if (d < hitDist) {
          hitDist = d;
          hitWallNormalX = 0;
          hitWallNormalY = -1;
        }
      } else if (dy < -1e-5) {
        const d = (minBound - strikerY) / dy;
        if (d < hitDist) {
          hitDist = d;
          hitWallNormalX = 0;
          hitWallNormalY = 1;
        }
      }

      if (guideMode === 'full') {
        const combinedR = STRIKER_RADIUS + COIN_RADIUS;
        for (const coin of coins) {
          const ocX = coin.x - strikerX;
          const ocY = coin.y - strikerY;
          const proj = ocX * dx + ocY * dy;
          if (proj <= 0) continue;
          const perpSq = ocX * ocX + ocY * ocY - proj * proj;
          if (perpSq >= combinedR * combinedR) continue;
          const thc = Math.sqrt(combinedR * combinedR - perpSq);
          const t = proj - thc;
          if (t > 0 && t < hitDist) {
            hitDist = t;
            hitCoin = coin;
            hitWallNormalX = 0;
            hitWallNormalY = 0;
          }
        }
      }

      const endX = strikerX + dx * hitDist;
      const endY = strikerY + dy * hitDist;

      ctx.beginPath();
      ctx.setLineDash([7, 7]);
      ctx.moveTo(
        strikerX + dx * (STRIKER_RADIUS + 4),
        strikerY + dy * (STRIKER_RADIUS + 4)
      );
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = 'rgba(255, 250, 232, 0.88)';
      ctx.lineWidth = 2.4;
      ctx.stroke();

      // Clear directional arrowhead near the tip of the aim ray
      ctx.setLineDash([]);
      if (hitDist > STRIKER_RADIUS + 24) {
        const tipX = strikerX + dx * Math.min(hitDist - 4, 96);
        const tipY = strikerY + dy * Math.min(hitDist - 4, 96);
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(
          tipX - Math.cos(angle - 0.45) * 11,
          tipY - Math.sin(angle - 0.45) * 11
        );
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(
          tipX - Math.cos(angle + 0.45) * 11,
          tipY - Math.sin(angle + 0.45) * 11
        );
        ctx.strokeStyle = powerColor;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      if (guideMode === 'full') {
        ctx.beginPath();
        ctx.arc(endX, endY, STRIKER_RADIUS * 0.86, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 250, 232, 0.58)';
        ctx.lineWidth = 1.6;
        ctx.stroke();

        if (hitCoin) {
          const nx = hitCoin.x - endX;
          const ny = hitCoin.y - endY;
          const nLen = Math.hypot(nx, ny) || 1;
          ctx.beginPath();
          ctx.moveTo(hitCoin.x, hitCoin.y);
          ctx.lineTo(hitCoin.x + (nx / nLen) * 62, hitCoin.y + (ny / nLen) * 62);
          ctx.strokeStyle = 'rgba(245, 180, 65, 0.85)';
          ctx.lineWidth = 2.2;
          ctx.stroke();
        } else if (hitWallNormalX !== 0 || hitWallNormalY !== 0) {
          // Short cushion rebound hint
          const dot = dx * hitWallNormalX + dy * hitWallNormalY;
          const rdx = dx - 2 * dot * hitWallNormalX;
          const rdy = dy - 2 * dot * hitWallNormalY;
          ctx.beginPath();
          ctx.setLineDash([4, 5]);
          ctx.moveTo(endX, endY);
          ctx.lineTo(endX + rdx * 54, endY + rdy * 54);
          ctx.strokeStyle = 'rgba(255, 238, 190, 0.55)';
          ctx.lineWidth = 1.8;
          ctx.stroke();
        }
      }
    }

    ctx.restore();
  }
}
