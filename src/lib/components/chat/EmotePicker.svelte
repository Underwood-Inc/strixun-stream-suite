<script lang="ts">
  /**
   * Emote Picker Component
   * 
   * Displays 7TV and custom emotes for selection
   */

  import { createEventDispatcher, onMount } from 'svelte';
  import { sevenTVEmoteService } from '../../../services/chat/emotes';
  import type { EmoteData } from '../../../types/chat';

  const dispatch = createEventDispatcher();

  let emotes: EmoteData[] = [];
  let customEmojis: EmoteData[] = [];
  let searchQuery: string = '';
  let loading: boolean = true;
  let activeTab: '7tv' | 'custom' = '7tv';

  $: filteredEmotes = searchQuery
    ? emotes.filter((e) => e.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : emotes;

  onMount(async () => {
    try {
      // Load global 7TV emotes
      emotes = await sevenTVEmoteService.getGlobalEmotes();
      loading = false;
    } catch (error) {
      console.error('[EmotePicker] Failed to load emotes:', error);
      loading = false;
    }
  });

  function handleEmoteClick(emote: EmoteData) {
    dispatch('select', emote);
  }
</script>

<style lang="scss">
  @use '@styles/variables' as *;

  .emote-picker {
    position: absolute;
    bottom: 100%;
    right: 0;
    margin-bottom: 8px;
    width: 320px;
    max-height: 400px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    display: flex;
    flex-direction: column;
    z-index: 1000;
  }

  .emote-picker .emote-picker__header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    border-bottom: 1px solid var(--border);
  }

  .emote-picker .emote-picker__tabs {
    display: flex;
    gap: 8px;
  }

  .emote-picker .emote-picker__tab {
    padding: 6px 12px;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--text-secondary);
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .emote-picker .emote-picker__tab--active {
    background: var(--primary);
    color: var(--text-on-primary);
  }

  .emote-picker .emote-picker__search {
    flex: 1;
    padding: 6px 12px;
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text);
    font-size: 0.85rem;
  }

  .emote-picker .emote-picker__content {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
    gap: 8px;
  }

  .emote-picker .emote-picker__emote {
    width: 40px;
    height: 40px;
    padding: 4px;
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .emote-picker .emote-picker__emote:hover {
    background: var(--card-hover);
    border-color: var(--primary);
  }

  .emote-picker .emote-picker__emote img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .emote-picker .emote-picker__empty {
    padding: 24px;
    text-align: center;
    color: var(--text-secondary);
    font-size: 0.85rem;
  }

  .emote-picker .emote-picker__loading {
    padding: 24px;
    text-align: center;
    color: var(--text-secondary);
    font-size: 0.85rem;
  }
</style>

<div class="emote-picker">
  <div class="emote-picker__header">
    <div class="emote-picker__tabs">
      <button
        class="emote-picker__tab emote-picker__tab--{activeTab === '7tv' ? 'active' : ''}"
        on:click={() => (activeTab = '7tv')}
        type="button"
      >
        7TV
      </button>
      <button
        class="emote-picker__tab emote-picker__tab--{activeTab === 'custom' ? 'active' : ''}"
        on:click={() => (activeTab = 'custom')}
        type="button"
      >
        Custom
      </button>
    </div>
    <input
      type="text"
      bind:value={searchQuery}
      placeholder="Search..."
      class="emote-picker__search"
    />
  </div>
  <div class="emote-picker__content">
    {#if loading}
      <div class="emote-picker__loading">Loading emotes...</div>
    {:else if activeTab === '7tv'}
      {#if filteredEmotes.length === 0}
        <div class="emote-picker__empty">No emotes found</div>
      {:else}
        {#each filteredEmotes as emote (emote.id)}
          <button
            on:click={() => handleEmoteClick(emote)}
            class="emote-picker__emote"
            type="button"
            title={emote.name}
          >
            <img src={emote.url} alt={emote.name} loading="lazy" />
          </button>
        {/each}
      {/if}
    {:else}
      {#if customEmojis.length === 0}
        <div class="emote-picker__empty">No custom emojis available</div>
      {:else}
        {#each customEmojis as emoji (emoji.id)}
          <button
            on:click={() => handleEmoteClick(emoji)}
            class="emote-picker__emote"
            type="button"
            title={emoji.name}
          >
            <img src={emoji.url} alt={emoji.name} loading="lazy" />
          </button>
        {/each}
      {/if}
    {/if}
  </div>
</div>

