<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import SimpleTextEditor from './SimpleTextEditor.svelte';

  const { Story } = defineMeta({
    title: 'Components/SimpleTextEditor',
    component: SimpleTextEditor,
    tags: ['autodocs'],
    argTypes: {
      value: {
        control: 'text',
        description: 'Editor content',
      },
      placeholder: {
        control: 'text',
        description: 'Placeholder text',
      },
    },
  });
</script>

<Story 
  name="Default" 
  args={{ 
    value: '',
    placeholder: 'Start typing...'
  }}
>
  <div style="width: 600px; height: 400px;">
    <SimpleTextEditor placeholder="Start typing..." />
  </div>
</Story>

<Story 
  name="With Content" 
  args={{ 
    value: 'This is some sample text content.\n\nYou can type multiple lines here.',
    placeholder: 'Start typing...'
  }}
>
  <div style="width: 600px; height: 400px;">
    <SimpleTextEditor 
      value="This is some sample text content.\n\nYou can type multiple lines here."
      placeholder="Start typing..."
    />
  </div>
</Story>

<Story 
  name="Custom Placeholder" 
  args={{ 
    value: '',
    placeholder: 'Enter your notes here...'
  }}
>
  <div style="width: 600px; height: 400px;">
    <SimpleTextEditor placeholder="Enter your notes here..." />
  </div>
</Story>

