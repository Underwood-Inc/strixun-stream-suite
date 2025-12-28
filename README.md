# [EMOJI] Strixun's Stream Suite

<div align="center">

![Version](https://img.shields.io/badge/version-1.3.0-blue?style=for-the-badge&logo=github)
![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)
![OBS Studio](https://img.shields.io/badge/OBS%20Studio-28%2B-orange?style=for-the-badge&logo=obsstudio)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey?style=for-the-badge)

**A comprehensive OBS Studio production toolkit for professional streaming**

*Source animations, layout presets, text cycling, and Twitch integration - all in one powerful suite*

[[DEPLOY] Quick Start](#-quick-start) • [[EMOJI] Documentation](#-documentation) • [[BUG] Issues](https://github.com/Underwood-Inc/strixun-stream-suite/issues) • [[CHAT] Discussions](https://github.com/Underwood-Inc/strixun-stream-suite/discussions)

</div>

---

## [FEATURE] What Is This?

**Strixun's Stream Suite** is a professional streaming toolkit that helps content creators automate and enhance their live streams. It provides:

- [EMOJI] **Source Animations** - Smooth fade, slide, zoom, and pop effects
- [SYNC] **Source Swaps** - Animated position swapping between sources
- [EMOJI] **Layout Presets** - Save and apply entire scene layouts instantly
- [NOTE] **Text Cycler** - Cycle text with animated transitions
- [EMOJI] **Twitch Clips Player** - Auto-play clips during BRB screens
- [CONTROL] **Unified Control Panel** - One dock to control everything

---

## [DEPLOY] Quick Start

### For GitHub Pages Users (Recommended)

If you're viewing this on GitHub, the easiest way to use Strixun Stream Suite is via GitHub Pages:

#### Step 1: Navigate to GitHub Pages URL

Simply open your browser and go to:

```
https://underwood-inc.github.io/strixun-stream-suite
```

> **Note:** If you've forked this repository, your URL will be `https://YOUR-USERNAME.github.io/strixun-stream-suite`

#### Step 2: Add to OBS Studio as a Dock

1. Open **OBS Studio**
2. Go to **View [EMOJI] Docks [EMOJI] Custom Browser Docks**
3. Click **"+"** to add a new dock
4. Enter a name (e.g., "Stream Suite")
5. Paste your GitHub Pages URL: `https://underwood-inc.github.io/strixun-stream-suite`
6. Click **OK**

#### Step 3: Connect to OBS

The control panel will automatically attempt to connect to OBS via WebSocket. Make sure:

- OBS Studio is running
- WebSocket Server is enabled in **OBS [EMOJI] Tools [EMOJI] WebSocket Server Settings**
- Default port is **4455** (or configure custom port)

#### Step 4: Install Scripts (First Time Only)

1. In the control panel dock, click the **[EMOJI] Install** tab
2. Follow the installation wizard
3. Restart OBS Studio when prompted
4. Configure your scripts in the **[EMOJI] Scripts** tab

---

## [MOBILE] What You'll See

### Initial Setup Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Strixun's Stream Suite - Control Panel                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Connection Status                                     │ │
│  │  [!] Not Connected                                     │ │
│  │  Connecting to OBS WebSocket (localhost:4455)...       │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Installer Tab                                         │ │
│  │                                                        │ │
│  │  Welcome! Let's get you set up:                        │ │
│  │                                                        │ │
│  │  [1] Generate Install Script                           │ │
│  │  [2] Run Script (Windows/Mac/Linux)                    │ │
│  │  [3] Restart OBS                                       │ │
│  │  [4] Configure Scripts                                 │ │
│  │                                                        │ │
│  │  [> Start Installation]                                │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### After Installation - Main Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│  Strixun's Stream Suite v1.3.0                              │
├─────────────────────────────────────────────────────────────┤
│  Dashboard  Sources  Text  Swaps  Layouts                   │
│  Scripts   Install   Setup                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [OK] Connected to OBS (localhost:4455)                     │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Quick Actions                                         │ │
│  │                                                        │ │
│  │  [Animate Source]  [Swap Sources]                      │ │
│  │  [Apply Layout]    [Cycle Text]                        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Script Status                                         │ │
│  │                                                        │ │
│  │  [OK] Source Animations (v2.8.1)                       │ │
│  │  [OK] Source Swap (v3.1.0)                             │ │
│  │  [OK] Source Layouts (v1.0.0)                          │ │
│  │  [OK] Text Cycler (v1.0.0)                             │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Adding a Dock in OBS Studio (Visual Guide)

```
┌─────────────────────────────────────────────────────────────┐
│  OBS Studio                                                 │
├─────────────────────────────────────────────────────────────┤
│  File  Edit  View  Docks  Tools  Help                       │
│                                                             │
│  View [EMOJI] Docks [EMOJI] Custom Browser Docks [EMOJI] [+]                  │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Add Custom Browser Dock                               │ │
│  ├────────────────────────────────────────────────────────┤ │
│  │  Dock Name: [Stream Suite                  ]           │ │
│  │                                                        │ │
│  │  URL:                                                  │ │
│  │  ┌───────────────────────────────────────────────────┐ │ │
│  │  │ https://underwood-inc.github.io/                  │ │ │
│  │  │ strixun-stream-suite                              │ │ │
│  │  └───────────────────────────────────────────────────┘ │ │
│  │                                                        │ │
│  │  [  Cancel  ]  [  OK  ]                                │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Control Panel Tabs Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Tab Navigation                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Dashboard  ->  Quick access to common actions              │
│  Sources    ->  Configure source visibility animations      │
│  Text       ->  Set up text cycler configurations           │
│  Swaps      ->  Create source swap presets                  │
│  Layouts    ->  Save and apply layout presets               │
│  Scripts    ->  View script status and manage               │
│  Install    ->  Installation wizard (first time)            │
│  Setup      ->  Connection and storage settings             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## [TARGET] Features

| Feature | Description |
|---------|-------------|
| **[EMOJI] Source Animations** | Fade, slide, zoom, pop effects on visibility toggle |
| **[SYNC] Source Swap** | Swap position and size of two sources with animation |
| **[EMOJI] Source Layouts** | Save and apply layout presets with multi-source animation |
| **[NOTE] Text Cycler** | Cycle text with animated transitions (obfuscate, typewriter, glitch, wave) |
| **[PERF] Quick Controls** | Hotkey to cycle aspect override mode |
| **[EMOJI] Script Manager** | Unified dashboard for all animation scripts |
| **[CONTROL] Control Panel** | Web-based dock UI to control everything |
| **[EMOJI] Twitch Clips Player** | Auto-play Twitch clips with chat command support |
| **[UI] Scrollbar Customizer** | Free CDN-hosted tool to customize scrollbars on any website |

---

## [CLIPBOARD] Requirements

- **OBS Studio 28+** (includes WebSocket support)
- **No additional plugins needed** - works out of the box!

---

## [CONFIG] Manual Installation (Alternative)

If you prefer to install scripts manually:

1. **Download/Clone** this repository
2. **Copy all `.lua` files** to your OBS scripts folder:
   - **Windows:** `%AppData%\obs-studio\basic\scripts\`
   - **macOS:** `~/Library/Application Support/obs-studio/basic/scripts/`
   - **Linux:** `~/.config/obs-studio/basic/scripts/`
3. **In OBS:** `Tools [EMOJI] Scripts [EMOJI] + [EMOJI] Select all .lua files`
4. **Add the control panel** as a Custom Browser Dock (use local file path or GitHub Pages URL)

---

## [EMOJI] Documentation

Comprehensive documentation is available in the [`docs/`](./docs/) directory:

### [EMOJI] For Everyone
- **[Product Overview](./docs/PRODUCT_OVERVIEW.md)** - Understand what Strixun Stream Suite does (non-technical)
- **[Scrollbar Customizer](./serverless/SCROLLBAR_CUSTOMIZER.md)** - Free CDN tool to customize scrollbars on any website (super beginner-friendly!)

### [CONFIG] For Developers
- **[Technical Architecture](./docs/TECHNICAL_ARCHITECTURE.md)** - Complete system architecture
- **[API Reference](./docs/API_REFERENCE.md)** - Complete API documentation
- **[Deployment Guide](./docs/DEPLOYMENT.md)** - CI/CD workflows and deployment

#### Development Scripts

Run all build and check scripts across all projects to verify everything compiles correctly:

```bash
pnpm check:all
```

This script runs:
- Root project: TypeScript checks, linting, and build
- Control Panel: TypeScript build and linting
- Mods Hub: TypeScript build and linting
- OTP Login: All build variants (vanilla, React, Svelte)
- OTP Auth Service: Svelte checks and build
- OTP Auth Dashboard: Svelte checks and build
- OTP Auth SDK: TypeScript build
- URL Shortener App: Vite build

See [docs/README.md](./docs/README.md) for a complete documentation index.

---

## [BUG] Troubleshooting

**Scripts not appearing in OBS?**
- Ensure `.lua` files are in the correct scripts folder
- Restart OBS after adding scripts
- Check `Tools [EMOJI] Scripts` for error messages

**Control panel not connecting?**
- Verify OBS WebSocket Server is enabled (`Tools [EMOJI] WebSocket Server Settings`)
- Check that port 4455 is not blocked by firewall
- Try restarting OBS Studio

**Animations not playing?**
- First visibility toggle caches state, second triggers animation
- Check "Animate on SHOW/HIDE" is enabled in script settings
- Click "Refresh Sources" in script settings

**Sources drifting out of position?**
- Click "[TARGET] Recapture Home Positions" in source_animations settings
- This resets the canonical transform cache

---

## [EMOJI] Version History

### Control Panel
- **v1.3.0** - Current version
- **v3.0.0** - Multi-layer storage system (IndexedDB + localStorage + Recovery)
- **v2.0.0** - Added installer wizard, script manager, Twitch clips integration

### Scripts
- **Source Animations v2.8.1** - Fixed position drift with canonical transforms
- **Source Swap v3.1.0** - Temporary aspect override in settings
- **Source Layouts v1.0.0** - Save and apply layout presets

---

## [FILE] License

MIT License - feel free to use and modify.

---

---

<div align="center">

**Made with [EMOJI][EMOJI] for the streaming community**

[[EMOJI] Star this repo](https://github.com/Underwood-Inc/strixun-stream-suite) • [[BUG] Report Bug](https://github.com/Underwood-Inc/strixun-stream-suite/issues) • [[IDEA] Request Feature](https://github.com/Underwood-Inc/strixun-stream-suite/issues)

</div>
