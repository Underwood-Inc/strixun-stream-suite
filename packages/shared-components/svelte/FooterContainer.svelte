<script lang="ts">
  /**
   * FooterContainer - Atomic footer component for layout/styling
   * Provides consistent footer styling (background, padding, border)
   * 
   * @param className - Optional CSS class
   */
  export let className: string = '';
</script>

<footer class="footer-container {className}">
  <slot />
</footer>

<style>
  .footer-container {
    background: var(--bg-dark, #1a1611);
    border-top: 1px solid var(--border, #3e3e3e);
    padding: var(--spacing-xl, 2rem);
    margin-top: var(--spacing-3xl, 4rem);
  }

  @media (max-width: 768px) {
    .footer-container {
      padding: var(--spacing-lg, 1.5rem);
    }
  }

  @media (max-width: 480px) {
    .footer-container {
      padding: var(--spacing-md, 1rem);
      margin-top: var(--spacing-2xl, 3rem);
    }
  }
</style>
