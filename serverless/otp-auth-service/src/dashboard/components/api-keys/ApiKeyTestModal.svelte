<script lang="ts">
  import type { ApiKeyVerifyResponse } from '$dashboard/lib/types';

  export let show = false;
  export let loading = false;
  export let error: string | null = null;
  export let result: ApiKeyVerifyResponse | null = null;

  function close() {
    show = false;
    result = null;
    error = null;
  }
</script>

{#if show}
  <div class="modal" role="dialog" tabindex="-1" aria-modal="true" aria-labelledby="test-modal-title"
    onclick={(e) => e.target === e.currentTarget && close()}
    onkeydown={(e) => e.key === 'Escape' && close()}>
    <div class="modal__content">
      <button class="modal__close" onclick={close} aria-label="Close modal">×</button>

      {#if loading}
        <div class="modal__loading">
          <div class="modal__spinner"></div>
          <p>Testing API key...</p>
        </div>
      {:else if error}
        <h2 id="test-modal-title" class="modal__title modal__title--error">✗ Test Failed</h2>
        <p class="modal__text">{error}</p>
      {:else if result}
        <h2 id="test-modal-title" class="modal__title"
          class:modal__title--success={result.valid}
          class:modal__title--error={!result.valid}>
          {result.valid ? '✓ Multi-Tenant Integration Test Passed' : '✗ Integration Test Failed'}
        </h2>

        {#if result.testSummary}
          <p class="modal__summary"
            class:modal__summary--success={result.valid}
            class:modal__summary--error={!result.valid}>
            {result.testSummary}
          </p>
        {/if}

        {#if result.testSteps?.length}
          <div class="modal__section">
            <h3>Test Steps</h3>
            <ul class="modal__steps">
              {#each result.testSteps as step}
                <li class="modal__step"
                  class:modal__step--passed={step.status === 'passed'}
                  class:modal__step--failed={step.status === 'failed'}
                  class:modal__step--skipped={step.status === 'skipped'}>
                  <span class="modal__step-num">{step.step}</span>
                  <span class="modal__step-icon">
                    {#if step.status === 'passed'}✓{:else if step.status === 'failed'}✗{:else if step.status === 'skipped'}○{:else}•{/if}
                  </span>
                  <div class="modal__step-body">
                    <span class="modal__step-name">{step.name}</span>
                    <span class="modal__step-msg">{step.message}</span>
                    {#if step.duration !== undefined}
                      <span class="modal__step-dur">{step.duration}ms</span>
                    {/if}
                  </div>
                </li>
              {/each}
            </ul>
          </div>
        {/if}

        {#if result.valid}
          <div class="modal__details">
            <div class="modal__section">
              <h3>Key Information</h3>
              <dl class="modal__dl">
                <dt>Key ID</dt><dd>{result.keyId}</dd>
                <dt>Name</dt><dd>{result.name}</dd>
                <dt>Customer ID</dt><dd><code>{result.customerId}</code></dd>
                <dt>Status</dt><dd><span class="modal__badge modal__badge--active">{result.status}</span></dd>
                <dt>Plan</dt><dd><span class="modal__plan">{result.customerPlan}</span></dd>
              </dl>
            </div>

            {#if result.rateLimits}
              <div class="modal__section">
                <h3>Rate Limits</h3>
                <dl class="modal__dl">
                  <dt>Per Hour</dt><dd>{result.rateLimits.requestsPerHour.toLocaleString()} requests</dd>
                  <dt>Per Day</dt><dd>{result.rateLimits.requestsPerDay.toLocaleString()} requests</dd>
                </dl>
              </div>
            {/if}

            <div class="modal__section">
              <h3>Available Services ({result.services.filter((s: { available: boolean }) => s.available).length}/{result.services.length})</h3>
              <ul class="modal__services">
                {#each result.services as svc}
                  <li class:svc--on={svc.available} class:svc--off={!svc.available}>
                    <span class="svc__icon">{svc.available ? '✓' : '✗'}</span>
                    <span class="svc__name">{svc.name}</span>
                    <code class="svc__url">{svc.endpoint}</code>
                  </li>
                {/each}
              </ul>
            </div>
          </div>
        {:else}
          <p class="modal__text modal__text--error">{result.error || 'The API key is not valid.'}</p>
        {/if}
      {/if}
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
    position: relative;
    background: var(--card); border: 2px solid var(--accent);
    border-radius: var(--radius-md); padding: var(--spacing-xl);
    max-width: 700px; width: 90%; max-height: 80vh; overflow-y: auto;
  }
  .modal__close {
    position: absolute; top: var(--spacing-sm); right: var(--spacing-sm);
    background: transparent; border: none; color: var(--text-secondary);
    font-size: 1.5rem; cursor: pointer; padding: var(--spacing-xs); line-height: 1;
  }
  .modal__close:hover { color: var(--text); }
  .modal__title { margin-bottom: var(--spacing-lg); color: var(--accent); }
  .modal__title--success { color: var(--success); }
  .modal__title--error { color: var(--danger); }
  .modal__text { margin-bottom: var(--spacing-md); color: var(--text-secondary); }
  .modal__text--error { color: var(--danger); }

  .modal__loading { text-align: center; padding: var(--spacing-xl); }
  .modal__spinner {
    width: 40px; height: 40px; border: 4px solid var(--border);
    border-top-color: var(--accent); border-radius: 50%;
    animation: spin 1s linear infinite; margin: 0 auto var(--spacing-md);
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .modal__summary {
    padding: var(--spacing-md); border-radius: var(--radius-md);
    margin-bottom: var(--spacing-lg); font-weight: 600;
  }
  .modal__summary--success { background: rgba(0,210,106,0.15); border: 1px solid var(--success); color: var(--success); }
  .modal__summary--error { background: rgba(255,71,87,0.15); border: 1px solid var(--danger); color: var(--danger); }

  .modal__section {
    margin-bottom: var(--spacing-lg); padding: var(--spacing-md);
    background: var(--bg-dark); border-radius: var(--radius-md);
  }
  .modal__section h3 { margin-bottom: var(--spacing-sm); font-size: 1rem; color: var(--accent); }

  .modal__dl {
    display: grid; grid-template-columns: auto 1fr;
    gap: var(--spacing-xs) var(--spacing-md);
  }
  .modal__dl dt { color: var(--text-secondary); font-size: 0.875rem; }
  .modal__dl dd { margin: 0; font-size: 0.875rem; }

  .modal__plan {
    padding: var(--spacing-xs) var(--spacing-sm); background: var(--accent);
    color: #000; border-radius: var(--radius-sm); font-size: 0.75rem;
    font-weight: 600; text-transform: uppercase;
  }
  .modal__badge--active { background: var(--success); color: #000; padding: var(--spacing-xs) var(--spacing-sm); border-radius: var(--radius-sm); font-size: 0.875rem; font-weight: 600; }

  .modal__steps { list-style: none; padding: 0; margin: 0; }
  .modal__step {
    display: flex; align-items: flex-start; gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md); margin-bottom: var(--spacing-xs);
    border-radius: var(--radius-sm); background: var(--bg-dark); border-left: 3px solid var(--border);
  }
  .modal__step--passed { border-left-color: var(--success); }
  .modal__step--failed { border-left-color: var(--danger); background: rgba(255,71,87,0.1); }
  .modal__step--skipped { border-left-color: var(--warning); opacity: 0.7; }

  .modal__step-num {
    width: 20px; height: 20px; border-radius: 50%; background: var(--border);
    color: var(--text); display: flex; align-items: center; justify-content: center;
    font-size: 0.75rem; font-weight: 700; flex-shrink: 0;
  }
  .modal__step--passed .modal__step-num { background: var(--success); color: #000; }
  .modal__step--failed .modal__step-num { background: var(--danger); color: #000; }

  .modal__step-icon { font-size: 1rem; width: 20px; text-align: center; flex-shrink: 0; }
  .modal__step--passed .modal__step-icon { color: var(--success); }
  .modal__step--failed .modal__step-icon { color: var(--danger); }
  .modal__step--skipped .modal__step-icon { color: var(--warning); }

  .modal__step-body { flex: 1; display: flex; flex-direction: column; gap: 2px; }
  .modal__step-name { font-weight: 600; font-size: 0.875rem; }
  .modal__step-msg { font-size: 0.75rem; color: var(--text-secondary); word-break: break-word; }
  .modal__step-dur { font-size: 0.625rem; color: var(--muted); font-family: monospace; }

  .modal__details { margin-top: var(--spacing-lg); }

  .modal__services { list-style: none; padding: 0; margin: 0; }
  .modal__services li {
    display: flex; align-items: center; gap: var(--spacing-sm);
    padding: var(--spacing-xs) 0; font-size: 0.875rem;
  }
  .svc--on .svc__icon { color: var(--success); }
  .svc--off { opacity: 0.5; }
  .svc--off .svc__icon { color: var(--danger); }
  .svc__name { flex: 1; }
  .svc__url {
    font-family: monospace; font-size: 0.75rem; color: var(--text-secondary);
    background: var(--bg); padding: 2px var(--spacing-xs); border-radius: var(--radius-sm);
  }
</style>
