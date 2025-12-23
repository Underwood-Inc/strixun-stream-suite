<script lang="ts">
  /**
   * Simple Text Editor Component
   * 
   * Basic textarea for notes - no rich text, no Prism, no Lexical
   */
  
  export let value: string = '';
  export let placeholder: string = 'Start typing...';
  export let onChange: ((content: string) => void) | null = null;
  
  let textarea: HTMLTextAreaElement;
  let internalValue = value;
  
  $: if (value !== internalValue && textarea) {
    internalValue = value;
    textarea.value = value;
  }
  
  function handleInput(e: Event): void {
    const target = e.target as HTMLTextAreaElement;
    internalValue = target.value;
    value = internalValue;
    if (onChange) {
      onChange(value);
    }
  }
  
  /**
   * Set content programmatically
   */
  export function setContent(content: string): void {
    value = content;
    if (textarea) {
      textarea.value = content;
    }
  }
  
  /**
   * Get content
   */
  export function getContent(): Promise<string> {
    return Promise.resolve(value);
  }
  
  import ComponentDocsButton from './ComponentDocsButton.svelte';
</script>

<div class="simple-text-editor-wrapper" style="position: relative; width: 100%; height: 100%;">
  <ComponentDocsButton componentName="SimpleTextEditor" position="top-right" size="small" />
  <textarea
  bind:this={textarea}
  value={internalValue}
  {placeholder}
  on:input={handleInput}
  class="simple-text-editor"
/>

<style lang="scss">
  @use '@styles/variables' as *;
  @use '@styles/mixins' as *;
  
  .simple-text-editor {
    width: 100%;
    height: 100%;
    min-height: 400px;
    padding: 16px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 16px;
    line-height: 1.6;
    outline: none;
    overflow-y: auto;
    resize: vertical;
    @include scrollbar;
    
    &:focus {
      outline: 2px solid var(--accent);
      outline-offset: -2px;
      border-color: var(--accent);
    }
    
    &::placeholder {
      color: var(--text-secondary);
    }
  }
</style>

</div>

