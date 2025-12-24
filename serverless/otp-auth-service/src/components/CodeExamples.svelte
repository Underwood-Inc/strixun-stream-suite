<script lang="ts">
  import CodeBlock from '../lib/CodeBlock.svelte';
  import { vanillaJsExample, reactExample, svelteExample } from '../lib/code-examples';

  let activeTab = 'vanilla';

  function switchTab(tab: string) {
    activeTab = tab;
  }
</script>

<section class="code-examples" id="code-examples">
  <h2>Get Started in Minutes</h2>
  <p class="subtitle">
    Choose your framework and start integrating. All examples use the same simple API.
  </p>
  
  <div class="code-tabs">
    <button class="code-tab" class:active={activeTab === 'vanilla'} on:click={() => switchTab('vanilla')}>Vanilla JS/TS</button>
    <button class="code-tab" class:active={activeTab === 'react'} on:click={() => switchTab('react')}>React</button>
    <button class="code-tab" class:active={activeTab === 'svelte'} on:click={() => switchTab('svelte')}>Svelte</button>
  </div>

  {#if activeTab === 'vanilla'}
    <CodeBlock code={vanillaJsExample} language="javascript" />
  {:else if activeTab === 'react'}
    <CodeBlock code={reactExample} language="jsx" />
  {:else if activeTab === 'svelte'}
    <CodeBlock code={svelteExample} language="svelte" />
  {/if}
</section>

<style>
  .code-examples {
    padding: var(--spacing-3xl) var(--spacing-xl);
    max-width: 1200px;
    margin: 0 auto;
  }

  .code-examples h2 {
    text-align: center;
    font-size: clamp(2rem, 4vw, 3rem);
    margin-bottom: var(--spacing-lg);
    color: var(--accent);
  }

  .subtitle {
    text-align: center;
    color: var(--text-secondary);
    margin-bottom: var(--spacing-xl);
  }

  .code-tabs {
    display: flex;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-lg);
    flex-wrap: wrap;
    border-bottom: 2px solid var(--border);
  }

  .code-tab {
    padding: var(--spacing-sm) var(--spacing-lg);
    background: transparent;
    border: none;
    border-bottom: 3px solid transparent;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    transition: all 0.2s;
    margin-bottom: -2px;
  }

  .code-tab:hover {
    color: var(--text);
    border-bottom-color: var(--border-light);
  }

  .code-tab.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }

  @media (max-width: 768px) {
    .code-examples {
      padding: var(--spacing-2xl) var(--spacing-md);
    }

    .code-tabs {
      overflow-x: auto;
    }
  }
</style>
