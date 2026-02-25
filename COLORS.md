# Strixun Stream Suite — Brand Color Palette

> **Purpose**: Single source of truth for all Strixun-branded colors. Share this document with AI chat agents, design tools, and other codebases to synchronize UI theming across the Strixun ecosystem.
>
> **Design Aesthetic**: Warm, retro-arcade dark theme with golden/amber accents.

---

## Quick Reference

| Role | Token | Hex |
|------|-------|-----|
| Background | `bg` | `#1a1611` |
| Background Dark | `bg-dark` | `#0f0e0b` |
| Card / Surface | `card` | `#252017` |
| Card Hover | `card-hover` | `#2d2920` |
| Border | `border` | `#3d3627` |
| Border Light | `border-light` | `#4a4336` |
| Accent (Gold) | `accent` | `#edae49` |
| Accent Light | `accent-light` | `#f9df74` |
| Accent Dark | `accent-dark` | `#c68214` |
| Accent 2 (Blue) | `accent2` | `#6495ed` |
| Success | `success` | `#28a745` |
| Warning | `warning` | `#ffc107` |
| Danger | `danger` | `#ea2b1f` |
| Info | `info` | `#6495ed` |
| Text Primary | `text` | `#f9f9f9` |
| Text Secondary | `text-secondary` | `#b8b8b8` |
| Text Muted | `muted` | `#888888` |

---

## 1. Background & Surface Colors

These form the foundational layers of every Strixun UI. They are warm, dark browns (not pure black) to achieve the retro-arcade aesthetic.

| Token Name | Hex | RGB | Usage |
|------------|-----|-----|-------|
| `bg` | `#1a1611` | `rgb(26, 22, 17)` | Page-level background, root containers |
| `bg-dark` | `#0f0e0b` | `rgb(15, 14, 11)` | Deepest background layer, modals backdrop |
| `card` | `#252017` | `rgb(37, 32, 23)` | Cards, panels, elevated surfaces |
| `card-hover` | `#2d2920` | `rgb(45, 41, 32)` | Hover state for cards and interactive surfaces |

### Glass Effects

Used for overlay panels, tooltips, and floating elements that sit on top of content.

| Token Name | Value | Usage |
|------------|-------|-------|
| `glass-bg` | `rgba(37, 32, 23, 0.95)` | Glassmorphism panel backgrounds |
| `glass-bg-dark` | `rgba(26, 22, 17, 0.98)` | Heavier glass backgrounds for modals |
| `glass-border` | `rgba(61, 54, 39, 0.8)` | Borders on glass elements |

---

## 2. Border Colors

| Token Name | Hex | RGB | Usage |
|------------|-----|-----|-------|
| `border` | `#3d3627` | `rgb(61, 54, 39)` | Default border for cards, inputs, dividers |
| `border-light` | `#4a4336` | `rgb(74, 67, 54)` | Lighter borders, secondary dividers, hover states |

---

## 3. Brand / Accent Colors

The primary accent is a rich **golden amber** — the signature Strixun color. The secondary accent is a **cornflower blue** used for links, info states, and to complement the gold.

| Token Name | Hex | RGB | Usage |
|------------|-----|-----|-------|
| `accent` | `#edae49` | `rgb(237, 174, 73)` | Primary buttons, active states, highlights, brand identity |
| `accent-light` | `#f9df74` | `rgb(249, 223, 116)` | Hover states for accent elements, glows |
| `accent-dark` | `#c68214` | `rgb(198, 130, 20)` | Active/pressed states, darker accent variant |
| `accent2` | `#6495ed` | `rgb(100, 149, 237)` | Links, secondary actions, info badges |

### PWA / Meta Theme Color

| Token Name | Hex | Usage |
|------------|-----|-------|
| `meta-theme` | `#d4af37` | PWA theme color in `manifest.json` and `<meta>` tags. A slightly different gold tuned for browser chrome. |

---

## 4. Semantic / Status Colors

These communicate state and feedback to the user — success, warnings, errors, and informational messages.

| Token Name | Hex | RGB | Usage |
|------------|-----|-----|-------|
| `success` | `#28a745` | `rgb(40, 167, 69)` | Success states, confirmations, positive indicators |
| `warning` | `#ffc107` | `rgb(255, 193, 7)` | Warning banners, caution states |
| `danger` | `#ea2b1f` | `rgb(234, 43, 31)` | Errors, destructive actions, critical alerts |
| `info` | `#6495ed` | `rgb(100, 149, 237)` | Informational badges, tips (same as `accent2`) |

### Danger Variant

Some areas of the codebase use `#dc3545` as an alternate danger/error color (Bootstrap-origin). The canonical danger color is `#ea2b1f`, but `#dc3545` appears in error displays, action menus, and code-example templates.

| Token Name | Hex | Usage |
|------------|-----|-------|
| `danger-alt` | `#dc3545` | Legacy/alternate error red found in some components |

---

## 5. Text Colors

| Token Name | Hex | RGB | Usage |
|------------|-----|-----|-------|
| `text` | `#f9f9f9` | `rgb(249, 249, 249)` | Primary text — headings, body copy |
| `text-secondary` | `#b8b8b8` | `rgb(184, 184, 184)` | Secondary text — descriptions, captions |
| `muted` | `#888888` | `rgb(136, 136, 136)` | Disabled text, placeholders, timestamps |

---

## 6. Development Status Colors

Used to visually tag features/components by their release maturity stage (e.g., WIP badges, alpha ribbons).

| Status | Hex | RGB | Usage |
|--------|-----|-----|-------|
| WIP | `#ff8c00` | `rgb(255, 140, 0)` | Work-in-progress, under construction |
| Alpha | `#e74c3c` | `rgb(231, 76, 60)` | Alpha-stage features, unstable |
| Beta | `#9b59b6` | `rgb(155, 89, 182)` | Beta-stage features, mostly stable |
| Experimental | `#f39c12` | `rgb(243, 156, 18)` | Experimental features, may change |
| Deprecated | `#1abc9c` | `rgb(26, 188, 156)` | Deprecated features, slated for removal |

---

## 7. CSS Custom Properties (Variable Names)

When using these colors in CSS or SCSS, reference them via CSS custom properties defined on `:root`:

```css
:root {
  /* Backgrounds */
  --bg: #1a1611;
  --bg-dark: #0f0e0b;
  --card: #252017;
  --border: #3d3627;
  --border-light: #4a4336;

  /* Brand */
  --accent: #edae49;
  --accent-light: #f9df74;
  --accent-dark: #c68214;
  --accent2: #6495ed;

  /* Status */
  --success: #28a745;
  --warning: #ffc107;
  --danger: #ea2b1f;
  --info: #6495ed;

  /* Text */
  --text: #f9f9f9;
  --text-secondary: #b8b8b8;
  --muted: #888888;

  /* Glass Effects */
  --glass-bg: rgba(37, 32, 23, 0.95);
  --glass-bg-dark: rgba(26, 22, 17, 0.98);
  --glass-border: rgba(61, 54, 39, 0.8);
}
```

---

## 8. TypeScript / JavaScript Token Object

Copy-paste ready for any TypeScript or JavaScript project:

```typescript
export const strixunColors = {
  // Backgrounds
  bg: '#1a1611',
  bgDark: '#0f0e0b',
  card: '#252017',
  cardHover: '#2d2920',

  // Borders
  border: '#3d3627',
  borderLight: '#4a4336',

  // Brand (Gold/Amber)
  accent: '#edae49',
  accentLight: '#f9df74',
  accentDark: '#c68214',

  // Secondary Accent (Blue)
  accent2: '#6495ed',

  // Status
  success: '#28a745',
  warning: '#ffc107',
  danger: '#ea2b1f',
  info: '#6495ed',

  // Text
  text: '#f9f9f9',
  textSecondary: '#b8b8b8',
  muted: '#888888',

  // Glass Effects
  glassBg: 'rgba(37, 32, 23, 0.95)',
  glassBgDark: 'rgba(26, 22, 17, 0.98)',
  glassBorder: 'rgba(61, 54, 39, 0.8)',

  // Dev Status
  statusWip: '#ff8c00',
  statusAlpha: '#e74c3c',
  statusBeta: '#9b59b6',
  statusExperimental: '#f39c12',
  statusDeprecated: '#1abc9c',

  // PWA Meta
  metaTheme: '#d4af37',
} as const;
```

---

## 9. SCSS Variables Map

Copy-paste ready for any SCSS project:

```scss
$strixun-colors: (
  // Backgrounds
  bg: #1a1611,
  bg-dark: #0f0e0b,
  card: #252017,
  card-hover: #2d2920,

  // Borders
  border: #3d3627,
  border-light: #4a4336,

  // Brand
  accent: #edae49,
  accent-light: #f9df74,
  accent-dark: #c68214,
  accent2: #6495ed,

  // Status
  success: #28a745,
  warning: #ffc107,
  danger: #ea2b1f,
  info: #6495ed,

  // Text
  text: #f9f9f9,
  text-secondary: #b8b8b8,
  muted: #888888,

  // Dev Status
  status-wip: #ff8c00,
  status-alpha: #e74c3c,
  status-beta: #9b59b6,
  status-experimental: #f39c12,
  status-deprecated: #1abc9c,
);
```

---

## 10. Tailwind CSS Config

For projects using Tailwind CSS, extend the theme like so:

```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        strixun: {
          bg: { DEFAULT: '#1a1611', dark: '#0f0e0b' },
          card: { DEFAULT: '#252017', hover: '#2d2920' },
          border: { DEFAULT: '#3d3627', light: '#4a4336' },
          accent: { DEFAULT: '#edae49', light: '#f9df74', dark: '#c68214' },
          accent2: '#6495ed',
          success: '#28a745',
          warning: '#ffc107',
          danger: '#ea2b1f',
          info: '#6495ed',
          text: { DEFAULT: '#f9f9f9', secondary: '#b8b8b8', muted: '#888888' },
        },
      },
    },
  },
};
```

---

## 11. Design Principles

1. **No pure black (`#000000`)** — Backgrounds use warm dark browns for a softer, more inviting feel.
2. **No pure white (`#ffffff`)** — Primary text uses `#f9f9f9` to reduce harshness on dark backgrounds.
3. **Gold is king** — `#edae49` is the signature brand color. Use it sparingly for maximum impact on CTAs, highlights, and key interactive elements.
4. **Blue complements gold** — `#6495ed` serves as the secondary accent for links, info states, and areas where gold would be too heavy.
5. **Glass over opaque** — Overlay elements (tooltips, dropdowns, modals) should use glass-effect tokens for depth and sophistication.
6. **Status colors are universal** — Success (green), warning (yellow), danger (red), and info (blue) follow widely recognized conventions for immediate user comprehension.

---

## 12. Accessibility Notes

- **Text on `bg` (`#1a1611`)**: Primary text (`#f9f9f9`) achieves a contrast ratio of approximately **15.8:1** (AAA).
- **Text on `card` (`#252017`)**: Primary text (`#f9f9f9`) achieves approximately **13.5:1** (AAA).
- **Accent on `bg`**: Gold accent (`#edae49`) on background (`#1a1611`) achieves approximately **7.5:1** (AAA for normal text).
- **Muted text on `bg`**: Muted (`#888888`) on background (`#1a1611`) achieves approximately **4.7:1** (AA for normal text, AAA for large text).

Always verify contrast ratios when introducing new color combinations. Aim for WCAG AA minimum (4.5:1 for normal text, 3:1 for large text).

---

## 13. AI Agent Instructions

When building UIs for any Strixun product or project:

1. **Always use this palette** — Do not introduce new colors without explicit approval.
2. **Reference tokens by name** — Use semantic names (`accent`, `danger`, `text-secondary`) rather than raw hex values when possible.
3. **Dark theme only** — Strixun products currently use a single dark theme. There is no light mode variant.
4. **Accent hierarchy** — Use `accent` (gold) for primary actions, `accent2` (blue) for secondary actions and links.
5. **Glass effects for overlays** — Tooltips, dropdowns, and modals should use the glass-effect tokens.
6. **Dev status colors** — When tagging features by maturity, use the status colors defined in section 6.
7. **When in doubt** — Default to `bg` for backgrounds, `accent` for interactive elements, `text` for copy, and `border` for dividers.
