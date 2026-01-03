<script lang="ts">
  import CodeBlock from '../lib/CodeBlock.svelte';
  import { 
    vanillaJsExample, 
    reactExample, 
    svelteExample,
    vanillaJsApiKeyExample,
    reactApiKeyExample,
    svelteApiKeyExample
  } from '../lib/code-examples';

  let activeTab = 'vanilla';
  let activeMode: 'otp' | 'apikey' = 'otp';

  function switchTab(tab: string) {
    activeTab = tab;
  }

  function switchMode(mode: 'otp' | 'apikey') {
    activeMode = mode;
  }
</script>

<section class="code-examples" id="code-examples">
  <h2>Get Started in Minutes</h2>
  <p class="subtitle">
    Choose your framework and authentication method. All examples use the same simple API.
  </p>
  
  <div class="mode-selector">
    <button 
      class="mode-button" 
      class:active={activeMode === 'otp'} 
      on:click={() => switchMode('otp')}
    >
      🔐 OTP Flow (User Authentication)
    </button>
    <button 
      class="mode-button" 
      class:active={activeMode === 'apikey'} 
      on:click={() => switchMode('apikey')}
    >
      🔑 API Key (Server-to-Server)
    </button>
  </div>

  <div class="info-box" class:apikey={activeMode === 'apikey'}>
    {#if activeMode === 'otp'}
      <strong>💡 OTP Flow:</strong> Perfect for user-facing applications. Users enter their email, receive an OTP code, and get a JWT token for authenticated requests.
    {:else}
      <strong>💡 API Key Authentication:</strong> Perfect for server-to-server calls, multi-tenant applications, and backend integrations. Get your API key from the <a href="/dashboard">dashboard</a> or from the signup response.
    {/if}
  </div>
  
  <div class="code-tabs">
    <button class="code-tab" class:active={activeTab === 'vanilla'} on:click={() => switchTab('vanilla')}>Vanilla JS/TS</button>
    <button class="code-tab" class:active={activeTab === 'react'} on:click={() => switchTab('react')}>React</button>
    <button class="code-tab" class:active={activeTab === 'svelte'} on:click={() => switchTab('svelte')}>Svelte</button>
  </div>

  {#if activeMode === 'otp'}
    {#if activeTab === 'vanilla'}
      <CodeBlock code={vanillaJsExample} language="javascript" />
    {:else if activeTab === 'react'}
      <CodeBlock code={reactExample} language="jsx" />
    {:else if activeTab === 'svelte'}
      <CodeBlock code={svelteExample} language="svelte" />
    {/if}
  {:else}
    {#if activeTab === 'vanilla'}
      <CodeBlock code={vanillaJsApiKeyExample} language="javascript" />
    {:else if activeTab === 'react'}
      <CodeBlock code={reactApiKeyExample} language="jsx" />
    {:else if activeTab === 'svelte'}
      <CodeBlock code={svelteApiKeyExample} language="svelte" />
    {/if}
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

  .mode-selector {
    display: flex;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-lg);
    justify-content: center;
    flex-wrap: wrap;
  }

  .mode-button {
    padding: var(--spacing-sm) var(--spacing-lg);
    background: var(--bg-secondary, #f5f5f5);
    border: 2px solid var(--border, #ddd);
    border-radius: 6px;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 600;
    transition: all 0.2s;
  }

  .mode-button:hover {
    background: var(--bg-hover, #e9ecef);
    border-color: var(--accent, #007bff);
  }

  .mode-button.active {
    background: var(--accent, #007bff);
    color: white;
    border-color: var(--accent, #007bff);
  }

  .info-box {
    background: #e7f3ff;
    border-left: 4px solid #007bff;
    padding: var(--spacing-md);
    margin-bottom: var(--spacing-lg);
    border-radius: 4px;
    color: #004085;
  }

  .info-box.apikey {
    background: #fff3cd;
    border-left-color: #ffc107;
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
    }

    .mode-selector {
      flex-direction: column;
    }

    .mode-button {
      width: 100%;
    }
  }
</style>
