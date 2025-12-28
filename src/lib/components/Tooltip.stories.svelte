<script lang="ts" module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import Tooltip from './Tooltip.svelte';

  const { Story } = defineMeta({
    title: 'Components/Tooltip',
    component: Tooltip,
    tags: ['autodocs'],
    argTypes: {
      text: {
        control: 'text',
        description: 'Tooltip text content',
      },
      position: {
        control: { type: 'select' },
        options: ['top', 'bottom', 'left', 'right', 'auto'],
        description: 'Tooltip position relative to trigger',
      },
      level: {
        control: { type: 'select' },
        options: ['log', 'info', 'warning', 'error'],
        description: 'Alert level for styling',
      },
      delay: {
        control: { type: 'number', min: 0, max: 1000, step: 100 },
        description: 'Delay before showing tooltip (ms)',
      },
      disabled: {
        control: 'boolean',
        description: 'Disable tooltip',
      },
    },
  });
</script>

<Story 
  name="Default" 
  args={{ 
    text: 'This is a tooltip',
    position: 'bottom',
    level: 'log'
  }}
>
  <Tooltip text="This is a tooltip" position="bottom">
    <button>Hover me</button>
  </Tooltip>
</Story>

<Story 
  name="Info Level" 
  args={{ 
    text: 'This is an info tooltip',
    position: 'bottom',
    level: 'info'
  }}
>
  <Tooltip text="This is an info tooltip" position="bottom" level="info">
    <button>Info Tooltip</button>
  </Tooltip>
</Story>

<Story 
  name="Warning Level" 
  args={{ 
    text: 'This is a warning tooltip',
    position: 'bottom',
    level: 'warning'
  }}
>
  <Tooltip text="This is a warning tooltip" position="bottom" level="warning">
    <button>Warning Tooltip</button>
  </Tooltip>
</Story>

<Story 
  name="Error Level" 
  args={{ 
    text: 'This is an error tooltip',
    position: 'bottom',
    level: 'error'
  }}
>
  <Tooltip text="This is an error tooltip" position="bottom" level="error">
    <button>Error Tooltip</button>
  </Tooltip>
</Story>

<Story 
  name="All Positions" 
  args={{ 
    text: 'Tooltip text',
    position: 'auto',
    level: 'log'
  }}
>
  <div style="display: flex; gap: 20px; padding: 40px; flex-wrap: wrap;">
    <Tooltip text="Top tooltip" position="top">
      <button>Top</button>
    </Tooltip>
    <Tooltip text="Bottom tooltip" position="bottom">
      <button>Bottom</button>
    </Tooltip>
    <Tooltip text="Left tooltip" position="left">
      <button>Left</button>
    </Tooltip>
    <Tooltip text="Right tooltip" position="right">
      <button>Right</button>
    </Tooltip>
  </div>
</Story>

