<script lang="ts">
  import Tooltip from './Tooltip.svelte';
  import { tooltipManager, type ItemTooltipData } from '../core/tooltip-system';
  import type { TooltipConfig } from '../core/tooltip-system';

  export let itemData: ItemTooltipData;
  export let anchor: HTMLElement;
  export let customContent: string | null = null;

  const rarityColors = {
    common: '#9d9d9d',
    uncommon: '#1eff00',
    rare: '#0070dd',
    epic: '#a335ee',
    legendary: '#ff8000',
    unique: '#e6cc80'
  };

  function getRarityColor(rarity: string): string {
    return rarityColors[rarity.toLowerCase() as keyof typeof rarityColors] || rarityColors.common;
  }

  function formatStatName(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  function createTooltipConfig(): TooltipConfig {
    const rarityColor = getRarityColor(itemData.item.rarity);
    
    return {
      id: `item-tooltip-${Date.now()}`,
      content: {
        type: 'html',
        data: customContent || generateItemTooltipHTML(),
        title: itemData.item.fullName || itemData.item.name
      },
      position: {
        placement: 'auto',
        offset: { x: 10, y: 10 },
        anchor,
        viewportPadding: 10
      },
      style: {
        theme: 'fantasy',
        size: 'large',
        customCss: `
          --tooltip-border: ${rarityColor};
          --tooltip-accent: ${rarityColor};
          --tooltip-title-color: ${rarityColor};
        `
      },
      behavior: {
        trigger: 'hover',
        delay: 200,
        hideDelay: 150,
        persistent: false,
        closeOnClick: false,
        maxWidth: 400
      }
    };
  }

  function generateItemTooltipHTML(): string {
    const rarityColor = getRarityColor(itemData.item.rarity);
    const rarityBorder = `2px solid ${rarityColor}`;
    const rarityGlow = `0 0 20px ${rarityColor}40`;

    let html = `
      <div class="item-tooltip" style="border: ${rarityBorder}; box-shadow: ${rarityGlow};">
        <div class="item-tooltip__header">
          <div class="item-tooltip__name" style="color: ${rarityColor};">
            ${itemData.item.fullName || itemData.item.name}
          </div>
          <div class="item-tooltip__meta">
            <span class="item-tooltip__rarity" style="color: ${rarityColor};">
              [${itemData.item.rarity.toUpperCase()}]
            </span>
            ${itemData.item.itemLevel ? `<span>• Item Level ${itemData.item.itemLevel}</span>` : ''}
            ${itemData.item.quality ? `<span>• Quality: ${itemData.item.quality}</span>` : ''}
          </div>
        </div>
    `;

    // Modifiers
    if (itemData.modifiers) {
      if (itemData.modifiers.prefixes.length > 0) {
        html += '<div class="item-tooltip__section"><div class="item-tooltip__section-title">Prefixes:</div>';
        itemData.modifiers.prefixes.forEach(mod => {
          html += `<div class="item-tooltip__modifier">`;
          html += `<span class="item-tooltip__modifier-name">${mod.name}</span>`;
          html += '<div class="item-tooltip__modifier-stats">';
          Object.entries(mod.stats).forEach(([key, value]) => {
            html += `<div>+${value} ${formatStatName(key)}</div>`;
          });
          html += '</div></div>';
        });
        html += '</div>';
      }

      if (itemData.modifiers.suffixes.length > 0) {
        html += '<div class="item-tooltip__section"><div class="item-tooltip__section-title">Suffixes:</div>';
        itemData.modifiers.suffixes.forEach(mod => {
          html += `<div class="item-tooltip__modifier">`;
          html += `<span class="item-tooltip__modifier-name">${mod.name}</span>`;
          html += '<div class="item-tooltip__modifier-stats">';
          Object.entries(mod.stats).forEach(([key, value]) => {
            html += `<div>+${value} ${formatStatName(key)}</div>`;
          });
          html += '</div></div>';
        });
        html += '</div>';
      }
    }

    // Stats
    if (Object.keys(itemData.stats).length > 0) {
      html += '<div class="item-tooltip__section"><div class="item-tooltip__section-title">Stats:</div>';
      html += '<div class="item-tooltip__stats">';
      Object.entries(itemData.stats).forEach(([key, value]) => {
        html += `<div class="item-tooltip__stat">`;
        html += `<span class="item-tooltip__stat-name">${formatStatName(key)}:</span>`;
        html += `<span class="item-tooltip__stat-value">${value}</span>`;
        html += `</div>`;
      });
      html += '</div></div>';
    }

    // Description
    if (itemData.description) {
      html += `<div class="item-tooltip__description">${itemData.description}</div>`;
    }

    // Flavor text
    if (itemData.flavorText) {
      html += `<div class="item-tooltip__flavor">"${itemData.flavorText}"</div>`;
    }

    // Requirements
    if (itemData.requirements) {
      html += '<div class="item-tooltip__section"><div class="item-tooltip__section-title">Requirements:</div>';
      if (itemData.requirements.level) {
        html += `<div>Level ${itemData.requirements.level}</div>`;
      }
      if (itemData.requirements.stats) {
        Object.entries(itemData.requirements.stats).forEach(([key, value]) => {
          html += `<div>${formatStatName(key)}: ${value}</div>`;
        });
      }
      html += '</div>';
    }

    // Sell price
    if (itemData.sellPrice) {
      html += `<div class="item-tooltip__footer">Sell Price: ${itemData.sellPrice} Gold</div>`;
    }

    html += '</div>';
    return html;
  }
</script>

<svelte:component this={Tooltip} config={createTooltipConfig()} visible={true} />

<style lang="scss">
  @use '../../shared-styles/_variables.scss' as *;

  :global(.item-tooltip) {
    padding: 16px;
    min-width: 300px;
    max-width: 400px;
  }

  :global(.item-tooltip__header) {
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  :global(.item-tooltip__name) {
    font-size: 1.2em;
    font-weight: bold;
    margin-bottom: 4px;
    text-shadow: 0 0 10px currentColor;
  }

  :global(.item-tooltip__meta) {
    font-size: 0.85em;
    color: #b0b0b0;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  :global(.item-tooltip__section) {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  :global(.item-tooltip__section-title) {
    font-weight: bold;
    color: #e6cc80;
    margin-bottom: 8px;
    font-size: 0.95em;
  }

  :global(.item-tooltip__modifier) {
    margin-bottom: 8px;
    padding-left: 12px;
    border-left: 2px solid rgba(255, 255, 255, 0.2);
  }

  :global(.item-tooltip__modifier-name) {
    color: #4a90e2;
    font-weight: 600;
    display: block;
    margin-bottom: 4px;
  }

  :global(.item-tooltip__modifier-stats) {
    font-size: 0.9em;
    color: #1eff00;
    margin-left: 8px;
  }

  :global(.item-tooltip__stats) {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  :global(.item-tooltip__stat) {
    display: flex;
    justify-content: space-between;
    font-size: 0.95em;
  }

  :global(.item-tooltip__stat-name) {
    color: #b0b0b0;
  }

  :global(.item-tooltip__stat-value) {
    color: #1eff00;
    font-weight: 600;
  }

  :global(.item-tooltip__description) {
    margin-top: 12px;
    color: #d0d0d0;
    font-size: 0.9em;
    line-height: 1.5;
  }

  :global(.item-tooltip__flavor) {
    margin-top: 12px;
    font-style: italic;
    color: #888;
    font-size: 0.85em;
    text-align: center;
    padding: 8px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 4px;
  }

  :global(.item-tooltip__footer) {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    color: #ffd700;
    font-size: 0.9em;
    text-align: center;
  }
</style>

