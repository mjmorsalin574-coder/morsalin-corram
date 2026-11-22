import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const combined = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(combined), 0);
  return Buffer.concat([len, combined, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

function clamp(v, min = 0, max = 255) {
  return Math.max(min, Math.min(max, Math.round(v)));
}

function blendPixel(buf, idx, r, g, b, a = 1) {
  const alpha = Math.max(0, Math.min(1, a));
  if (alpha <= 0) return;
  const inv = 1 - alpha;
  buf[idx] = clamp(buf[idx] * inv + r * alpha);
  buf[idx + 1] = clamp(buf[idx + 1] * inv + g * alpha);
  buf[idx + 2] = clamp(buf[idx + 2] * inv + b * alpha);
  buf[idx + 3] = 255;
}

function drawCarromIcon(size, safeMarginRatio = 0.08) {
  const buf = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const boardHalf = size * (0.5 - safeMarginRatio);
  const outerRadius = boardHalf * 0.22;
  const frameWidth = boardHalf * 0.16;
  const innerHalf = boardHalf - frameWidth;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      // Rich mahogany backdrop
      const bgGrad = (y / size) * 14;
      buf[idx] = clamp(24 - bgGrad * 0.4);
      buf[idx + 1] = clamp(14 - bgGrad * 0.3);
      buf[idx + 2] = clamp(10 - bgGrad * 0.2);
      buf[idx + 3] = 255;

      const dx = Math.abs(x + 0.5 - cx);
      const dy = Math.abs(y + 0.5 - cy);

      // Signed distance to rounded outer board
      const qx = Math.max(dx - (boardHalf - outerRadius), 0);
      const qy = Math.max(dy - (boardHalf - outerRadius), 0);
      const outerDist = Math.hypot(qx, qy) + Math.min(Math.max(dx - (boardHalf - outerRadius), dy - (boardHalf - outerRadius)), 0) - outerRadius;

      if (outerDist <= 1.2) {
        const edgeAlpha = Math.max(0, Math.min(1, 1.2 - outerDist));
        // Rosewood frame with subtle grain
        const grain = Math.sin((x + y * 0.35) * 0.18) * 6;
        blendPixel(buf, idx, 72 + grain, 31 + grain * 0.5, 20 + grain * 0.4, edgeAlpha);

        // Inner playing surface
        if (dx <= innerHalf && dy <= innerHalf) {
          const woodNoise = Math.sin(x * 0.22) * 3 + Math.cos(y * 0.08) * 2;
          blendPixel(buf, idx, 241 + woodNoise, 223 + woodNoise, 184 + woodNoise, 1);

          // Corner pockets
          const pocketOffset = innerHalf * 0.82;
          const pocketR = innerHalf * 0.12;
          const pd = Math.hypot(dx - pocketOffset, dy - pocketOffset);
          if (pd < pocketR + 3) {
            if (pd < pocketR) {
              blendPixel(buf, idx, 18, 12, 10, 1);
            } else {
              blendPixel(buf, idx, 194, 146, 56, Math.max(0, Math.min(1, (pocketR + 3 - pd) / 2)));
            }
          }

          // Center decorative circle
          const distCenter = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
          const mandalaR = innerHalf * 0.44;
          if (Math.abs(distCenter - mandalaR) < size * 0.008) {
            blendPixel(buf, idx, 178, 42, 42, 0.85);
          }
          if (Math.abs(distCenter - mandalaR * 0.72) < size * 0.005) {
            blendPixel(buf, idx, 42, 34, 28, 0.65);
          }

          // Central Red Queen
          const queenR = innerHalf * 0.145;
          if (distCenter <= queenR + 1) {
            const qa = Math.max(0, Math.min(1, queenR + 1 - distCenter));
            const shade = (1 - distCenter / queenR) * 26;
            blendPixel(buf, idx, 202 + shade, 36 + shade * 0.3, 42 + shade * 0.3, qa);
            if (Math.abs(distCenter - queenR * 0.64) < size * 0.006) {
              blendPixel(buf, idx, 246, 206, 124, 0.75 * qa);
            }
          }

          // Flanking Ivory White & Ebony Black Coins
          const coinOffset = queenR * 2.15;
          const coinR = queenR * 0.92;
          const wDist = Math.hypot(x + 0.5 - (cx - coinOffset), y + 0.5 - (cy + coinOffset * 0.55));
          if (wDist <= coinR + 1) {
            const wa = Math.max(0, Math.min(1, coinR + 1 - wDist));
            blendPixel(buf, idx, 249, 242, 224, wa);
            if (Math.abs(wDist - coinR * 0.58) < size * 0.006) {
              blendPixel(buf, idx, 198, 174, 130, 0.8 * wa);
            }
          }

          const bDist = Math.hypot(x + 0.5 - (cx + coinOffset), y + 0.5 - (cy - coinOffset * 0.55));
          if (bDist <= coinR + 1) {
            const ba = Math.max(0, Math.min(1, coinR + 1 - bDist));
            blendPixel(buf, idx, 34, 31, 32, ba);
            if (Math.abs(bDist - coinR * 0.58) < size * 0.006) {
              blendPixel(buf, idx, 110, 96, 86, 0.75 * ba);
            }
          }

          // Foreground Carved Striker at bottom baseline
          const sy = cy + innerHalf * 0.58;
          const sx = cx;
          const sDist = Math.hypot(x + 0.5 - sx, y + 0.5 - sy);
          const strikerR = innerHalf * 0.19;
          if (sDist <= strikerR + 1.2) {
            const sa = Math.max(0, Math.min(1, strikerR + 1.2 - sDist));
            blendPixel(buf, idx, 250, 238, 206, sa);
            if (Math.abs(sDist - strikerR * 0.78) < size * 0.01) {
              blendPixel(buf, idx, 206, 148, 44, sa);
            }
            if (sDist <= strikerR * 0.34) {
              blendPixel(buf, idx, 190, 42, 42, sa);
            }
          }
        } else if (dx <= innerHalf + size * 0.008 && dy <= innerHalf + size * 0.008) {
          // Brass inlay trim
          blendPixel(buf, idx, 196, 150, 62, 0.9);
        }
      }
    }
  }
  return buf;
}

function drawSplash(width, height) {
  const buf = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const dx = (x - width / 2) / (width / 2);
      const dy = (y - height / 2) / (height / 2);
      const rad = Math.hypot(dx, dy);
      const glow = Math.max(0, 1 - rad * 0.85);
      buf[idx] = clamp(18 + glow * 26);
      buf[idx + 1] = clamp(11 + glow * 14);
      buf[idx + 2] = clamp(7 + glow * 9);
      buf[idx + 3] = 255;
    }
  }

  const iconSize = Math.min(width, height) * 0.42;
  const iconPng = drawCarromIcon(Math.round(iconSize), 0.06);
  const startX = Math.round((width - iconSize) / 2);
  const startY = Math.round((height - iconSize) / 2);
  const iSize = Math.round(iconSize);

  for (let y = 0; y < iSize; y++) {
    for (let x = 0; x < iSize; x++) {
      const srcIdx = (y * iSize + x) * 4;
      const dstIdx = ((startY + y) * width + (startX + x)) * 4;
      buf[dstIdx] = iconPng[srcIdx];
      buf[dstIdx + 1] = iconPng[srcIdx + 1];
      buf[dstIdx + 2] = iconPng[srcIdx + 2];
      buf[dstIdx + 3] = 255;
    }
  }
  return buf;
}

fs.mkdirSync('public', { recursive: true });
fs.mkdirSync('resources', { recursive: true });

const targets = [
  { file: 'public/pwa-192x192.png', size: 192, margin: 0.07 },
  { file: 'public/pwa-512x512.png', size: 512, margin: 0.07 },
  { file: 'public/pwa-maskable-512x512.png', size: 512, margin: 0.16 }, // 16% safe zone margin
  { file: 'public/apple-touch-icon.png', size: 180, margin: 0.07 },
  { file: 'resources/icon.png', size: 512, margin: 0.08 },
];

for (const t of targets) {
  const rgba = drawCarromIcon(t.size, t.margin);
  fs.writeFileSync(t.file, encodePNG(t.size, t.size, rgba));
  console.log(`Generated ${t.file} (${t.size}x${t.size})`);
}

const splashSize = 1024;
const splashRgba = drawSplash(splashSize, splashSize);
fs.writeFileSync('resources/splash.png', encodePNG(splashSize, splashSize, splashRgba));
console.log('Generated resources/splash.png (1024x1024)');
