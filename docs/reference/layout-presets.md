# Layout Presets System - Technical Specification

> **Status**: [SUCCESS] Implemented  
> **Version**: 1.0.0  
> **Last Updated**: 2025-12-21

---

## Table of Contents

1. [Overview](#overview)
2. [Current Codebase Audit](#current-codebase-audit)
3. [Architecture](#architecture)
4. [Data Structures](#data-structures)
5. [Implementation Plan](#implementation-plan)
6. [API Reference](#api-reference)
7. [UI Specifications](#ui-specifications)

---

## Overview

### What is the Layout Presets System?

The Layout Presets System allows streamers to:

1. **Save** the current positions, sizes, and visibility states of ALL sources in a scene as a named "layout preset"
2. **Apply** saved layouts with smooth animations transitioning sources from their current positions to the preset positions
3. **Track** which sources exist/are missing when applying layouts
4. **Switch** between layouts via hotkeys or the control panel

### Use Cases

- **Scene Variants**: Same scene, different arrangements (e.g., "Full Gameplay", "Gameplay + Chat", "Just Chatting")
- **Dynamic Layouts**: Quickly swap between camera positions during a stream
- **Show Segments**: Different layouts for intro, main content, outro
- **A/B Testing**: Compare different layouts easily

---

## Current Codebase Audit

### Existing Assets

| Component | File | Version | Relevant Features |
|-----------|------|---------|-------------------|
| Source Animations | `source_animations.lua` | v2.8.0 | `canonical_transforms{}`, easing functions, visibility monitoring |
| Source Swap | `source_swap.lua` | v3.1.0 | `capture_transform()`, animation engine, group support |
| Source Opacity | `source_opacity.lua` | v1.0.0 | Filter management for opacity |
| Control Panel | `control_panel.html` | v3.0 | WebSocket API, `getTransform()`, `setTransform()`, animation functions |
| Storage System | `assets/js/storage.js` | v1.0.0 | IndexedDB + localStorage persistence |

### Transform Data Available

**From Lua (`source_swap.lua` [EMOJI] `capture_transform()`):**

```lua
{
    local_x, local_y,           -- Position relative to parent/scene
    local_w, local_h,           -- Size (bounds or calculated)
    screen_x, screen_y,         -- Absolute screen position
    screen_w, screen_h,         -- Visual size on canvas
    scale_x, scale_y,           -- Scale factors
    bounds_x, bounds_y,         -- Bounds dimensions
    bounds_type,                -- OBS_BOUNDS_NONE, STRETCH, SCALE_INNER, etc.
    uses_bounds,                -- Boolean
    base_w, base_h,             -- Source native dimensions
    in_group, parent_group,     -- Group hierarchy info
    group_x, group_y, group_sx, group_sy  -- Parent group transform
}
```

**From WebSocket (`GetSceneItemTransform`):**

```javascript
{
    positionX, positionY,
    scaleX, scaleY,
    boundsWidth, boundsHeight,
    boundsType,                 // "OBS_BOUNDS_NONE", "OBS_BOUNDS_STRETCH", etc.
    sourceWidth, sourceHeight,
    rotation,
    alignment,
    cropLeft, cropRight, cropTop, cropBottom
}
```

### Gaps Identified

| Gap | Severity | Solution |
|-----|----------|----------|
| No scene-wide snapshot capability | HIGH | New `captureLayoutPreset()` function |
| No multi-source animation | HIGH | Parallel animation engine with stagger |
| No layout storage schema | MEDIUM | New `layoutPresets` config array |
| No visibility tracking in layouts | MEDIUM | Add `visible` field to preset sources |
| No source presence diff | MEDIUM | `diffLayoutState()` function |
| No UI for layouts | LOW | New "Layouts" tab in control panel |

---

## Architecture

### Hybrid Approach (Selected)

The system uses a **hybrid architecture**:

1. **`source_layouts.lua`** - Lua script for:
   - Hotkey-triggered layout switching
   - OBS-native layout application (works without control panel)
   - Integration with existing animation scripts

2. **Control Panel (HTML/JS)** - For:
   - Creating and managing layouts via UI
   - Visual preview of layouts
   - WebSocket-based layout operations
   - Cross-session persistence

3. **Shared Storage** - Layouts accessible by both:
   - Stored in OBS script settings (Lua-accessible)
   - Mirrored to IndexedDB/localStorage (JS-accessible)

### Flow Diagrams

#### Save Layout Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        SAVE LAYOUT FLOW                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  User clicks "Save Current Layout"                              │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────┐                                            │
│  │ Get Current     │ ──► Store sceneName                        │
│  │ Scene Name      │                                            │
│  └────────┬────────┘                                            │
│           ▼                                                     │
│  ┌────────────────────┐                                         │
│  │ GetSceneItemList() │ ──► Enumerate ALL sources               │
│  │ (recursive for     │     (including nested in groups)        │
│  │  groups)           │                                         │
│  └────────┬───────────┘                                         │
│           ▼                                                     │
│  ┌────────────────────────────────────┐                         │
│  │ For each source:                   │                         │
│  │   • GetSceneItemTransform()        │                         │
│  │   • GetSceneItemEnabled() [EMOJI] visible│                         │
│  │   • Record all transform data      │                         │
│  └────────┬───────────────────────────┘                         │
│           ▼                                                     │
│  ┌─────────────────────────┐                                    │
│  │ Create LayoutPreset obj │                                    │
│  │ with metadata + sources │                                    │
│  └────────┬────────────────┘                                    │
│           ▼                                                     │
│  ┌─────────────────────────┐                                    │
│  │ Save to storage         │                                    │
│  │ (IDB + localStorage +   │                                    │
│  │  OBS script settings)   │                                    │
│  └─────────────────────────┘                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Apply Layout Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                       APPLY LAYOUT FLOW                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  User triggers layout (hotkey or UI)                            │
│         │                                                       │
│         ▼                                                       │
│  ┌───────────────────────────────────────────┐                  │
│  │ Validate: preset.sceneName vs currentScene│                  │
│  │ (Warn if different, optionally proceed)   │                  │
│  └────────┬──────────────────────────────────┘                  │
│           ▼                                                     │
│  ┌────────────────────────────────────────────┐                 │
│  │ GATHER CURRENT STATE                       │                 │
│  │                                            │                 │
│  │ GetSceneItemList() [EMOJI] for each source:      │                 │
│  │   • GetSceneItemTransform() = currentState │                 │
│  │   • Compare with preset sources            │                 │
│  └────────┬───────────────────────────────────┘                 │
│           ▼                                                     │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ CATEGORIZE SOURCES                                         │ │
│  │                                                            │ │
│  │ • inBoth[]: Sources in BOTH current scene AND preset       │ │
│  │   [EMOJI] Will be animated                                       │ │
│  │                                                            │ │
│  │ • inPresetOnly[]: Sources in preset but NOT in scene       │ │
│  │   [EMOJI] Log warning, skip                                      │ │
│  │                                                            │ │
│  │ • inSceneOnly[]: Sources in scene but NOT in preset        │ │
│  │   [EMOJI] Leave untouched                                        │ │
│  └────────┬───────────────────────────────────────────────────┘ │
│           ▼                                                     │
│  ┌────────────────────────────────────────────┐                 │
│  │ BUILD ANIMATION PLAN                       │                 │
│  │                                            │                 │
│  │ For each source in inBoth[]:               │                 │
│  │   animationPlan.push({                     │                 │
│  │     sourceName,                            │                 │
│  │     sceneItemId,                           │                 │
│  │     from: currentTransform,                │                 │
│  │     to: presetTransform,                   │                 │
│  │     visibilityChange: 'none'|'show'|'hide' │                 │
│  │   })                                       │                 │
│  └────────┬───────────────────────────────────┘                 │
│           ▼                                                     │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ EXECUTE ANIMATION                                          │ │
│  │                                                            │ │
│  │ Phase 1: Hide sources that need hiding (instant)           │ │
│  │                                                            │ │
│  │ Phase 2: Animate position/scale/bounds                     │ │
│  │   • All sources animate with optional stagger              │ │
│  │   • Uses configured easing function                        │ │
│  │   • Lerp all transform properties over duration            │ │
│  │                                                            │ │
│  │ Phase 3: Show sources that need showing (after move)       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Structures

### LayoutPreset

```typescript
interface LayoutPreset {
    // Identification
    id: string;                    // UUID
    name: string;                  // User-friendly name
    sceneName: string;             // Associated scene
    
    // Timestamps
    createdAt: string;             // ISO 8601
    updatedAt: string;             // ISO 8601
    
    // Animation settings for applying this layout
    animation: {
        duration: number;          // ms (default: 500)
        easing: string;            // 'ease_out', 'ease_in_out', 'bounce', etc.
        stagger: number;           // Delay between sources (ms, default: 0)
        style: string;             // 'slide', 'fade', 'scale' (default: 'slide')
    };
    
    // Behavior settings
    options: {
        applyVisibility: boolean;  // Whether to change source visibility
        warnOnMissing: boolean;    // Warn about missing sources
        ignoreNewSources: boolean; // Don't touch sources not in preset
    };
    
    // Source states
    sources: {
        [sourceName: string]: SourceLayoutState;
    };
}
```

### SourceLayoutState

```typescript
interface SourceLayoutState {
    // Existence & visibility at save time
    visible: boolean;
    
    // Position (always present)
    positionX: number;
    positionY: number;
    
    // Sizing - bounds mode
    boundsType: string;            // 'OBS_BOUNDS_NONE', 'OBS_BOUNDS_STRETCH', etc.
    boundsWidth: number;
    boundsHeight: number;
    
    // Sizing - scale mode (if not using bounds)
    scaleX: number;
    scaleY: number;
    
    // Source dimensions at save time (for reference)
    sourceWidth: number;
    sourceHeight: number;
    
    // Optional transform properties
    rotation: number;
    alignment: number;
    cropLeft: number;
    cropRight: number;
    cropTop: number;
    cropBottom: number;
    
    // Group info
    inGroup: boolean;
    groupName: string | null;
}
```

### AnimationPlan (Internal)

```typescript
interface AnimationPlanItem {
    sourceName: string;
    sceneItemId: number;
    from: SourceLayoutState;
    to: SourceLayoutState;
    visibilityChange: 'none' | 'show' | 'hide';
    delay: number;                 // Stagger delay for this source
}
```

---

## Implementation Plan

### Phase 1: Core Infrastructure

- [x] Create `source_layouts.lua` base script
- [x] Implement `captureLayoutPreset()` - snapshot all sources
- [x] Implement layout storage (OBS settings + JSON)
- [x] Add basic UI placeholder in control panel

### Phase 2: Animation Engine

- [x] Implement `applyLayoutPreset()` with single-source animation
- [x] Add multi-source parallel animation
- [x] Add stagger support
- [x] Add visibility change handling

### Phase 3: Smart Diffing

- [x] Implement `diffLayoutState()` - compare current vs preset
- [x] Add source categorization (inBoth, inPresetOnly, inSceneOnly)
- [x] Add warnings/logging for missing sources

### Phase 4: Control Panel UI

- [x] Add "Layouts" tab to control panel
- [x] Create layout management UI (save, rename, delete)
- [x] Add layout preview/quick-apply buttons
- [x] Add animation settings per-layout

### Phase 5: Hotkeys & Polish

- [x] Add hotkey registration for layouts (1-9) (in Lua script)
- [x] Export/import support
- [x] Auto-backup integration
- [ ] Add keyboard shortcuts in control panel (future enhancement)
- [ ] Testing and bug fixes (ongoing)

---

## API Reference

### Lua Functions (source_layouts.lua)

```lua
-- Capture current scene as a layout preset
-- @param name string: User-friendly name for the layout
-- @return boolean: Success
capture_layout(name)

-- Apply a saved layout preset
-- @param name string: Name of the layout to apply
-- @param options table: Optional overrides { duration, easing, stagger }
-- @return boolean: Success
apply_layout(name, options)

-- List all saved layouts for current scene
-- @return table: Array of layout names
list_layouts()

-- Delete a layout
-- @param name string: Name of the layout to delete
-- @return boolean: Success
delete_layout(name)

-- Get layout details
-- @param name string: Layout name
-- @return table|nil: Layout data or nil if not found
get_layout(name)
```

### WebSocket Commands (Control Panel)

```javascript
// Capture current scene as layout
async function captureLayout(name, options = {}) { ... }

// Apply saved layout with animation
async function applyLayout(name, animationOverrides = {}) { ... }

// Get all layouts for current scene
async function getLayouts() { ... }

// Delete a layout
async function deleteLayout(name) { ... }

// Update layout metadata (name, animation settings)
async function updateLayout(name, updates) { ... }
```

---

## UI Specifications

### Layouts Tab

```
┌────────────────────────────────────────────────────────────┐
│ [EMOJI] LAYOUTS                                                 │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ [EMOJI] Save Current Layout                                 │ │
│ ├────────────────────────────────────────────────────────┤ │
│ │ Name: [_______________________]                        │ │
│ │                                                        │ │
│ │ [[EMOJI] Capture Current Layout]                            │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                            │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ [EMOJI] Saved Layouts (Scene: Gaming Scene)                 │ │
│ ├────────────────────────────────────────────────────────┤ │
│ │                                                        │ │
│ │ ┌──────────────────────────────────────────────────┐   │ │
│ │ │ [EMOJI] Full Gameplay                                 │   │ │
│ │ │ 5 sources • Saved 2 hours ago                    │   │ │
│ │ │ [▶[EMOJI] Apply] [[EMOJI][EMOJI] Edit] [[DELETE] Delete]                 │   │ │
│ │ └──────────────────────────────────────────────────┘   │ │
│ │                                                        │ │
│ │ ┌──────────────────────────────────────────────────┐   │ │
│ │ │ [CHAT] Just Chatting                                 │   │ │
│ │ │ 5 sources • Saved yesterday                      │   │ │
│ │ │ [▶[EMOJI] Apply] [[EMOJI][EMOJI] Edit] [[DELETE] Delete]                 │   │ │
│ │ └──────────────────────────────────────────────────┘   │ │
│ │                                                        │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                            │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ [SETTINGS] Default Animation Settings                          │ │
│ ├────────────────────────────────────────────────────────┤ │
│ │ Duration: [500] ms    Easing: [Ease Out ▼]             │ │
│ │ Stagger:  [0] ms      Style:  [Slide ▼]                │ │
│ │                                                        │ │
│ │ [EMOJI][EMOJI] Apply visibility changes                            │ │
│ │ [EMOJI][EMOJI] Warn on missing sources                             │ │
│ │ [EMOJI][EMOJI] Ignore new sources (not in preset)                  │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## Decision Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Architecture | Hybrid (Lua + WebSocket) | Works via hotkeys AND UI |
| Visibility handling | Store per-layout, apply if enabled | Most flexible |
| Sources not in preset | Leave untouched | Safest default |
| Missing sources | Warn in log, continue | Informative but not blocking |
| Stagger | User configurable, default 0ms | Flexibility |
| Storage | OBS settings + IDB + localStorage | Redundancy |

---

## Changelog

### v1.0.0 (2025-12-21)
- [SUCCESS] Initial implementation complete
- [SUCCESS] `source_layouts.lua` - Full Lua script with capture/apply/hotkeys
- [SUCCESS] Control Panel - Layouts tab with save/apply/delete UI
- [SUCCESS] Multi-source animation engine with stagger support
- [SUCCESS] Smart source diffing (exists/missing/new tracking)
- [SUCCESS] Export/import/backup integration
- [SUCCESS] Scene-specific layout filtering

### v0.1.0 (2025-12-21)
- Initial specification
- Core architecture defined
- Data structures documented

