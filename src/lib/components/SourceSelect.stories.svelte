<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import SourceSelect from './SourceSelect.svelte';

  const { Story } = defineMeta({
    title: 'Components/SourceSelect',
    component: SourceSelect,
    tags: ['autodocs'],
    argTypes: {
      value: {
        control: 'text',
        description: 'Selected source value',
      },
      placeholder: {
        control: 'text',
        description: 'Placeholder text',
      },
      disabled: {
        control: 'boolean',
        description: 'Disable the select',
      },
      searchable: {
        control: 'boolean',
        description: 'Enable search functionality',
      },
      minSearchChars: {
        control: { type: 'number', min: 1, max: 10, step: 1 },
        description: 'Minimum characters for search',
      },
    },
  });
</script>

<Story 
  name="Default" 
  args={{ 
    value: '',
    placeholder: '-- Select Source --',
    disabled: false,
    searchable: false
  }}
>
  <div style="padding: 20px; width: 300px;">
    <SourceSelect 
      placeholder="-- Select Source --"
      searchable={false}
    />
  </div>
</Story>

<Story 
  name="Searchable" 
  args={{ 
    value: '',
    placeholder: 'Search sources...',
    disabled: false,
    searchable: true,
    minSearchChars: 1
  }}
>
  <div style="padding: 20px; width: 300px;">
    <SourceSelect 
      placeholder="Search sources..."
      searchable={true}
      minSearchChars={1}
    />
  </div>
</Story>

<Story 
  name="Disabled" 
  args={{ 
    value: '',
    placeholder: '-- Select Source --',
    disabled: true,
    searchable: false
  }}
>
  <div style="padding: 20px; width: 300px;">
    <SourceSelect 
      placeholder="-- Select Source --"
      disabled={true}
    />
  </div>
</Story>



