<script lang="ts">
  import CodeBlock from '@shared-components/svelte/CodeBlock.svelte';

  export let show = false;
  export let snippet = '';

  function close() {
    show = false;
    snippet = '';
  }

  function download() {
    if (!snippet) return;
    const blob = new Blob([snippet], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'otp-auth-test.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
</script>

{#if show}
  <div class="modal" role="dialog" tabindex="-1" aria-modal="true" aria-labelledby="snippet-modal-title"
    onclick={(e) => e.target === e.currentTarget && close()}
    onkeydown={(e) => e.key === 'Escape' && close()}>
    <div class="modal__content">
      <div class="modal__header">
        <h2 id="snippet-modal-title" class="modal__title">End-to-End Test Page</h2>
        <button class="modal__close" onclick={close} aria-label="Close modal">x</button>
      </div>

      <div class="modal__body">
        <p class="modal__text">
          Download or copy this HTML code. Open it in your browser to test the complete OTP flow.
        </p>

        <div class="modal__instructions">
          <h4>Instructions:</h4>
          <ol>
            <li>Click "Download HTML" below to save the file</li>
            <li>Open the downloaded file in your browser</li>
            <li>Enter your email and test the full OTP flow</li>
          </ol>
        </div>

        <div class="modal__snippet">
          {#if snippet}
            <CodeBlock code={snippet} language="html" />
          {:else}
            <div class="modal__loading">
              <div class="modal__spinner"></div>
              <p>Generating test page...</p>
            </div>
          {/if}
        </div>
      </div>

      <div class="modal__footer">
        <button class="modal__btn modal__btn--secondary" onclick={close}>Close</button>
        <button class="modal__btn modal__btn--download" onclick={download} disabled={!snippet}>
          Download HTML
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal {
    position: fixed; inset: 0; background: rgba(0,0,0,0.8);
    display: flex; align-items: center; justify-content: center;
    z-index: 10000; padding: 1rem;
  }
  .modal__content {
    background: var(--card); border: 2px solid var(--accent);
    border-radius: var(--radius-md); padding: var(--spacing-xl);
    max-width: 900px; width: 95%; max-height: 80vh;
    overflow-y: auto; display: flex; flex-direction: column;
  }
  .modal__header {
    display: flex; justify-content: space-between; align-items: center;
    padding-bottom: var(--spacing-md); border-bottom: 1px solid var(--border);
    margin-bottom: var(--spacing-md);
  }
  .modal__title { margin: 0; color: var(--accent); }
  .modal__close {
    background: transparent; border: none; color: var(--text-secondary);
    font-size: 1.5rem; cursor: pointer; padding: var(--spacing-xs); line-height: 1;
  }
  .modal__close:hover { color: var(--text); }
  .modal__body { flex: 1; overflow-y: auto; }
  .modal__text { margin-bottom: var(--spacing-md); color: var(--text-secondary); }
  .modal__footer {
    display: flex; justify-content: flex-end; gap: var(--spacing-md);
    padding-top: var(--spacing-md); border-top: 1px solid var(--border);
    margin-top: var(--spacing-md);
  }
  .modal__instructions {
    background: var(--bg-dark); border-radius: var(--radius-md);
    padding: var(--spacing-md); margin-bottom: var(--spacing-lg);
  }
  .modal__instructions h4 { margin-bottom: var(--spacing-sm); color: var(--accent); }
  .modal__instructions ol {
    margin: 0; padding-left: var(--spacing-lg);
    color: var(--text-secondary); font-size: 0.875rem;
  }
  .modal__instructions li { margin-bottom: var(--spacing-xs); }
  .modal__snippet {
    background: var(--bg-dark); border: 1px solid var(--border);
    border-radius: var(--radius-md); max-height: 400px;
    overflow: auto; margin-bottom: var(--spacing-lg);
  }
  .modal__loading { text-align: center; padding: var(--spacing-xl); }
  .modal__spinner {
    width: 40px; height: 40px; border: 4px solid var(--border);
    border-top-color: var(--accent); border-radius: 50%;
    animation: spin 1s linear infinite; margin: 0 auto var(--spacing-md);
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .modal__btn {
    padding: var(--spacing-sm) var(--spacing-lg); font-weight: 600;
    font-size: 0.875rem; cursor: pointer; border-radius: var(--radius-sm);
  }
  .modal__btn--secondary {
    background: transparent; border: 1px solid var(--border); color: var(--text-secondary);
  }
  .modal__btn--secondary:hover { background: var(--bg-dark); }
  .modal__btn--download {
    background: var(--success); border: none; color: #fff;
    display: inline-flex; align-items: center; gap: var(--spacing-xs);
  }
  .modal__btn--download:disabled { opacity: 0.5; cursor: not-allowed; }

  @media (max-width: 768px) {
    .modal__content { width: 100%; padding: var(--spacing-md); }
  }
</style>
