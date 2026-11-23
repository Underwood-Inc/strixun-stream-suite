<script lang="ts">
  import type { ShortUrlListRow } from '@strixun/url-shortener-core';
  import MappyIcon from '@strixun/mappy-icons/svelte';

  interface Props {
    row: ShortUrlListRow;
    onCopy?: (shortUrl: string) => void;
    onDelete?: (shortCode: string) => void;
  }

  let { row, onCopy, onDelete }: Props = $props();
</script>

<div class="row-actions">
  <button
    type="button"
    class="row-actions__btn"
    title="Copy short URL"
    aria-label="Copy short URL"
    onclick={() => onCopy?.(row.shortUrl)}
  >
    <MappyIcon alias="action.copy" size={16} />
  </button>
  <button
    type="button"
    class="row-actions__btn row-actions__btn--danger"
    title="Delete"
    aria-label="Delete short URL"
    onclick={() => onDelete?.(row.shortCode)}
  >
    <MappyIcon alias="action.delete" size={16} />
  </button>
</div>

<style>
  .row-actions {
    display: flex;
    gap: 0.35rem;
    align-items: center;
  }
  .row-actions__btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 4px 8px;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    color: var(--text);
    cursor: pointer;
  }
  .row-actions__btn:hover {
    border-color: var(--accent);
  }
  .row-actions__btn--danger:hover {
    border-color: var(--danger);
    color: var(--danger);
  }
</style>