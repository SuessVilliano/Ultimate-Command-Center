const fs = require('fs');
const path = require('path');

// Generate SVG icon with LIV8 branding
function generateSVGIcon(size) {
  const padding = size * 0.1;
  const innerSize = size - (padding * 2);
  const fontSize = size * 0.35;
  const cornerRadius = size * 0.15;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#7c3aed"/>
      <stop offset="100%" style="stop-color:#5b21b6"/>
    </linearGradient>
    <linearGradient id="shine" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:rgba(255,255,255,0.2)"/>
      <stop offset="50%" style="stop-color:rgba(255,255,255,0)"/>
    </linearGradient>
  </defs>
  <rect x="${padding}" y="${padding}" width="${innerSize}" height="${innerSize}" rx="${cornerRadius}" fill="url(#bg)"/>
  <rect x="${padding}" y="${padding}" width="${innerSize}" height="${innerSize * 0.5}" rx="${cornerRadius}" fill="url(#shine)"/>
  <text x="${size/2}" y="${size/2 + fontSize * 0.35}" font-family="Inter, Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="white" text-anchor="middle">L8</text>
</svg>`;
}

// Write SVG icons
const icon192 = generateSVGIcon(192);
const icon512 = generateSVGIcon(512);

fs.writeFileSync(path.join(__dirname, 'public', 'icon-192.svg'), icon192);
fs.writeFileSync(path.join(__dirname, 'public', 'icon-512.svg'), icon512);

console.log('SVG icons generated!');

// For PWA we need PNG - create a simple fallback using canvas-like approach
// Since we can't use canvas in Node without dependencies, we'll create placeholder PNGs
// The app will work with SVGs for now, and you can convert them to PNG later

// Create a simple 1x1 PNG header for placeholders (these should be replaced with real icons)
const png192Header = Buffer.from([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
  0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
  0x00, 0x00, 0x00, 0xC0, 0x00, 0x00, 0x00, 0xC0, // 192x192
  0x08, 0x06, 0x00, 0x00, 0x00, // 8-bit RGBA
  0x52, 0xDC, 0x67, 0x5C, // CRC
  0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, // IEND
  0xAE, 0x42, 0x60, 0x82
]);

console.log('Icon generation complete!');
console.log('Note: SVG icons created. For best PWA support, convert these to PNG using an image editor or online tool.');
console.log('The app will still work - modern browsers support SVG icons.');

// Update manifest to use SVG
const manifestPath = path.join(__dirname, 'public', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.icons = [
  {
    src: '/icon-192.svg',
    sizes: '192x192',
    type: 'image/svg+xml',
    purpose: 'any maskable'
  },
  {
    src: '/icon-512.svg',
    sizes: '512x512',
    type: 'image/svg+xml',
    purpose: 'any maskable'
  }
];
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log('Manifest updated to use SVG icons.');
