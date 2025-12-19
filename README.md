# OBS Animation Suite

A collection of Lua scripts for OBS Studio that add smooth animations to sources.

## Features

| Script | Description |
|--------|-------------|
| **Source Animations** | Fade, slide, zoom, pop effects on visibility toggle |
| **Source Swap** | Swap position and size of two sources with animation |
| **Text Cycler** | Cycle text with animated transitions (obfuscate, typewriter, glitch) |
| **Quick Controls** | Hotkey to cycle aspect override mode |
| **Control Panel** | Web-based UI to control everything |

## Requirements

- OBS Studio 28+ (includes WebSocket support)
- No additional plugins needed

## Installation

1. Download all `.lua` files to a folder
2. In OBS: **Tools → Scripts**
3. Click **+** and add each `.lua` file
4. Configure as needed

## Scripts

### Source Animations (v2.7)

Animates sources when their visibility is toggled.

**Animation Types:**
- Fade - opacity transition
- Slide - move from direction
- Zoom - scale in/out
- Pop - bouncy scale

**Configuration:**
- Open script settings in OBS
- Set default animation type, duration, easing
- Add per-source overrides if needed

### Source Swap (v3.1)

Swap position and size between two sources with smooth animation.

**Features:**
- Unlimited swap configurations
- Per-config hotkeys
- Temporary aspect override
- Works with grouped sources

**Configuration:**
1. Open script settings
2. Add swap configs (name + two sources)
3. Assign hotkeys in Settings → Hotkeys

**Aspect Override:**
- Off: Uses default setting
- Preserve: Maintains aspect ratio (SCALE_INNER)
- Stretch: Fills exactly (may distort)

### Text Cycler (v1.0)

Cycle through text strings on a text source with animated transitions.

**Transitions:**
- None - instant switch
- Obfuscate - Minecraft enchantment table scramble effect
- Typewriter - types out character by character
- Glitch - random glitch characters that settle
- Scramble - full scramble then snap
- Wave - characters appear in a wave pattern

**Configuration:**
1. Select a text source
2. Enter text lines (one per line)
3. Set duration per text and transition type
4. Click "Start Cycling"

### Quick Controls (v1.0)

Provides hotkeys for quick actions.

**Hotkeys (assign in Settings → Hotkeys):**
- `Quick: Cycle Aspect Override` - cycles Off → Preserve → Stretch

## Control Panel

Open `control_panel.html` in any browser for a web-based control panel.

**Setup:**
1. Enable WebSocket in OBS: Tools → WebSocket Server Settings
2. Note port (default 4455) and password
3. Open control_panel.html
4. Enter connection details and connect

**Features:**
- Dashboard with script status
- Trigger swap configs
- Toggle aspect override
- Activity log

**Keyboard Shortcuts (when panel is focused):**
- `1-9` - Trigger swap configs 1-9
- `a` - Cycle aspect override

## File Structure

```
source-fade-script-plugin/
├── source_animations.lua   # Visibility animations
├── source_swap.lua         # Source swapping
├── quick_controls.lua      # Hotkey utilities
├── script_manager.lua      # Status dashboard (OBS script)
├── control_panel.html      # Web control panel
├── animations.json         # Legacy config (optional)
└── README.md
```

## Troubleshooting

**Animations not playing:**
- First visibility toggle caches state, second triggers animation
- Check "Animate on SHOW/HIDE" is enabled
- Click "Refresh Sources" in script settings

**Swap not working:**
- Both sources must be in current scene
- Source names are case-sensitive
- Check script log for errors

**Control panel won't connect:**
- Enable WebSocket in OBS (Tools → WebSocket Server Settings)
- Check port and password match
- Must use OBS 28 or newer

## Version History

### Source Animations
- v2.7 - Config changes reset filter state properly
- v2.6 - Fixed hide flicker with faster polling
- v2.5 - Persistent opacity filter approach

### Source Swap
- v3.1 - Temporary aspect override in settings
- v3.0 - Simplified to local coordinates
- v2.8 - Fixed grouped source sizing

### Text Cycler
- v1.0 - Initial release with 6 transition types

## License

MIT License - feel free to use and modify.
