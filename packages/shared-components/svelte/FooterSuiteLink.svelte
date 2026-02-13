<script lang="ts">
  /**
   * FooterSuiteLink - Atomic footer component for suite link
   * Shows "Part of the [StrixunSuiteLink]" or "Powered by [text]"
   * 
   * @param prefix - Text before the link (default: "Part of the")
   * @param className - Optional CSS class
   */
  import StrixunSuiteLink from './StrixunSuiteLink.svelte';
  
  export let prefix: string = 'Part of the';
  export let className: string = '';
</script>

<p class="footer-suite-link {className}">
  {prefix} <StrixunSuiteLink />
</p>

<style>
  .footer-suite-link {
    text-align: center;
    margin: var(--spacing-sm, 0.5rem) 0 0 0;
    font-size: 0.875rem;
    color: var(--text-secondary, #b8b8b8);
  }

  @media (max-width: 768px) {
    .footer-suite-link {
      font-size: 0.75rem;
    }
  }

  @media (max-width: 480px) {
    .footer-suite-link {
      font-size: 0.7rem;
    }
  }
</style>
