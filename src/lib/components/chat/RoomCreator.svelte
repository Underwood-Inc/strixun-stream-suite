<script lang="ts">
  /**
   * Room Creator Component
   * 
   * UI for creating or joining a room
   */

  import { createEventDispatcher } from 'svelte';
  import type { RoomManager } from '../../../services/chat/roomManager';

  const dispatch = createEventDispatcher();

  export let roomManager: RoomManager | null = null;

  let roomName: string = '';
  let roomId: string = '';
  let mode: 'create' | 'join' = 'create';
  let loading: boolean = false;

  function handleCreate() {
    if (mode === 'create') {
      dispatch('create', roomName || undefined);
    } else {
      dispatch('join', roomId);
    }
  }

  function handleCancel() {
    dispatch('cancel');
  }
</script>

<style lang="scss">
  @use '@styles/variables' as *;

  .room-creator {
    display: flex;
    flex-direction: column;
    padding: 24px;
    height: 100%;
  }

  .room-creator .room-creator__header {
    margin-bottom: 24px;
  }

  .room-creator .room-creator__title {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text);
    margin-bottom: 8px;
  }

  .room-creator .room-creator__tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 24px;
  }

  .room-creator .room-creator__tab {
    padding: 8px 16px;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-secondary);
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .room-creator .room-creator__tab--active {
    background: var(--primary);
    color: var(--text-on-primary);
    border-color: var(--primary);
  }

  .room-creator .room-creator__form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .room-creator .room-creator__field {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .room-creator .room-creator__label {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text);
  }

  .room-creator .room-creator__input {
    padding: 10px 12px;
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text);
    font-size: 0.9rem;
    font-family: inherit;
  }

  .room-creator .room-creator__input:focus {
    outline: none;
    border-color: var(--primary);
  }

  .room-creator .room-creator__actions {
    display: flex;
    gap: 12px;
    margin-top: 8px;
  }

  .room-creator .room-creator__button {
    flex: 1;
    padding: 10px 16px;
    border: none;
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .room-creator .room-creator__button--primary {
    background: var(--primary);
    color: var(--text-on-primary);
  }

  .room-creator .room-creator__button--primary:hover:not(:disabled) {
    background: var(--primary-hover);
  }

  .room-creator .room-creator__button--secondary {
    background: var(--background);
    color: var(--text);
    border: 1px solid var(--border);
  }

  .room-creator .room-creator__button--secondary:hover:not(:disabled) {
    background: var(--card-hover);
  }

  .room-creator .room-creator__button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>

<div class="room-creator">
  <div class="room-creator__header">
    <h2 class="room-creator__title">Chat Room</h2>
  </div>

  <div class="room-creator__tabs">
    <button
      class="room-creator__tab room-creator__tab--{mode === 'create' ? 'active' : ''}"
      on:click={() => (mode = 'create')}
      type="button"
    >
      Create Room
    </button>
    <button
      class="room-creator__tab room-creator__tab--{mode === 'join' ? 'active' : ''}"
      on:click={() => (mode = 'join')}
      type="button"
    >
      Join Room
    </button>
  </div>

  <div class="room-creator__form">
    {#if mode === 'create'}
      <div class="room-creator__field">
        <label for="room-name" class="room-creator__label">Room Name (Optional)</label>
        <input
          id="room-name"
          type="text"
          bind:value={roomName}
          placeholder="My Awesome Chat Room"
          class="room-creator__input"
        />
      </div>
    {:else}
      <div class="room-creator__field">
        <label for="room-id" class="room-creator__label">Room ID</label>
        <input
          id="room-id"
          type="text"
          bind:value={roomId}
          placeholder="Enter room ID to join"
          class="room-creator__input"
        />
      </div>
    {/if}

    <div class="room-creator__actions">
      <button
        on:click={handleCreate}
        disabled={loading || (mode === 'join' && !roomId.trim())}
        class="room-creator__button room-creator__button--primary"
        type="button"
      >
        {mode === 'create' ? 'Create' : 'Join'}
      </button>
      <button
        on:click={handleCancel}
        disabled={loading}
        class="room-creator__button room-creator__button--secondary"
        type="button"
      >
        Cancel
      </button>
    </div>
  </div>
</div>

