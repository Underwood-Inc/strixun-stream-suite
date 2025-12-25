<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import ResizableZone from './ResizableZone.svelte';

  const { Story } = defineMeta({
    title: 'Components/Primitives/ResizableZone',
    component: ResizableZone,
    tags: ['autodocs'],
    argTypes: {
      direction: {
        control: { type: 'select' },
        options: ['vertical', 'horizontal'],
        description: 'Resize direction',
      },
      minSize: {
        control: { type: 'number', min: 50, max: 500, step: 10 },
        description: 'Minimum size in pixels',
      },
      maxSize: {
        control: { type: 'number', min: 100, max: 1000, step: 50 },
        description: 'Maximum size in pixels',
      },
      defaultSize: {
        control: { type: 'number', min: 100, max: 500, step: 10 },
        description: 'Default size in pixels',
      },
      handlePosition: {
        control: { type: 'select' },
        options: ['start', 'end'],
        description: 'Handle position',
      },
      disabled: {
        control: 'boolean',
        description: 'Disable resizing',
      },
    },
  });
</script>

<Story 
  name="Vertical Resize" 
  args={{ 
    direction: 'vertical',
    minSize: 100,
    maxSize: 600,
    defaultSize: 200,
    handlePosition: 'end'
  }}
>
  <div style="display: flex; height: 500px; border: 1px solid var(--border);">
    <div style="flex: 1; padding: 20px; background: var(--card);">
      <h3>Main Content</h3>
      <p>This is the main content area.</p>
    </div>
    <ResizableZone 
      direction="vertical"
      minSize={100}
      maxSize={600}
      defaultSize={200}
      handlePosition="end"
    >
      <div slot="content" style="padding: 20px; background: var(--bg-dark); height: 100%;">
        <h3>Resizable Panel</h3>
        <p>Drag the handle to resize this panel.</p>
      </div>
    </ResizableZone>
  </div>
</Story>

<Story 
  name="Horizontal Resize" 
  args={{ 
    direction: 'horizontal',
    minSize: 100,
    maxSize: 600,
    defaultSize: 200,
    handlePosition: 'end'
  }}
>
  <div style="display: flex; flex-direction: column; height: 500px; border: 1px solid var(--border);">
    <div style="flex: 1; padding: 20px; background: var(--card);">
      <h3>Main Content</h3>
      <p>This is the main content area.</p>
    </div>
    <ResizableZone 
      direction="horizontal"
      minSize={100}
      maxSize={600}
      defaultSize={200}
      handlePosition="end"
    >
      <div slot="content" style="padding: 20px; background: var(--bg-dark); width: 100%;">
        <h3>Resizable Panel</h3>
        <p>Drag the handle to resize this panel.</p>
      </div>
    </ResizableZone>
  </div>
</Story>

<Story 
  name="Disabled" 
  args={{ 
    direction: 'vertical',
    minSize: 100,
    maxSize: 600,
    defaultSize: 200,
    handlePosition: 'end',
    disabled: true
  }}
>
  <div style="display: flex; height: 500px; border: 1px solid var(--border);">
    <div style="flex: 1; padding: 20px; background: var(--card);">
      <h3>Main Content</h3>
      <p>This is the main content area.</p>
    </div>
    <ResizableZone 
      direction="vertical"
      minSize={100}
      maxSize={600}
      defaultSize={200}
      handlePosition="end"
      disabled={true}
    >
      <div slot="content" style="padding: 20px; background: var(--bg-dark); height: 100%;">
        <h3>Resizable Panel (Disabled)</h3>
        <p>Resizing is disabled for this panel.</p>
      </div>
    </ResizableZone>
  </div>
</Story>















