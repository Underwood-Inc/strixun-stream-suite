# PWA Icon Generation Guide

This directory contains the source SVG icon for generating PWA icons. The PWA setup requires several PNG icon sizes.

## Required Icons

The following icons need to be generated from `icon-source.svg`:

1. **favicon.ico** - 32x32 (or multi-size ICO file)
2. **apple-touch-icon.png** - 180x180 PNG
3. **pwa-64x64.png** - 64x64 PNG
4. **pwa-192x192.png** - 192x192 PNG
5. **pwa-512x512.png** - 512x512 PNG
6. **maskable-icon-512x512.png** - 512x512 PNG (with safe zone padding for maskable icons)

## Generating Icons

### Option 1: Using Online Tools

1. Use [PWA Asset Generator](https://github.com/onderceylan/pwa-asset-generator) or [RealFaviconGenerator](https://realfavicongenerator.net/)
2. Upload `icon-source.svg`
3. Download the generated icons
4. Place them in the `public/` directory

### Option 2: Using ImageMagick (Command Line)

```bash
# Install ImageMagick first, then:

# Generate PNG icons
convert -background none -resize 64x64 icon-source.svg pwa-64x64.png
convert -background none -resize 192x192 icon-source.svg pwa-192x192.png
convert -background none -resize 512x512 icon-source.svg pwa-512x512.png
convert -background none -resize 180x180 icon-source.svg apple-touch-icon.png

# For maskable icon, add padding (safe zone should be 20% of icon size)
convert -background none -resize 360x360 icon-source.svg temp.png
convert -size 512x512 xc:transparent -gravity center temp.png -composite maskable-icon-512x512.png
rm temp.png

# Generate favicon.ico
convert -background none -resize 32x32 icon-source.svg favicon.ico
```

### Option 3: Using Node.js Script

You can use packages like `sharp` or `jimp` to programmatically generate icons from the SVG.

## Current Status

The PWA is configured and will work once the PNG icons are generated. The SVG source file (`icon-source.svg`) is provided as a starting point.

## Testing PWA

1. Build the app: `pnpm build`
2. Serve the dist folder: `pnpm preview`
3. Open Chrome DevTools > Application > Manifest to verify
4. Check "Add to Home Screen" functionality
5. Test offline functionality

## Notes

- The `mask-icon.svg` is already provided and used for Safari pinned tabs
- Icons should have transparent backgrounds where appropriate
- Maskable icons need a safe zone (20% padding) to work correctly on Android
