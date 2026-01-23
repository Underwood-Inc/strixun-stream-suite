# OBS Lua Script Versions

## Current Versions

| Script | Version | Last Updated | Status |
|--------|---------|--------------|--------|
| `source_animations.lua` | 2.8.2 | 2026-01-23 | ✅ Fixed instant pop bug |
| `source_swap.lua` | 3.2.0 | 2026-01-23 | ✅ Streamlined UI |
| `source_opacity.lua` | 1.0.0 | Initial | ✅ Stable |
| `source_layouts.lua` | 1.0.0 | Initial | ✅ Stable |
| `text_cycler.lua` | 1.0.0 | Initial | ✅ Stable |
| `quick_controls.lua` | 1.0.0 | Initial | ✅ Stable |

## How to Update Scripts

### Method 1: Download from Web UI (Easiest)

1. **Download Latest Scripts**
   - Open Stream Suite Control Panel
   - Go to **Scripts** tab
   - Click **💾 Download** button for each script
   - Save to your preferred location

2. **Update in OBS**
   - Open OBS Studio
   - Go to `Tools` → `Scripts`
   - For each script:
     - Click the script name
     - Click `-` (Remove)
     - Click `+` (Add)
     - Browse to the new `.lua` file
     - Click `Open`

3. **Verify Versions**
   - Check the script description in OBS
   - Version number is displayed at the top

### Method 2: Auto-Update (Future)

We're working on an auto-update mechanism that will:
- Check script versions on startup
- Notify you of available updates
- One-click update via web UI

## Breaking Changes

### v2.8.2 (source_animations.lua)
- **FIX:** Sources no longer instantly pop when showing (not visible → visible)
- **FIX:** Proper visibility animation now works correctly
- **ACTION:** Update recommended for smooth animations

### v3.2.0 (source_swap.lua)
- **IMPROVEMENT:** Removed redundant EDIT and REMOVE sections
- **IMPROVEMENT:** Inline delete buttons per config
- **IMPROVEMENT:** 40% less vertical space
- **ACTION:** Update for better UX

## Changelog

### 2026-01-23
- `source_animations.lua` → v2.8.2 (Fixed visibility pop bug)
- `source_swap.lua` → v3.2.0 (UI/UX overhaul)

## Script Locations

All Lua scripts are located in the `public/` folder:
```
c:\Users\mamop\Documents\source fade script plugin\public\
├── source_animations.lua    (v2.8.2)
├── source_swap.lua           (v3.2.0)
├── source_opacity.lua        (v1.0.0)
├── source_layouts.lua        (v1.0.0)
├── text_cycler.lua          (v1.0.0)
└── quick_controls.lua       (v1.0.0)
```

## Future Enhancements

- [ ] Version checking API endpoint
- [ ] In-app update notifications
- [ ] One-click script reload
- [ ] Auto-detection of outdated scripts
- [ ] Script marketplace/repository

---

**Last Updated:** 2026-01-23  
**Maintainer:** Strixun Stream Suite Team
