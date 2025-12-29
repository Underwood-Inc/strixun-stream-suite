/**
 * Generate PWA Icons from SVG
 * 
 * Converts the icon-source.svg to all required PNG sizes for PWA
 */

import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const publicDir = join(rootDir, 'public');
const svgPath = join(publicDir, 'icon-source.svg');

// Icon sizes needed for PWA
const iconSizes = [
  { name: 'pwa-64x64.png', size: 64 },
  { name: 'pwa-192x192.png', size: 192 },
  { name: 'pwa-512x512.png', size: 512 },
  { name: 'maskable-icon-512x512.png', size: 512, maskable: true },
  { name: 'apple-touch-icon.png', size: 180 }
];

// For maskable icons, we need to add padding (safe zone is 20% of icon size)
// So the actual icon content should be 80% of the size, centered
async function createMaskableIcon(svgBuffer, size) {
  const padding = size * 0.2; // 20% padding
  const contentSize = size - (padding * 2);
  
  // Resize the SVG to fit in the safe zone (80% of total size)
  const resizedSvg = await sharp(svgBuffer)
    .resize(Math.round(contentSize), Math.round(contentSize), {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer();
  
  // Create a canvas with padding and composite the resized icon in the center
  return await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
    }
  })
  .composite([
    {
      input: resizedSvg,
      top: Math.round(padding),
      left: Math.round(padding),
    }
  ])
  .png()
  .toBuffer();
}

async function generateIcons() {
  try {
    console.log('🎨 Generating PWA icons from SVG...\n');
    
    // Read the SVG file
    const svgBuffer = readFileSync(svgPath);
    
    for (const icon of iconSizes) {
      const outputPath = join(publicDir, icon.name);
      
      if (icon.maskable) {
        // Generate maskable icon with padding
        const maskableBuffer = await createMaskableIcon(svgBuffer, icon.size);
        await sharp(maskableBuffer).png().toFile(outputPath);
        console.log(`✅ Generated ${icon.name} (${icon.size}x${icon.size} with safe zone)`);
      } else {
        // Generate regular icon
        await sharp(svgBuffer)
          .resize(icon.size, icon.size, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 }
          })
          .png()
          .toFile(outputPath);
        console.log(`✅ Generated ${icon.name} (${icon.size}x${icon.size})`);
      }
    }
    
    // Generate favicon.ico (32x32)
    const faviconPath = join(publicDir, 'favicon.ico');
    await sharp(svgBuffer)
      .resize(32, 32, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(faviconPath);
    console.log(`✅ Generated favicon.ico (32x32)\n`);
    
    console.log('❓ All PWA icons generated successfully!');
    console.log('📁 Icons are in the public/ directory\n');
    
  } catch (error) {
    console.error('❌ Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();
