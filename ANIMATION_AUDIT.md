# Animation Audit & Implementation Plan

## Components to Animate

### High Priority (User-Facing, Frequent Interactions)

1. **Toast Notifications** ✅ (Already done - FLIP animation)
   - Mount: `fadeIn` + `slideUp`
   - Dismiss: `fadeOut` + `slideUp`
   - Position updates: FLIP animation

2. **Log Entries** (ActivityLog)
   - Mount: `fadeIn` with stagger
   - Hover: subtle `scale` (1.02x)

3. **Navigation Tabs**
   - Active tab: `scaleIn` on selection
   - Tab hover: `pulse` or subtle `scale`

4. **Modal/Dropdown** (AlertsDropdown, LoginModal)
   - Mount: `fadeIn` + `scaleIn`
   - Unmount: `fadeOut` + `scaleOut`

5. **Cards** (All page cards)
   - Mount: `fadeIn` with stagger
   - Hover: subtle `float` or `scale`

6. **Buttons**
   - Click: `press-down` (existing CSS)
   - Hover: subtle `scale` or `glow`

### Medium Priority (Less Frequent, But Important)

7. **SearchBox**
   - Focus: `glow` pulse
   - Results appear: `fadeIn` with stagger

8. **SourceSelect**
   - Options dropdown: `slideDown` + `fadeIn`
   - Selection change: `shake` or `pulse`

9. **VirtualList Items**
   - Mount: `fadeIn` with stagger
   - Scroll into view: `slideUp`

10. **InfoBar**
    - Status changes: `pulse` or `glow`
    - Connection state: `bounceIn` on connect

11. **ProgressRing**
    - Value changes: `scaleIn`
    - Complete: `bounceIn`

### Low Priority (Subtle, Background)

12. **Tooltip**
    - Mount: `fadeIn` + `slideUp`
    - Very fast (150ms)

13. **LoadingSkeleton**
    - Shimmer animation (existing CSS)

14. **Page Transitions**
    - Page change: `fadeIn` + `slideUp`

15. **ResizableZone**
    - Resize handle hover: `glow`
    - Resize complete: subtle `pulse`

## Animation Strategy

### Principles
1. **Subtle & Fast** - Most animations should be 200-300ms
2. **Purposeful** - Only animate meaningful state changes
3. **Respectful** - Honor `prefers-reduced-motion`
4. **Performance** - Use GPU-accelerated properties
5. **Consistent** - Use same presets for similar interactions

### Timing Guidelines
- **Micro-interactions** (hover, click): 100-200ms
- **Component mount**: 200-300ms
- **Page transitions**: 300-400ms
- **Complex animations**: 400-600ms
- **Stagger delay**: 50-100ms between items

### Easing Guidelines
- **Entrance**: `easeOutCubic` or `easeOutBack` (bouncy)
- **Exit**: `easeInCubic` (quick)
- **Hover**: `easeInOutQuad` (smooth)
- **State changes**: `easeInOutCubic` (balanced)

## Implementation Order

1. ✅ Core animation system
2. ✅ Toast animations (FLIP)
3. ⏳ Log entries (staggered fadeIn)
4. ⏳ Navigation tabs
5. ⏳ Modals/dropdowns
6. ⏳ Cards (page-level)
7. ⏳ Buttons (enhance existing)
8. ⏳ SearchBox
9. ⏳ VirtualList
10. ⏳ Tooltips
11. ⏳ Page transitions

