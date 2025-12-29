# 🔄 UI/UX Migration Tracking Document

## Overview

This document tracks the migration of the Strixun Stream Suite control panel from a monolithic HTML/JS file to a modern React + TypeScript + styled-components architecture.

**Start Date:** 2024-12-21  
**Target:** Full UI/UX redesign with component library

---

## ✅ Architecture Goals

| Goal | Description |
|------|-------------|
| **Decoupled** | UI completely separated from business logic |
| **Type-Safe** | Full TypeScript coverage |
| **Maintainable** | Small, focused files (<300 lines) |
| **Themeable** | Design tokens for easy customization |
| **Testable** | Components and services independently testable |
| **OBS Compatible** | Storage system unchanged for OBS dock compatibility |

---

## 📦 Tech Stack

| Package | Version | Purpose |
|---------|---------|---------|
| React | 19.x | UI framework |
| TypeScript | 5.x | Type safety |
| Vite | 6.x | Build tool |
| styled-components | 6.x | CSS-in-JS |
| pnpm | 9.x | Package manager |

---

## 📁 New Project Structure

```
control-panel/
├── src/
│   ├── components/           # Reusable UI components
│   │   ├── primitives/       # Base building blocks
│   │   │   ├── Button/
│   │   │   ├── Toggle/
│   │   │   ├── Slider/
│   │   │   ├── Input/
│   │   │   ├── Select/
│   │   │   └── Card/
│   │   ├── composite/        # Complex components
│   │   │   ├── SourceItem/
│   │   │   ├── ConfigList/
│   │   │   ├── SearchBox/
│   │   │   └── LoadingButton/
│   │   └── layout/           # Layout components
│   │       ├── Header/
│   │       ├── Tabs/
│   │       ├── SplitPanel/
│   │       └── ActivityLog/
│   │
│   ├── pages/                # Page-level components
│   │   ├── Dashboard/
│   │   ├── Sources/
│   │   ├── TextCycler/
│   │   ├── ClipsPlayer/
│   │   ├── Swaps/
│   │   ├── Scripts/
│   │   ├── Installer/
│   │   └── Setup/
│   │
│   ├── services/             # Business logic (NO UI)
│   │   ├── obs-websocket.ts  # OBS WebSocket communication
│   │   ├── storage.ts        # Storage adapter (wraps existing)
│   │   ├── opacity.ts        # Opacity filter management
│   │   ├── animation.ts      # Animation utilities
│   │   └── text-cycler.ts    # Text cycler engine
│   │
│   ├── hooks/                # Custom React hooks
│   │   ├── useOBS.ts
│   │   ├── useStorage.ts
│   │   ├── useLoading.ts
│   │   └── useDebounce.ts
│   │
│   ├── theme/                # Design system
│   │   ├── tokens.ts         # Design tokens (colors, spacing)
│   │   ├── GlobalStyle.ts    # Global CSS reset
│   │   └── index.ts
│   │
│   ├── types/                # TypeScript types
│   │   ├── obs.ts
│   │   ├── config.ts
│   │   └── index.ts
│   │
│   ├── utils/                # Pure utility functions
│   │   ├── easing.ts
│   │   └── helpers.ts
│   │
│   ├── App.tsx
│   ├── main.tsx
│   └── vite-env.d.ts
│
├── public/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── .gitignore
```

---

## 🔧 Services to Extract

### From `control_panel.html`:

| Service | Lines | Status | Notes |
|---------|-------|--------|-------|
| `storage` | 963-1200 | 🟡 Partially Done | Already in `assets/js/storage.js` |
| `obs-websocket` | 2450-2600 | ⬜ Not Started | WebSocket connection, request/response |
| `sources` | 2600-2900 | ⬜ Not Started | Source visibility, opacity |
| `swaps` | 2950-3500 | ⬜ Not Started | Swap animations |
| `text-cycler` | 3500-4000 | ⬜ Not Started | Text cycling engine |
| `clips-player` | 4000-4500 | ⬜ Not Started | Clips configuration |
| `installer` | 4600-4900 | ⬜ Not Started | Install script generation |

---

## ✅ Component Library

### Primitives (Base Components)

| Component | Props | Status | Notes |
|-----------|-------|--------|-------|
| `Button` | variant, size, loading, disabled | ⬜ | Primary, Secondary, Danger, Ghost |
| `Toggle` | checked, onChange, loading, disabled | ⬜ | Gold themed |
| `Slider` | value, onChange, min, max, disabled | ⬜ | Chunky gold thumb |
| `Input` | type, value, onChange, placeholder | ⬜ | Text, Number, Password |
| `Select` | options, value, onChange | ⬜ | Dropdown |
| `Checkbox` | checked, onChange, label | ⬜ | Custom gold style |
| `Card` | title, collapsible, children | ⬜ | Container |
| `Badge` | variant, children | ⬜ | Status indicators |
| `Spinner` | size | ⬜ | Loading indicator |

### Composite Components

| Component | Uses | Status | Notes |
|-----------|------|--------|-------|
| `SourceItem` | Toggle, Slider, Button | ⬜ | Stacked layout |
| `ConfigListItem` | Card, Button | ⬜ | Selectable |
| `SearchBox` | Input, Button | ⬜ | With clear |
| `LoadingButton` | Button, Spinner | ⬜ | Async actions |
| `ColorPicker` | Input | ⬜ | Custom styled |
| `InfoBox` | Card | ⬜ | Alert/info styling |
| `Stepper` | Badge | ⬜ | Install wizard |

### Layout Components

| Component | Status | Notes |
|-----------|--------|-------|
| `Header` | ⬜ | Status dot, title, actions |
| `TabNav` | ⬜ | Emoji tabs with routing |
| `SplitPanel` | ⬜ | Resizable main + log |
| `ActivityLog` | ⬜ | Collapsible log panel |
| `PageContainer` | ⬜ | Scrollable page wrapper |

---

## 🎨 Design Tokens

```typescript
// From existing CSS variables
const tokens = {
  colors: {
    bg: '#1a1611',
    bgDark: '#0f0e0b',
    card: '#252017',
    border: '#3d3627',
    borderLight: '#4a4336',
    accent: '#edae49',
    accentLight: '#f9df74',
    accentDark: '#c68214',
    success: '#28a745',
    warning: '#ffc107',
    danger: '#ea2b1f',
    text: '#f9f9f9',
    textSecondary: '#b8b8b8',
    muted: '#888',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
  },
  radii: {
    sm: '4px',
    md: '6px',
    lg: '8px',
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 3px rgba(0,0,0,0.3)',
    md: '0 4px 12px rgba(0,0,0,0.4)',
  },
};
```

---

## ✅ Migration Checklist

### Phase 1: Foundation
- [x] Create `control-panel/` directory
- [x] Initialize Vite + React + TypeScript project
- [x] Install dependencies (styled-components)
- [x] Set up theme tokens
- [x] Create GlobalStyle

### Phase 2: Services
- [x] Port storage.js to TypeScript adapter
- [ ] Extract OBS WebSocket service
- [ ] Extract opacity service
- [ ] Extract animation utilities

### Phase 3: Primitives
- [x] Button component
- [x] Toggle component
- [x] Slider component
- [x] Input component
- [x] Select component
- [x] Checkbox component
- [x] Card component
- [x] Spinner component

### Phase 4: Composite Components
- [ ] SourceItem component
- [ ] ConfigListItem component
- [ ] SearchBox component
- [ ] LoadingButton component
- [ ] ColorPicker component

### Phase 5: Layout
- [ ] Header component
- [ ] TabNav component
- [ ] SplitPanel component
- [ ] ActivityLog component

### Phase 6: Pages
- [ ] Dashboard page
- [ ] Sources page
- [ ] TextCycler page
- [ ] ClipsPlayer page
- [ ] Swaps page
- [ ] Scripts page
- [ ] Installer page
- [ ] Setup page

### Phase 7: Build & Deploy
- [ ] Configure Vite build for single HTML output
- [ ] Test in OBS dock
- [ ] Set up GitHub Action for build

---

## 🔄 Change Log

| Date | Change | Author |
|------|--------|--------|
| 2024-12-21 | Initial migration document created | AI |
| 2024-12-21 | Project structure created with Vite + React 19 + TypeScript | AI |
| 2024-12-21 | Theme tokens and GlobalStyle created | AI |
| 2024-12-21 | Primitive components created: Button, Toggle, Slider, Card, Input, Select, Checkbox, Spinner | AI |
| 2024-12-21 | Storage service adapter created | AI |
| 2024-12-21 | Demo App.tsx created for component testing | AI |

---

## 📝 Notes

### Storage Compatibility
The storage system MUST remain compatible with existing OBS dock functionality:
- IndexedDB as primary
- localStorage as backup
- Same key prefixes (`sss_`)
- Same API surface

### Build Output
The final build must produce a single `control_panel.html` file (or equivalent) that can be loaded as an OBS Custom Browser Dock.

### CSS Variables
We'll use CSS variables in the theme for runtime theming capability, but styled-components will reference the token values.

---

## 🚀 Getting Started (for continuation)

```bash
cd control-panel
pnpm install
pnpm dev
```

To build for production:
```bash
pnpm build
```

The build output will be in `dist/` and needs to be copied to the root as `control_panel.html`.

