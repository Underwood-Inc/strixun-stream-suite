<script lang="ts">
  import type { ShortenerPublicHostRow } from '@strixun/url-shortener-core';

  interface Props {
    hosts: readonly ShortenerPublicHostRow[];
    value: string;
    onchange?: (hostKey: string) => void;
    id?: string;
    label?: string;
  }

  let {
    hosts,
    value = $bindable(''),
    onchange,
    id = 'shortener-public-host',
    label = 'Public link domain',
  }: Props = $props();

  function handleChange(event: Event): void {
    const key = (event.currentTarget as HTMLSelectElement).value;
    value = key;
    onchange?.(key);
  }
</script>

<label class="domain-selector" for={id}>
  <span class="domain-selector__label">{label}</span>
  <select {id} class="domain-selector__select" {value} onchange={handleChange}>
    {#each hosts as host (host.id)}
      <option value={host.id}>{host.label}</option>
    {/each}
  </select>
</label>

<style>
  .domain-selector {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-size: 0.875rem;
  }
  .domain-selector__select {
    min-width: 12rem;
    padding: 0.35rem 0.5rem;
    border-radius: 0.35rem;
    border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
    background: transparent;
    color: inherit;
  }
</style>