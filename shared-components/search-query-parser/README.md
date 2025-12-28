# Advanced Search Query Parser

A human-friendly search query parser that supports advanced search syntax for filtering data across all applications.

## Features

- **Quoted exact phrases**: `"exact phrase"` - matches entries containing the exact phrase
- **Space-separated AND terms**: `term1 term2` - matches entries containing both terms
- **Pipe-separated OR groups**: `term1 | term2` - matches entries containing either term
- **Wildcard prefix matching**: `term*` - matches entries containing anything starting with the prefix
- **Combined queries**: Mix all features together for powerful searches

## Usage

### TypeScript/JavaScript

```typescript
import { matchesSearchQuery, matchesSearchQueryFields, parseSearchQuery } from './shared-components/search-query-parser/index.js';

// Simple text matching
const matches = matchesSearchQuery('error connection failed', 'error failed');
// Returns: true (both "error" AND "failed" must be present)

// Multi-field matching
const matches = matchesSearchQueryFields(
  {
    title: 'My Mod',
    description: 'A great mod for the game',
    author: 'John Doe'
  },
  '"great mod" | author:John'
);
// Returns: true (matches "great mod" OR contains "author:John")

// Parse query structure
const parsed = parseSearchQuery('"exact phrase" term1 | term2 term3');
// Returns: {
//   exactPhrases: ['exact phrase'],
//   orGroups: [['term1'], ['term2', 'term3']],
//   hasContent: true
// }
```

### Svelte Component

```svelte
<script>
  import AdvancedSearchInput from './shared-components/search-query-parser/AdvancedSearchInput.svelte';
  import { matchesSearchQuery } from './shared-components/search-query-parser/index.js';
  
  let searchQuery = '';
  let items = [/* your items */];
  
  $: filteredItems = items.filter(item => 
    matchesSearchQuery(item.text, searchQuery)
  );
</script>

<AdvancedSearchInput
  value={searchQuery}
  onInput={(value) => searchQuery = value}
  placeholder="Search items..."
/>
```

### React Component

```tsx
import { AdvancedSearchInput } from './shared-components/search-query-parser/AdvancedSearchInput';
import { matchesSearchQueryFields } from './shared-components/search-query-parser/index.js';

function MyComponent() {
  const [searchQuery, setSearchQuery] = useState('');
  const [items, setItems] = useState([/* your items */]);
  
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    return items.filter(item => 
      matchesSearchQueryFields(
        {
          title: item.title,
          description: item.description
        },
        searchQuery
      )
    );
  }, [items, searchQuery]);
  
  return (
    <AdvancedSearchInput
      value={searchQuery}
      onChange={setSearchQuery}
      placeholder="Search items..."
    />
  );
}
```

## Examples

### Exact Phrase Search
```
"connection failed"
```
Matches entries containing the exact phrase "connection failed"

### AND Logic (Space-separated)
```
error failed
```
Matches entries containing both "error" AND "failed"

### OR Logic (Pipe-separated)
```
error | warning
```
Matches entries containing "error" OR "warning"

### Combined Query
```
"connection failed" | timeout error
```
Matches entries with:
- The exact phrase "connection failed" OR
- Both "timeout" AND "error"

### Wildcard Prefix
```
err*
```
Matches entries containing anything starting with "err" (error, errors, erroring, etc.)

### Complex Query
```
"user login" | (auth failed | timeout) error
```
Note: Parentheses are not currently supported, but you can achieve similar results with:
```
"user login" | "auth failed" error | timeout error
```

## API Reference

### `parseSearchQuery(query: string): SearchQueryResult`

Parses a search query into structured components.

**Parameters:**
- `query` - The search query string

**Returns:**
```typescript
{
  exactPhrases: string[];  // Quoted phrases
  orGroups: string[][];     // OR groups, each containing AND terms
  hasContent: boolean;      // Whether query has any content
}
```

### `matchesSearchQuery(text: string, query: string): boolean`

Matches a search query against a single text string.

**Parameters:**
- `text` - The text to search in (will be lowercased)
- `query` - The search query string

**Returns:** `true` if the text matches the query

### `matchesSearchQueryFields(fields: Record<string, string | undefined>, query: string): boolean`

Matches a search query against multiple text fields.

**Parameters:**
- `fields` - Object with text fields to search
- `query` - The search query string

**Returns:** `true` if any field matches the query

## Component Props

### `AdvancedSearchInput` (Svelte)

- `value: string` - Current search query value
- `onInput: (value: string) => void` - Callback when input changes
- `placeholder?: string` - Input placeholder text
- `inputId?: string` - HTML id for the input element
- `showHint?: boolean` - Whether to show the search syntax hint (default: true)
- `onClear?: () => void` - Optional callback when search is cleared

### `AdvancedSearchInput` (React)

- `value: string` - Current search query value
- `onChange: (value: string) => void` - Callback when input changes
- `placeholder?: string` - Input placeholder text
- `inputId?: string` - HTML id for the input element
- `showHint?: boolean` - Whether to show the search syntax hint (default: true)
- `onClear?: () => void` - Optional callback when search is cleared

## Integration

This search parser is now used in:
- ✅ Admin Panel - Mod Triage (React)
- ✅ Activity Log Filter (Svelte)
- 🔄 All other search inputs should be migrated to use this component

## Migration Guide

To migrate existing search inputs to use this component:

1. **Replace simple search inputs:**
   ```svelte
   <!-- Before -->
   <input type="text" bind:value={searchQuery} />
   
   <!-- After -->
   <AdvancedSearchInput
     value={searchQuery}
     onInput={(value) => searchQuery = value}
   />
   ```

2. **Update filtering logic:**
   ```typescript
   // Before
   const filtered = items.filter(item => 
     item.text.toLowerCase().includes(searchQuery.toLowerCase())
   );
   
   // After
   import { matchesSearchQuery } from './shared-components/search-query-parser/index.js';
   const filtered = items.filter(item => 
     matchesSearchQuery(item.text, searchQuery)
   );
   ```

3. **For multi-field searches:**
   ```typescript
   import { matchesSearchQueryFields } from './shared-components/search-query-parser/index.js';
   const filtered = items.filter(item => 
     matchesSearchQueryFields(
       {
         title: item.title,
         description: item.description,
         author: item.author
       },
       searchQuery
     )
   );
   ```

