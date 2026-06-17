/**
 * Generates build/icon.png (1024x1024) for the macOS app — no external deps.
 * Brand: purple gradient rounded square with a subtle top shine.
 * electron-builder turns this into the .icns automatically.
 *
 * Run: node electron/make-icon.cjs
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZE = 1024;
const RADIUS = 230; // rounded corners

// Brand colors
const TOP = { r: 0x7c, g: 0x3a, b: 0xed };   // #7c3aed
const BOT = { r: 0x4c, g: 0x1d, b: 0x95 };   // #4c1d95

function lerp(a, b, t) { return Math.round(a + (b - a) * t); }

// Distance helper for rounded-corner anti-aliased alpha.
function cornerAlpha(x, y) {
  const r = RADIUS;
  // Centers of the four corner arcs
  const cx = x < r ? r : (x > SIZE - r ? SIZE - r : x);
  const cy = y < r ? r : (y > SIZE - r ? SIZE - r : y);
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist <= r - 1) return 1;
  if (dist >= r + 1) return 0;
  return r + 1 - dist; // 1px feather
}

// ---- "L8" brand mark, drawn with geometric primitives (no font needed) ----
const TOP_Y = 302, BOT_Y = 722;     // glyph vertical extent
const T = 80;                        // stroke thickness
// "L"
const Lx = 262, Lw = 196;            // left x, foot width
// "8"
const E_cx = 644;                    // center x of the 8
const rTop = 104, rBot = 126;        // top/bottom lobe radii
const cyTop = TOP_Y + rTop;          // top lobe center y
const cyBot = BOT_Y - rBot;          // bottom lobe center y
const ring = 38;                     // half ring thickness for the 8

function smooth(edgeDist) {
  // edgeDist > 0 inside, with ~1px feather
  if (edgeDist >= 1) return 1;
  if (edgeDist <= 0) return 0;
  return edgeDist;
}

// Coverage (0..1) of the white "L8" at a pixel.
function glyphAlpha(x, y) {
  let cov = 0;

  // L vertical bar
  if (y >= TOP_Y && y <= BOT_Y) {
    const d = Math.min(x - Lx, Lx + T - x, BOT_Y - y + 999, y - TOP_Y + 999);
    cov = Math.max(cov, smooth(Math.min(x - Lx, Lx + T - x)));
  }
  // L foot
  if (x >= Lx && x <= Lx + Lw && y >= BOT_Y - T && y <= BOT_Y) {
    cov = Math.max(cov, smooth(Math.min(x - Lx, Lx + Lw - x, y - (BOT_Y - T), BOT_Y - y)));
  }

  // 8 — two rings
  const dTop = Math.abs(Math.sqrt((x - E_cx) ** 2 + (y - cyTop) ** 2) - rTop);
  if (dTop <= ring) cov = Math.max(cov, smooth(ring - dTop));
  const dBot = Math.abs(Math.sqrt((x - E_cx) ** 2 + (y - cyBot) ** 2) - rBot);
  if (dBot <= ring) cov = Math.max(cov, smooth(ring - dBot));

  return Math.max(0, Math.min(1, cov));
}

// Build raw RGBA scanlines with PNG filter byte (0) per row.
const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
let p = 0;
for (let y = 0; y < SIZE; y++) {
  raw[p++] = 0; // filter: none
  for (let x = 0; x < SIZE; x++) {
    const t = (x + y) / (2 * SIZE); // diagonal gradient
    let r = lerp(TOP.r, BOT.r, t);
    let g = lerp(TOP.g, BOT.g, t);
    let b = lerp(TOP.b, BOT.b, t);

    // Top shine: lighten upper portion subtly.
    if (y < SIZE * 0.5) {
      const s = (1 - y / (SIZE * 0.5)) * 0.18;
      r = Math.min(255, Math.round(r + (255 - r) * s));
      g = Math.min(255, Math.round(g + (255 - g) * s));
      b = Math.min(255, Math.round(b + (255 - b) * s));
    }

    // Overlay the white "L8" mark.
    const gw = glyphAlpha(x + 0.5, y + 0.5);
    if (gw > 0) {
      r = Math.round(r + (255 - r) * gw);
      g = Math.round(g + (255 - g) * gw);
      b = Math.round(b + (255 - b) * gw);
    }

    const a = Math.round(255 * cornerAlpha(x + 0.5, y + 0.5));
    raw[p++] = r; raw[p++] = g; raw[p++] = b; raw[p++] = a;
  }
}

// --- Minimal PNG encoder ---------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8;   // bit depth
ihdr[9] = 6;   // color type RGBA
ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const idat = zlib.deflateSync(raw, { level: 9 });

const png = Buffer.concat([
  sig,
  chunk('IHDR', ihdr),
  chunk('IDAT', idat),
  chunk('IEND', Buffer.alloc(0)),
]);

const outDir = path.join(__dirname, '..', 'build');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'icon.png');
fs.writeFileSync(outPath, png);
console.log(`Wrote ${outPath} (${png.length} bytes, ${SIZE}x${SIZE})`);
