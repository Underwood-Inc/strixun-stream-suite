<script lang="ts">
  // Composable Card component
</script>

<div class="card">
  <slot />
</div>

<style>
  .card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--spacing-lg);
  }
</style>

