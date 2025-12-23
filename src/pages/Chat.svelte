<script lang="ts">
  /**
   * Chat Page
   * 
   * P2P chat interface page
   */

  import { ChatClient } from '@components';
  import { isAuthenticated } from '../stores/auth';

  // Signaling server URL is set globally in main.ts
  // ChatClient will pick it up automatically
</script>

<div class="chat-page">
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
  
  .chat-page {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
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

