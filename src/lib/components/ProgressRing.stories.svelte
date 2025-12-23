<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import ProgressRing from './ProgressRing.svelte';

  const { Story } = defineMeta({
    title: 'Components/ProgressRing',
    component: ProgressRing,
    tags: ['autodocs'],
    argTypes: {
      progress: {
        control: { type: 'range', min: 0, max: 100, step: 1 },
        description: 'Progress value (0-100)',
      },
      size: {
        control: { type: 'number', min: 40, max: 200, step: 10 },
        description: 'Ring size in pixels',
      },
      strokeWidth: {
        control: { type: 'number', min: 2, max: 20, step: 1 },
        description: 'Stroke width in pixels',
      },
      color: {
        control: 'color',
        description: 'Progress ring color',
      },
      showLabel: {
        control: 'boolean',
        description: 'Show progress label',
      },
      label: {
        control: 'text',
        description: 'Custom label text',
      },
    },
  });
</script>

<Story 
  name="Default" 
  args={{ 
    progress: 50,
    size: 60,
    strokeWidth: 6,
    color: 'var(--accent)',
    showLabel: true
  }}
>
  <ProgressRing progress={50} />
</Story>

<Story 
  name="Different Progress Values" 
  args={{ 
    progress: 75,
    size: 60,
    strokeWidth: 6
  }}
>
  <div style="display: flex; gap: 20px; align-items: center;">
    <ProgressRing progress={0} />
    <ProgressRing progress={25} />
    <ProgressRing progress={50} />
    <ProgressRing progress={75} />
    <ProgressRing progress={100} />
  </div>
</Story>

<Story 
  name="Different Sizes" 
  args={{ 
    progress: 60,
    strokeWidth: 6
  }}
>
  <div style="display: flex; gap: 20px; align-items: center;">
    <ProgressRing progress={60} size={40} />
    <ProgressRing progress={60} size={60} />
    <ProgressRing progress={60} size={80} />
    <ProgressRing progress={60} size={100} />
  </div>
</Story>

<Story 
  name="Custom Colors" 
  args={{ 
    progress: 70,
    size: 60,
    strokeWidth: 6
  }}
>
  <div style="display: flex; gap: 20px; align-items: center;">
    <ProgressRing progress={70} color="var(--accent)" />
    <ProgressRing progress={70} color="var(--success)" />
    <ProgressRing progress={70} color="var(--info)" />
    <ProgressRing progress={70} color="var(--warning)" />
    <ProgressRing progress={70} color="var(--danger)" />
  </div>
</Story>

<Story 
  name="Custom Label" 
  args={{ 
    progress: 85,
    size: 60,
    strokeWidth: 6,
    label: '85%'
  }}
>
  <ProgressRing progress={85} label="85%" />
</Story>

<Story 
  name="No Label" 
  args={{ 
    progress: 45,
    size: 60,
    strokeWidth: 6,
    showLabel: false
  }}
>
  <ProgressRing progress={45} showLabel={false} />
</Story>

