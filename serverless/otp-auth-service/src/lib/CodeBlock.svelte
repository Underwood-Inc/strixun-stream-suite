<script lang="ts">
  import { onMount } from 'svelte';
  import Prism from 'prismjs';
  import 'prismjs/components/prism-javascript';
  import 'prismjs/components/prism-jsx';
  import 'prismjs/components/prism-typescript';
  import 'prismjs/components/prism-json';
  import 'prismjs/components/prism-http';
  import 'prismjs/components/prism-bash';
  import 'prismjs/components/prism-python';
  import 'prismjs/components/prism-markup';
  import 'prismjs/themes/prism-tomorrow.css';

  export let code: string;
  export let language: string = 'javascript';

  let codeElement: HTMLElement;
  let copied = false;

  // Map svelte to markup for syntax highlighting
  $: prismLanguage = language === 'svelte' ? 'markup' : language;

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(code);
      copied = true;
      setTimeout(() => {
        copied = false;
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }

  onMount(() => {
    if (codeElement) {
      Prism.highlightElement(codeElement);
    }
  });
</script>

<div class="code-block-wrapper">
  <button
    class="copy-button"
    class:copied={copied}
    on:click={copyToClipboard}
    aria-label="Copy code to clipboard"
    title={copied ? 'Copied!' : 'Copy code'}
  >
    {#if copied}
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M13.5 4L6 11.5L2.5 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span>Copied!</span>
    {:else}
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="5" y="5" width="9" height="9" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/>
        <path d="M3 3V11C3 11.5523 3.44772 12 4 12H11" stroke="currentColor" stroke-width="1.5" fill="none"/>
      </svg>
      <span>Copy</span>
    {/if}
  </button>
  <pre><code class="language-{prismLanguage}" bind:this={codeElement}>{code}</code></pre>
</div>

<style>
  .code-block-wrapper {
    position: relative;
    margin: var(--spacing-md) 0;
  }

  .copy-button {
    position: absolute;
    top: var(--spacing-sm);
    right: var(--spacing-sm);
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-xs) var(--spacing-sm);
    background: var(--bg-dark);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 10;
    font-family: inherit;
  }

  .copy-button:hover {
    background: var(--bg);
    color: var(--text);
    border-color: var(--border-light);
  }

  .copy-button:active {
    transform: scale(0.95);
  }

  .copy-button.copied {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--bg-dark);
  }

  .copy-button svg {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
  }

  .copy-button span {
    white-space: nowrap;
  }

  pre {
    background: var(--bg-dark);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--spacing-lg);
    overflow-x: auto;
    overflow-y: auto;
    max-height: 400px;
    margin: 0;
  }

  code {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
    font-size: 0.875rem;
    line-height: 1.6;
  }

  @media (max-width: 768px) {
    .copy-button span {
      display: none;
    }

    .copy-button {
      padding: var(--spacing-xs);
    }
  }
</style>

