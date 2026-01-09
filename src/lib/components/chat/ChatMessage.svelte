<script lang="ts">
  /**
   * Chat Message Component
   * 
   * Displays individual chat messages with emote support
   */

  import type { ChatMessage } from '../../../types/chat';
  import { sevenTVEmoteService } from '../../../services/chat/emotes';
  import { getCurrentCustomerId } from '../../../stores/chat';

  export let message: ChatMessage;

  let emoteCache: Map<string, string> = new Map();

  // Parse message content for emotes
  $: parsedContent = parseMessageContent(message.content, message.emoteIds || [], message.customEmojiIds || []);

  function parseMessageContent(content: string, emoteIds: string[], customEmojiIds: string[]): string {
    // Simple implementation - replace emote IDs with images
    // In production, you'd want more sophisticated parsing
    let parsed = content;

    // Replace 7TV emotes
    emoteIds.forEach((emoteId) => {
      const emoteUrl = emoteCache.get(`7tv_${emoteId}`);
      if (emoteUrl) {
        parsed = parsed.replace(
          new RegExp(`:${emoteId}:`, 'g'),
          `<img src="${emoteUrl}" alt="emote" class="chat-message__emote" />`
        );
      }
    });

    // Replace custom emojis
    customEmojiIds.forEach((emojiId) => {
      const emojiUrl = emoteCache.get(`custom_${emojiId}`);
      if (emojiUrl) {
        parsed = parsed.replace(
          new RegExp(`:${emojiId}:`, 'g'),
          `<img src="${emojiUrl}" alt="emoji" class="chat-message__emote" />`
        );
      }
    });

    return parsed;
  }

  // Load emotes on mount
  import { onMount } from 'svelte';
  onMount(async () => {
    // Load 7TV emotes
    if (message.emoteIds) {
      for (const emoteId of message.emoteIds) {
        const emote = await sevenTVEmoteService.getEmote(emoteId);
        if (emote) {
          emoteCache.set(`7tv_${emoteId}`, emote.url);
        }
      }
    }

    // Load custom emojis (would need custom emoji service)
    // For now, placeholder
  });

  $: isOwnMessage = getCurrentCustomerId() === message.senderId;
  $: timestamp = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
</script>

<style lang="scss">
  @use '@styles/variables' as *;

  .chat-message {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 12px;
    border-radius: 8px;
    background: var(--card);
    transition: background 0.2s ease;
  }

  .chat-message.chat-message--own {
    background: var(--card-hover);
  }

  .chat-message .chat-message__header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.85rem;
  }

  .chat-message .chat-message__sender {
    font-weight: 600;
    color: var(--text);
  }

  .chat-message .chat-message__timestamp {
    color: var(--text-secondary);
    font-size: 0.75rem;
  }

  .chat-message .chat-message__content {
    color: var(--text);
    line-height: 1.5;
    word-wrap: break-word;
  }

  .chat-message .chat-message__emote {
    display: inline-block;
    vertical-align: middle;
    width: 28px;
    height: 28px;
    margin: 0 2px;
  }

  .chat-message .chat-message__type-system {
    font-style: italic;
    color: var(--text-secondary);
    font-size: 0.85rem;
  }
</style>

<div class="chat-message chat-message--{isOwnMessage ? 'own' : 'other'}">
  {#if message.type === 'system' || message.type === 'join' || message.type === 'leave'}
    <div class="chat-message__type-system">
      {message.content}
    </div>
  {:else}
    <div class="chat-message__header">
      <span class="chat-message__sender">{message.senderName}</span>
      <span class="chat-message__timestamp">{timestamp}</span>
    </div>
    <div class="chat-message__content">
      {@html parsedContent}
    </div>
  {/if}
</div>

