<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import TruncatedText from './TruncatedText.svelte';

  const { Story } = defineMeta({
    title: 'Components/TruncatedText',
    component: TruncatedText,
    tags: ['autodocs'],
    argTypes: {
      position: {
        control: { type: 'select' },
        options: ['top', 'bottom', 'left', 'right', 'auto'],
        description: 'Tooltip position',
      },
      level: {
        control: { type: 'select' },
        options: ['log', 'info', 'warning', 'error'],
        description: 'Tooltip level',
      },
      delay: {
        control: { type: 'number', min: 0, max: 1000, step: 100 },
        description: 'Tooltip delay in milliseconds',
      },
    },
  });
</script>

<Story 
  name="Truncated Text" 
  args={{ 
    position: 'bottom',
    level: 'log'
  }}
>
  <div style="width: 200px; padding: 20px;">
    <TruncatedText position="bottom">
      <span style="display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        This is a very long text that will be truncated and show a tooltip
      </span>
    </TruncatedText>
  </div>
</Story>

<Story 
  name="Non-Truncated Text" 
  args={{ 
    position: 'bottom',
    level: 'log'
  }}
>
  <div style="width: 500px; padding: 20px;">
    <TruncatedText position="bottom">
      <span style="display: block;">
        Short text that won't be truncated
      </span>
    </TruncatedText>
  </div>
</Story>

<Story 
  name="Info Level" 
  args={{ 
    position: 'bottom',
    level: 'info'
  }}
>
  <div style="width: 200px; padding: 20px;">
    <TruncatedText position="bottom" level="info">
      <span style="display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        This truncated text has an info level tooltip
      </span>
    </TruncatedText>
  </div>
</Story>

