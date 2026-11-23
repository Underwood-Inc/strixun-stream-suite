<script lang="ts">
  import type { HostViewBarDatum } from '@strixun/url-shortener-core';
  import HorizontalBar from '../charts/HorizontalBar.svelte';

  interface Props {
    series: readonly HostViewBarDatum[];
    compact?: boolean;
  }

  let { series, compact = false }: Props = $props();
</script>

<div class="host-breakdown" class:compact>
  {#each series as bar (bar.hostKey)}
  {#if bar.value > 0 || !compact}
    <HorizontalBar
      label={bar.label}
      value={bar.value}
      max={bar.max}
      valueLabel={`${bar.value} views`}
    />
    {/if}
  {/each}
</div>

<style>
  .host-breakdown {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 12rem;
  }
  .host-breakdown.compact :global(.horizontal-bar) {
    gap: 0.15rem;
  }
</style>