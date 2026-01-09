# @strixun/portal-select

Lightweight, agnostic select component for React using Portals with viewport-aware positioning.

## Features

- **Viewport-Aware Positioning**: Automatically flips to open upward if not enough space below
- **Searchable**: Built-in search with custom filter support
- **Keyboard Navigation**: Full keyboard support (arrow keys, enter, escape)
- **Custom Option Rendering**: Render options however you want
- **Clearable Selection**: Optional clear button
- **Fully Themeable**: Pass your theme via props
- **Portal Rendering**: Dropdown renders at body level to prevent clipping
- **Scroll & Resize Handling**: Stays anchored to trigger on scroll/resize

## Installation

This is an internal package within the Strixun monorepo.

```bash
pnpm add @strixun/portal-select
```

## Usage

```tsx
import { PortalSelect, type PortalSelectOption, type PortalSelectTheme } from '@strixun/portal-select';

const theme: PortalSelectTheme = {
  colors: {
    bg: '#1a1a1a',
    bgSecondary: '#2a2a2a',
    bgTertiary: '#3a3a3a',
    text: '#ffffff',
    textSecondary: '#cccccc',
    textMuted: '#888888',
    border: '#444444',
    accent: '#00aaff',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
  },
};

const options: PortalSelectOption[] = [
  { value: '1', label: 'Option 1' },
  { value: '2', label: 'Option 2' },
  { value: '3', label: 'Option 3', disabled: true },
];

function MyComponent() {
  const [value, setValue] = useState<string | undefined>();

  return (
    <PortalSelect
      value={value}
      onChange={setValue}
      options={options}
      theme={theme}
      placeholder="Select an option..."
      searchable={true}
      clearable={true}
    />
  );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string \| undefined` | `undefined` | Currently selected value |
| `onChange` | `(value: string \| undefined) => void` | **required** | Callback when selection changes |
| `options` | `PortalSelectOption[]` | **required** | Array of options |
| `theme` | `PortalSelectTheme` | **required** | Theme configuration |
| `placeholder` | `string` | `'Select an option...'` | Placeholder text |
| `searchable` | `boolean` | `false` | Enable search input |
| `searchPlaceholder` | `string` | `'Search...'` | Search input placeholder |
| `disabled` | `boolean` | `false` | Disable the select |
| `clearable` | `boolean` | `false` | Show clear button |
| `renderOption` | `(option: PortalSelectOption) => React.ReactNode` | `undefined` | Custom option renderer |
| `filterOptions` | `(query: string, options: PortalSelectOption[]) => PortalSelectOption[]` | `undefined` | Custom filter function |

## Types

### PortalSelectOption

```typescript
interface PortalSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}
```

### PortalSelectTheme

```typescript
interface PortalSelectTheme {
  colors: {
    bg: string;
    bgSecondary: string;
    bgTertiary: string;
    text: string;
    textSecondary: string;
    textMuted: string;
    border: string;
    accent: string;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
  };
}
```

## Advanced Usage

### Custom Option Rendering

```tsx
<PortalSelect
  options={gameOptions}
  renderOption={(option) => (
    <div>
      <strong>{option.label}</strong>
      <small style={{ color: '#888' }}>PC, Console</small>
    </div>
  )}
  theme={theme}
  onChange={setValue}
  value={value}
/>
```

### Custom Filtering

```tsx
<PortalSelect
  options={options}
  searchable={true}
  filterOptions={(query, opts) => {
    // Custom search logic
    return opts.filter(opt => 
      opt.label.toLowerCase().includes(query.toLowerCase()) ||
      opt.value.startsWith(query)
    );
  }}
  theme={theme}
  onChange={setValue}
  value={value}
/>
```

## License

Internal use only - Strixun Stream Suite
