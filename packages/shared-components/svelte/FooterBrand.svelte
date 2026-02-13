<script lang="ts">
  /**
   * FooterBrand - Atomic footer component for brand/service name
   * 
   * @param serviceName - Name of the service (e.g., "OTP Authentication API")
   * @param description - Optional description/tagline
   * @param className - Optional CSS class
   */
  export let serviceName: string;
  export let description: string = '';
  export let className: string = '';
</script>

<div class="footer-brand {className}">
  <p class="footer-brand__title">{serviceName}</p>
  {#if description}
    <p class="footer-brand__description">{description}</p>
  {/if}
</div>

<style>
  .footer-brand {
    text-align: center;
  }

  .footer-brand__title {
    color: var(--text-secondary, #b8b8b8);
    font-size: 1rem;
    margin: 0;
  }

  .footer-brand__description {
    color: var(--text-muted, #888);
    font-size: 0.875rem;
    margin: var(--spacing-sm, 0.5rem) 0 0 0;
  }

  @media (max-width: 768px) {
    .footer-brand__title {
      font-size: 0.875rem;
    }

    .footer-brand__description {
      font-size: 0.75rem;
    }
  }

  @media (max-width: 480px) {
    .footer-brand__title {
      font-size: 0.8rem;
    }

    .footer-brand__description {
      font-size: 0.7rem;
    }
  }
</style>
