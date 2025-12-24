<script lang="ts">
  import { onMount } from 'svelte';
  import SwaggerUIBundle from 'swagger-ui-dist/swagger-ui-bundle';
  import SwaggerUIStandalonePreset from 'swagger-ui-dist/swagger-ui-standalone-preset';
  import 'swagger-ui-dist/swagger-ui.css';

  export let url: string = '/openapi.json';

  let container: HTMLElement;
  let initialized = false;

  onMount(() => {
    if (initialized || !container) return;
    
    try {
      SwaggerUIBundle({
        url,
        dom_id: container,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        layout: 'StandaloneLayout',
        deepLinking: true,
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 1,
        docExpansion: 'list',
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
        tryItOutEnabled: true,
        requestSnippetsEnabled: true,
        onComplete: () => {
          // Inject custom styles to match design system
          const style = document.createElement('style');
          style.textContent = `
            .swagger-ui .topbar { display: none; }
            .swagger-ui .info { margin: var(--spacing-lg) 0; color: var(--text); }
            .swagger-ui .scheme-container { background: var(--card); padding: var(--spacing-md); border-radius: var(--radius-md); margin: var(--spacing-md) 0; }
            .swagger-ui .opblock { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-md); margin: var(--spacing-md) 0; }
            .swagger-ui .opblock.opblock-post { border-left: 4px solid var(--accent); }
            .swagger-ui .opblock.opblock-get { border-left: 4px solid var(--info); }
            .swagger-ui .opblock.opblock-put { border-left: 4px solid var(--warning); }
            .swagger-ui .opblock.opblock-delete { border-left: 4px solid var(--danger); }
            .swagger-ui .opblock-tag { color: var(--accent); }
            .swagger-ui .opblock-summary { color: var(--text); }
            .swagger-ui .opblock-description-wrapper p { color: var(--text-secondary); }
            .swagger-ui input, .swagger-ui select, .swagger-ui textarea { background: var(--bg-dark); border: 1px solid var(--border); color: var(--text); }
            .swagger-ui .btn { background: var(--accent); color: #000; border: none; }
            .swagger-ui .btn:hover { background: var(--accent-light); }
            .swagger-ui .response-col_status { color: var(--text); }
            .swagger-ui code { background: var(--bg-dark); color: var(--accent); }
            .swagger-ui pre { background: var(--bg-dark); border: 1px solid var(--border); }
            .swagger-ui .model-box { background: var(--card); border: 1px solid var(--border); }
            .swagger-ui .model-title { color: var(--accent); }
          `;
          document.head.appendChild(style);
        }
      });
      initialized = true;
    } catch (error) {
      console.error('Failed to initialize Swagger UI:', error);
    }
  });
</script>

<div bind:this={container} class="swagger-container"></div>

<style>
  .swagger-container {
    margin-top: var(--spacing-lg);
  }
</style>

