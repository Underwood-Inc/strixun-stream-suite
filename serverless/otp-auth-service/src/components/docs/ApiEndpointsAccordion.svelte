<script lang="ts">
  import { onMount } from 'svelte';
  import SwaggerUI from '../../lib/SwaggerUI.svelte';
  
  let showSwagger = false;
  let container: HTMLElement;
  
  onMount(() => {
    // Only load SwaggerUI when this component is mounted (accordion opened)
    showSwagger = true;
  });
</script>

<h4>Interactive API Documentation (OpenAPI/Swagger)</h4>
<p>
  Explore and test all API endpoints with our interactive Swagger UI. You can try out requests directly from this interface:
</p>
<div class="swagger-container" bind:this={container}>
  {#if showSwagger}
    <SwaggerUI url="/openapi.json" />
  {/if}
</div>

<h4>Quick Reference</h4>
<p>
  For a quick overview, here are the main endpoints:
</p>

<h5>Authentication Endpoints</h5>
<ul>
  <li><strong>POST /auth/request-otp</strong> - Request OTP code via email</li>
  <li><strong>POST /auth/verify-otp</strong> - Verify OTP and receive JWT token</li>
  <li><strong>GET /auth/me</strong> - Get current customer info (requires Bearer token)</li>
  <li><strong>POST /auth/logout</strong> - Logout and revoke token</li>
  <li><strong>POST /auth/refresh</strong> - Refresh expiring JWT token</li>
</ul>

<h5>SSO Configuration Endpoints</h5>
<p>
  Manage API key-level SSO configuration for inter-tenant session sharing:
</p>
<ul>
  <li><strong>GET /auth/api-keys</strong> - List all API keys with SSO configuration</li>
  <li><strong>GET /auth/api-key/:keyId/sso-config</strong> - Get SSO configuration for a specific API key</li>
  <li><strong>PUT /auth/api-key/:keyId/sso-config</strong> - Update SSO configuration for an API key</li>
</ul>
<p>
  <strong>SSO Isolation Modes:</strong>
</p>
<ul>
  <li><code>none</code> - Global SSO enabled (default) - sessions shared across all customer's API keys</li>
  <li><code>selective</code> - Sessions shared only with specified API keys in <code>allowedKeyIds</code></li>
  <li><code>complete</code> - Complete isolation - sessions not shared with any other keys</li>
</ul>

<h5>Public Endpoints</h5>
<ul>
  <li><strong>POST /signup</strong> - Public customer signup</li>
  <li><strong>POST /signup/verify</strong> - Verify signup email</li>
  <li><strong>GET /health</strong> - Health check</li>
  <li><strong>GET /health/ready</strong> - Readiness probe</li>
  <li><strong>GET /health/live</strong> - Liveness probe</li>
</ul>

<style>
  .swagger-container {
    margin-top: var(--spacing-lg);
    min-height: 400px;
  }
</style>

