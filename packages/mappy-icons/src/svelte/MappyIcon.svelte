<script lang="ts">
  import { ClipboardCopy, Link, RefreshCw, Search, Trash2, X } from 'lucide-svelte';
  import { resolveActionIconLucideName } from '../canon/mappyActionIconAliasCatalog.js';

  interface Props {
    alias: string;
    size?: number;
    class?: string;
    'aria-label'?: string;
  }

  let { alias, size = 16, class: className = '', 'aria-label': ariaLabel }: Props = $props();

  const lucide = $derived(resolveActionIconLucideName(alias));
</script>

{#if lucide === 'ClipboardCopy'}
  <ClipboardCopy {size} class={className} aria-label={ariaLabel} aria-hidden={ariaLabel ? undefined : true} />
{:else if lucide === 'Trash2'}
  <Trash2 {size} class={className} aria-label={ariaLabel} aria-hidden={ariaLabel ? undefined : true} />
{:else if lucide === 'RefreshCw'}
  <RefreshCw {size} class={className} aria-label={ariaLabel} aria-hidden={ariaLabel ? undefined : true} />
{:else if lucide === 'Link'}
  <Link {size} class={className} aria-label={ariaLabel} aria-hidden={ariaLabel ? undefined : true} />
{:else if lucide === 'Search'}
  <Search {size} class={className} aria-label={ariaLabel} aria-hidden={ariaLabel ? undefined : true} />
{:else if lucide === 'X'}
  <X {size} class={className} aria-label={ariaLabel} aria-hidden={ariaLabel ? undefined : true} />
{/if}