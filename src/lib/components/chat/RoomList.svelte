<script lang="ts">
  /**
   * Room List Component
   * 
   * Displays available rooms to join
   */

  import { createEventDispatcher, onMount } from 'svelte';
  import type { RoomManager } from '../../../services/chat/roomManager';
  import type { RoomMetadata } from '../../../types/chat';

  const dispatch = createEventDispatcher();

  export let roomManager: RoomManager | null = null;
  export let showRoomCreator: boolean = true;

  let rooms: RoomMetadata[] = [];
  let loading: boolean = true;
  let error: string | null = null;

  onMount(async () => {
    await loadRooms();
  });

  async function loadRooms() {
    if (!roomManager) {
      loading = false;
      return;
    }

    try {
      loading = true;
      error = null;
      rooms = await roomManager.getActiveRooms();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load rooms';
    } finally {
      loading = false;
    }
  }

  function handleJoin(roomId: string) {
    dispatch('join', roomId);
  }

  function handleCreate() {
    dispatch('create');
  }
</script>

<style lang="scss">
  @use '@styles/variables' as *;

  .room-list {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 16px;
  }

  .room-list .room-list__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  .room-list .room-list__title {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text);
  }

  .room-list .room-list__create-button {
    padding: 8px 16px;
    background: var(--primary);
    color: var(--text-on-primary);
    border: none;
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .room-list .room-list__create-button:hover {
    background: var(--primary-hover);
  }

  .room-list .room-list__content {
    flex: 1;
    overflow-y: auto;
  }

  .room-list .room-list__room {
    padding: 12px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 6px;
    margin-bottom: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .room-list .room-list__room:hover {
    background: var(--card-hover);
    border-color: var(--primary);
  }

  .room-list .room-list__room-name {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text);
    margin-bottom: 4px;
  }

  .room-list .room-list__room-info {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .room-list .room-list__empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  .room-list .room-list__loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  .room-list .room-list__error {
    padding: 12px;
    background: var(--error-bg);
    color: var(--error);
    border-radius: 6px;
    font-size: 0.85rem;
    margin-bottom: 16px;
  }
</style>

<div class="room-list">
  <div class="room-list__header">
    <h2 class="room-list__title">Available Rooms</h2>
    {#if showRoomCreator}
      <button on:click={handleCreate} class="room-list__create-button" type="button">
        Create Room
      </button>
    {/if}
  </div>

  {#if error}
    <div class="room-list__error">{error}</div>
  {/if}

  <div class="room-list__content">
    {#if loading}
      <div class="room-list__loading">Loading rooms...</div>
    {:else if rooms.length === 0}
      <div class="room-list__empty">
        No rooms available. {#if showRoomCreator}Create one to get started!{/if}
      </div>
    {:else}
      {#each rooms as room (room.roomId)}
        <div class="room-list__room" on:click={() => handleJoin(room.roomId)} role="button" tabindex="0">
          <div class="room-list__room-name">
            {room.customName || room.broadcasterName}
          </div>
          <div class="room-list__room-info">
            <span>[USER] {room.participantCount}</span>
            <span>•</span>
            <span>by {room.broadcasterName}</span>
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>

