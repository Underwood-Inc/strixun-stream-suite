<script lang="ts">
  // Composable Card component
</script>

<div class="card">
  <slot />
</div>

<style>
  /* Reusable: 0 spacing so consumers control layout (no opinionated margin/padding). */
  .card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }
</style>

