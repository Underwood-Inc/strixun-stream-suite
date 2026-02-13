# Source Visibility Toggle Button - Implementation

## 📋 Overview

Added a single visibility toggle button to each source that works exactly like the OBS eye icon - one click to hide/show with your configured animation.

## ✨ Features

### Quick Action Buttons

Each source item now has TWO action buttons:

1. **Visibility Toggle** - Click to toggle visibility (shows "👁️ Visible" or "🙈 Hidden")
   - Green when visible, red when hidden
   - Same as clicking the eye icon at the top
   - Uses your configured Visibility Animation settings
2. **Reset** - Reset opacity to 100% and remove opacity filter

### Visual Feedback

- **Color-Coded States:**
  - **GREEN** = Source is visible (shows "👁️ Visible")
  - **RED** = Source is hidden (shows "🙈 Hidden")
  - Click to toggle between states

- **Loading States:**
  - Spinning indicator appears during visibility animations
  - Button disabled during animation
  - Loading duration matches your configured animation duration + 100ms buffer

### UI Layout

```
┌─────────────────────────────────────────────────┐
│ Source Name                          [Toggle ON]│ ← Eye icon (top)
│ scene                                            │
├─────────────────────────────────────────────────┤
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 100%                  │ ← Opacity Slider
│ [👁️ Visible]  [Reset]                           │ ← Toggle button (bottom)
└─────────────────────────────────────────────────┘
```

## 🔧 Implementation Details

### Files Modified

#### `src/modules/sources.ts`
- Added `quickHideWithLoader()` - Triggers animated hide via `toggleSource()`
- Added `quickShowWithLoader()` - Triggers animated show via `toggleSource()`
- Added `updateVisibilityButtonStates()` - Updates button active states based on visibility
- Updated `renderSources()` - Added visibility toggle buttons to HTML
- Uses same animation system as OBS eye icon toggle
- Respects configured animation type, duration, and easing from page settings
- Version bump: 2.0.0 → 2.1.0

#### `src/styles/components/_sources.scss`
- Added `.opacity-toggle-btn` - Base styles for Hide/Show buttons
- Added `.opacity-hide-btn.active` - Red styling for active Hide button
- Added `.opacity-show-btn.active` - Green styling for active Show button
- Updated `.opacity-reset-btn` - Enhanced Reset button styles
- Added loading animations with spinning indicator
- Restructured `.source-item__controls` - Changed to column layout
- Added `.source-item__buttons` - Button container with flex layout

### Behavior

#### Hide Button (🙈)
- **Default:** Gray background, white text
- **When Active (Hidden):** Red background (#e74c3c), white text, bold
- **Action:** Triggers OBS visibility disable with configured animation (fade/slide/zoom/etc.)
- **Animation:** Uses settings from "Visibility Animation" card at top of page
- **Same as:** Clicking the eye icon in OBS to disable visibility

#### Show Button (👁️)
- **Default:** Gray background, white text
- **When Active (Visible):** Green background (#2ecc71), white text, bold
- **Action:** Triggers OBS visibility enable with configured animation (fade/slide/zoom/etc.)
- **Animation:** Uses settings from "Visibility Animation" card at top of page
- **Same as:** Clicking the eye icon in OBS to enable visibility

#### Reset Button
- **Always Visible:** No active state
- **Action:** Sets opacity to 100% AND removes the opacity filter (instant, no animation)
- **Purpose:** Clean slate for opacity filter (no performance overhead)
- **Note:** This is for opacity control, NOT visibility control

### State Synchronization

**Visibility Controls (Hide/Show buttons and Eye icon):**
- All trigger the same animated transitions
- Active states reflect OBS visibility state (enabled/disabled)
- Hide button = RED when OBS visibility is disabled
- Show button = GREEN when OBS visibility is enabled

**Opacity Controls (Slider and Reset button):**
- Independent from visibility (can have hidden source at 50% opacity)
- Slider controls opacity filter (0-100%)
- Reset removes opacity filter entirely

**These are SEPARATE systems:**
- Visibility = OBS sceneItemEnabled (with animations)
- Opacity = Color filter overlay (instant changes)

## 🎯 Use Cases

### Animated Visibility Control During Stream
1. Click **Hide** button on source
2. Source animates out using your configured animation (fade/slide/zoom)
3. Red indicator shows it's hidden
4. Click **Show** to animate it back in with the same animation

### Quick Access to Visibility Toggles
- Convenient buttons right next to each source (no scrolling to OBS)
- Same animations as OBS eye icon
- Visual indicators (red/green) show current state at a glance
- Faster workflow: everything in one UI

### Combined Visibility + Opacity Workflow
- Use **Hide/Show** for animated visibility transitions
- Use **Slider** for partial transparency while visible (e.g., watermarks at 30%)
- Use **Reset** to remove opacity filter when done

## 🔄 Comparison to Controls

### OBS Native Eye Icon (Top Right of Each Source)
- **Controls:** OBS visibility (sceneItemEnabled)
- **Animation:** Uses configured visibility animation (fade, slide, etc.)
- **Location:** Top right of each source item

### Quick Hide/Show Buttons (Bottom of Each Source) ⭐ NEW
- **Controls:** **SAME as eye icon** - OBS visibility (sceneItemEnabled)
- **Animation:** **SAME as eye icon** - Uses configured visibility animation
- **Location:** Bottom of each source item
- **Benefit:** Convenient access, visual indicators (red/green), keyboard-free workflow

### Opacity Slider (Bottom Middle)
- **Controls:** Opacity filter (0-100%)
- **Animation:** Instant change (no animation)
- **Purpose:** Partial transparency while source is visible
- **Independent:** Works separately from visibility system

### Best Practice
- Use **Eye Icon OR Hide/Show Buttons** for animated visibility (they do the same thing!)
- Use **Slider** for transparency effects (watermarks, overlays at 30-50%)
- Use **Reset** to remove opacity filter overhead when done

## 🎨 Visual Design Philosophy

### Color Semantics
- **Red (Hide):** Indicates "off/danger/hidden" state
- **Green (Show):** Indicates "on/success/visible" state
- **Gray (Inactive):** Neutral state, not currently active

### Layout Rationale
- **Two-Row Layout:** Slider on top row, buttons on bottom row
  - Maximizes horizontal space for slider (precision)
  - Groups action buttons together (cognitive grouping)
  - Maintains consistent height across all source items

### Accessibility
- Clear emoji icons (🙈 👁️) for quick visual recognition
- Text labels for screen readers and clarity
- Color + bold weight for active states (not color-only)
- Adequate button sizing (touch-friendly)

## 📊 Performance Notes

### Animation Performance
- Uses same optimized animation system as OBS eye icon
- Respects configured animation duration (default 300ms)
- Loading states match animation duration + 100ms buffer
- No performance overhead when using "none" animation type

### Opacity Filter Behavior (Separate from Visibility)
- **0-99%:** Opacity filter is applied and persists
- **100%:** Opacity filter is REMOVED (zero overhead)
- **Benefits:** No performance impact when opacity is at 100%

## 🧪 Testing Checklist

- [x] Hide button triggers animated hide transition
- [x] Show button triggers animated show transition
- [x] Buttons use configured animation settings (fade/slide/zoom/etc.)
- [x] Reset button sets opacity to 100% (independent of visibility)
- [x] Eye icon and Hide/Show buttons work identically
- [x] Active states show correct colors (red for hidden, green for visible)
- [x] Loading states match animation duration
- [x] Visibility state persists (OBS manages this)
- [x] Works with multiple sources simultaneously
- [x] No conflicts between visibility and opacity systems

## 🔮 Future Enhancements

Potential improvements:
- Keyboard shortcuts for hide/show (H/S keys)
- Bulk hide/show all sources in scene
- Preset opacity levels (25%, 50%, 75%)
- Favorite/quick-access sources section
- Undo/redo opacity changes

---

**Version:** 2.1.0  
**Date:** 2026-01-23  
**Author:** Strixun Stream Suite Development Team
