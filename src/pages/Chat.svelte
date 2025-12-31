<script lang="ts">
  /**
   * Chat Page
   * 
   * P2P chat interface page
   */

  import { ChatClient, Tooltip } from '@components';
  import { isAuthenticated } from '../stores/auth';

  // Signaling server URL is set globally in main.ts
  // ChatClient will pick it up automatically
</script>

<div class="chat-page">
  <Tooltip text="Chat | This feature is incomplete and still in progress" level="warning" position="bottom">
    <div class="wip-banner wip">
      [WARNING] Work in Progress - This feature is incomplete and still in progress
    </div>
  </Tooltip>
  {#if $isAuthenticated}
    <ChatClient 
      showRoomList={true}
      showRoomCreator={true}
    />
  {:else}
    <div class="chat-page__auth-required">
      <h2>Authentication Required</h2>
      <p>Please log in to use the chat feature.</p>
    </div>
  {/if}
</div>

<style lang="scss">
  @use '../styles/animations' as *;
  @use '../styles/mixins' as *;
  
  .chat-page {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    position: relative;
  }

  .wip-banner {
    padding: 12px 16px;
    margin: 16px;
    text-align: center;
    font-size: 0.9rem;
    font-weight: 600;
    border-radius: 0;
    @include wip-state;
    pointer-events: auto;
    cursor: help;
  }

  .chat-page .chat-page__auth-required {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 16px;
    color: var(--text-secondary);
  }

  .chat-page .chat-page__auth-required h2 {
    color: var(--text);
    margin: 0;
  }

  .chat-page .chat-page__auth-required p {
    margin: 0;
  }
</style>

