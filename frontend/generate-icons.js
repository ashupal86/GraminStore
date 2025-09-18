// Simple icon generator using Canvas API (for development purposes)
// For production, use proper tools like sharp or imagemagick

const fs = require('fs');
const path = require('path');

// Create a simple base64 PNG icon data
const createSimpleIcon = (size) => {
  // A simple base64 encoded PNG icon representing "GS"
  const canvas = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" rx="${size * 0.14}" fill="url(#gradient)"/>
      <text x="${size/2}" y="${size*0.65}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${size*0.35}" font-weight="bold" fill="white">GS</text>
      <defs>
        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#1e293b;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#64748b;stop-opacity:1" />
        </linearGradient>
      </defs>
    </svg>
  `;
  
  // Convert SVG to base64 for browser compatibility
  const base64 = Buffer.from(canvas).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
};

// Icon sizes needed for PWA
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Create icons directory if it doesn't exist
const iconsDir = path.join(__dirname, 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// For now, just copy the SVG as different named files
// In production, you would convert these to PNG
sizes.forEach(size => {
  const svgContent = `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${size * 0.14}" fill="url(#gradient)"/>
  <text x="${size/2}" y="${size*0.65}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${size*0.35}" font-weight="bold" fill="white">GS</text>
  <defs>
    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1e293b;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#64748b;stop-opacity:1" />
    </linearGradient>
  </defs>
</svg>`;
  
  fs.writeFileSync(path.join(iconsDir, `icon-${size}x${size}.png`), svgContent);
});

console.log('Icons generated successfully!');

// Also create calculator and dashboard icons
const calculatorIcon = `
<svg width="96" height="96" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">
  <rect width="96" height="96" rx="13" fill="#1e293b"/>
  <text x="48" y="62" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="white">🧮</text>
</svg>`;

const dashboardIcon = `
<svg width="96" height="96" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">
  <rect width="96" height="96" rx="13" fill="#1e293b"/>
  <text x="48" y="62" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="white">📊</text>
</svg>`;

fs.writeFileSync(path.join(iconsDir, 'calculator-96x96.png'), calculatorIcon);
fs.writeFileSync(path.join(iconsDir, 'dashboard-96x96.png'), dashboardIcon);
