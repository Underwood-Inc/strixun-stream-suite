# How to Update Your OBS Lua Scripts

## 🚀 Quick Update Guide

When new Lua script versions are released, follow these steps to update:

### Step 1: Check Your Current Versions

In OBS Studio:
1. Go to `Tools` → `Scripts`
2. Click on each script in the list
3. Look at the version number in the description (top of the properties panel)

Current latest versions:
- **Source Animation System:** v2.8.2
- **Source Swap:** v3.2.0
- **Source Opacity Control:** v1.0.0
- **Source Layouts:** v1.0.0
- **Text Cycler:** v1.0.0
- **Quick Controls:** v1.0.0

### Step 2: Get the Latest Scripts

**Option A: Download from Web UI (Easiest)**
1. Open your Stream Suite Control Panel
2. Go to the **Scripts** tab
3. Click **💾 Download** button next to each script you want
4. Save to a location you'll remember (like `C:\OBS-Scripts\`)

**Option B: Manual Copy from Project Folder**

The Lua scripts are in your project's `public/` folder:
```
C:\Users\mamop\Documents\source fade script plugin\public\
```

**Files to update:**
- `source_animations.lua`
- `source_swap.lua`
- `source_opacity.lua`
- `source_layouts.lua`
- `text_cycler.lua`
- `quick_controls.lua`

### Step 3: Update in OBS

For each script that needs updating:

1. **In OBS Scripts panel:**
   - Click the script name in the list
   - Click the `-` (minus) button to remove it
   - Click the `+` (plus) button to add a new script
   - Browse to the project folder
   - Select the `.lua` file
   - Click `Open`

2. **Verify the update:**
   - The new version number should show in the description
   - Check that your settings are preserved (they should be)
   - Test the script functionality

### Step 4: Reconfigure if Needed

Most updates preserve your settings, but for major changes:
- **Source Animation System:** May need to click "Recapture Home Positions" button
- **Source Swap:** May need to reassign hotkeys if configs changed

## 🔥 Recent Critical Updates

### v2.8.2 - Source Animation System (2026-01-23)
**CRITICAL BUG FIX:** Sources no longer instantly pop when showing (not visible → visible)

**What was broken:**
- Source would appear at full opacity for 1 frame before animating
- Fade-in animations didn't work properly

**What's fixed:**
- Smooth fade-in from 0% to 100%
- Proper animation sequencing

**Action:** UPDATE IMMEDIATELY if you use show animations!

### v3.2.0 - Source Swap (2026-01-23)
**UI/UX IMPROVEMENT:** Streamlined interface, 40% less space

**What changed:**
- Removed redundant EDIT and REMOVE sections
- Inline delete buttons per config
- Better visual hierarchy

**Action:** Update for better experience (not critical)

## 🤖 Future: Auto-Update System

We're planning to add:
- Version check on web UI startup
- Notification when updates are available
- One-click update button (copies scripts to OBS folder)
- Automatic backup of old scripts

## 💡 Pro Tips

### Keep Scripts Organized
Create a dedicated folder for OBS scripts:
```
C:\OBS-Scripts\
├── source_animations.lua
├── source_swap.lua
└── ...
```

Then always load from this folder so updates are easy.

### Backup Your Settings
Before major updates:
1. Export your OBS scenes (File → Export)
2. Note down your script settings
3. Take screenshots of configurations

### Test After Updates
After updating scripts:
1. Test visibility animations
2. Test source swaps
3. Check that hotkeys still work
4. Verify no console errors

## ❓ Troubleshooting

**Script won't load after update:**
- Check OBS log (Help → Log Files)
- Remove and re-add the script
- Restart OBS

**Settings lost after update:**
- Settings are stored in OBS profile, not the script
- If lost, use "Recapture Home Positions" button
- Re-assign hotkeys in Settings → Hotkeys

**Old behavior still happening:**
- OBS might be caching the old script
- Restart OBS completely
- Check version number in script description

---

**Need Help?** Check the full documentation in `LUA_SCRIPT_VERSIONS.md`
