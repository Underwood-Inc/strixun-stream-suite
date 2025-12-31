# Virtualized Table Component

High-performance, agnostic virtualized table component that handles thousands of rows efficiently using `react-window`.

## Features

- ✓ **Virtualization** - Only renders visible rows, handles thousands of records smoothly
- ✓ **Sortable Columns** - Click headers to sort, supports ascending/descending
- ✓ **Row Selection** - Built-in checkbox selection with select all
- ✓ **Composable** - Framework-agnostic, works with any styling system
- ✓ **Customizable** - Full control over styling via props
- ✓ **Type-Safe** - Full TypeScript support with generics
- ✓ **Performant** - Optimized with useMemo and useCallback

## Installation

```bash
pnpm add react-window @types/react-window
```

## Usage

### Basic Example

```tsx
import { VirtualizedTable } from './shared-components/virtualized-table';
import type { Column } from './shared-components/virtualized-table';

interface Item {
  id: string;
  name: string;
  status: string;
  createdAt: Date;
}

const columns: Column<Item>[] = [
  { key: 'name', label: 'Name', sortable: true, width: '200px' },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'createdAt', label: 'Created', sortable: true, width: '150px' },
];

function MyComponent() {
  const [data, setData] = useState<Item[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const handleSort = (key: string, direction: 'asc' | 'desc') => {
    setSortConfig({ key, direction });
    // Implement your sorting logic
  };
  
  return (
    <VirtualizedTable
      data={data}
      columns={columns}
      height={600}
      getItemId={(item) => item.id}
      sortConfig={sortConfig}
      onSort={handleSort}
      selectedIds={selectedIds}
      onSelectionChange={setSelectedIds}
      onRowClick={(item) => console.log('Clicked:', item)}
    />
  );
}
```

### With Custom Styling

```tsx
<VirtualizedTable
  data={data}
  columns={columns}
  height={600}
  getItemId={(item) => item.id}
  colors={{
    bg: '#1a1a1a',
    bgSecondary: '#252525',
    bgTertiary: '#2d2d2d',
    border: '#3a3a3a',
    text: '#f9f9f9',
    textSecondary: '#b0b0b0',
    accent: '#d4af37',
  }}
  containerStyle={{ borderRadius: '12px' }}
  rowStyle={{ padding: '8px' }}
/>
```

### With Custom Cell Rendering

```tsx
const columns: Column<Item>[] = [
  {
    key: 'status',
    label: 'Status',
    sortable: true,
    render: (item) => (
      <StatusBadge status={item.status}>
        {item.status}
      </StatusBadge>
    ),
  },
  {
    key: 'actions',
    label: 'Actions',
    render: (item) => (
      <button onClick={() => handleAction(item)}>
        Action
      </button>
    ),
  },
];
```

## API Reference

### `VirtualizedTableProps<T>`

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `data` | `T[]` | ✓ | Array of data items to display |
| `columns` | `Column<T>[]` | ✓ | Column definitions |
| `height` | `number` | ✓ | Total height of the table in pixels |
| `getItemId` | `(item: T) => string` | ✓ | Function to get unique ID for each item |
| `rowHeight` | `number` | ✗ | Height of each row (default: 48) |
| `onRowClick` | `(item: T, index: number) => void` | ✗ | Callback when row is clicked |
| `selectedIds` | `Set<string>` | ✗ | Set of selected item IDs |
| `onSelectionChange` | `(selectedIds: Set<string>) => void` | ✗ | Callback when selection changes |
| `sortConfig` | `{ key: string; direction: 'asc' \| 'desc' } \| null` | ✗ | Current sort configuration |
| `onSort` | `(key: string, direction: 'asc' \| 'desc') => void` | ✗ | Callback when column is sorted |
| `colors` | `object` | ✗ | Custom color theme |
| `className` | `string` | ✗ | CSS class for container |
| `containerStyle` | `React.CSSProperties` | ✗ | Inline styles for container |
| `headerStyle` | `React.CSSProperties` | ✗ | Inline styles for header |
| `rowStyle` | `React.CSSProperties` | ✗ | Inline styles for rows |
| `cellStyle` | `React.CSSProperties` | ✗ | Inline styles for cells |

### `Column<T>`

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `key` | `string` | ✓ | Unique key for the column |
| `label` | `string` | ✓ | Header label |
| `width` | `string` | ✗ | Column width (CSS value, e.g., '200px', '1fr') |
| `sortable` | `boolean` | ✗ | Whether column is sortable |
| `render` | `(item: T, index: number) => React.ReactNode` | ✗ | Custom render function for cells |
| `accessor` | `(item: T) => string \| number \| Date` | ✗ | Function to extract value for sorting |

## Performance Tips

1. **Memoize columns** - Keep column definitions stable
2. **Memoize data** - Use useMemo for filtered/sorted data
3. **Stable getItemId** - Ensure IDs don't change between renders
4. **Debounce sorting** - For large datasets, debounce sort operations
5. **Virtualization** - Component handles this automatically, but ensure height is set correctly

## Examples

See the admin panel implementation for a complete example with:
- Sorting
- Selection
- Custom cell rendering
- Status badges
- Action buttons

