<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import Tooltip from './Tooltip.svelte';

  const { Story } = defineMeta({
    title: 'Components/Tooltip',
    component: Tooltip,
    tags: ['autodocs'],
    argTypes: {
      content: {
        control: 'text',
        description: 'Tooltip content text',
      },
      position: {
        control: 'select',
        options: ['top', 'bottom', 'left', 'right'],
        description: 'Tooltip position',
      },
      delay: {
        control: { type: 'number', min: 0, max: 1000, step: 50 },
        description: 'Delay before showing tooltip (ms)',
      },
    },
  });
</script>

<Story 
  name="Default" 
  args={{ 
    content: 'This is a tooltip',
    position: 'top'
  }}
>
  <Tooltip content="This is a tooltip" position="top">
    <button>Hover me</button>
  </Tooltip>
</Story>

<Story 
  name="Long Text" 
  args={{ 
    content: 'This is a longer tooltip that demonstrates how the component handles multiple lines of text.',
    position: 'top'
  }}
>
  <Tooltip content="This is a longer tooltip that demonstrates how the component handles multiple lines of text." position="top">
    <button>Hover for long tooltip</button>
  </Tooltip>
</Story>

<Story 
  name="Bottom Position" 
  args={{ 
    content: 'Tooltip on bottom',
    position: 'bottom'
  }}
>
  <Tooltip content="Tooltip on bottom" position="bottom">
    <button>Hover for bottom tooltip</button>
  </Tooltip>
</Story>

<Story 
  name="Right Position" 
  args={{ 
    content: 'Tooltip on right',
    position: 'right'
  }}
>
  <Tooltip content="Tooltip on right" position="right">
    <button>Hover for right tooltip</button>
  </Tooltip>
</Story>

