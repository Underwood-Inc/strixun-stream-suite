<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import LoadingSkeleton from './LoadingSkeleton.svelte';

  const { Story } = defineMeta({
    title: 'Components/LoadingSkeleton',
    component: LoadingSkeleton,
    tags: ['autodocs'],
    argTypes: {
      lines: {
        control: { type: 'number', min: 1, max: 10, step: 1 },
        description: 'Number of skeleton lines',
      },
      width: {
        control: 'text',
        description: 'Width of skeleton container',
      },
      height: {
        control: 'text',
        description: 'Height of each skeleton line',
      },
    },
  });
</script>

<Story 
  name="Default" 
  args={{ 
    lines: 3,
    width: '100%',
    height: '20px'
  }}
>
  <LoadingSkeleton />
</Story>

<Story 
  name="Single Line" 
  args={{ 
    lines: 1,
    width: '100%',
    height: '20px'
  }}
>
  <LoadingSkeleton lines={1} />
</Story>

<Story 
  name="Multiple Lines" 
  args={{ 
    lines: 5,
    width: '100%',
    height: '20px'
  }}
>
  <LoadingSkeleton lines={5} />
</Story>

<Story 
  name="Custom Size" 
  args={{ 
    lines: 3,
    width: '300px',
    height: '24px'
  }}
>
  <LoadingSkeleton lines={3} width="300px" height="24px" />
</Story>

