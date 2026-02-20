<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Card from '$dashboard/components/Card.svelte';

  const dispatch = createEventDispatcher<{ create: { name: string } }>();

  let newKeyName = '';

  function handleCreate() {
    dispatch('create', { name: newKeyName.trim() || 'Default API Key' });
    newKeyName = '';
  }
</script>

<Card>
  <h2 class="create-form__title">Create New API Key</h2>
  <div class="create-form__row">
    <input
      type="text"
      class="create-form__input"
      placeholder="Key name (optional)"
      bind:value={newKeyName}
      onkeypress={(e) => e.key === 'Enter' && handleCreate()}
    />
    <button class="create-form__button" onclick={handleCreate}>
      Create API Key
    </button>
  </div>
</Card>

<style>
  .create-form__title {
    font-size: 1.25rem;
    margin-bottom: var(--spacing-md);
    color: var(--accent);
  }

  .create-form__row {
    display: flex;
    gap: var(--spacing-md);
  }

  .create-form__input {
    flex: 1;
    padding: var(--spacing-md);
    background: var(--bg-dark);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    color: var(--text);
    font-size: 1rem;
  }

  .create-form__button {
    padding: var(--spacing-md) var(--spacing-lg);
    background: var(--accent);
    border: 3px solid var(--accent-dark);
    border-radius: 0;
    color: #000;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    box-shadow: 0 4px 0 var(--accent-dark);
  }

  .create-form__button:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 0 var(--accent-dark);
  }
</style>
