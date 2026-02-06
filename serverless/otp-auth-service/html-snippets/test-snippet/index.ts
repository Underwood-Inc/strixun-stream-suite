/**
 * OTP Auth Test Snippet Generator
 * 
 * Assembles the complete HTML test page from modular templates.
 * Uses Vite's ?raw imports to include static assets as strings.
 */

// Import static assets as text (esbuild --loader:.ext=text)
import styles from './styles.css';
import scripts from './scripts.tpl';
import securityDocs from './security-docs.html';
import testForm from './test-form.html';
import mermaidInit from './mermaid-init.tpl';

/**
 * Replace template placeholders with actual values
 */
function interpolate(template: string, vars: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(vars)) {
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    return result;
}

/**
 * Generate a complete HTML test page for OTP integration testing
 * 
 * @param apiKey - The API key to embed in the test page
 * @param baseUrl - The base URL for API calls (e.g., https://auth.idling.app)
 * @returns Complete HTML document as a string
 */
export function generateTestHtmlSnippet(apiKey: string, baseUrl: string): string {
    const generatedAt = new Date().toISOString();
    
    const vars = {
        API_KEY: apiKey,
        BASE_URL: baseUrl
    };
    
    // Interpolate all templates
    const interpolatedSecurityDocs = interpolate(securityDocs, vars);
    const interpolatedTestForm = interpolate(testForm, vars);
    const interpolatedScripts = interpolate(scripts, vars);
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OTP Auth API - Integration Test</title>
    <style>
${styles}
    </style>
    <!-- Mermaid.js for diagrams -->
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
    <script>
${mermaidInit}
    </script>
</head>
<body>
    <div class="container">
        <h1>🔐 OTP Auth API - Integration Test</h1>
        <p class="subtitle">Test your API key with a complete end-to-end OTP flow</p>
        
        <div class="header-actions">
            <button class="btn-download" onclick="downloadThisFile()">
                ⬇️ Download This File
            </button>
            <span style="color: var(--text-muted); font-size: 0.75rem; align-self: center;">
                Generated: ${generatedAt}
            </span>
        </div>
        
        ${interpolatedSecurityDocs}
        
        ${interpolatedTestForm}
    </div>
    
    <script>
${interpolatedScripts}
    </script>
</body>
</html>`;
}
