const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function makeCRCTable() {
  const table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c;
  }
  return table;
}

const crcTable = makeCRCTable();

function crc32(buf) {
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = crc32(body);
  const chunk = Buffer.alloc(4 + 4 + len + 4);
  chunk.writeUInt32BE(len, 0);
  typeBuf.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

function createPNG(width, height, getPixel) {
  const rowSize = 1 + width * 4;
  const raw = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    raw[rowOffset] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixel(x, y, width, height);
      const pxOffset = rowOffset + 1 + x * 4;
      raw[pxOffset] = r;
      raw[pxOffset + 1] = g;
      raw[pxOffset + 2] = b;
      raw[pxOffset + 3] = a;
    }
  }
  const compressed = zlib.deflateSync(raw);
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdrChunk = makeChunk('IHDR', ihdrData);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));
  
  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

// Distance to rounded rectangle
function sdRoundRect(x, y, cx, cy, w, h, r) {
  const dx = Math.abs(x - cx) - (w / 2 - r);
  const dy = Math.abs(y - cy) - (h / 2 - r);
  const ax = Math.max(dx, 0);
  const ay = Math.max(dy, 0);
  const outside = Math.sqrt(ax * ax + ay * ay);
  const inside = Math.min(Math.max(dx, dy), 0);
  return outside + inside - r;
}

// Distance to point in 2D triangle
function pointInTriangle(px, py, x1, y1, x2, y2, x3, y3) {
  const d1 = (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2);
  const d2 = (px - x3) * (y2 - y3) - (x2 - x3) * (py - y3);
  const d3 = (px - x1) * (y3 - y1) - (x3 - x1) * (py - y1);
  const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
  const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
  return !(hasNeg && hasPos);
}

function renderLassuIcon(isMaskable) {
  return function(x, y, w, h) {
    const nx = x / w;
    const ny = y / h;
    const cx = w / 2;
    const cy = h / 2;
    
    // Background
    let bgR = 10, bgG = 10, bgB = 10;
    if (isMaskable) {
      // Solid dark background for maskable safe-zone compliance
      bgR = 8; bgG = 8; bgB = 8;
    }

    // Outer rounded card
    const cardDist = sdRoundRect(x, y, cx, cy, w * 0.92, h * 0.92, w * 0.22);
    if (!isMaskable && cardDist > 0) {
      return [0, 0, 0, 0]; // Transparent outside card
    }

    // Scale factors relative to width
    const plateW = w * 0.52;
    const plateH = h * 0.40;
    const plateR = w * 0.10;
    const plateDist = sdRoundRect(x, y, cx, cy, plateW, plateH, plateR);

    // Play triangle points
    const triX1 = cx - plateW * 0.16;
    const triY1 = cy - plateH * 0.28;
    const triX2 = cx + plateW * 0.24;
    const triY2 = cy;
    const triX3 = cx - plateW * 0.16;
    const triY3 = cy + plateH * 0.28;
    const inTri = pointInTriangle(x, y, triX1, triY1, triX2, triY2, triX3, triY3);

    if (inTri) {
      return [255, 255, 255, 255]; // Crisp white play icon
    }

    if (plateDist <= 0) {
      // YouTube Red gradient
      const grad = Math.min(Math.max((y - (cy - plateH/2)) / plateH, 0), 1);
      const r = Math.round(255 - grad * 35);
      const g = Math.round(30 - grad * 20);
      const b = Math.round(30 - grad * 20);
      return [r, g, b, 255];
    }

    // Background body gradient
    const gradY = ny;
    const r = Math.round(bgR + (1 - gradY) * 12);
    const g = Math.round(bgG + (1 - gradY) * 2);
    const b = Math.round(bgB + (1 - gradY) * 2);
    return [r, g, b, 255];
  };
}

const outDir = path.join(__dirname, '../public');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Generate PWA Icons
console.log('Generating PWA Icons...');
fs.writeFileSync(path.join(outDir, 'pwa-192x192.png'), createPNG(192, 192, renderLassuIcon(false)));
fs.writeFileSync(path.join(outDir, 'pwa-512x512.png'), createPNG(512, 512, renderLassuIcon(false)));
fs.writeFileSync(path.join(outDir, 'pwa-maskable-512x512.png'), createPNG(512, 512, renderLassuIcon(true)));
fs.writeFileSync(path.join(outDir, 'apple-touch-icon.png'), createPNG(180, 180, renderLassuIcon(false)));
fs.writeFileSync(path.join(outDir, 'favicon.ico'), createPNG(64, 64, renderLassuIcon(false)));
console.log('PWA Icons generated successfully in public/');
