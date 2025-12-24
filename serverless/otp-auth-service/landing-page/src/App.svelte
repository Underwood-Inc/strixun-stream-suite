<script lang="ts">
  import MermaidDiagram from './lib/MermaidDiagram.svelte';
  import CodeBlock from './lib/CodeBlock.svelte';
  import SwaggerUI from './lib/SwaggerUI.svelte';

  const architectureDiagram = `graph TB
    Client["\`**Client Application**<br/>Web/Mobile App\`"] -->|"\`**1. Request OTP**\`"| API["\`**Cloudflare Worker**<br/>OTP Auth API\`"]
    API -->|"\`**2. Generate OTP**\`"| KV["\`**Cloudflare KV**<br/>Secure Storage\`"]
    API -->|"\`**3. Send Email**\`"| Email["\`**Email Service**<br/>Resend/SendGrid\`"]
    Email -->|"\`**4. Deliver OTP**\`"| User["\`**User Email**<br/>Inbox\`"]
    User -->|"\`**5. Enter OTP**\`"| Client
    Client -->|"\`**6. Verify OTP**\`"| API
    API -->|"\`**7. Validate**\`"| KV
    API -->|"\`**8. Issue JWT**\`"| Client
    Client -->|"\`**9. Authenticated Requests**\`"| API
    
    classDef clientStyle fill:#252017,stroke:#edae49,stroke-width:3px,color:#f9f9f9
    classDef apiStyle fill:#1a1611,stroke:#6495ed,stroke-width:3px,color:#f9f9f9
    classDef storageStyle fill:#252017,stroke:#28a745,stroke-width:3px,color:#f9f9f9
    classDef emailStyle fill:#1a1611,stroke:#f9df74,stroke-width:3px,color:#f9f9f9
    classDef userStyle fill:#252017,stroke:#edae49,stroke-width:3px,color:#f9f9f9
    
    class Client clientStyle
    class API apiStyle
    class KV storageStyle
    class Email emailStyle
    class User userStyle`;

  const vanillaJsExample = `// Vanilla JavaScript/TypeScript Example
const API_URL = 'https://auth.idling.app';

// Step 1: Request OTP
async function requestOTP(email) {
  const response = await fetch(\`\${API_URL}/auth/request-otp\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  
  if (!response.ok) {
    throw new Error('Failed to request OTP');
  }
  
  return await response.json();
}

// Step 2: Verify OTP
async function verifyOTP(email, otp) {
  const response = await fetch(\`\${API_URL}/auth/verify-otp\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp })
  });
  
  if (!response.ok) {
    throw new Error('Invalid OTP');
  }
  
  const data = await response.json();
  // Store token securely
  localStorage.setItem('auth_token', data.token);
  return data;
}

// Step 3: Use token for authenticated requests
async function getCurrentUser() {
  const token = localStorage.getItem('auth_token');
  
  const response = await fetch(\`\${API_URL}/auth/me\`, {
    headers: {
      'Authorization': \`Bearer \${token}\`
    }
  });
  
  return await response.json();
}`;

  let activeTab = 'vanilla';
  let swaggerOpen = false;

  function switchTab(tab: string) {
    activeTab = tab;
  }

  function toggleSwagger() {
    swaggerOpen = !swaggerOpen;
  }
</script>

<main>
  <header class="header">
    <div class="header-content">
      <a href="/" class="logo">OTP Auth API</a>
      <div class="header-actions">
        <a href="/dashboard" class="btn btn-secondary">Dashboard</a>
        <a href="#docs" class="btn btn-primary">Get Started</a>
      </div>
    </div>
  </header>

  <section class="hero">
    <h1>OTP Authentication API</h1>
    <p>Secure, passwordless authentication for modern applications. Easy integration with React, Svelte, and vanilla JavaScript.</p>
    <div class="hero-cta">
      <a href="#docs" class="btn btn-primary">View Documentation</a>
      <a href="/dashboard" class="btn btn-secondary">Open Dashboard</a>
    </div>
  </section>

  <section class="features" id="docs">
    <h2>Quick Start</h2>
    
    <div class="code-tabs">
      <button class="code-tab" class:active={activeTab === 'vanilla'} on:click={() => switchTab('vanilla')}>Vanilla JS</button>
      <button class="code-tab" class:active={activeTab === 'react'} on:click={() => switchTab('react')}>React</button>
      <button class="code-tab" class:active={activeTab === 'svelte'} on:click={() => switchTab('svelte')}>Svelte</button>
    </div>

    {#if activeTab === 'vanilla'}
      <CodeBlock code={vanillaJsExample} language="javascript" />
    {/if}

    <h2>System Architecture</h2>
    <MermaidDiagram diagram={architectureDiagram} />

    <h2>Interactive API Documentation</h2>
    <button class="btn btn-primary" on:click={toggleSwagger}>
      {swaggerOpen ? 'Hide' : 'Show'} Swagger UI
    </button>
    {#if swaggerOpen}
      <SwaggerUI url="/openapi.json" />
    {/if}
  </section>
</main>

<style>
  .header {
    background: rgba(37, 32, 23, 0.95);
    border-bottom: 1px solid var(--border);
    padding: var(--spacing-md) var(--spacing-xl);
    position: sticky;
    top: 0;
    z-index: 100;
    backdrop-filter: blur(10px);
  }

  .header-content {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .logo {
    font-size: 1.5rem;
    font-weight: 700;
    background: linear-gradient(135deg, var(--accent), var(--accent-light));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    text-decoration: none;
  }

  .header-actions {
    display: flex;
    gap: var(--spacing-md);
    align-items: center;
  }

  .btn {
    padding: var(--spacing-sm) var(--spacing-lg);
    border: 3px solid;
    border-radius: 0;
    font-size: 0.875rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    cursor: pointer;
    transition: all 0.1s cubic-bezier(0.4, 0, 0.2, 1);
    text-decoration: none;
    display: inline-block;
    background: transparent;
    color: var(--text);
  }

  .btn-primary {
    background: var(--accent);
    border-color: var(--accent-dark);
    color: #000;
    box-shadow: 0 4px 0 var(--accent-dark);
  }

  .btn-primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 0 var(--accent-dark);
  }

  .btn-secondary {
    border-color: var(--border-light);
    color: var(--text);
  }

  .btn-secondary:hover {
    background: var(--border);
    border-color: var(--border-light);
  }

  .hero {
    padding: var(--spacing-3xl) var(--spacing-xl);
    text-align: center;
    max-width: 1200px;
    margin: 0 auto;
  }

  .hero h1 {
    font-size: clamp(2.5rem, 5vw, 4rem);
    margin-bottom: var(--spacing-lg);
    background: linear-gradient(135deg, var(--accent), var(--accent-light));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    line-height: 1.2;
  }

  .hero p {
    font-size: clamp(1.1rem, 2vw, 1.5rem);
    color: var(--text-secondary);
    margin-bottom: var(--spacing-2xl);
    max-width: 800px;
    margin-left: auto;
    margin-right: auto;
  }

  .hero-cta {
    display: flex;
    gap: var(--spacing-md);
    justify-content: center;
    flex-wrap: wrap;
  }

  .features {
    padding: var(--spacing-3xl) var(--spacing-xl);
    max-width: 1200px;
    margin: 0 auto;
  }

  .features h2 {
    text-align: center;
    font-size: clamp(2rem, 4vw, 3rem);
    margin-bottom: var(--spacing-2xl);
    color: var(--accent);
  }

  .code-tabs {
    display: flex;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-lg);
    flex-wrap: wrap;
    border-bottom: 2px solid var(--border);
  }

  .code-tab {
    padding: var(--spacing-sm) var(--spacing-lg);
    background: transparent;
    border: none;
    border-bottom: 3px solid transparent;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    transition: all 0.2s;
    margin-bottom: -2px;
  }

  .code-tab:hover {
    color: var(--text);
    border-bottom-color: var(--border-light);
  }

  .code-tab.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }
</style>
