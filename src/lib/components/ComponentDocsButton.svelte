<script lang="ts">
  /**
   * Component Docs Button
   * 
   * Small button that opens Storybook viewer for a component.
   * Can be added to any component to provide inline documentation access.
   * 
   * @example
   * <ComponentDocsButton componentName="SearchBox" />
   */
  
  import StorybookViewer from './StorybookViewer.svelte';
  
  export let componentName: string;
  export let position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' = 'top-right';
  export let size: 'small' | 'medium' = 'small';
  
  let showStorybook = false;
  
  function toggleStorybook(): void {
    showStorybook = !showStorybook;
  }
</script>

<div class="component-docs-button component-docs-button--{position} component-docs-button--{size}">
  <button
    class="component-docs-button__btn"
    on:click={toggleStorybook}
    title="View {componentName} in Storybook"
    type="button"
  >
    <span class="component-docs-button__icon">📚</span>
  </button>
</div>

<StorybookViewer 
  componentName={componentName}
  open={showStorybook}
  onClose={() => showStorybook = false}
/>

<style lang="scss">
  @use '@styles/animations' as *;
  
  .component-docs-button {
    position: absolute;
    z-index: 100;
    pointer-events: none;
  }
  
  .component-docs-button--top-right {
    top: 8px;
    right: 8px;
  }
  
  .component-docs-button--top-left {
    top: 8px;
    left: 8px;
  }
  
  .component-docs-button--bottom-right {
    bottom: 8px;
    right: 8px;
  }
  
  .component-docs-button--bottom-left {
    bottom: 8px;
    left: 8px;
  }
  
  .component-docs-button__btn {
    pointer-events: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-dark);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s;
    @include gpu-accelerated;
    
    &:hover {
      background: var(--bg);
      border-color: var(--accent);
      color: var(--accent);
      transform: scale(1.05);
    }
    
    &:active {
      transform: scale(0.95);
    }
  }
  
  .component-docs-button--small .component-docs-button__btn {
    width: 24px;
    height: 24px;
    padding: 4px;
  }
  
  .component-docs-button--medium .component-docs-button__btn {
    width: 32px;
    height: 32px;
    padding: 6px;
  }
  
  .component-docs-button__icon {
    font-size: 14px;
    line-height: 1;
  }
  
  .component-docs-button--medium .component-docs-button__icon {
    font-size: 18px;
  }
</style>



