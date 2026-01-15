<script lang="ts">
  import MultiFileViewer from '@shared-components/svelte/MultiFileViewer.svelte';
  import StatusFlair from '@shared-components/svelte/StatusFlair.svelte';
  import { 
    reactMultiFileExample,
    svelteMultiFileExample,
    vanillaMultiFileExample
  } from '../lib/multi-file-examples';

  let activeTab = 'react';

  function switchTab(tab: string) {
    activeTab = tab;
  }
</script>

<section class="code-examples" id="code-examples">
  <h2>Get Started in Minutes</h2>
  <p class="subtitle">
    Choose your framework. All examples use the same simple API with your API key.
  </p>
  
  <div class="info-box">
    <strong>◆ API Key Required:</strong> All integrations require an API key. <StatusFlair status="in-testing"><strong>Free tier available!</strong></StatusFlair> Get your API key from the <a href="/dashboard">dashboard</a> after signing up. Includes free tier with 1,000 OTP requests/month.
  </div>
  
  <div class="code-tabs">
    <button class="code-tab" class:active={activeTab === 'react'} on:click={() => switchTab('react')}>
      <span class="tab-icon">⚛</span> React + TypeScript
    </button>
    <button class="code-tab" class:active={activeTab === 'svelte'} on:click={() => switchTab('svelte')}>
      <span class="tab-icon">S</span> Svelte + TypeScript
    </button>
    <button class="code-tab" class:active={activeTab === 'vanilla'} on:click={() => switchTab('vanilla')}>
      <span class="tab-icon">JS</span> Vanilla JavaScript
    </button>
  </div>

  {#if activeTab === 'react'}
    <MultiFileViewer files={reactMultiFileExample} />
  {:else if activeTab === 'svelte'}
    <MultiFileViewer files={svelteMultiFileExample} />
  {:else if activeTab === 'vanilla'}
    <MultiFileViewer files={vanillaMultiFileExample} />
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
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
  }

  .code-tab:hover {
    color: var(--text);
    border-bottom-color: var(--border-light);
  }

  .code-tab.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }

  .tab-icon {
    font-size: 1.2rem;
    font-weight: 700;
  }

  .info-box {
    background: #fff3cd;
    border-left: 4px solid #ffc107;
    padding: var(--spacing-md);
    margin-bottom: var(--spacing-lg);
    border-radius: 4px;
    color: #856404;
  }

  .info-box a {
    color: inherit;
    text-decoration: underline;
    font-weight: 600;
  }

  @media (max-width: 768px) {
    .code-examples {
      padding: var(--spacing-2xl) var(--spacing-md);
    }

    .code-tabs {
      overflow-x: auto;
      scrollbar-width: thin;
    }

    .code-tab {
      flex-shrink: 0;
    }

    .info-box {
      font-size: 0.875rem;
    }
  }

  @media (max-width: 480px) {
    .code-examples {
      padding: var(--spacing-xl) var(--spacing-sm);
    }

    .code-examples h2 {
      font-size: 1.75rem;
      margin-bottom: var(--spacing-md);
    }

    .subtitle {
      font-size: 0.9rem;
      margin-bottom: var(--spacing-md);
    }

    .code-tabs {
      gap: var(--spacing-xs);
      margin-bottom: var(--spacing-md);
    }

    .code-tab {
      padding: var(--spacing-xs) var(--spacing-sm);
      font-size: 0.75rem;
      letter-spacing: 0px;
    }

    .info-box {
      padding: var(--spacing-sm);
      font-size: 0.8rem;
      margin-bottom: var(--spacing-md);
    }
  }
</style>
