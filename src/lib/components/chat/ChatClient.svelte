<script lang="ts">
  /**
   * Chat Client Component
   * 
   * Main chat interface component
   */

  import { onMount, onDestroy } from 'svelte';
  import { RoomManager, type RoomManagerConfig } from '../../../services/chat/roomManager';
  import { chatState, messages, connectionStatus, isConnected, getCurrentUserId, getCurrentUserName, resetChat } from '../../../stores/chat';
  import { getAuthToken, user } from '../../../stores/auth';
  import ChatMessage from './ChatMessage.svelte';
  import ChatInput from './ChatInput.svelte';
  import RoomList from './RoomList.svelte';
  import RoomCreator from './RoomCreator.svelte';
  import Tooltip from '../Tooltip.svelte';
  
  // Typing indicator - WIP feature
  $: typingUsers = Array.from($chatState.isTyping);

  // Props
  export let signalingBaseUrl: string = '';
  export let showRoomList: boolean = true;
  export let showRoomCreator: boolean = true;

  let roomManager: RoomManager | null = null;
  let currentView: 'chat' | 'rooms' | 'create' = 'rooms';
  let error: string | null = null;

  // Get config from window or props
  $: config = {
    signalingBaseUrl: signalingBaseUrl || (typeof window !== 'undefined' && (window as any).CHAT_SIGNALING_URL) || '',
    token: getAuthToken(),
    userId: getCurrentUserId() || '',
    userName: getCurrentUserName() || 'Anonymous',
  };

  onMount(async () => {
    if (!config.token || !config.userId) {
      error = 'Not authenticated. Please log in.';
      return;
    }

    if (!config.signalingBaseUrl) {
      error = 'Signaling server URL not configured';
      return;
    }

    try {
      const roomManagerConfig: RoomManagerConfig = {
        ...config,
        onMessage: (message) => {
          // Message already handled by store
          console.log('[ChatClient] New message:', message);
        },
        onError: (err) => {
          error = err.message;
          console.error('[ChatClient] Error:', err);
        },
      };

      roomManager = new RoomManager(roomManagerConfig);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to initialize chat';
    }
  });

  onDestroy(async () => {
    if (roomManager) {
      await roomManager.leaveRoom();
    }
    resetChat();
  });

  async function handleCreateRoom(customName?: string) {
    if (!roomManager) return;

    try {
      error = null;
      await roomManager.createRoom(customName);
      currentView = 'chat';
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to create room';
    }
  }

  async function handleJoinRoom(roomId: string) {
    if (!roomManager) return;

    try {
      error = null;
      await roomManager.joinRoom(roomId);
      currentView = 'chat';
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to join room';
    }
  }

  async function handleSendMessage(content: string, emoteIds?: string[], customEmojiIds?: string[]) {
    if (!roomManager) return;

    try {
      await roomManager.sendMessage(content, emoteIds, customEmojiIds);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to send message';
    }
  }

  async function handleLeaveRoom() {
    if (!roomManager) return;

    try {
      await roomManager.leaveRoom();
      currentView = 'rooms';
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to leave room';
    }
  }
</script>

<style lang="scss">
  @use '@styles/variables' as *;
  @use '@styles/mixins' as *;

  .chat-client {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--card);
    border-radius: 8px;
    overflow: hidden;
  }

  .chat-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--card);
    border-bottom: 1px solid var(--border);
  }

  .chat-header .chat-header__title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text);
  }

  .chat-header .chat-header__actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .chat-header .chat-header__action-btn {
    padding: 4px 8px;
    background: var(--card);
    border: 2px solid var(--border);
    border-radius: 0;
    color: var(--text);
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 2px 0 var(--border);
    
    &:hover:not(:disabled) {
      background: var(--border);
      transform: translateY(-1px);
      box-shadow: 0 3px 0 var(--border);
    }
    
    &:active:not(:disabled) {
      transform: translateY(1px);
      box-shadow: 0 1px 0 var(--border);
    }
  }

  .chat-header .chat-header__status {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .chat-header .chat-header__status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--text-secondary);
  }

  .chat-header .chat-header__status-dot--connected {
    background: var(--success);
  }

  .chat-header .chat-header__status-dot--connecting {
    background: var(--warning);
  }

  .chat-header .chat-header__status-dot--error {
    background: var(--error);
  }

  .chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .chat-messages .chat-messages__empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  .chat-messages .chat-messages__typing-indicator {
    padding: 8px 12px;
    margin-top: 8px;
    font-size: 0.85rem;
    color: var(--text-secondary);
    font-style: italic;
    border: 2px solid var(--border);
    border-radius: 0;
  }

  .chat-error {
    padding: 12px 16px;
    background: var(--error-bg);
    color: var(--error);
    font-size: 0.85rem;
    border-bottom: 1px solid var(--border);
  }

  .chat-views {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
</style>

<div class="chat-client">
  {#if error}
    <div class="chat-error">
      {error}
    </div>
  {/if}

  {#if currentView === 'chat'}
    <div class="chat-header">
      <div class="chat-header__title">
        {$chatState.room?.customName || $chatState.room?.broadcasterName || 'Chat'}
      </div>
      <div class="chat-header__actions">
        {#if $chatState.room}
          <Tooltip text="Message History | This feature is incomplete and still in progress" level="warning" position="bottom">
            <button class="chat-header__action-btn wip" disabled>
              [EMOJI] History
            </button>
          </Tooltip>
          <Tooltip text="User Presence | This feature is incomplete and still in progress" level="warning" position="bottom">
            <button class="chat-header__action-btn wip" disabled>
              [USERS] Presence
            </button>
          </Tooltip>
        {/if}
        <div class="chat-header__status">
          <div class="chat-header__status-dot chat-header__status-dot--{$connectionStatus}"></div>
          <span>
            {#if $isConnected}
              Connected
            {:else if $connectionStatus === 'connecting'}
              Connecting...
            {:else}
              Disconnected
            {/if}
          </span>
          {#if $chatState.room}
            <button on:click={handleLeaveRoom} class="chat-header__leave-btn">
              Leave
            </button>
          {/if}
        </div>
      </div>
    </div>

    <div class="chat-messages">
      {#if $messages.length === 0}
        <div class="chat-messages__empty">
          No messages yet. Start the conversation!
        </div>
      {:else}
        {#each $messages as message (message.id)}
          <ChatMessage {message} />
        {/each}
      {/if}
      {#if typingUsers.length > 0}
        <Tooltip text="Typing Indicators | This feature is incomplete and still in progress" level="warning" position="top">
          <div class="chat-messages__typing-indicator wip">
            {typingUsers.length === 1 
              ? `${typingUsers[0]} is typing...`
              : `${typingUsers.length} people are typing...`}
          </div>
        </Tooltip>
      {/if}
    </div>

    <ChatInput on:send={handleSendMessage} disabled={!$isConnected} />
  {:else if currentView === 'rooms'}
    <RoomList
      {roomManager}
      on:join={handleJoinRoom}
      on:create={() => (currentView = 'create')}
      {showRoomCreator}
    />
  {:else if currentView === 'create'}
    <RoomCreator
      {roomManager}
      on:create={handleCreateRoom}
      on:cancel={() => (currentView = 'rooms')}
    />
  {/if}
</div>

