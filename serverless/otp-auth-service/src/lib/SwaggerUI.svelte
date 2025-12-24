<script lang="ts">
  import { onMount } from 'svelte';
  
  // Swagger UI loaded from CDN (UMD bundles)
  let SwaggerUIBundle: any;
  let SwaggerUIStandalonePreset: any;

  export let url: string = '/openapi.json';

  let container: HTMLElement;
  let initialized = false;

  // Helper function to load scripts dynamically
  function loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if script already loaded
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
    });
  }

  onMount(async () => {
    if (initialized || !container) return;
    
    try {
      // Load Swagger UI from CDN (same approach as landing page)
      // This avoids Vite bundling issues with UMD modules
      if (!SwaggerUIBundle || !SwaggerUIStandalonePreset) {
        // Check if already loaded globally
        if ((window as any).SwaggerUIBundle && (window as any).SwaggerUIStandalonePreset) {
          SwaggerUIBundle = (window as any).SwaggerUIBundle;
          SwaggerUIStandalonePreset = (window as any).SwaggerUIStandalonePreset;
        } else {
          // Load CSS first
          const cssLink = document.createElement('link');
          cssLink.rel = 'stylesheet';
          cssLink.href = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui.css';
          if (!document.querySelector(`link[href="${cssLink.href}"]`)) {
            document.head.appendChild(cssLink);
          }
          
          // Load scripts and wait for them to be available
          await Promise.all([
            loadScript('https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui-bundle.js'),
            loadScript('https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui-standalone-preset.js')
          ]);
          
          SwaggerUIBundle = (window as any).SwaggerUIBundle;
          SwaggerUIStandalonePreset = (window as any).SwaggerUIStandalonePreset;
        }
      }
      
      // Create unique ID for container
      const containerId = `swagger-ui-${Math.random().toString(36).substr(2, 9)}`;
      container.id = containerId;
      
      // Use SwaggerUI according to official documentation
      // swagger-ui-dist uses the standard API with presets
      SwaggerUIBundle({
        url,
        dom_id: `#${containerId}`,
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
          const styleId = 'swagger-custom-styles';
          if (document.getElementById(styleId)) return;
          
          const style = document.createElement('style');
          style.id = styleId;
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

