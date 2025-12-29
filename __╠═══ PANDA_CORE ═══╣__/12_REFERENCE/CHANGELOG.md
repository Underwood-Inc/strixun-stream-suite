# Changelog

All notable changes to Strixun Stream Suite will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.1.0 (2025-12-21)

### Added

- **Source Layout Presets** - NEW! Save and apply layout presets with smooth multi-source animations
  - `source_layouts.lua` - Lua script with full capture/apply/hotkey support
  - Capture ALL source positions, sizes, visibility states in one click
  - Apply saved layouts with smooth eased animations
  - Stagger animation support for cinematic transitions
  - Smart source diffing (handles missing/new sources gracefully)
  - Scene-specific layout filtering
  - Hotkey support (1-9) for quick layout switching
  - Full export/import/backup integration
  - New "❓ Layouts" tab in Control Panel

### Changed

- Script Manager updated to v1.3 - now includes Source Layouts
- Source Animations updated to v2.8.0 - improved compatibility
- Control Panel - added layouts to export/import system
- Storage system - layouts included in auto-recovery snapshots

## 1.0.0

### Added

- **Source Swap**: Smooth animated transitions between OBS sources with customizable easing
- **Source Animations**: Fade in/out effects for any source with configurable durations
- **Text Cycler**: Automated text rotation for GDI+ text sources
- **Quick Controls**: Streamlined hotkey and quick-action system
- **Script Manager**: Centralized management for all suite scripts
- **Control Panel**: Unified web-based control interface as OBS dock
- **Twitch Clips Player**: Integrated clip playback with chat commands
- **Dual Storage System**: IndexedDB + localStorage for reliable OBS dock persistence
- **Import/Export**: Full configuration backup and restore with category selection
- **Auto-Recovery**: Automatic snapshots to protect against data loss
