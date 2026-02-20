<script lang="ts">
  export let show = false;
  export let apiKey: string | null = null;

  function copyToClipboard() {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey);
    alert('API key copied to clipboard!');
    show = false;
    apiKey = null;
  }

  function close() {
    show = false;
    apiKey = null;
  }
</script>

{#if show && apiKey}
  <div
    class="modal"
    role="dialog"
    tabindex="-1"
    aria-modal="true"
    aria-labelledby="new-key-title"
    onclick={(e) => e.target === e.currentTarget && close()}
    onkeydown={(e) => e.key === 'Escape' && close()}
  >
    <div class="modal__content">
      <h2 id="new-key-title" class="modal__title">⚠ API Key Created</h2>
      <p class="modal__text">Copy this API key now. You won't be able to see it again!</p>
      <div class="modal__key">{apiKey}</div>
      <button class="modal__btn" onclick={copyToClipboard}>Copy to Clipboard</button>
    </div>
  </div>
{/if}

<style>
  .modal {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.8);
    display: flex; align-items: center; justify-content: center;
    z-index: 10000; padding: 1rem;
  }

  .modal__content {
    background: var(--card);
    border: 2px solid var(--accent);
    border-radius: var(--radius-md);
    padding: var(--spacing-xl);
    max-width: 600px; width: 90%;
  }

  .modal__title { margin-bottom: var(--spacing-lg); color: var(--accent); }
  .modal__text { margin-bottom: var(--spacing-md); color: var(--text-secondary); }

  .modal__key {
    background: var(--bg-dark);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: var(--spacing-md);
    margin-bottom: var(--spacing-lg);
    font-family: monospace;
    word-break: break-all;
    color: var(--accent);
    font-weight: 600;
  }

  .modal__btn {
    padding: var(--spacing-md) var(--spacing-lg);
    background: var(--accent); border: 3px solid var(--accent-dark);
    border-radius: 0; color: #000; font-weight: 700; cursor: pointer;
    box-shadow: 0 4px 0 var(--accent-dark);
  }

  .modal__btn:hover { transform: translateY(-2px); box-shadow: 0 6px 0 var(--accent-dark); }
</style>
