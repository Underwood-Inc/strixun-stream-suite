# strixun's script suite [SSS]

An OBS Animation Suite for source-level animation(s)  

A comprehensive suite of Lua scripts and browser sources for OBS Studio that provides smooth, professional animations for sources, text cycling with effects, and integrated Twitch clip playback.

## Features

| Script | Description |
|--------|-------------|
| **Source Animations** | Fade, slide, zoom, pop effects on visibility toggle |
| **Source Swap** | Swap position and size of two sources with animation |
| **Text Cycler** | Cycle text with animated transitions (obfuscate, typewriter, glitch, wave) |
| **Quick Controls** | Hotkey to cycle aspect override mode |
| **Script Manager** | Unified dashboard for all animation scripts |
| **Control Panel** | Web-based dock UI to control everything |
| **Twitch Clips Player** | Auto-play Twitch clips with chat command support |

## Requirements

- OBS Studio 28+ (includes WebSocket support)
- No additional plugins needed

## File Inventory

```
OBS-Animation-Suite/
│
├── 📜 Lua Scripts (install to OBS scripts folder)
│   ├── source_animations.lua   - Visibility animations (v2.8.0)
│   ├── source_swap.lua         - Position swap animations (v3.1.0)
│   ├── text_cycler.lua         - Text cycling effects (v1.0.0)
│   ├── quick_controls.lua      - Hotkey controls (v1.0.0)
│   └── script_manager.lua      - Script dashboard (v1.0.0)
│
├── 🌐 Browser Sources (keep in suite folder)
│   ├── control_panel.html       - Main dock / control panel
│   └── text_cycler_display.html - Animated text browser source
│
├── 🎬 Twitch Clips Player (keep in suite folder)
│   └── twitch_clips_player/
│       ├── clips.html           - Browser source for clips
│       ├── index.html           - Configuration page
│       └── assets/              - CSS, JS, images
│
├── ⚙️ Config
│   └── animations.json          - Animation configurations
│
└── 📖 README.md
```

## Installation

### Quick Start

1. Download/clone the suite to a folder on your computer
2. In OBS: **View → Docks → Custom Browser Docks**
3. Add a dock with URL: `file:///C:/path/to/suite/control_panel.html`
4. Use the **📥 Installer** tab in the dock to install scripts

### Installation Flow

```
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  Download Suite  │───▶│  Add Dock to OBS │───▶│  Open Installer  │
│  (zip/git clone) │    │  (Custom Dock)   │    │  (📥 Tab)        │
└──────────────────┘    └──────────────────┘    └──────────────────┘
                                                         │
                                                         ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  Configure in    │◀───│  Add Scripts to  │◀───│  Run Install     │
│  Tools → Scripts │    │  OBS (Tools →    │    │  Script          │
└──────────────────┘    │  Scripts)        │    └──────────────────┘
         │              └──────────────────┘
         ▼
┌──────────────────┐
│  Use Control     │
│  Panel Dock!     │
│  🎉 Done!        │
└──────────────────┘
```

### Using the Installer Wizard

The control panel includes a built-in installer wizard (📥 tab):

```
┌─────────────────────────────────────────────────────────────────┐
│  📥 Installation Wizard                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Step 1: Configure Paths                                        │
│  ───────────────────────                                        │
│  Source Files: [Auto-detected from dock URL]                    │
│  OBS Scripts:  [C:\Users\You\AppData\...\obs-studio\scripts]    │
│                                                                 │
│  ✓ Supports custom install locations                            │
│  ✓ Auto-detects common OBS paths                                │
│  ✓ Click suggestions or type your own path                      │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Step 2: Select Scripts                                         │
│  ───────────────────────                                        │
│  ☑ Source Animations (v2.8.0)                        [New]      │
│  ☑ Source Swap (v3.1.0)                              [New]      │
│  ☑ Text Cycler (v1.0.0)                              [New]      │
│  ☑ Quick Controls (v1.0.0)                           [New]      │
│  ☑ Script Manager (v1.0.0)                           [New]      │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Step 3: Review & Generate                                      │
│  ─────────────────────────                                      │
│  Installation Method: [PowerShell ▼] [Batch] [Bash] [Manual]    │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Step 4: Run Installation                                       │
│  ────────────────────────                                       │
│  1. Download the generated script                               │
│  2. Right-click → Run as Administrator                          │
│  3. Restart OBS Studio                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Manual Installation

If you prefer to skip the wizard:

1. Copy all `.lua` files to your OBS scripts folder:
   - **Windows:** `%AppData%\obs-studio\basic\scripts\`
   - **macOS:** `~/Library/Application Support/obs-studio/basic/scripts/`
   - **Linux:** `~/.config/obs-studio/basic/scripts/`

2. In OBS: **Tools → Scripts → + → Select all .lua files**

3. Add the control panel as a Custom Browser Dock

### Existing Installation Detection

The installer wizard can detect if you already have scripts installed:

- **Skip** - Don't overwrite existing files
- **Backup** - Create `.backup` copies before replacing
- **Replace** - Overwrite with new versions

---

## Scripts

### Source Animations (v2.8.0)

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

**New in v2.8.0:**
- Fixed position drift bug with canonical transforms
- Sources now reliably return to their "home" position
- Added "Recapture Home Positions" button

### Source Swap (v3.1.0)

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

### Text Cycler (v1.0.0)

Cycle through text strings with animated transitions.

**Transitions:**
- None - instant switch
- Obfuscate - Minecraft enchantment table scramble effect
- Typewriter - types out character by character
- Glitch - random glitch characters that settle
- Scramble - full scramble then snap
- Wave - characters appear in a wave pattern
- Fade - smooth opacity transition
- Slide - text slides in/out
- Pop - bouncy appearance

**Two Modes:**

1. **Legacy Mode** - Updates OBS text sources directly (limited effects)
2. **Browser Mode** - Uses `text_cycler_display.html` for smooth CSS animations

**Browser Source Setup:**
```
URL: file:///C:/path/to/suite/text_cycler_display.html
Width: 1920 (or your stream width)
Height: 200 (adjust as needed)
```

### Quick Controls (v1.0.0)

Provides hotkeys for quick actions.

**Hotkeys (assign in Settings → Hotkeys):**
- `Quick: Cycle Aspect Override` - cycles Off → Preserve → Stretch

### Script Manager (v1.0.0)

Dashboard showing status of all animation scripts in OBS.

---

## Control Panel (Dock)

The main interface for controlling the entire suite.

### Setup

```
┌─────────────────────────────────────────────────────────────────┐
│  OBS Studio                                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Go to:  View  →  Docks  →  Custom Browser Docks             │
│                                                                 │
│  2. Add a new dock:                                             │
│     ┌─────────────────────────────────────────────────────────┐ │
│     │  Dock Name: Animation Suite                             │ │
│     │  URL: file:///C:/Users/You/OBS Animation Suite/         │ │
│     │       control_panel.html                                │ │
│     └─────────────────────────────────────────────────────────┘ │
│                                                                 │
│  3. Click Apply - the dock appears!                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Tabs

| Tab | Description |
|-----|-------------|
| 🔌 Connection | WebSocket connection to OBS |
| 🔄 Swap | Trigger source swap configs |
| 📝 Text | Text cycler with multiple configs |
| 🎬 Clips | Twitch clips player management |
| 📋 Scripts | Script overview and quick reference |
| 📥 Installer | Installation wizard |

### OBS Dock Limitations

OBS docks use an embedded browser that cannot open external URLs. The control panel handles this by:
- Copying URLs to clipboard when clicked
- Showing helpful messages about pasting in your browser
- Providing manual copy buttons for all URLs

---

## Twitch Clips Player

Auto-play Twitch clips during BRB/Starting screens.

### Setup

1. Open the **🎬 Clips** tab in the control panel
2. Create a new config with your channel name
3. Configure options (limit, date range, theme)
4. Copy the generated browser source URL
5. Add as a Browser Source in OBS

### Browser Source URL

```
file:///C:/path/to/suite/twitch_clips_player/clips.html
    ?channel=YourChannel&limit=25&theme=theme1
```

### Features

- Multiple configs for different scenes
- Date range filtering (today, week, month, year, all)
- Theme selection
- Chat command support (requires Twitch auth)
- Custom CSS support

### Twitch Authentication

For "Show Following" and chat commands, you need a Twitch access token:

1. Click "Get Access Token from Twitch" in the Clips tab
2. URL will be copied to clipboard (OBS dock limitation)
3. Paste in your browser and authorize
4. Copy the token back to the control panel

---

## Troubleshooting

**Scripts not appearing in OBS?**
- Ensure `.lua` files are in the correct scripts folder
- Restart OBS after adding scripts
- Check **Tools → Scripts** for error messages

**Animations not playing?**
- First visibility toggle caches state, second triggers animation
- Check "Animate on SHOW/HIDE" is enabled
- Click "Refresh Sources" in script settings

**Sources drifting out of position?**
- Click "🎯 Recapture Home Positions" in source_animations settings
- This resets the canonical transform cache

**Swap not working?**
- Both sources must be in current scene
- Source names are case-sensitive
- Check script log for errors

**Control panel not loading?**
- Verify the `file:///` URL path is correct
- Use forward slashes in the URL, not backslashes
- Ensure the HTML file exists at that location

**Control panel won't connect via WebSocket?**
- Enable WebSocket in OBS (Tools → WebSocket Server Settings)
- Check port and password match
- Must use OBS 28 or newer

**External links not opening?**
- OBS docks cannot open external browsers
- URLs are copied to clipboard automatically
- Paste in your browser manually

---

## Version History

### Source Animations
- v2.8.0 - Fixed position drift with canonical transforms
- v2.7.0 - Config changes reset filter state properly
- v2.6.0 - Fixed hide flicker with faster polling
- v2.5.0 - Persistent opacity filter approach

### Source Swap
- v3.1.0 - Temporary aspect override in settings
- v3.0.0 - Simplified to local coordinates
- v2.8.0 - Fixed grouped source sizing

### Text Cycler
- v1.0.0 - Initial release with browser mode and 9 transition types

### Control Panel
- v2.0.0 - Added installer wizard, script manager, Twitch clips integration
- v1.0.0 - Initial release with swap controls and text cycler

---

## License

MIT License - feel free to use and modify.
