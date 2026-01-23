# Lua Scripts Location

All OBS Lua scripts live in this `public/` folder.

## Why Here?

- ✅ **Single source of truth** - No duplication
- ✅ **Auto-served in production** - Vite includes `public/` in builds
- ✅ **Download buttons work** - Scripts accessible at root URL
- ✅ **No build scripts needed** - No copying, no syncing, no maintenance

## Scripts

- `source_animations.lua` (v2.8.2) - Source visibility animations
- `source_swap.lua` (v3.2.0) - Animated source swaps
- `source_opacity.lua` (v1.0.0) - Opacity control
- `source_layouts.lua` (v1.0.0) - Layout presets
- `text_cycler.lua` (v1.0.0) - Text cycling
- `quick_controls.lua` (v1.0.0) - Quick hotkeys
- `script_manager.lua` (v1.0.0) - Script dashboard

## Updating Scripts

1. Edit the `.lua` file directly in this folder
2. Test in dev
3. Build & deploy
4. Download buttons automatically serve the latest version

No copying, no syncing, just edit and deploy! 🔥
