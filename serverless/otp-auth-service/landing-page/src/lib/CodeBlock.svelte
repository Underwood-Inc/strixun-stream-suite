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

  onMount(() => {
    if (codeElement) {
      Prism.highlightElement(codeElement);
    }
  });
</script>

<pre><code class="language-{language}" bind:this={codeElement}>{code}</code></pre>

<style>
  pre {
    background: var(--bg-dark);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--spacing-lg);
    overflow-x: auto;
    margin: var(--spacing-md) 0;
  }

  code {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
    font-size: 0.875rem;
    line-height: 1.6;
  }
</style>

