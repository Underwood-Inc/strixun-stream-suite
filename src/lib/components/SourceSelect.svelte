<script lang="ts">
  /**
   * SourceSelect Component
   * 
   * Reusable, composable source selection dropdown with search functionality.
   * Reactively updates from the sources store.
   * 
   * @example
   * <SourceSelect
   *   bind:value={selectedSource}
   *   placeholder="-- Select Source --"
   *   filter={(source) => true}
   *   on:change={handleChange}
   * />
   */
  
  import { createEventDispatcher } from 'svelte';
  import { sources } from '../../stores/connection';
  import type { Source } from '../../types';
  import Select from './primitives/Select/Select.svelte';
  
  const dispatch = createEventDispatcher();
  
  // Props
  export let value: string = '';
  export let placeholder: string = '-- Select Source --';
  export let filter: ((source: Source) => boolean) | null = null;
  export let disabled: boolean = false;
  export let id: string | null = null;
  export let searchable: boolean = false;
  export let minSearchChars: number = 1;
  
  // Filtered sources based on filter prop
  $: filteredSources = filter ? $sources.filter(filter) : $sources;
  
  // Convert sources to Select component format
  $: selectItems = filteredSources.map(source => ({
    value: source.sourceName,
    label: source.sourceName,
  }));
  
  // Handle value change from Select
  function handleSelectChange(event: CustomEvent<{ value: string }>): void {
    value = event.detail.value;
    dispatch('change', { value });
  }
</script>

{#if searchable}
  <!-- Searchable Dropdown using generic Select component -->
  <Select
    {value}
    items={selectItems}
    {placeholder}
    {disabled}
    searchable={true}
    on:change={handleSelectChange}
  />
{:else}
  <!-- Native Select -->
  <select
    bind:value
    {id}
    {disabled}
    class="source-select source-select--native"
    on:change={handleSelectChange}
  >
    <option value="">{placeholder}</option>
    {#each filteredSources as source (source.sourceName)}
      <option value={source.sourceName}>{source.sourceName}</option>
    {/each}
  </select>
{/if}

<style lang="scss">
  @use '@styles/components/forms';
  
  .source-select--native {
    // Native select styling is handled by forms.scss
    width: 100%;
  }
</style>

