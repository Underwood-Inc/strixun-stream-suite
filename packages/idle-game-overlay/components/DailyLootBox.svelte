<script lang="ts">
  import { onMount } from 'svelte';
  import { gameApi } from '../services/game-api.js';
  import type { LootBoxStatus, LootBoxOpenResult } from '../types/index.js';

  let status: LootBoxStatus | null = null;
  let claiming = false;
  let claimResult: LootBoxOpenResult | null = null;
  let error: string | null = null;

  onMount(async () => {
    await loadStatus();
  });

  async function loadStatus() {
    try {
      error = null;
      status = await gameApi.getLootBoxStatus();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load loot box status';
      console.error('Failed to load loot box status:', err);
    }
  }

  async function handleClaim() {
    if (!status?.available || claiming) return;

    try {
      claiming = true;
      error = null;
      claimResult = await gameApi.claimLootBox();
      await loadStatus(); // Refresh status after claim
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to claim loot box';
      console.error('Failed to claim loot box:', err);
    } finally {
      claiming = false;
    }
  }

  function getStreakTier(streak: number): string {
    if (streak >= 31) return 'Legendary';
    if (streak >= 15) return 'Loyal';
    if (streak >= 8) return 'Committed';
    if (streak >= 4) return 'Dedicated';
    return 'New';
  }
</script>

<div class="daily-loot-box">
  {#if error}
    <div class="daily-loot-box__error">
      <p class="daily-loot-box__error-message">{error}</p>
      <button class="daily-loot-box__retry" on:click={loadStatus}>Retry</button>
    </div>
  {:else if status}
    <div class="daily-loot-box__header">
      <h3 class="daily-loot-box__title">Daily Loot Box</h3>
      <div class="daily-loot-box__streak">
        <span class="daily-loot-box__streak-label">Streak:</span>
        <span class="daily-loot-box__streak-value">{status.streak.current} days</span>
        <span class="daily-loot-box__streak-tier">({getStreakTier(status.streak.current)})</span>
      </div>
    </div>

    <div class="daily-loot-box__info">
      <div class="daily-loot-box__info-item">
        <span class="daily-loot-box__info-label">Longest Streak:</span>
        <span class="daily-loot-box__info-value">{status.streak.longest} days</span>
      </div>
      <div class="daily-loot-box__info-item">
        <span class="daily-loot-box__info-label">Streak Bonus:</span>
        <span class="daily-loot-box__info-value">{status.streak.bonus}x</span>
      </div>
      <div class="daily-loot-box__info-item">
        <span class="daily-loot-box__info-label">Status:</span>
        <span class="daily-loot-box__info-value" class:daily-loot-box__info-value--available={status.available}>
          {status.available ? 'Available' : 'Claimed'}
        </span>
      </div>
    </div>

    {#if claimResult}
      <div class="daily-loot-box__rewards">
        <h4 class="daily-loot-box__rewards-title">Rewards Claimed!</h4>
        <div class="daily-loot-box__rewards-list">
          <div class="daily-loot-box__reward-item">
            <span class="daily-loot-box__reward-label">Gold:</span>
            <span class="daily-loot-box__reward-value">+{claimResult.rewards.gold}</span>
          </div>
          <div class="daily-loot-box__reward-item">
            <span class="daily-loot-box__reward-label">Experience:</span>
            <span class="daily-loot-box__reward-value">+{claimResult.rewards.experience}</span>
          </div>
          {#each Object.entries(claimResult.rewards.materials) as [material, quantity]}
            <div class="daily-loot-box__reward-item">
              <span class="daily-loot-box__reward-label">{material}:</span>
              <span class="daily-loot-box__reward-value">+{quantity}</span>
            </div>
          {/each}
          {#if claimResult.rewards.items.length > 0}
            <div class="daily-loot-box__reward-item">
              <span class="daily-loot-box__reward-label">Items:</span>
              <span class="daily-loot-box__reward-value">{claimResult.rewards.items.length} item(s)</span>
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <div class="daily-loot-box__actions">
      <button 
        class="daily-loot-box__claim"
        class:daily-loot-box__claim--disabled={!status.available || claiming}
        on:click={handleClaim}
        disabled={!status.available || claiming}
      >
        {#if claiming}
          Claiming...
        {:else if status.available}
          Claim Daily Box
        {:else}
          Already Claimed
        {/if}
      </button>
      {#if !status.available}
        <p class="daily-loot-box__next-available">
          Next available: {new Date(status.nextAvailableAt).toLocaleString()}
        </p>
      {/if}
    </div>
  {:else}
    <div class="daily-loot-box__loading">Loading...</div>
  {/if}
</div>

<style lang="scss">
  @use '../../../src/styles/variables' as *;

  .daily-loot-box {
    max-width: 600px;
    margin: 0 auto;
  }

  .daily-loot-box .daily-loot-box__error {
    padding: var(--spacing-lg);
    background: var(--danger);
    color: #fff;
    border-radius: var(--border-radius-md);
    text-align: center;
  }

  .daily-loot-box .daily-loot-box__error-message {
    margin-bottom: var(--spacing-md);
  }

  .daily-loot-box .daily-loot-box__retry {
    padding: var(--spacing-sm) var(--spacing-md);
    background: rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: var(--border-radius-sm);
    color: #fff;
    cursor: pointer;
  }

  .daily-loot-box .daily-loot-box__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--spacing-lg);
    padding-bottom: var(--spacing-md);
    border-bottom: 1px solid var(--border);
  }

  .daily-loot-box .daily-loot-box__title {
    margin: 0;
    font-size: 1.5rem;
    color: var(--text);
  }

  .daily-loot-box .daily-loot-box__streak {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    font-size: 0.9rem;
  }

  .daily-loot-box .daily-loot-box__streak-label {
    color: var(--muted);
  }

  .daily-loot-box .daily-loot-box__streak-value {
    font-weight: 600;
    color: var(--accent);
  }

  .daily-loot-box .daily-loot-box__streak-tier {
    color: var(--muted);
    font-size: 0.85rem;
  }

  .daily-loot-box .daily-loot-box__info {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-lg);
  }

  .daily-loot-box .daily-loot-box__info-item {
    display: flex;
    justify-content: space-between;
    padding: var(--spacing-sm);
    background: var(--bg-dark);
    border-radius: var(--border-radius-sm);
  }

  .daily-loot-box .daily-loot-box__info-label {
    color: var(--muted);
  }

  .daily-loot-box .daily-loot-box__info-value {
    font-weight: 600;
    color: var(--text);
  }

  .daily-loot-box .daily-loot-box__info-value--available {
    color: var(--accent);
  }

  .daily-loot-box .daily-loot-box__rewards {
    padding: var(--spacing-lg);
    background: var(--bg-dark);
    border: 2px solid var(--accent);
    border-radius: var(--border-radius-md);
    margin-bottom: var(--spacing-lg);
  }

  .daily-loot-box .daily-loot-box__rewards-title {
    margin: 0 0 var(--spacing-md) 0;
    color: var(--accent);
    font-size: 1.2rem;
  }

  .daily-loot-box .daily-loot-box__rewards-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .daily-loot-box .daily-loot-box__reward-item {
    display: flex;
    justify-content: space-between;
    padding: var(--spacing-xs) 0;
  }

  .daily-loot-box .daily-loot-box__reward-label {
    color: var(--muted);
  }

  .daily-loot-box .daily-loot-box__reward-value {
    font-weight: 600;
    color: var(--accent);
  }

  .daily-loot-box .daily-loot-box__actions {
    text-align: center;
  }

  .daily-loot-box .daily-loot-box__claim {
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

  .daily-loot-box .daily-loot-box__claim:hover:not(.daily-loot-box__claim--disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .daily-loot-box .daily-loot-box__claim--disabled {
    background: var(--bg-dark);
    color: var(--muted);
    cursor: not-allowed;
    opacity: 0.6;
  }

  .daily-loot-box .daily-loot-box__next-available {
    margin-top: var(--spacing-md);
    color: var(--muted);
    font-size: 0.9rem;
  }

  .daily-loot-box .daily-loot-box__loading {
    text-align: center;
    padding: var(--spacing-xl);
    color: var(--muted);
  }
</style>

