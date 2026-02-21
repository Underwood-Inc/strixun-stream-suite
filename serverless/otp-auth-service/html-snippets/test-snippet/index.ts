/**
 * OTP Auth Test Snippet Generator
 * 
 * Assembles the complete HTML test page from modular templates.
 * Uses Vite's ?raw imports to include static assets as strings.
 */

// Import static assets as text (esbuild --loader:.ext=text)
import styles from './styles.css';
import scriptsCore from './scripts-core.tpl';
import scriptsVerify from './scripts-verify.tpl';
import scriptsOtp from './scripts-otp.tpl';
import scriptsTokens from './scripts-tokens.tpl';
import scriptsDiscovery from './scripts-discovery.tpl';
import scriptsIntrospect from './scripts-introspect.tpl';
import scriptsGlossary from './scripts-glossary.tpl';
import scriptsSearch from './scripts-search.tpl';
import scriptsToc from './scripts-toc.tpl';
import scriptsInit from './scripts-init.tpl';
import securityDocs from './security-docs.html';
import testForm from './test-form.html';
import mermaidInit from './mermaid-init.tpl';
import {
  SCOPES_SUPPORTED,
  CLAIMS_SUPPORTED,
  PRESET_SCOPES,
  CLAIMS_BY_SCOPE,
} from '../../shared/oidc-constants.js';

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
function buildScopesClaimsSection(): string {
    const scopesList = SCOPES_SUPPORTED.map((s) => `<code>${escapeHtml(s)}</code>`).join(', ');
    const claimsList = CLAIMS_SUPPORTED.slice(0, 20).map((c) => `<code>${escapeHtml(c)}</code>`).join(', ');
    const scopeClaimsRows = Object.entries(CLAIMS_BY_SCOPE)
        .map(
            ([scope, claims]) =>
                `<tr><td><code>${escapeHtml(scope)}</code></td><td>${claims.map((c) => `<code>${escapeHtml(c)}</code>`).join(', ')}</td></tr>`
        )
        .join('');
    const presetExamples = PRESET_SCOPES.map((p) => `<code>${escapeHtml(p.value)}</code> (${escapeHtml(p.label)})`).join('; ');
    return `
<section class="card searchable-doc" id="claims-scopes-ref" style="margin-top: 1rem;" role="region" aria-labelledby="sec-claims-scopes">
    <h2 id="sec-claims-scopes">📋 Scopes &amp; Claims (Configure per API Key)</h2>
    <p>Control which scopes (and thus claims) tokens can request. Configure <strong>allowed scopes</strong> per API key in the dashboard; then clients request scope in <code>POST /auth/verify-otp</code>.</p>

    <h3 id="sec-claims-scopes-request">How to request scope</h3>
    <p>Include <code>scope</code> in the verify-otp request body (space-separated). Example: <code>{ "email": "...", "otp": "...", "scope": "openid profile" }</code>. Per-key limits apply when the API key has allowed scopes set in the dashboard.</p>

    <h3 id="sec-claims-presets">Presets</h3>
    <p>Common combinations: ${presetExamples}.</p>

    <h3 id="sec-claims-by-scope">Claims by scope</h3>
    <p>Supported scopes: ${scopesList}. The table below lists which claims each scope unlocks (e.g. for UserInfo <code>/auth/me</code>).</p>
    <table style="width:100%; border-collapse: collapse; font-size: 0.875rem;" id="sec-claims-by-scope-table">
        <thead><tr><th style="text-align:left;">Scope</th><th style="text-align:left;">Claims</th></tr></thead>
        <tbody>${scopeClaimsRows}</tbody>
    </table>

    <h3 id="sec-claims-full-list">All supported claims</h3>
    <p>${claimsList}${CLAIMS_SUPPORTED.length > 20 ? ' …' : ''}.</p>
</section>`;
}
function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function generateTestHtmlSnippet(apiKey: string, baseUrl: string): string {
    const generatedAt = new Date().toISOString();
    const scopesClaimsSection = buildScopesClaimsSection();

    const vars = {
        API_KEY: apiKey,
        BASE_URL: baseUrl
    };

    // Assemble script fragments (order matters: core → verify → otp → tokens → discovery → introspect → glossary → search → toc → init)
    const scripts = [
        scriptsCore,
        scriptsVerify,
        scriptsOtp,
        scriptsTokens,
        scriptsDiscovery,
        scriptsIntrospect,
        scriptsGlossary,
        scriptsSearch,
        scriptsToc,
        scriptsInit,
    ].join('\n\n');
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
    <a href="#main-content" class="skip-link">Skip to content</a>

    <!-- Mobile TOC toggle -->
    <button class="toc-toggle" onclick="toggleTocSidebar()" aria-label="Toggle table of contents">☰</button>

    <div class="page-layout">
        <!-- Sidebar Table of Contents -->
        <nav class="toc-sidebar" id="tocSidebar" aria-label="Table of contents">
            <div class="toc-header">
                <h2>Contents</h2>
                <label for="tocSearch" class="sr-only">Filter table of contents</label>
                <input id="tocSearch" class="toc-search" type="text"
                       placeholder="Filter... &quot;phrase&quot;, a | b, prefix*"
                       autocomplete="off"
                       oninput="filterToc(this.value)" />
            </div>
            <div class="toc-nav" id="tocNav" role="navigation">
                <!-- Populated by JS on DOMContentLoaded -->
            </div>
        </nav>

        <main id="main-content" class="container">
            <div id="fileOriginBanner" class="file-origin-banner" style="display:none;">
                <strong>⚠️ This page was opened from a local file (file://).</strong> CORS will block requests from file://. <strong>To fix:</strong> Serve this file from a local web server (e.g. in this folder run <code>npx serve .</code> or <code>npx http-server -p 8080</code>, or use the Live Server extension in VS Code/Cursor), open the served URL, and add that origin (e.g. <code>http://localhost:3000</code> or <code>http://localhost:8080</code>) to this key's allowed origins in the dashboard.
            </div>
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
            <p class="subtitle" style="margin-top: 0.5rem; font-size: 0.8rem;">
                After downloading: serve this file from a local web server (e.g. in the file’s folder run <code>npx serve .</code> or <code>npx http-server -p 8080</code>, or use Live Server in VS Code/Cursor), then add that origin (e.g. <code>http://localhost:3000</code> or <code>http://localhost:8080</code>) to this key’s allowed origins. Opening file:// directly is not supported.
            </p>
            
            ${interpolatedSecurityDocs}

            ${scopesClaimsSection}

            ${interpolatedTestForm}
        </main>
    </div>
    
    <!-- Search overlay -->
    <div class="search-overlay" id="searchOverlay" role="dialog" aria-modal="true" aria-label="Search the guide" onclick="if(event.target===this)closeSearch()">
        <div class="search-box">
            <label for="searchInput" class="sr-only">Search the guide</label>
            <input id="searchInput" type="text"
                   placeholder="Search... &quot;exact phrase&quot;, term1 | term2, prefix*"
                   autocomplete="off"
                   oninput="renderSearchResults(this.value)"
                   onkeydown="handleSearchKeydown(event)" />
            <div class="search-results" id="searchResults" role="listbox" aria-label="Search results">
                <div class="sr-empty" role="status">Type to search — supports &quot;exact phrases&quot;, OR with |, prefix*</div>
            </div>
            <div class="search-hint" aria-hidden="true">
                <span><kbd>↑</kbd> <kbd>↓</kbd> navigate &nbsp; <kbd>Enter</kbd> jump &nbsp; <kbd>Esc</kbd> close</span>
                <span><kbd>Ctrl</kbd>+<kbd>F</kbd> or <kbd>Ctrl</kbd>+<kbd>K</kbd></span>
            </div>
        </div>
    </div>

    <!-- Floating search trigger -->
    <button class="search-trigger" onclick="openSearch()" aria-label="Search guide (Ctrl+F or Ctrl+K)">&#x1F50D;</button>

    <script>
${interpolatedScripts}
    </script>
</body>
</html>`;
}
