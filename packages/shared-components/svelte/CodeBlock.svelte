<script lang="ts">
  import { onMount } from 'svelte';
  import Prism from 'prismjs';
  // Base languages
  import 'prismjs/components/prism-markup'; // Must be first for templating
  import 'prismjs/components/prism-markup-templating'; // Required for PHP
  import 'prismjs/components/prism-javascript';
  import 'prismjs/components/prism-jsx';
  import 'prismjs/components/prism-typescript';
  import 'prismjs/components/prism-tsx';
  import 'prismjs/components/prism-json';
  import 'prismjs/components/prism-css';
  import 'prismjs/components/prism-scss';
  import 'prismjs/components/prism-http';
  import 'prismjs/components/prism-bash';
  import 'prismjs/components/prism-python';
  // Additional languages for chat and comprehensive support
  import 'prismjs/components/prism-rust';
  import 'prismjs/components/prism-go';
  import 'prismjs/components/prism-java';
  import 'prismjs/components/prism-c';
  import 'prismjs/components/prism-cpp';
  import 'prismjs/components/prism-csharp';
  import 'prismjs/components/prism-ruby';
  import 'prismjs/components/prism-php'; // Must come after markup-templating
  import 'prismjs/components/prism-swift';
  import 'prismjs/components/prism-kotlin';
  import 'prismjs/components/prism-sql';
  import 'prismjs/components/prism-yaml';
  import 'prismjs/components/prism-toml';
  import 'prismjs/components/prism-docker';
  import 'prismjs/components/prism-markdown';
  import 'prismjs/themes/prism-tomorrow.css';

  export let code: string;
  export let language: string = 'javascript';

  let codeElement: HTMLElement;
  let copied = false;

  // Map languages to Prism-supported languages
  $: prismLanguage = (() => {
    if (language === 'svelte') return 'markup';
    if (language === 'html') return 'markup';
    if (language === 'ts') return 'typescript';
    if (language === 'js') return 'javascript';
    return language;
  })();

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

  // Re-highlight when code or language changes
  $: if (codeElement && code && prismLanguage) {
    Prism.highlightElement(codeElement);
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
    margin: var(--spacing-md, 1rem) 0;
  }

  .copy-button {
    position: absolute;
    top: var(--spacing-sm, 0.5rem);
    right: var(--spacing-sm, 0.5rem);
    display: flex;
    align-items: center;
    gap: var(--spacing-xs, 0.25rem);
    padding: var(--spacing-xs, 0.25rem) var(--spacing-sm, 0.5rem);
    background: var(--bg-dark, #1a1611);
    border: 1px solid var(--border, #3e3e3e);
    border-radius: var(--radius-sm, 4px);
    color: var(--text-secondary, #b0b0b0);
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 10;
    font-family: inherit;
  }

  .copy-button:hover {
    background: var(--bg, #252017);
    color: var(--text, #f9f9f9);
    border-color: var(--border-light, #5a5a5a);
  }

  .copy-button:active {
    transform: scale(0.95);
  }

  .copy-button.copied {
    background: var(--accent, #edae49);
    border-color: var(--accent, #edae49);
    color: var(--bg-dark, #1a1611);
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
    background: var(--bg-dark, #1a1611);
    border: 1px solid var(--border, #3e3e3e);
    border-radius: var(--radius-md, 8px);
    padding: var(--spacing-lg, 1.5rem);
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
      padding: var(--spacing-xs, 0.25rem);
    }
  }
</style>
