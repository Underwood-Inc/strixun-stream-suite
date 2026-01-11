<script lang="ts">
  import Accordion from './Accordion.svelte';
  import ApiEndpointsAccordion from './docs/ApiEndpointsAccordion.svelte';
  import ArchitectureAccordion from './docs/ArchitectureAccordion.svelte';
  import ErrorHandlingAccordion from './docs/ErrorHandlingAccordion.svelte';
  import MultiTenancyAccordion from './docs/MultiTenancyAccordion.svelte';
  import SecurityBestPracticesAccordion from './docs/SecurityBestPracticesAccordion.svelte';

  let activeAccordion: string | null = null;

  function handleToggle(event: CustomEvent<{ id: string }>) {
    const { id } = event.detail;
    activeAccordion = activeAccordion === id ? null : id;
  }
</script>

<section class="code-examples" id="docs">
  <h2>Technical Documentation</h2>
  <p class="subtitle">
    Expand sections below for detailed technical information
  </p>

  <Accordion
    id="api-endpoints"
    title="API Endpoints"
    isActive={activeAccordion === 'api-endpoints'}
    on:toggle={handleToggle}
  >
    <ApiEndpointsAccordion />
  </Accordion>

  <Accordion
    id="architecture"
    title="Architecture"
    isActive={activeAccordion === 'architecture'}
    on:toggle={handleToggle}
  >
    <ArchitectureAccordion />
  </Accordion>

  <Accordion
    id="error-handling"
    title="Error Handling"
    isActive={activeAccordion === 'error-handling'}
    on:toggle={handleToggle}
  >
    <ErrorHandlingAccordion />
  </Accordion>

  <Accordion
    id="multi-tenancy"
    title="Multi-Tenancy"
    isActive={activeAccordion === 'multi-tenancy'}
    on:toggle={handleToggle}
  >
    <MultiTenancyAccordion />
  </Accordion>

  <Accordion
    id="security-best-practices"
    title="Security Best Practices"
    isActive={activeAccordion === 'security-best-practices'}
    on:toggle={handleToggle}
  >
    <SecurityBestPracticesAccordion />
  </Accordion>
</section>

<style>
  .code-examples {
    padding: var(--spacing-3xl) var(--spacing-xl);
    max-width: 1200px;
    margin: 0 auto;
  }

  .code-examples h2 {
    text-align: center;
    font-size: clamp(2rem, 4vw, 3rem);
    margin-bottom: var(--spacing-lg);
    color: var(--accent);
  }

  .subtitle {
    text-align: center;
    color: var(--text-secondary);
    margin-bottom: var(--spacing-xl);
  }

  @media (max-width: 768px) {
    .code-examples {
      padding: var(--spacing-2xl) var(--spacing-md);
    }

    .subtitle {
      font-size: 0.9rem;
    }
  }

  @media (max-width: 480px) {
    .code-examples {
      padding: var(--spacing-xl) var(--spacing-sm);
    }

    .code-examples h2 {
      font-size: 1.75rem;
      margin-bottom: var(--spacing-md);
    }

    .subtitle {
      font-size: 0.85rem;
      margin-bottom: var(--spacing-md);
    }
  }
</style>
