<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { gameApi } from '../services/game-api.js';
  import { currentCharacterId } from '../stores/game-state.js';
  import type { DungeonInstance } from '../types/index.js';

  let characterId = '';
  let instances: DungeonInstance[] = [];
  let loading = true;
  let error: string | null = null;
  let starting = false;

  const unsubscribe = currentCharacterId.subscribe(value => {
    characterId = value || '';
    if (characterId) {
      loadInstances();
    }
  });

  onMount(async () => {
    if (characterId) {
      await loadInstances();
    }
  });

  onDestroy(() => {
    unsubscribe();
  });

  async function loadInstances() {
    if (!characterId) return;
    
    try {
      loading = true;
      error = null;
      const result = await gameApi.getDungeonInstances(characterId);
      instances = result.instances;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load dungeon instances';
      console.error('Failed to load dungeon instances:', err);
    } finally {
      loading = false;
    }
  }

  async function handleStartDungeon(dungeonId: string, difficulty = 'normal') {
    if (!characterId || starting) return;

    try {
      starting = true;
      error = null;
      await gameApi.startDungeon(characterId, dungeonId, difficulty);
      await loadInstances(); // Refresh instances
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to start dungeon';
      console.error('Failed to start dungeon:', err);
    } finally {
      starting = false;
    }
  }

  async function handleCompleteRoom(instanceId: string, roomId: string) {
    try {
      error = null;
      await gameApi.completeRoom(instanceId, roomId);
      await loadInstances(); // Refresh instances
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to complete room';
      console.error('Failed to complete room:', err);
    }
  }

  async function handleCompleteDungeon(instanceId: string) {
    try {
      error = null;
      await gameApi.completeDungeon(instanceId);
      await loadInstances(); // Refresh instances
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to complete dungeon';
      console.error('Failed to complete dungeon:', err);
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
</script>

<div class="dungeon-screen">
  {#if loading}
    <div class="dungeon-screen__loading">Loading dungeons...</div>
  {:else if error}
    <div class="dungeon-screen__error">
      <p class="dungeon-screen__error-message">{error}</p>
      <button class="dungeon-screen__retry" on:click={loadInstances}>Retry</button>
    </div>
  {:else}
    <div class="dungeon-screen__header">
      <h3 class="dungeon-screen__title">Dungeons</h3>
      <button class="dungeon-screen__refresh" on:click={loadInstances}>Refresh</button>
    </div>

    {#if instances.length === 0}
      <div class="dungeon-screen__empty">
        <p class="dungeon-screen__empty-message">No active dungeon instances. Start a new dungeon run!</p>
      </div>
    {:else}
      <div class="dungeon-screen__instances">
        {#each instances as instance}
          <div class="dungeon-screen__instance">
            <div class="dungeon-screen__instance-header">
              <h4 class="dungeon-screen__instance-title">{instance.dungeonId}</h4>
              <span 
                class="dungeon-screen__instance-status"
                style="color: {getStatusColor(instance.status)}"
              >
                {instance.status}
              </span>
            </div>
            
            <div class="dungeon-screen__instance-info">
              <div class="dungeon-screen__instance-item">
                <span class="dungeon-screen__instance-label">Difficulty:</span>
                <span class="dungeon-screen__instance-value">{instance.difficulty}</span>
              </div>
              <div class="dungeon-screen__instance-item">
                <span class="dungeon-screen__instance-label">Floor:</span>
                <span class="dungeon-screen__instance-value">{instance.currentFloor}</span>
              </div>
              <div class="dungeon-screen__instance-item">
                <span class="dungeon-screen__instance-label">Room:</span>
                <span class="dungeon-screen__instance-value">{instance.currentRoom}</span>
              </div>
              <div class="dungeon-screen__instance-item">
                <span class="dungeon-screen__instance-label">Completed Rooms:</span>
                <span class="dungeon-screen__instance-value">{instance.completedRooms.length}</span>
              </div>
            </div>

            {#if instance.status === 'in_progress'}
              <div class="dungeon-screen__instance-actions">
                <button 
                  class="dungeon-screen__action-button"
                  on:click={() => handleCompleteRoom(instance.id, `room_${instance.currentRoom}`)}
                >
                  Complete Current Room
                </button>
                <button 
                  class="dungeon-screen__action-button"
                  on:click={() => handleCompleteDungeon(instance.id)}
                >
                  Complete Dungeon
                </button>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style lang="scss">
  @use '../../../src/styles/variables' as *;

  .dungeon-screen {
    max-width: 800px;
    margin: 0 auto;
  }

  .dungeon-screen .dungeon-screen__loading,
  .dungeon-screen .dungeon-screen__error {
    text-align: center;
    padding: var(--spacing-xl);
  }

  .dungeon-screen .dungeon-screen__error-message {
    color: var(--danger);
    margin-bottom: var(--spacing-md);
  }

  .dungeon-screen .dungeon-screen__retry {
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--accent);
    color: var(--text-on-accent, #000);
    border: none;
    border-radius: var(--border-radius-sm);
    cursor: pointer;
  }

  .dungeon-screen .dungeon-screen__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--spacing-lg);
    padding-bottom: var(--spacing-md);
    border-bottom: 1px solid var(--border);
  }

  .dungeon-screen .dungeon-screen__title {
    margin: 0;
    font-size: 1.5rem;
    color: var(--text);
  }

  .dungeon-screen .dungeon-screen__refresh {
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--bg-dark);
    border: 1px solid var(--border);
    border-radius: var(--border-radius-sm);
    color: var(--text);
    cursor: pointer;
  }

  .dungeon-screen .dungeon-screen__empty {
    text-align: center;
    padding: var(--spacing-xl);
    color: var(--muted);
  }

  .dungeon-screen .dungeon-screen__instances {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .dungeon-screen .dungeon-screen__instance {
    padding: var(--spacing-lg);
    background: var(--bg-dark);
    border: 1px solid var(--border);
    border-radius: var(--border-radius-md);
  }

  .dungeon-screen .dungeon-screen__instance-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--spacing-md);
  }

  .dungeon-screen .dungeon-screen__instance-title {
    margin: 0;
    font-size: 1.1rem;
    color: var(--text);
    text-transform: capitalize;
  }

  .dungeon-screen .dungeon-screen__instance-status {
    font-weight: 600;
    text-transform: capitalize;
  }

  .dungeon-screen .dungeon-screen__instance-info {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-md);
  }

  .dungeon-screen .dungeon-screen__instance-item {
    display: flex;
    justify-content: space-between;
    padding: var(--spacing-xs);
  }

  .dungeon-screen .dungeon-screen__instance-label {
    color: var(--muted);
  }

  .dungeon-screen .dungeon-screen__instance-value {
    font-weight: 600;
    color: var(--text);
  }

  .dungeon-screen .dungeon-screen__instance-actions {
    display: flex;
    gap: var(--spacing-sm);
  }

  .dungeon-screen .dungeon-screen__action-button {
    flex: 1;
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--accent);
    color: var(--text-on-accent, #000);
    border: none;
    border-radius: var(--border-radius-sm);
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.1s ease;
  }

  .dungeon-screen .dungeon-screen__action-button:hover {
    transform: translateY(-2px);
  }
</style>

