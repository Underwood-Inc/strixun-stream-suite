<script lang="ts">
  import { createEventDispatcher, afterUpdate, tick } from 'svelte';
  
  export let id: string;
  export let title: string;
  export let isActive: boolean = false;
  
  let accordionHeader: HTMLElement;
  let previousActiveState = false;
  
  function handleClick() {
    dispatch('toggle', { id });
  }
  
  const dispatch = createEventDispatcher();
  
  // Scroll to accordion header when it expands
  afterUpdate(async () => {
    // Only scroll if accordion just became active (expanded)
    if (isActive && !previousActiveState && accordionHeader) {
      // Wait for the accordion content to start expanding
      await tick();
      // Small delay to ensure the DOM has updated
      requestAnimationFrame(() => {
        accordionHeader.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      });
    }
    previousActiveState = isActive;
  });
</script>

<div class="accordion" class:active={isActive}>
  <div class="accordion-header" bind:this={accordionHeader} on:click={handleClick}>
    <h3>{title}</h3>
    <span class="accordion-icon">▼</span>
  </div>
  <div class="accordion-content">
    <div class="accordion-body">
      <slot />
    </div>
  </div>
</div>

<style>
  .accordion {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    margin-bottom: var(--spacing-md);
    overflow: hidden;
  }

  .accordion-header {
    padding: var(--spacing-lg);
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--bg-dark);
    transition: background 0.2s;
  }

  .accordion-header:hover {
    background: var(--card);
  }

  .accordion-header h3 {
    font-size: 1.1rem;
    color: var(--text);
    margin: 0;
  }

  .accordion-icon {
    transition: transform 0.3s;
    color: var(--accent);
    font-size: 1.25rem;
  }

  .accordion.active .accordion-icon {
    transform: rotate(180deg);
  }

  .accordion-content {
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.3s ease-out;
  }

  .accordion.active .accordion-content {
    max-height: 5000px;
  }

  .accordion-body {
    padding: var(--spacing-lg);
    color: var(--text-secondary);
  }

  .accordion-body :global(h4) {
    color: var(--accent);
    margin-top: var(--spacing-lg);
    margin-bottom: var(--spacing-sm);
  }

  .accordion-body :global(h5) {
    color: var(--accent);
    margin-top: var(--spacing-md);
    margin-bottom: var(--spacing-sm);
    font-size: 1rem;
  }

  .accordion-body :global(ul),
  .accordion-body :global(ol) {
    margin-left: var(--spacing-lg);
    margin-bottom: var(--spacing-md);
  }

  .accordion-body :global(li) {
    margin-bottom: var(--spacing-xs);
  }

  .accordion-body :global(code) {
    background: var(--bg-dark);
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
    font-size: 0.875rem;
    color: var(--accent);
  }

  @media (max-width: 768px) {
    .accordion-header {
      padding: var(--spacing-md);
    }

    .accordion-header h3 {
      font-size: 1rem;
    }

    .accordion-icon {
      font-size: 1rem;
    }

    .accordion-body {
      padding: var(--spacing-md);
    }
  }

  @media (max-width: 480px) {
    .accordion-header {
      padding: var(--spacing-sm);
    }

    .accordion-header h3 {
      font-size: 0.9rem;
    }

    .accordion-icon {
      font-size: 0.9rem;
    }

    .accordion-body {
      padding: var(--spacing-sm);
      font-size: 0.875rem;
    }

    .accordion-body :global(h4) {
      font-size: 1rem;
    }

    .accordion-body :global(h5) {
      font-size: 0.9rem;
    }

    .accordion-body :global(code) {
      font-size: 0.8rem;
      padding: 1px 4px;
    }
  }
</style>

