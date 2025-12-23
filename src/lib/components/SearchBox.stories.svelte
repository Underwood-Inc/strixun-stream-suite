<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import SearchBox from './SearchBox.svelte';

  const { Story } = defineMeta({
    title: 'Components/SearchBox',
    component: SearchBox,
    tags: ['autodocs'],
    argTypes: {
      inputId: {
        control: 'text',
        description: 'Unique ID for the search input',
      },
      placeholder: {
        control: 'text',
        description: 'Placeholder text',
      },
      containerId: {
        control: 'text',
        description: 'ID of container to search within',
      },
      itemSelector: {
        control: 'text',
        description: 'CSS selector for items to filter',
      },
      textSelector: {
        control: 'text',
        description: 'CSS selector for text content to search',
      },
      minChars: {
        control: { type: 'number', min: 0, max: 10, step: 1 },
        description: 'Minimum characters before searching',
      },
      debounceMs: {
        control: { type: 'number', min: 0, max: 1000, step: 50 },
        description: 'Debounce delay in milliseconds',
      },
      showCount: {
        control: 'boolean',
        description: 'Show result count',
      },
    },
  });
</script>

<Story 
  name="Default" 
  args={{ 
    inputId: 'search-default',
    placeholder: 'Search...',
    showCount: true
  }}
>
  <div id="search-container" style="padding: 20px;">
    <SearchBox 
      inputId="search-default"
      placeholder="Search items..."
      containerId="search-container"
      itemSelector=".item"
      textSelector=".item-text"
      showCount={true}
    />
    <div style="margin-top: 20px;">
      <div class="item">
        <span class="item-text">Apple</span>
      </div>
      <div class="item">
        <span class="item-text">Banana</span>
      </div>
      <div class="item">
        <span class="item-text">Cherry</span>
      </div>
    </div>
  </div>
</Story>

<Story 
  name="With Custom Placeholder" 
  args={{ 
    inputId: 'search-custom',
    placeholder: 'Type to filter...',
    showCount: false
  }}
>
  <div id="search-container-2" style="padding: 20px;">
    <SearchBox 
      inputId="search-custom"
      placeholder="Type to filter..."
      containerId="search-container-2"
      itemSelector=".item"
      textSelector=".item-text"
      showCount={false}
    />
    <div style="margin-top: 20px;">
      <div class="item">
        <span class="item-text">Item 1</span>
      </div>
      <div class="item">
        <span class="item-text">Item 2</span>
      </div>
    </div>
  </div>
</Story>

