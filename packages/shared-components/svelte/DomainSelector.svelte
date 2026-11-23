<script lang="ts">
  import '../styles/DomainSelector.css';
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
    label = 'Domain',
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