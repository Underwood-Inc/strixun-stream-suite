<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { gameApi } from '../services/game-api.js';
  import { currentCharacterId } from '../stores/game-state.js';
  import ItemTooltip from './ItemTooltip.svelte';
  import type { Inventory, Equipment, GameItem } from '../types/index.js';
  import type { ItemTooltipData } from '../core/tooltip-system.js';

  let characterId = '';
  let inventory: Inventory | null = null;
  let equipment: Equipment | null = null;
  let loading = true;
  let error: string | null = null;
  let selectedItem: GameItem | null = null;
  let selectedItemElement: HTMLElement | null = null;
  let showTooltip = false;

  const unsubscribe = currentCharacterId.subscribe(value => {
    characterId = value || '';
    if (characterId) {
      loadInventory();
    }
  });

  onMount(async () => {
    if (characterId) {
      await loadInventory();
    }
  });

  onDestroy(() => {
    unsubscribe();
  });

  async function loadInventory() {
    if (!characterId) return;
    
    try {
      loading = true;
      error = null;
      const result = await gameApi.getInventory(characterId);
      inventory = result.inventory;
      equipment = result.equipment;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load inventory';
      console.error('Failed to load inventory:', err);
    } finally {
      loading = false;
    }
  }

  function handleItemMouseEnter(item: GameItem, event: MouseEvent) {
    selectedItem = item;
    selectedItemElement = event.currentTarget as HTMLElement;
    showTooltip = true;
  }

  function handleItemMouseLeave() {
    showTooltip = false;
    // Delay hiding to allow moving to tooltip
    setTimeout(() => {
      if (!showTooltip) {
        selectedItem = null;
        selectedItemElement = null;
      }
    }, 100);
  }

  function getItemTooltipData(item: GameItem): ItemTooltipData {
    const template = item.template;
    return {
      item: {
        name: template?.displayName || `Item ${item.id}`,
        rarity: template?.rarity || 'common',
        itemLevel: template?.requiredLevel || 1,
        fullName: template?.displayName || `Item ${item.id}`
      },
      stats: item.statModifiers || {},
      description: template?.description,
      sellPrice: template?.baseSellPrice
    };
  }

  function getItemName(item: GameItem): string {
    return item.template?.displayName || `Item ${item.id}`;
  }

  function getItemRarity(item: GameItem): string {
    return item.template?.rarity || 'common';
  }

  function getRarityColor(rarity: string): string {
    const colors: Record<string, string> = {
      common: 'var(--muted)',
      uncommon: '#4ade80',
      rare: '#60a5fa',
      epic: '#a78bfa',
      legendary: '#fbbf24',
      unique: '#f87171'
    };
    return colors[rarity] || colors.common;
  }
</script>

<div class="inventory-screen">
  {#if loading}
    <div class="inventory-screen__loading">Loading inventory...</div>
  {:else if error}
    <div class="inventory-screen__error">
      <p class="inventory-screen__error-message">{error}</p>
      <button class="inventory-screen__retry" on:click={loadInventory}>Retry</button>
    </div>
  {:else if inventory && equipment}
    <div class="inventory-screen__layout">
      <div class="inventory-screen__equipment">
        <h3 class="inventory-screen__section-title">Equipment</h3>
        <div class="inventory-screen__equipment-slots">
          {#each Object.entries(equipment.slots) as [slot, item]}
            <div class="inventory-screen__equipment-slot">
              <div class="inventory-screen__slot-label">{slot}</div>
              {#if item}
                <div 
                  class="inventory-screen__item"
                  style="border-color: {getRarityColor(getItemRarity(item))}"
                  on:mouseenter={(e) => handleItemMouseEnter(item, e)}
                  on:mouseleave={handleItemMouseLeave}
                >
                  <span class="inventory-screen__item-name">{getItemName(item)}</span>
                </div>
              {:else}
                <div class="inventory-screen__slot-empty">Empty</div>
              {/if}
            </div>
          {/each}
        </div>
      </div>

      <div class="inventory-screen__inventory">
        <h3 class="inventory-screen__section-title">
          Inventory ({inventory.usedSlots}/{inventory.maxSlots})
        </h3>
        <div class="inventory-screen__inventory-grid">
          {#each inventory.slots as slot}
            {#if slot.item}
              <div 
                class="inventory-screen__item"
                style="border-color: {getRarityColor(getItemRarity(slot.item))}"
                on:mouseenter={(e) => handleItemMouseEnter(slot.item!, e)}
                on:mouseleave={handleItemMouseLeave}
              >
                <span class="inventory-screen__item-name">{getItemName(slot.item)}</span>
                {#if slot.quantity > 1}
                  <span class="inventory-screen__item-quantity">{slot.quantity}</span>
                {/if}
              </div>
            {:else}
              <div class="inventory-screen__slot-empty"></div>
            {/if}
          {/each}
        </div>
      </div>
    </div>

    {#if selectedItem && selectedItemElement && showTooltip}
      <ItemTooltip 
        itemData={getItemTooltipData(selectedItem)}
        anchor={selectedItemElement}
      />
    {/if}
  {/if}
</div>

<style lang="scss">
  @use '../../../src/styles/variables' as *;

  .inventory-screen {
    max-width: 1000px;
    margin: 0 auto;
  }

  .inventory-screen .inventory-screen__loading,
  .inventory-screen .inventory-screen__error {
    text-align: center;
    padding: var(--spacing-xl);
  }

  .inventory-screen .inventory-screen__error-message {
    color: var(--danger);
    margin-bottom: var(--spacing-md);
  }

  .inventory-screen .inventory-screen__retry {
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--accent);
    color: var(--text-on-accent, #000);
    border: none;
    border-radius: var(--border-radius-sm);
    cursor: pointer;
  }

  .inventory-screen .inventory-screen__layout {
    display: grid;
    grid-template-columns: 300px 1fr;
    gap: var(--spacing-lg);
  }

  .inventory-screen .inventory-screen__section-title {
    margin: 0 0 var(--spacing-md) 0;
    font-size: 1.2rem;
    color: var(--text);
  }

  .inventory-screen .inventory-screen__equipment-slots {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--spacing-sm);
  }

  .inventory-screen .inventory-screen__equipment-slot {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .inventory-screen .inventory-screen__slot-label {
    font-size: 0.85rem;
    color: var(--muted);
    text-transform: capitalize;
  }

  .inventory-screen .inventory-screen__slot-empty {
    min-height: 60px;
    background: var(--bg-dark);
    border: 2px dashed var(--border);
    border-radius: var(--border-radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--muted);
    font-size: 0.85rem;
  }

  .inventory-screen .inventory-screen__inventory-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: var(--spacing-sm);
  }

  .inventory-screen .inventory-screen__item {
    aspect-ratio: 1;
    background: var(--bg-dark);
    border: 2px solid var(--border);
    border-radius: var(--border-radius-sm);
    padding: var(--spacing-xs);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: transform 0.1s ease;
    position: relative;
  }

  .inventory-screen .inventory-screen__item:hover {
    transform: scale(1.05);
  }

  .inventory-screen .inventory-screen__item-name {
    font-size: 0.75rem;
    text-align: center;
    color: var(--text);
    word-break: break-word;
  }

  .inventory-screen .inventory-screen__item-quantity {
    position: absolute;
    bottom: 2px;
    right: 4px;
    background: var(--accent);
    color: var(--text-on-accent, #000);
    border-radius: 50%;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: 600;
  }
</style>

