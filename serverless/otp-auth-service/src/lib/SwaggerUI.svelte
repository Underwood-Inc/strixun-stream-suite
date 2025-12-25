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
          // Inject comprehensive custom styles to match design system with proper contrast
          const styleId = 'swagger-custom-styles';
          const existingStyle = document.getElementById(styleId);
          if (existingStyle) {
            existingStyle.remove();
          }
          
          const style = document.createElement('style');
          style.id = styleId;
          style.setAttribute('data-swagger-theme', 'strixun');
          style.textContent = `
            /* ============================================
               SWAGGER UI THEME - Strixun Stream Suite
               Comprehensive styling for readability and brand alignment
               ============================================ */
            
            /* Hide Swagger topbar */
            .swagger-ui .topbar { display: none !important; }
            
            /* ========== Base Container & Layout ========== */
            .swagger-ui { 
              background: var(--bg, #1a1611) !important;
              color: var(--text, #f9f9f9) !important;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
            }
            
            /* ========== Text Selection - Match Global App Style ========== */
            /* Use same semi-transparent orange as main app (rgba(237, 174, 73, 0.3)) */
            .swagger-ui *::selection,
            .swagger-ui ::selection {
              background: var(--accent, #edae49) !important;
              background-color: var(--accent, #edae49) !important;
              color: var(--bg-dark, #0f0e0b) !important;
            }
            
            .swagger-ui *::-moz-selection,
            .swagger-ui ::-moz-selection {
              background: var(--accent, #edae49) !important;
              background-color: var(--accent, #edae49) !important;
              color: var(--bg-dark, #0f0e0b) !important;
            }
            
            .swagger-ui *::-webkit-selection,
            .swagger-ui ::-webkit-selection {
              background: var(--accent, #edae49) !important;
              background-color: var(--accent, #edae49) !important;
              color: var(--bg-dark, #0f0e0b) !important;
            }
            
            /* ========== Force Dark Theme - Override All Light Elements ========== */
            .swagger-ui * {
              box-sizing: border-box;
            }
            
            /* Force dark backgrounds on all containers */
            .swagger-ui .swagger-ui,
            .swagger-ui .wrapper,
            .swagger-ui .container,
            .swagger-ui .scheme-container,
            .swagger-ui .opblock,
            .swagger-ui .opblock-body,
            .swagger-ui .opblock-summary,
            .swagger-ui .opblock-description-wrapper,
            .swagger-ui .parameters-container,
            .swagger-ui .request-body,
            .swagger-ui .responses-wrapper,
            .swagger-ui .responses-inner,
            .swagger-ui .response,
            .swagger-ui .model-box,
            .swagger-ui .model-container,
            .swagger-ui .tab-content,
            .swagger-ui .highlight-code,
            .swagger-ui .microlight,
            .swagger-ui .renderedMarkdown,
            .swagger-ui .auth-container,
            .swagger-ui .auth-btn-wrapper,
            .swagger-ui .opblock-section,
            .swagger-ui .opblock-section-header {
              background: var(--bg-dark, #0f0e0b) !important;
              background-color: var(--bg-dark, #0f0e0b) !important;
            }
            
            /* Override any white/light backgrounds */
            .swagger-ui div,
            .swagger-ui section,
            .swagger-ui article,
            .swagger-ui aside,
            .swagger-ui main {
              background: transparent !important;
            }
            
            /* Force dark theme on all inputs, selects, textareas */
            .swagger-ui input[type="text"],
            .swagger-ui input[type="email"],
            .swagger-ui input[type="password"],
            .swagger-ui input[type="number"],
            .swagger-ui input[type="search"],
            .swagger-ui input[type="url"],
            .swagger-ui input[type="tel"],
            .swagger-ui select,
            .swagger-ui textarea {
              background: var(--bg-dark, #0f0e0b) !important;
              background-color: var(--bg-dark, #0f0e0b) !important;
              color: var(--text, #f9f9f9) !important;
              border-color: var(--border, #3d3627) !important;
            }
            
            /* Override any light text colors */
            .swagger-ui .opblock-summary-description,
            .swagger-ui .opblock-description-wrapper p,
            .swagger-ui .parameter__description,
            .swagger-ui .response-col_description,
            .swagger-ui .response-col_links {
              color: var(--text-secondary, #b8b8b8) !important;
            }
            
            /* Ensure all text is visible */
            .swagger-ui p,
            .swagger-ui span,
            .swagger-ui div,
            .swagger-ui td,
            .swagger-ui th,
            .swagger-ui label {
              color: inherit;
            }
            
            /* ========== Info Section (API Title & Description) ========== */
            .swagger-ui .info { 
              margin: var(--spacing-lg, 24px) 0;
              color: var(--text, #f9f9f9);
            }
            .swagger-ui .info .title { 
              color: var(--accent, #edae49) !important;
              font-size: 2rem;
              font-weight: 700;
              margin-bottom: var(--spacing-md, 16px);
            }
            .swagger-ui .info .title small { 
              color: var(--text-secondary, #b8b8b8) !important;
              font-size: 0.875rem;
            }
            .swagger-ui .info p { 
              color: var(--text, #f9f9f9) !important;
              line-height: 1.6;
              margin: var(--spacing-md, 16px) 0;
            }
            .swagger-ui .info .base-url { 
              color: var(--text, #f9f9f9) !important;
              font-weight: 600;
            }
            .swagger-ui .info a { 
              color: var(--accent, #edae49) !important;
              text-decoration: none;
            }
            .swagger-ui .info a:hover { 
              color: var(--accent-light, #f9df74) !important;
              text-decoration: underline;
            }
            
            /* ========== Servers Section ========== */
            .swagger-ui .scheme-container { 
              background: var(--card, #252017);
              padding: var(--spacing-md, 16px);
              border-radius: var(--radius-md, 8px);
              margin: var(--spacing-md, 16px) 0;
              border: 1px solid var(--border, #3d3627);
            }
            .swagger-ui .scheme-container label { 
              color: var(--text, #f9f9f9) !important;
              font-weight: 600;
            }
            .swagger-ui .scheme-container select { 
              background: var(--bg-dark, #0f0e0b) !important;
              border: 1px solid var(--border, #3d3627) !important;
              color: var(--text, #f9f9f9) !important;
              padding: var(--spacing-sm, 12px);
              border-radius: var(--radius-sm, 4px);
            }
            .swagger-ui .scheme-container .auth-wrapper { 
              margin-top: var(--spacing-sm, 12px);
            }
            .swagger-ui .scheme-container .btn.authorize { 
              background: var(--accent, #edae49) !important;
              color: #000 !important;
              border: none !important;
              font-weight: 600;
              padding: var(--spacing-sm, 12px) var(--spacing-md, 16px);
              border-radius: var(--radius-sm, 4px);
            }
            .swagger-ui .scheme-container .btn.authorize:hover { 
              background: var(--accent-light, #f9df74) !important;
            }
            
            /* ========== Filter Input ========== */
            .swagger-ui .filter-container input { 
              background: var(--bg-dark, #0f0e0b) !important;
              border: 1px solid var(--border, #3d3627) !important;
              color: var(--text, #f9f9f9) !important;
              padding: var(--spacing-sm, 12px);
              border-radius: var(--radius-sm, 4px);
              width: 100%;
            }
            .swagger-ui .filter-container input::placeholder { 
              color: var(--muted, #888) !important;
            }
            .swagger-ui .filter-container label { 
              color: var(--text, #f9f9f9) !important;
              font-weight: 600;
              margin-bottom: var(--spacing-xs, 8px);
              display: block;
            }
            
            /* ========== Tags (Section Headers) ========== */
            .swagger-ui .opblock-tag { 
              color: var(--accent, #edae49) !important;
              font-size: 1.5rem;
              font-weight: 700;
              margin: var(--spacing-lg, 24px) 0 var(--spacing-md, 16px) 0;
              padding-bottom: var(--spacing-sm, 12px);
              border-bottom: 2px solid var(--border, #3d3627);
            }
            .swagger-ui .opblock-tag small { 
              color: var(--text-secondary, #b8b8b8) !important;
              font-size: 0.875rem;
              font-weight: 400;
              margin-left: var(--spacing-sm, 12px);
            }
            
            /* Override any blue link colors to brand accent */
            .swagger-ui a,
            .swagger-ui .opblock-tag,
            .swagger-ui .opblock-summary-path,
            .swagger-ui .parameter__name,
            .swagger-ui .prop-name,
            .swagger-ui .model-title,
            .swagger-ui .opblock-section-header h4,
            .swagger-ui .request-body h4,
            .swagger-ui .responses-wrapper h4 {
              color: var(--accent, #edae49) !important;
            }
            
            /* Override any default blue colors */
            .swagger-ui [style*="blue"],
            .swagger-ui [style*="#0066cc"],
            .swagger-ui [style*="#007bff"],
            .swagger-ui [style*="rgb(0, 123, 255)"],
            .swagger-ui [style*="rgba(0, 123, 255"] {
              color: var(--accent, #edae49) !important;
            }
            
            /* ========== Operation Blocks (Endpoints) ========== */
            .swagger-ui .opblock { 
              background: var(--card, #252017) !important;
              border: 1px solid var(--border, #3d3627) !important;
              border-radius: var(--radius-md, 8px);
              margin: var(--spacing-md, 16px) 0;
              transition: border-color 0.2s, box-shadow 0.2s;
            }
            .swagger-ui .opblock:hover { 
              border-color: var(--border-light, #4a4336) !important;
              box-shadow: var(--shadow-md, 0 4px 8px rgba(0, 0, 0, 0.3));
            }
            
            /* Method-specific border colors */
            .swagger-ui .opblock.opblock-post { 
              border-left: 4px solid var(--accent, #edae49) !important;
            }
            .swagger-ui .opblock.opblock-get { 
              border-left: 4px solid var(--info, #6495ed) !important;
            }
            .swagger-ui .opblock.opblock-put { 
              border-left: 4px solid var(--warning, #ffc107) !important;
            }
            .swagger-ui .opblock.opblock-patch { 
              border-left: 4px solid var(--warning, #ffc107) !important;
            }
            .swagger-ui .opblock.opblock-delete { 
              border-left: 4px solid var(--danger, #ea2b1f) !important;
            }
            
            /* Method buttons */
            .swagger-ui .opblock .opblock-summary-method { 
              font-weight: 700;
              font-size: 0.875rem;
              padding: var(--spacing-xs, 8px) var(--spacing-sm, 12px);
              border-radius: var(--radius-sm, 4px);
              min-width: 60px;
              text-align: center;
            }
            .swagger-ui .opblock.opblock-post .opblock-summary-method { 
              background: var(--accent, #edae49) !important;
              color: #000 !important;
            }
            .swagger-ui .opblock.opblock-get .opblock-summary-method { 
              background: var(--info, #6495ed) !important;
              color: #fff !important;
            }
            .swagger-ui .opblock.opblock-put .opblock-summary-method,
            .swagger-ui .opblock.opblock-patch .opblock-summary-method { 
              background: var(--warning, #ffc107) !important;
              color: #000 !important;
            }
            .swagger-ui .opblock.opblock-delete .opblock-summary-method { 
              background: var(--danger, #ea2b1f) !important;
              color: #fff !important;
            }
            
            /* Operation summary text */
            .swagger-ui .opblock-summary { 
              color: var(--text, #f9f9f9) !important;
              font-weight: 600;
            }
            .swagger-ui .opblock-summary-path { 
              color: var(--text, #f9f9f9) !important;
              font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
            }
            .swagger-ui .opblock-summary-description { 
              color: var(--text-secondary, #b8b8b8) !important;
            }
            
            /* ========== Operation Details (Expanded) ========== */
            .swagger-ui .opblock-body { 
              background: var(--bg-dark, #0f0e0b) !important;
              border-top: 1px solid var(--border, #3d3627);
            }
            .swagger-ui .opblock-description-wrapper { 
              padding: var(--spacing-md, 16px);
            }
            .swagger-ui .opblock-description-wrapper p { 
              color: var(--text, #f9f9f9) !important;
              line-height: 1.6;
              margin: var(--spacing-sm, 12px) 0;
            }
            .swagger-ui .opblock-description-wrapper h4 { 
              color: var(--accent, #edae49) !important;
              font-weight: 600;
              margin: var(--spacing-md, 16px) 0 var(--spacing-sm, 12px) 0;
            }
            
            /* ========== Parameters ========== */
            .swagger-ui .parameters-container { 
              padding: var(--spacing-md, 16px);
            }
            .swagger-ui .parameters-container .parameter__name { 
              color: var(--text, #f9f9f9) !important;
              font-weight: 600;
              font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
            }
            .swagger-ui .parameters-container .parameter__type { 
              color: var(--accent, #edae49) !important;
              font-weight: 600;
            }
            .swagger-ui .parameters-container .parameter__in { 
              color: var(--text-secondary, #b8b8b8) !important;
              font-size: 0.875rem;
            }
            .swagger-ui .parameters-container .parameter__description { 
              color: var(--text-secondary, #b8b8b8) !important;
            }
            .swagger-ui .parameters-container .parameter__deprecated { 
              color: var(--danger, #ea2b1f) !important;
            }
            
            /* Parameter inputs */
            .swagger-ui .parameters-container input,
            .swagger-ui .parameters-container select,
            .swagger-ui .parameters-container textarea { 
              background: var(--bg-dark, #0f0e0b) !important;
              border: 1px solid var(--border, #3d3627) !important;
              color: var(--text, #f9f9f9) !important;
              padding: var(--spacing-sm, 12px);
              border-radius: var(--radius-sm, 4px);
              font-size: 0.875rem;
            }
            .swagger-ui .parameters-container input:focus,
            .swagger-ui .parameters-container select:focus,
            .swagger-ui .parameters-container textarea:focus { 
              outline: none;
              border-color: var(--accent, #edae49) !important;
              box-shadow: 0 0 0 2px rgba(237, 174, 73, 0.2);
            }
            .swagger-ui .parameters-container input::placeholder { 
              color: var(--muted, #888) !important;
            }
            
            /* ========== Enhanced Dropdown/Select Styling ========== */
            .swagger-ui select,
            .swagger-ui select[class],
            .swagger-ui select[id] { 
              background: var(--bg-dark, #0f0e0b) !important;
              background-color: var(--bg-dark, #0f0e0b) !important;
              background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23edae49' d='M6 9L1 4h10z'/%3E%3C/svg%3E") !important;
              background-repeat: no-repeat !important;
              background-position: right 12px center !important;
              background-size: 12px !important;
              border: 1px solid var(--border, #3d3627) !important;
              border-color: var(--border, #3d3627) !important;
              color: var(--text, #f9f9f9) !important;
              padding: var(--spacing-sm, 12px) var(--spacing-md, 16px) !important;
              padding-right: 40px !important;
              border-radius: var(--radius-sm, 4px) !important;
              font-size: 0.875rem !important;
              appearance: none !important;
              -webkit-appearance: none !important;
              -moz-appearance: none !important;
              cursor: pointer !important;
              transition: all 0.2s !important;
            }
            .swagger-ui select:hover { 
              border-color: var(--border-light, #4a4336) !important;
              background-color: var(--bg-dark, #0f0e0b) !important;
            }
            .swagger-ui select:focus { 
              outline: none !important;
              border-color: var(--accent, #edae49) !important;
              box-shadow: 0 0 0 2px rgba(237, 174, 73, 0.2) !important;
              background-color: var(--bg-dark, #0f0e0b) !important;
            }
            .swagger-ui select option { 
              background: var(--card, #252017) !important;
              background-color: var(--card, #252017) !important;
              color: var(--text, #f9f9f9) !important;
              padding: var(--spacing-sm, 12px) !important;
            }
            .swagger-ui select option:checked,
            .swagger-ui select option:focus,
            .swagger-ui select option:hover {
              background: var(--bg-dark, #0f0e0b) !important;
              background-color: var(--bg-dark, #0f0e0b) !important;
            }
            
            /* Override any select wrappers or containers */
            .swagger-ui .select-container,
            .swagger-ui .content-type-wrapper,
            .swagger-ui .body-param-content-type,
            .swagger-ui .response-content-type {
              background: transparent !important;
            }
            
            /* Media type selectors */
            .swagger-ui .content-type-wrapper { 
              margin: var(--spacing-md, 16px) 0;
            }
            .swagger-ui .content-type-wrapper select { 
              width: 100%;
              max-width: 300px;
            }
            
            /* Request body content type selector */
            .swagger-ui .body-param-content-type { 
              margin: var(--spacing-md, 16px) 0;
            }
            .swagger-ui .body-param-content-type select { 
              width: 100%;
              max-width: 300px;
            }
            
            /* Textarea for request body */
            .swagger-ui textarea,
            .swagger-ui textarea[class],
            .swagger-ui textarea[id] { 
              background: var(--bg-dark, #0f0e0b) !important;
              background-color: var(--bg-dark, #0f0e0b) !important;
              border: 1px solid var(--border, #3d3627) !important;
              border-color: var(--border, #3d3627) !important;
              color: var(--text, #f9f9f9) !important;
              padding: var(--spacing-md, 16px) !important;
              border-radius: var(--radius-md, 8px) !important;
              font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace !important;
              font-size: 0.875rem !important;
              line-height: 1.6 !important;
              width: 100% !important;
              min-height: 200px !important;
              resize: vertical !important;
            }
            .swagger-ui textarea:focus { 
              outline: none !important;
              border-color: var(--accent, #edae49) !important;
              box-shadow: 0 0 0 2px rgba(237, 174, 73, 0.2) !important;
              background-color: var(--bg-dark, #0f0e0b) !important;
            }
            .swagger-ui textarea::placeholder { 
              color: var(--muted, #888) !important;
            }
            
            /* Code editor areas (JSON input) */
            .swagger-ui .body-param,
            .swagger-ui .body-param__content,
            .swagger-ui .body-param__text,
            .swagger-ui .body-param__text textarea,
            .swagger-ui .body-param__text pre {
              background: var(--bg-dark, #0f0e0b) !important;
              background-color: var(--bg-dark, #0f0e0b) !important;
              color: var(--text, #f9f9f9) !important;
            }
            
            /* Override any code editor wrappers */
            .swagger-ui .ace_editor,
            .swagger-ui .ace-tm,
            .swagger-ui .ace_gutter,
            .swagger-ui .ace_scroller {
              background: var(--bg-dark, #0f0e0b) !important;
              background-color: var(--bg-dark, #0f0e0b) !important;
            }
            
            /* Required indicator */
            .swagger-ui .parameter__name.required:after { 
              color: var(--danger, #ea2b1f) !important;
            }
            .swagger-ui .required { 
              color: var(--danger, #ea2b1f) !important;
              font-size: 0.75rem;
              font-weight: 600;
              margin-left: var(--spacing-xs, 8px);
            }
            
            /* ========== Request/Response Sections ========== */
            .swagger-ui .request-body,
            .swagger-ui .responses-wrapper { 
              padding: var(--spacing-md, 16px);
              background: var(--bg-dark, #0f0e0b);
            }
            .swagger-ui .request-body h4,
            .swagger-ui .responses-wrapper h4 { 
              color: var(--accent, #edae49) !important;
              font-weight: 600;
              margin: var(--spacing-md, 16px) 0 var(--spacing-sm, 12px) 0;
              font-size: 1.125rem;
            }
            
            /* Response section headers */
            .swagger-ui .responses-inner { 
              padding: var(--spacing-md, 16px);
            }
            .swagger-ui .responses-table { 
              width: 100%;
              border-collapse: collapse;
              margin: var(--spacing-md, 16px) 0;
            }
            .swagger-ui .responses-table thead { 
              background: var(--bg-dark, #0f0e0b);
              border-bottom: 2px solid var(--border, #3d3627);
            }
            .swagger-ui .responses-table thead th { 
              color: var(--text, #f9f9f9) !important;
              font-weight: 600;
              padding: var(--spacing-sm, 12px);
              text-align: left;
            }
            .swagger-ui .responses-table tbody tr { 
              border-bottom: 1px solid var(--border, #3d3627);
            }
            .swagger-ui .responses-table tbody tr:hover { 
              background: var(--card, #252017);
            }
            .swagger-ui .responses-table tbody td { 
              color: var(--text, #f9f9f9) !important;
              padding: var(--spacing-sm, 12px);
            }
            
            /* Response codes */
            .swagger-ui .response-col_status { 
              color: var(--text, #f9f9f9) !important;
              font-weight: 600;
              font-size: 1rem;
            }
            .swagger-ui .response-col_links { 
              color: var(--text-secondary, #b8b8b8) !important;
            }
            .swagger-ui .response-col_description { 
              color: var(--text, #f9f9f9) !important;
            }
            
            /* Response content sections */
            .swagger-ui .response { 
              margin: var(--spacing-md, 16px) 0;
              padding: var(--spacing-md, 16px);
              background: var(--card, #252017);
              border: 1px solid var(--border, #3d3627);
              border-radius: var(--radius-md, 8px);
            }
            .swagger-ui .response-content-type { 
              margin: var(--spacing-md, 16px) 0;
            }
            .swagger-ui .response-content-type label { 
              color: var(--text, #f9f9f9) !important;
              font-weight: 600;
              margin-bottom: var(--spacing-xs, 8px);
              display: block;
            }
            .swagger-ui .response-content-type .highlighted { 
              color: var(--text-secondary, #b8b8b8) !important;
              font-size: 0.875rem;
              margin-top: var(--spacing-xs, 8px);
            }
            
            /* Example Value and Schema tabs */
            .swagger-ui .tab { 
              display: inline-block;
              padding: var(--spacing-sm, 12px) var(--spacing-md, 16px);
              margin-right: var(--spacing-xs, 8px);
              background: var(--bg-dark, #0f0e0b) !important;
              border: 1px solid var(--border, #3d3627) !important;
              border-radius: var(--radius-sm, 4px) var(--radius-sm, 4px) 0 0;
              color: var(--text-secondary, #b8b8b8) !important;
              cursor: pointer;
              font-weight: 600;
              transition: all 0.2s;
            }
            .swagger-ui .tab.active { 
              background: var(--card, #252017) !important;
              border-bottom-color: var(--card, #252017) !important;
              color: var(--accent, #edae49) !important;
              border-color: var(--border, #3d3627) !important;
            }
            .swagger-ui .tab:hover:not(.active) { 
              color: var(--text, #f9f9f9) !important;
              border-color: var(--border-light, #4a4336) !important;
            }
            
            /* Tab content */
            .swagger-ui .tab-content { 
              background: var(--card, #252017);
              border: 1px solid var(--border, #3d3627);
              border-radius: 0 var(--radius-md, 8px) var(--radius-md, 8px) var(--radius-md, 8px);
              padding: var(--spacing-md, 16px);
              margin-top: -1px;
            }
            
            /* Example value display */
            .swagger-ui .microlight { 
              font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace !important;
              font-size: 0.875rem;
              line-height: 1.6;
            }
            .swagger-ui .highlight-code { 
              background: var(--bg-dark, #0f0e0b) !important;
              border: 1px solid var(--border, #3d3627) !important;
              border-radius: var(--radius-md, 8px);
              padding: var(--spacing-md, 16px);
              overflow-x: auto;
            }
            
            /* ========== Buttons ========== */
            .swagger-ui .btn { 
              background: var(--accent, #edae49) !important;
              color: #000 !important;
              border: none !important;
              font-weight: 600;
              padding: var(--spacing-sm, 12px) var(--spacing-md, 16px);
              border-radius: var(--radius-sm, 4px);
              cursor: pointer;
              transition: background 0.2s;
            }
            .swagger-ui .btn:hover { 
              background: var(--accent-light, #f9df74) !important;
            }
            .swagger-ui .btn.cancel { 
              background: var(--bg-dark, #0f0e0b) !important;
              color: var(--text, #f9f9f9) !important;
              border: 1px solid var(--border, #3d3627) !important;
            }
            .swagger-ui .btn.cancel:hover { 
              background: var(--card, #252017) !important;
              border-color: var(--border-light, #4a4336) !important;
            }
            .swagger-ui .btn.execute { 
              background: var(--accent, #edae49) !important;
              color: #000 !important;
            }
            .swagger-ui .btn.execute:hover { 
              background: var(--accent-light, #f9df74) !important;
            }
            
            /* ========== Code Blocks ========== */
            .swagger-ui code { 
              background: var(--bg-dark, #0f0e0b) !important;
              color: var(--accent, #edae49) !important;
              padding: 2px 6px;
              border-radius: var(--radius-sm, 4px);
              font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
              font-size: 0.875rem;
            }
            .swagger-ui pre { 
              background: var(--bg-dark, #0f0e0b) !important;
              border: 1px solid var(--border, #3d3627) !important;
              border-radius: var(--radius-md, 8px);
              padding: var(--spacing-md, 16px);
              overflow-x: auto;
              margin: var(--spacing-md, 16px) 0;
            }
            .swagger-ui pre code { 
              background: transparent !important;
              color: var(--text, #f9f9f9) !important;
              padding: 0;
            }
            
            /* JSON syntax highlighting in code blocks - Override blue colors */
            .swagger-ui pre .hljs-string,
            .swagger-ui pre .hljs-string .hljs-string { 
              color: var(--success, #28a745) !important;
            }
            .swagger-ui pre .hljs-number { 
              color: var(--danger, #ea2b1f) !important;
            }
            .swagger-ui pre .hljs-literal,
            .swagger-ui pre .hljs-literal .hljs-literal { 
              color: var(--accent, #edae49) !important;
            }
            .swagger-ui pre .hljs-keyword,
            .swagger-ui pre .hljs-keyword .hljs-keyword { 
              color: var(--accent, #edae49) !important;
            }
            .swagger-ui pre .hljs-property,
            .swagger-ui pre .hljs-property .hljs-property { 
              color: var(--text, #f9f9f9) !important;
            }
            /* Override any blue in syntax highlighting */
            .swagger-ui pre .hljs-attr,
            .swagger-ui pre .hljs-attribute,
            .swagger-ui pre .hljs-title,
            .swagger-ui pre .hljs-name,
            .swagger-ui pre .hljs-selector-tag,
            .swagger-ui pre .hljs-selector-id,
            .swagger-ui pre .hljs-selector-class,
            .swagger-ui pre .hljs-function,
            .swagger-ui pre .hljs-built_in,
            .swagger-ui pre .hljs-type,
            .swagger-ui pre .hljs-class,
            .swagger-ui pre .hljs-tag,
            .swagger-ui pre .hljs-variable,
            .swagger-ui pre .hljs-params {
              color: var(--accent, #edae49) !important;
            }
            
            /* Microlight syntax highlighting - Override blue */
            .swagger-ui .microlight { 
              color: var(--text, #f9f9f9) !important;
            }
            .swagger-ui .microlight .hljs-string,
            .swagger-ui .microlight .hljs-string .hljs-string { 
              color: var(--success, #28a745) !important;
            }
            .swagger-ui .microlight .hljs-number { 
              color: var(--danger, #ea2b1f) !important;
            }
            .swagger-ui .microlight .hljs-literal,
            .swagger-ui .microlight .hljs-literal .hljs-literal { 
              color: var(--accent, #edae49) !important;
            }
            .swagger-ui .microlight .hljs-keyword,
            .swagger-ui .microlight .hljs-keyword .hljs-keyword { 
              color: var(--accent, #edae49) !important;
            }
            /* Override blue in microlight */
            .swagger-ui .microlight .hljs-attr,
            .swagger-ui .microlight .hljs-attribute,
            .swagger-ui .microlight .hljs-title,
            .swagger-ui .microlight .hljs-name,
            .swagger-ui .microlight .hljs-property {
              color: var(--accent, #edae49) !important;
            }
            
            /* Override any inline blue colors in JSON/code */
            .swagger-ui pre [style*="blue"],
            .swagger-ui code [style*="blue"],
            .swagger-ui .microlight [style*="blue"],
            .swagger-ui .highlight-code [style*="blue"],
            .swagger-ui pre [style*="#0066cc"],
            .swagger-ui code [style*="#0066cc"],
            .swagger-ui .microlight [style*="#0066cc"],
            .swagger-ui .highlight-code [style*="#0066cc"] {
              color: var(--accent, #edae49) !important;
            }
            
            /* ========== Models/Schemas ========== */
            .swagger-ui .model-box { 
              background: var(--card, #252017) !important;
              border: 1px solid var(--border, #3d3627) !important;
              border-radius: var(--radius-md, 8px);
              padding: var(--spacing-md, 16px);
              margin: var(--spacing-md, 16px) 0;
            }
            .swagger-ui .model-title { 
              color: var(--accent, #edae49) !important;
              font-weight: 700;
              font-size: 1.125rem;
            }
            .swagger-ui .model-jump-to-path { 
              color: var(--accent, #edae49) !important;
            }
            .swagger-ui .model-box-control { 
              color: var(--text-secondary, #b8b8b8) !important;
            }
            .swagger-ui .model-toggle { 
              color: var(--accent, #edae49) !important;
            }
            .swagger-ui .prop-name { 
              color: var(--text, #f9f9f9) !important;
              font-weight: 600;
            }
            .swagger-ui .prop-type { 
              color: var(--accent, #edae49) !important;
            }
            .swagger-ui .prop-format { 
              color: var(--text-secondary, #b8b8b8) !important;
            }
            
            /* ========== Tables ========== */
            .swagger-ui table { 
              border-collapse: collapse;
              width: 100%;
            }
            .swagger-ui table thead tr { 
              background: var(--bg-dark, #0f0e0b);
              border-bottom: 2px solid var(--border, #3d3627);
            }
            .swagger-ui table thead th { 
              color: var(--text, #f9f9f9) !important;
              font-weight: 600;
              padding: var(--spacing-sm, 12px);
              text-align: left;
            }
            .swagger-ui table tbody tr { 
              border-bottom: 1px solid var(--border, #3d3627);
            }
            .swagger-ui table tbody tr:hover { 
              background: var(--bg-dark, #0f0e0b);
            }
            .swagger-ui table tbody td { 
              color: var(--text, #f9f9f9) !important;
              padding: var(--spacing-sm, 12px);
            }
            
            /* ========== Links ========== */
            .swagger-ui a { 
              color: var(--accent, #edae49) !important;
              text-decoration: none;
            }
            .swagger-ui a:hover { 
              color: var(--accent-light, #f9df74) !important;
              text-decoration: underline;
            }
            
            /* ========== Loading & Empty States ========== */
            .swagger-ui .loading-container { 
              color: var(--text-secondary, #b8b8b8) !important;
            }
            .swagger-ui .loading:after { 
              border-color: var(--accent, #edae49) transparent transparent transparent !important;
            }
            
            /* ========== Authorization Modal ========== */
            .swagger-ui .auth-btn-wrapper { 
              padding: var(--spacing-md, 16px);
            }
            .swagger-ui .auth-container { 
              background: var(--card, #252017) !important;
              border: 1px solid var(--border, #3d3627) !important;
            }
            .swagger-ui .auth-container input { 
              background: var(--bg-dark, #0f0e0b) !important;
              border: 1px solid var(--border, #3d3627) !important;
              color: var(--text, #f9f9f9) !important;
            }
            .swagger-ui .auth-container label { 
              color: var(--text, #f9f9f9) !important;
            }
            
            /* ========== Expanded Operation Content ========== */
            .swagger-ui .opblock.opblock-is-open .opblock-body { 
              border-top: 1px solid var(--border, #3d3627);
            }
            .swagger-ui .opblock.opblock-is-open .opblock-summary { 
              border-bottom: none;
            }
            
            /* Try it out section */
            .swagger-ui .btn.try-out__btn { 
              background: var(--bg-dark, #0f0e0b) !important;
              color: var(--text, #f9f9f9) !important;
              border: 1px solid var(--border, #3d3627) !important;
              margin-left: var(--spacing-sm, 12px);
            }
            .swagger-ui .btn.try-out__btn:hover { 
              background: var(--card, #252017) !important;
              border-color: var(--border-light, #4a4336) !important;
            }
            
            /* Execute button */
            .swagger-ui .btn.execute { 
              background: var(--accent, #edae49) !important;
              color: #000 !important;
              border: none !important;
              width: 100%;
              margin-top: var(--spacing-md, 16px);
              padding: var(--spacing-md, 16px);
              font-size: 1rem;
              font-weight: 700;
            }
            .swagger-ui .btn.execute:hover { 
              background: var(--accent-light, #f9df74) !important;
            }
            
            /* Response content wrapper */
            .swagger-ui .response-content-type { 
              margin-top: var(--spacing-lg, 24px);
            }
            
            /* Response headers */
            .swagger-ui .response-col_status.response-col_status--default { 
              color: var(--text, #f9f9f9) !important;
            }
            
            /* ========== Collapsible Sections ========== */
            .swagger-ui .opblock-section { 
              border-top: 1px solid var(--border, #3d3627);
            }
            .swagger-ui .opblock-section-header { 
              background: var(--bg-dark, #0f0e0b);
              padding: var(--spacing-md, 16px);
              cursor: pointer;
              transition: background 0.2s;
            }
            .swagger-ui .opblock-section-header:hover { 
              background: var(--card, #252017);
            }
            .swagger-ui .opblock-section-header h4 { 
              color: var(--accent, #edae49) !important;
              margin: 0;
            }
            .swagger-ui .opblock-section-header label { 
              color: var(--text, #f9f9f9) !important;
              font-weight: 600;
            }
            
            /* ========== Miscellaneous ========== */
            .swagger-ui .markdown p,
            .swagger-ui .markdown li { 
              color: var(--text, #f9f9f9) !important;
            }
            .swagger-ui .markdown code { 
              background: var(--bg-dark, #0f0e0b) !important;
              color: var(--accent, #edae49) !important;
            }
            .swagger-ui .renderedMarkdown p { 
              color: var(--text, #f9f9f9) !important;
            }
            
            /* Parameter collection format */
            .swagger-ui .parameter__collection-format { 
              color: var(--text-secondary, #b8b8b8) !important;
              font-size: 0.875rem;
              margin-left: var(--spacing-xs, 8px);
            }
            
            /* Parameter enum values */
            .swagger-ui .parameter__enum { 
              color: var(--text-secondary, #b8b8b8) !important;
              font-size: 0.875rem;
            }
            
            /* Ensure all text has proper contrast */
            .swagger-ui * { 
              color: inherit;
            }
            
            /* Override any remaining light backgrounds - More aggressive */
            .swagger-ui .opblock-body,
            .swagger-ui .opblock-description-wrapper,
            .swagger-ui .parameters-container,
            .swagger-ui .request-body,
            .swagger-ui .responses-inner,
            .swagger-ui .opblock-summary,
            .swagger-ui .opblock-description,
            .swagger-ui .opblock-external-docs,
            .swagger-ui .opblock-section,
            .swagger-ui .opblock-section-header,
            .swagger-ui .opblock-section-header > div,
            .swagger-ui .opblock-section-header > label,
            .swagger-ui .parameter,
            .swagger-ui .parameter__name,
            .swagger-ui .parameter__in,
            .swagger-ui .parameter__type,
            .swagger-ui .response,
            .swagger-ui .response-content-type,
            .swagger-ui .response-col_status,
            .swagger-ui .response-col_description,
            .swagger-ui .response-col_links,
            .swagger-ui .response-content-type label,
            .swagger-ui .response-content-type .highlighted,
            .swagger-ui .response-content-type select,
            .swagger-ui .body-param-content-type,
            .swagger-ui .body-param-content-type select,
            .swagger-ui .content-type-wrapper,
            .swagger-ui .content-type-wrapper select,
            .swagger-ui .tab,
            .swagger-ui .tab-content,
            .swagger-ui .highlight-code,
            .swagger-ui .microlight,
            .swagger-ui .renderedMarkdown,
            .swagger-ui .model-box,
            .swagger-ui .model-container,
            .swagger-ui .model-title,
            .swagger-ui .prop-name,
            .swagger-ui .prop-type,
            .swagger-ui .prop-format,
            .swagger-ui .auth-container,
            .swagger-ui .auth-btn-wrapper,
            .swagger-ui .scheme-container,
            .swagger-ui .scheme-container select,
            .swagger-ui .scheme-container label,
            .swagger-ui .scheme-container .auth-wrapper,
            .swagger-ui .filter-container,
            .swagger-ui .filter-container input,
            .swagger-ui .filter-container label {
              background: transparent !important;
              background-color: transparent !important;
            }
            
            /* Force dark on specific containers that need it */
            .swagger-ui .opblock-body,
            .swagger-ui .opblock-description-wrapper,
            .swagger-ui .parameters-container,
            .swagger-ui .request-body,
            .swagger-ui .responses-inner,
            .swagger-ui .response,
            .swagger-ui .tab-content,
            .swagger-ui .highlight-code,
            .swagger-ui .microlight,
            .swagger-ui .model-box {
              background: var(--bg-dark, #0f0e0b) !important;
              background-color: var(--bg-dark, #0f0e0b) !important;
            }
            
            /* Override any inline styles that might force light backgrounds */
            .swagger-ui [style*="background"],
            .swagger-ui [style*="background-color"] {
              background: var(--bg-dark, #0f0e0b) !important;
              background-color: var(--bg-dark, #0f0e0b) !important;
            }
            
            /* Override any white or light colored backgrounds specifically */
            .swagger-ui [style*="white"],
            .swagger-ui [style*="#fff"],
            .swagger-ui [style*="#ffffff"],
            .swagger-ui [style*="rgb(255"],
            .swagger-ui [style*="rgba(255"] {
              background: var(--bg-dark, #0f0e0b) !important;
              background-color: var(--bg-dark, #0f0e0b) !important;
              color: var(--text, #f9f9f9) !important;
            }
          `;
          document.head.appendChild(style);
          
          // Also inject a global style override for the entire document to catch any Swagger UI elements
          const globalStyleId = 'swagger-global-selection-override';
          const existingGlobalStyle = document.getElementById(globalStyleId);
          if (existingGlobalStyle) {
            existingGlobalStyle.remove();
          }
          
          const globalStyle = document.createElement('style');
          globalStyle.id = globalStyleId;
          globalStyle.setAttribute('data-swagger-theme', 'strixun-global');
          globalStyle.textContent = `
            /* Global selection override for Swagger UI container - match main app style */
            #${containerId} *::selection,
            #${containerId} *::-moz-selection,
            #${containerId} *::-webkit-selection {
              background: var(--accent, #edae49) !important;
              background-color: var(--accent, #edae49) !important;
              color: var(--bg-dark, #0f0e0b) !important;
            }
          `;
          document.head.appendChild(globalStyle);
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

