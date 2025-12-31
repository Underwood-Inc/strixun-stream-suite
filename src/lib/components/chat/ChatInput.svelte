<script lang="ts">
  /**
   * Chat Input Component
   * 
   * Message input with emote picker support
   */

  import { createEventDispatcher } from 'svelte';
  import EmotePicker from './EmotePicker.svelte';

  export let disabled: boolean = false;

  const dispatch = createEventDispatcher();

  let input: HTMLTextAreaElement;
  let showEmotePicker: boolean = false;
  let message: string = '';

  function handleSubmit() {
    if (!message.trim() || disabled) return;

    // Parse message for emotes (simple implementation)
    const emoteIds: string[] = [];
    const customEmojiIds: string[] = [];

    // Extract emote IDs from message
    // This is a placeholder - real implementation would parse :emote_name: patterns
    const emoteMatches = message.match(/:([a-zA-Z0-9_]+):/g);
    if (emoteMatches) {
      // Would need to lookup emote IDs by name
      // For now, just pass empty arrays
    }

    dispatch('send', {
      content: message.trim(),
      emoteIds,
      customEmojiIds,
    });

    message = '';
    if (input) {
      input.focus();
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  }

  function handleEmoteSelect(emote: { id: string; name: string; provider: '7tv' | 'custom' }) {
    // Insert emote into message
    message += `:${emote.name}: `;
    showEmotePicker = false;
    if (input) {
      input.focus();
    }
  }
</script>

<style lang="scss">
  @use '@styles/variables' as *;

  .chat-input {
    display: flex;
    flex-direction: column;
    padding: 12px 16px;
    background: var(--card);
    border-top: 1px solid var(--border);
  }

  .chat-input .chat-input__container {
    display: flex;
    gap: 8px;
    align-items: flex-end;
  }

  .chat-input .chat-input__textarea {
    flex: 1;
    min-height: 40px;
    max-height: 120px;
    padding: 8px 12px;
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text);
    font-size: 0.9rem;
    font-family: inherit;
    resize: none;
    overflow-y: auto;
  }

  .chat-input .chat-input__textarea:focus {
    outline: none;
    border-color: var(--primary);
  }

  .chat-input .chat-input__textarea:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .chat-input .chat-input__actions {
    display: flex;
    gap: 8px;
  }

  .chat-input .chat-input__button {
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

  .chat-input .chat-input__button:hover:not(:disabled) {
    background: var(--primary-hover);
  }

  .chat-input .chat-input__button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .chat-input .chat-input__emote-button {
    padding: 8px;
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .chat-input .chat-input__emote-button:hover {
    background: var(--card-hover);
  }

  .chat-input .chat-input__picker-container {
    position: relative;
  }
</style>

<div class="chat-input">
  <div class="chat-input__container">
    <textarea
      bind:this={input}
      bind:value={message}
      on:keydown={handleKeyDown}
      placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
      disabled={disabled}
      class="chat-input__textarea"
      rows="1"
    ></textarea>
    <div class="chat-input__actions">
      <div class="chat-input__picker-container">
        <button
          on:click={() => (showEmotePicker = !showEmotePicker)}
          class="chat-input__emote-button"
          disabled={disabled}
          type="button"
        >
          
        </button>
        {#if showEmotePicker}
          <EmotePicker on:select={handleEmoteSelect} on:close={() => (showEmotePicker = false)} />
        {/if}
      </div>
      <button
        on:click={handleSubmit}
        disabled={disabled || !message.trim()}
        class="chat-input__button"
        type="button"
      >
        Send
      </button>
    </div>
  </div>
</div>

