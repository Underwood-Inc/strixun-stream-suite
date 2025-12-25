<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { gameApi } from '../services/game-api.js';
  import { currentCharacterId } from '../stores/game-state.js';
  import type { CraftingSession } from '../types/index.js';

  let characterId = '';
  let sessions: CraftingSession[] = [];
  let loading = true;
  let error: string | null = null;
  let starting = false;

  const unsubscribe = currentCharacterId.subscribe(value => {
    characterId = value || '';
    if (characterId) {
      loadSessions();
    }
  });

  onMount(async () => {
    if (characterId) {
      await loadSessions();
    }
  });

  onDestroy(() => {
    unsubscribe();
  });

  async function loadSessions() {
    if (!characterId) return;
    
    try {
      loading = true;
      error = null;
      const result = await gameApi.getCraftingSessions(characterId);
      sessions = result.sessions;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load crafting sessions';
      console.error('Failed to load crafting sessions:', err);
    } finally {
      loading = false;
    }
  }

  async function handleStartCrafting(recipeId: string) {
    if (!characterId || starting) return;

    try {
      starting = true;
      error = null;
      await gameApi.startCrafting(characterId, recipeId);
      await loadSessions(); // Refresh sessions
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to start crafting';
      console.error('Failed to start crafting:', err);
    } finally {
      starting = false;
    }
  }

  async function handleCollect(sessionId: string) {
    try {
      error = null;
      await gameApi.collectCrafting(sessionId);
      await loadSessions(); // Refresh sessions
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to collect crafting result';
      console.error('Failed to collect crafting result:', err);
    }
  }

  function getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      in_progress: 'var(--accent)',
      completed: 'var(--success, #4ade80)',
      failed: 'var(--danger)'
    };
    return colors[status] || 'var(--muted)';
  }

  function formatTimeRemaining(completesAt: string): string {
    const now = new Date();
    const complete = new Date(completesAt);
    const diff = complete.getTime() - now.getTime();
    
    if (diff <= 0) return 'Ready';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }
</script>

<div class="crafting-screen">
  {#if loading}
    <div class="crafting-screen__loading">Loading crafting sessions...</div>
  {:else if error}
    <div class="crafting-screen__error">
      <p class="crafting-screen__error-message">{error}</p>
      <button class="crafting-screen__retry" on:click={loadSessions}>Retry</button>
    </div>
  {:else}
    <div class="crafting-screen__header">
      <h3 class="crafting-screen__title">Crafting</h3>
      <button class="crafting-screen__refresh" on:click={loadSessions}>Refresh</button>
    </div>

    {#if sessions.length === 0}
      <div class="crafting-screen__empty">
        <p class="crafting-screen__empty-message">No active crafting sessions. Start a new crafting project!</p>
      </div>
    {:else}
      <div class="crafting-screen__sessions">
        {#each sessions as session}
          <div class="crafting-screen__session">
            <div class="crafting-screen__session-header">
              <h4 class="crafting-screen__session-title">Recipe: {session.recipeId}</h4>
              <span 
                class="crafting-screen__session-status"
                style="color: {getStatusColor(session.status)}"
              >
                {session.status}
              </span>
            </div>
            
            <div class="crafting-screen__session-info">
              <div class="crafting-screen__session-item">
                <span class="crafting-screen__session-label">Quantity:</span>
                <span class="crafting-screen__session-value">{session.quantity}</span>
              </div>
              <div class="crafting-screen__session-item">
                <span class="crafting-screen__session-label">Progress:</span>
                <span class="crafting-screen__session-value">{session.progressPercent}%</span>
              </div>
              {#if session.status === 'in_progress'}
                <div class="crafting-screen__session-item">
                  <span class="crafting-screen__session-label">Time Remaining:</span>
                  <span class="crafting-screen__session-value">{formatTimeRemaining(session.completesAt)}</span>
                </div>
              {/if}
            </div>

            {#if session.status === 'completed'}
              <button 
                class="crafting-screen__collect-button"
                on:click={() => handleCollect(session.id)}
              >
                Collect Result
              </button>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style lang="scss">
  @use '../../../src/styles/variables' as *;

  .crafting-screen {
    max-width: 800px;
    margin: 0 auto;
  }

  .crafting-screen .crafting-screen__loading,
  .crafting-screen .crafting-screen__error {
    text-align: center;
    padding: var(--spacing-xl);
  }

  .crafting-screen .crafting-screen__error-message {
    color: var(--danger);
    margin-bottom: var(--spacing-md);
  }

  .crafting-screen .crafting-screen__retry {
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--accent);
    color: var(--text-on-accent, #000);
    border: none;
    border-radius: var(--border-radius-sm);
    cursor: pointer;
  }

  .crafting-screen .crafting-screen__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--spacing-lg);
    padding-bottom: var(--spacing-md);
    border-bottom: 1px solid var(--border);
  }

  .crafting-screen .crafting-screen__title {
    margin: 0;
    font-size: 1.5rem;
    color: var(--text);
  }

  .crafting-screen .crafting-screen__refresh {
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--bg-dark);
    border: 1px solid var(--border);
    border-radius: var(--border-radius-sm);
    color: var(--text);
    cursor: pointer;
  }

  .crafting-screen .crafting-screen__empty {
    text-align: center;
    padding: var(--spacing-xl);
    color: var(--muted);
  }

  .crafting-screen .crafting-screen__sessions {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .crafting-screen .crafting-screen__session {
    padding: var(--spacing-lg);
    background: var(--bg-dark);
    border: 1px solid var(--border);
    border-radius: var(--border-radius-md);
  }

  .crafting-screen .crafting-screen__session-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--spacing-md);
  }

  .crafting-screen .crafting-screen__session-title {
    margin: 0;
    font-size: 1.1rem;
    color: var(--text);
  }

  .crafting-screen .crafting-screen__session-status {
    font-weight: 600;
    text-transform: capitalize;
  }

  .crafting-screen .crafting-screen__session-info {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-md);
  }

  .crafting-screen .crafting-screen__session-item {
    display: flex;
    justify-content: space-between;
  }

  .crafting-screen .crafting-screen__session-label {
    color: var(--muted);
  }

  .crafting-screen .crafting-screen__session-value {
    font-weight: 600;
    color: var(--text);
  }

  .crafting-screen .crafting-screen__collect-button {
    width: 100%;
    padding: var(--spacing-md);
    background: var(--accent);
    color: var(--text-on-accent, #000);
    border: none;
    border-radius: var(--border-radius-md);
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.1s ease;
  }

  .crafting-screen .crafting-screen__collect-button:hover {
    transform: translateY(-2px);
  }
</style>

