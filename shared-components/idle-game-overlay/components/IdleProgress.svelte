<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { gameApi } from '../services/game-api.js';
  import type { IdleProgressResult } from '../types/index.js';

  let progress: IdleProgressResult | null = null;
  let loading = true;
  let error: string | null = null;
  let claiming = false;
  let refreshInterval: number | null = null;

  onMount(async () => {
    await loadProgress();
    // Refresh every 30 seconds
    refreshInterval = window.setInterval(loadProgress, 30000);
  });

  onDestroy(() => {
    if (refreshInterval !== null) {
      clearInterval(refreshInterval);
    }
  });

  async function loadProgress() {
    try {
      loading = true;
      error = null;
      progress = await gameApi.getIdleProgress();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load idle progress';
      console.error('Failed to load idle progress:', err);
    } finally {
      loading = false;
    }
  }

  async function handleClaim() {
    if (claiming || !progress) return;

    try {
      claiming = true;
      error = null;
      await gameApi.claimIdleRewards();
      await loadProgress(); // Refresh after claim
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to claim rewards';
      console.error('Failed to claim rewards:', err);
    } finally {
      claiming = false;
    }
  }

  function formatTime(hours: number): string {
    if (hours < 1) {
      const minutes = Math.floor(hours * 60);
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    if (m === 0) {
      return `${h} hour${h !== 1 ? 's' : ''}`;
    }
    return `${h}h ${m}m`;
  }
</script>

<div class="idle-progress">
  {#if loading}
    <div class="idle-progress__loading">Loading idle progress...</div>
  {:else if error}
    <div class="idle-progress__error">
      <p class="idle-progress__error-message">{error}</p>
      <button class="idle-progress__retry" on:click={loadProgress}>Retry</button>
    </div>
  {:else if progress}
    <div class="idle-progress__header">
      <h3 class="idle-progress__title">Idle Progress</h3>
      {#if progress.lastActiveAt}
        <p class="idle-progress__last-active">
          Last active: {new Date(progress.lastActiveAt).toLocaleString()}
        </p>
      {/if}
    </div>

    <div class="idle-progress__stats">
      <div class="idle-progress__stat">
        <span class="idle-progress__stat-label">Offline Time:</span>
        <span class="idle-progress__stat-value">{formatTime(progress.offlineHours)}</span>
      </div>
      <div class="idle-progress__stat">
        <span class="idle-progress__stat-label">Capped Time:</span>
        <span class="idle-progress__stat-value">{formatTime(progress.cappedHours)}</span>
      </div>
    </div>

    {#if progress.rewards && (progress.rewards.gold > 0 || progress.rewards.experience > 0 || Object.keys(progress.rewards.materials).length > 0)}
      <div class="idle-progress__rewards">
        <h4 class="idle-progress__rewards-title">Available Rewards</h4>
        <div class="idle-progress__rewards-list">
          {#if progress.rewards.gold > 0}
            <div class="idle-progress__reward-item">
              <span class="idle-progress__reward-label">Gold:</span>
              <span class="idle-progress__reward-value">+{progress.rewards.gold}</span>
            </div>
          {/if}
          {#if progress.rewards.experience > 0}
            <div class="idle-progress__reward-item">
              <span class="idle-progress__reward-label">Experience:</span>
              <span class="idle-progress__reward-value">+{progress.rewards.experience}</span>
            </div>
          {/if}
          {#each Object.entries(progress.rewards.materials) as [material, quantity]}
            {#if quantity > 0}
              <div class="idle-progress__reward-item">
                <span class="idle-progress__reward-label">{material}:</span>
                <span class="idle-progress__reward-value">+{quantity}</span>
              </div>
            {/if}
          {/each}
        </div>
      </div>

      <div class="idle-progress__actions">
        <button 
          class="idle-progress__claim"
          class:idle-progress__claim--disabled={claiming}
          on:click={handleClaim}
          disabled={claiming}
        >
          {#if claiming}
            Claiming...
          {:else}
            Claim Rewards
          {/if}
        </button>
      </div>
    {:else}
      <div class="idle-progress__no-rewards">
        <p class="idle-progress__no-rewards-message">No rewards available yet. Start an idle activity to generate rewards!</p>
      </div>
    {/if}

    {#if progress.activeActivities && progress.activeActivities.length > 0}
      <div class="idle-progress__activities">
        <h4 class="idle-progress__activities-title">Active Activities</h4>
        <div class="idle-progress__activities-list">
          {#each progress.activeActivities as activity}
            <div class="idle-progress__activity">
              <span class="idle-progress__activity-name">{activity.activityId || 'Unknown'}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</div>

<style lang="scss">
  @use '../../../src/styles/variables' as *;

  .idle-progress {
    max-width: 600px;
    margin: 0 auto;
  }

  .idle-progress .idle-progress__loading,
  .idle-progress .idle-progress__error {
    text-align: center;
    padding: var(--spacing-xl);
  }

  .idle-progress .idle-progress__error-message {
    color: var(--danger);
    margin-bottom: var(--spacing-md);
  }

  .idle-progress .idle-progress__retry {
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--accent);
    color: var(--text-on-accent, #000);
    border: none;
    border-radius: var(--border-radius-sm);
    cursor: pointer;
  }

  .idle-progress .idle-progress__header {
    margin-bottom: var(--spacing-lg);
    padding-bottom: var(--spacing-md);
    border-bottom: 1px solid var(--border);
  }

  .idle-progress .idle-progress__title {
    margin: 0 0 var(--spacing-xs) 0;
    font-size: 1.5rem;
    color: var(--text);
  }

  .idle-progress .idle-progress__last-active {
    margin: 0;
    color: var(--muted);
    font-size: 0.9rem;
  }

  .idle-progress .idle-progress__stats {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-lg);
  }

  .idle-progress .idle-progress__stat {
    padding: var(--spacing-md);
    background: var(--bg-dark);
    border-radius: var(--border-radius-md);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .idle-progress .idle-progress__stat-label {
    color: var(--muted);
    font-size: 0.9rem;
  }

  .idle-progress .idle-progress__stat-value {
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--accent);
  }

  .idle-progress .idle-progress__rewards {
    padding: var(--spacing-lg);
    background: var(--bg-dark);
    border: 2px solid var(--accent);
    border-radius: var(--border-radius-md);
    margin-bottom: var(--spacing-lg);
  }

  .idle-progress .idle-progress__rewards-title {
    margin: 0 0 var(--spacing-md) 0;
    color: var(--accent);
    font-size: 1.1rem;
  }

  .idle-progress .idle-progress__rewards-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .idle-progress .idle-progress__reward-item {
    display: flex;
    justify-content: space-between;
    padding: var(--spacing-xs) 0;
  }

  .idle-progress .idle-progress__reward-label {
    color: var(--muted);
  }

  .idle-progress .idle-progress__reward-value {
    font-weight: 600;
    color: var(--accent);
  }

  .idle-progress .idle-progress__actions {
    text-align: center;
    margin-bottom: var(--spacing-lg);
  }

  .idle-progress .idle-progress__claim {
    padding: var(--spacing-md) var(--spacing-xl);
    background: var(--accent);
    color: var(--text-on-accent, #000);
    border: none;
    border-radius: var(--border-radius-md);
    font-size: 1.1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .idle-progress .idle-progress__claim:hover:not(.idle-progress__claim--disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .idle-progress .idle-progress__claim--disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .idle-progress .idle-progress__no-rewards {
    text-align: center;
    padding: var(--spacing-xl);
    color: var(--muted);
  }

  .idle-progress .idle-progress__activities {
    margin-top: var(--spacing-lg);
    padding-top: var(--spacing-lg);
    border-top: 1px solid var(--border);
  }

  .idle-progress .idle-progress__activities-title {
    margin: 0 0 var(--spacing-md) 0;
    font-size: 1.1rem;
    color: var(--text);
  }

  .idle-progress .idle-progress__activities-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .idle-progress .idle-progress__activity {
    padding: var(--spacing-sm);
    background: var(--bg-dark);
    border-radius: var(--border-radius-sm);
    color: var(--text);
  }

  .idle-progress .idle-progress__activity-name {
    text-transform: capitalize;
  }
</style>

