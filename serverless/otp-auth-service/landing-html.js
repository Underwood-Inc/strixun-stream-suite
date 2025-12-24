// Landing page HTML embedded as a module
// This file is generated from landing.html
// To regenerate: node -e "const fs=require('fs'); const h=fs.readFileSync('landing.html','utf8'); console.log('export default `' + h.replace(/\\/g,'\\\\').replace(/`/g,'\\`').replace(/\${/g,'\\${') + '`;');" > landing-html.js

// For now, we'll use a simple approach - the HTML will be embedded during deployment
// This is a placeholder that will be replaced with the actual HTML content
export default `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OTP Authentication API - Passwordless Auth for Modern Apps</title>
    <meta name="description" content="Secure, passwordless OTP authentication API. Easy integration with React, Svelte, and vanilla JavaScript. Enterprise-grade security with multi-tenancy support.">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        :root {
            --bg: #1a1611; --bg-dark: #0f0e0b; --card: #252017; --border: #3d3627; --border-light: #4a4336;
            --accent: #edae49; --accent-light: #f9df74; --accent-dark: #c68214; --accent2: #6495ed;
            --success: #28a745; --warning: #ffc107; --danger: #ea2b1f; --info: #6495ed;
            --text: #f9f9f9; --text-secondary: #b8b8b8; --muted: #888;
            --spacing-xs: 8px; --spacing-sm: 12px; --spacing-md: 16px; --spacing-lg: 24px;
            --spacing-xl: 32px; --spacing-2xl: 48px; --spacing-3xl: 64px;
            --radius-sm: 4px; --radius-md: 8px; --radius-lg: 12px;
            --shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.2);
            --shadow-md: 0 4px 8px rgba(0, 0, 0, 0.3);
            --shadow-lg: 0 8px 16px rgba(0, 0, 0, 0.4);
        }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; min-height: 100vh; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: var(--muted); }
        * { scrollbar-width: thin; scrollbar-color: var(--border) transparent; }
        .header { background: rgba(37, 32, 23, 0.95); border-bottom: 1px solid var(--border); padding: var(--spacing-md) var(--spacing-xl); position: sticky; top: 0; z-index: 100; backdrop-filter: blur(10px); }
        .header-content { max-width: 1200px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; }
        .logo { font-size: 1.5rem; font-weight: 700; background: linear-gradient(135deg, var(--accent), var(--accent-light)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; text-decoration: none; }
        .header-actions { display: flex; gap: var(--spacing-md); align-items: center; }
        .btn { padding: var(--spacing-sm) var(--spacing-lg); border: 3px solid; border-radius: 0; font-size: 0.875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; cursor: pointer; transition: all 0.1s cubic-bezier(0.4, 0, 0.2, 1); text-decoration: none; display: inline-block; background: transparent; color: var(--text); }
        .btn-primary { background: var(--accent); border-color: var(--accent-dark); color: #000; box-shadow: 0 4px 0 var(--accent-dark); }
        .btn-primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 0 var(--accent-dark); }
        .btn-primary:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 2px 0 var(--accent-dark); }
        .btn-secondary { border-color: var(--border-light); color: var(--text); }
        .btn-secondary:hover { background: var(--border); border-color: var(--border-light); }
        .hero { padding: var(--spacing-3xl) var(--spacing-xl); text-align: center; max-width: 1200px; margin: 0 auto; }
        .hero h1 { font-size: clamp(2.5rem, 5vw, 4rem); margin-bottom: var(--spacing-lg); background: linear-gradient(135deg, var(--accent), var(--accent-light)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; line-height: 1.2; }
        .hero p { font-size: clamp(1.1rem, 2vw, 1.5rem); color: var(--text-secondary); margin-bottom: var(--spacing-2xl); max-width: 800px; margin-left: auto; margin-right: auto; }
        .hero-cta { display: flex; gap: var(--spacing-md); justify-content: center; flex-wrap: wrap; }
        .features { padding: var(--spacing-3xl) var(--spacing-xl); max-width: 1200px; margin: 0 auto; }
        .features h2 { text-align: center; font-size: clamp(2rem, 4vw, 3rem); margin-bottom: var(--spacing-2xl); color: var(--accent); }
        .features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: var(--spacing-lg); margin-bottom: var(--spacing-3xl); }
        .feature-card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: var(--spacing-xl); transition: transform 0.2s, box-shadow 0.2s; }
        .feature-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-lg); border-color: var(--border-light); }
        .feature-icon { font-size: 2.5rem; margin-bottom: var(--spacing-md); }
        .feature-card h3 { font-size: 1.25rem; margin-bottom: var(--spacing-sm); color: var(--accent); }
        .feature-card p { color: var(--text-secondary); }
        .security { background: var(--bg-dark); padding: var(--spacing-3xl) var(--spacing-xl); margin: var(--spacing-3xl) 0; }
        .security-content { max-width: 1200px; margin: 0 auto; }
        .security h2 { text-align: center; font-size: clamp(2rem, 4vw, 3rem); margin-bottom: var(--spacing-2xl); color: var(--accent); }
        .security-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: var(--spacing-lg); }
        .security-item { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: var(--spacing-lg); border-left: 4px solid var(--success); }
        .security-item h3 { color: var(--success); margin-bottom: var(--spacing-sm); }
        .code-examples { padding: var(--spacing-3xl) var(--spacing-xl); max-width: 1200px; margin: 0 auto; }
        .code-examples h2 { text-align: center; font-size: clamp(2rem, 4vw, 3rem); margin-bottom: var(--spacing-2xl); color: var(--accent); }
        .code-tabs { display: flex; gap: var(--spacing-sm); margin-bottom: var(--spacing-lg); flex-wrap: wrap; border-bottom: 2px solid var(--border); }
        .code-tab { padding: var(--spacing-sm) var(--spacing-lg); background: transparent; border: none; border-bottom: 3px solid transparent; color: var(--text-secondary); cursor: pointer; font-size: 0.875rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; transition: all 0.2s; margin-bottom: -2px; }
        .code-tab:hover { color: var(--text); border-bottom-color: var(--border-light); }
        .code-tab.active { color: var(--accent); border-bottom-color: var(--accent); }
        .code-block { background: var(--bg-dark); border: 1px solid var(--border); border-radius: var(--radius-md); padding: var(--spacing-lg); overflow-x: auto; display: none; }
        .code-block.active { display: block; }
        .code-block pre { margin: 0; font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace; font-size: 0.875rem; line-height: 1.6; color: var(--text); }
        .code-block code { color: var(--text); }
        .accordion { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-md); margin-bottom: var(--spacing-md); overflow: hidden; }
        .accordion-header { padding: var(--spacing-lg); cursor: pointer; display: flex; justify-content: space-between; align-items: center; background: var(--bg-dark); transition: background 0.2s; }
        .accordion-header:hover { background: var(--card); }
        .accordion-header h3 { font-size: 1.1rem; color: var(--text); margin: 0; }
        .accordion-icon { transition: transform 0.3s; color: var(--accent); font-size: 1.25rem; }
        .accordion.active .accordion-icon { transform: rotate(180deg); }
        .accordion-content { max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out; }
        .accordion.active .accordion-content { max-height: 5000px; }
        .accordion-body { padding: var(--spacing-lg); color: var(--text-secondary); }
        .accordion-body h4 { color: var(--accent); margin-top: var(--spacing-lg); margin-bottom: var(--spacing-sm); }
        .accordion-body ul { margin-left: var(--spacing-lg); margin-bottom: var(--spacing-md); }
        .accordion-body li { margin-bottom: var(--spacing-xs); }
        .limitations { padding: var(--spacing-3xl) var(--spacing-xl); max-width: 1200px; margin: 0 auto; }
        .limitations h2 { text-align: center; font-size: clamp(2rem, 4vw, 3rem); margin-bottom: var(--spacing-2xl); color: var(--accent); }
        .limitations-list { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: var(--spacing-xl); }
        .limitations-list ul { list-style: none; margin: 0; }
        .limitations-list li { padding: var(--spacing-md); border-bottom: 1px solid var(--border); color: var(--text-secondary); }
        .limitations-list li:last-child { border-bottom: none; }
        .limitations-list li strong { color: var(--accent); display: block; margin-bottom: var(--spacing-xs); }
        .footer { background: var(--bg-dark); border-top: 1px solid var(--border); padding: var(--spacing-xl); text-align: center; color: var(--text-secondary); margin-top: var(--spacing-3xl); }
        @media (max-width: 768px) {
            .hero { padding: var(--spacing-2xl) var(--spacing-md); }
            .features, .code-examples, .limitations { padding: var(--spacing-2xl) var(--spacing-md); }
            .header-content { flex-direction: column; gap: var(--spacing-md); }
            .code-tabs { overflow-x: auto; }
        }
        .mermaid-container { background: var(--bg-dark); border: 1px solid var(--border); border-radius: var(--radius-md); padding: var(--spacing-lg); margin: var(--spacing-lg) 0; overflow-x: auto; }
    </style>
</head>
<body>
    <header class="header">
        <div class="header-content">
            <a href="/" class="logo">🔐 OTP Auth API</a>
            <div class="header-actions">
                <a href="#code-examples" class="btn btn-secondary">Get Started</a>
                <a href="#docs" class="btn btn-primary">Documentation</a>
            </div>
        </div>
    </header>
    <section class="hero">
        <h1>Passwordless Authentication Made Simple</h1>
        <p>Secure, scalable OTP authentication API built for modern applications. No passwords, no complexity—just email verification that works.</p>
        <div class="hero-cta">
            <a href="#code-examples" class="btn btn-primary">Start Integrating</a>
            <a href="#security" class="btn btn-secondary">Learn About Security</a>
        </div>
    </section>
    <section class="features">
        <h2>Why Choose OTP Auth?</h2>
        <div class="features-grid">
            <div class="feature-card"><div class="feature-icon">⚡</div><h3>Lightning Fast</h3><p>Built on Cloudflare Workers for global edge deployment. Sub-100ms response times worldwide.</p></div>
            <div class="feature-card"><div class="feature-icon">🔒</div><h3>Enterprise Security</h3><p>Cryptographically secure OTP codes, JWT tokens, rate limiting, and comprehensive audit logging.</p></div>
            <div class="feature-card"><div class="feature-icon">🚀</div><h3>Easy Integration</h3><p>Simple REST API that works with any framework. React, Svelte, Vue, or vanilla JavaScript—we've got you covered.</p></div>
            <div class="feature-card"><div class="feature-icon">📊</div><h3>Multi-Tenant Ready</h3><p>Built for SaaS applications. Complete customer isolation, per-tenant rate limiting, and usage analytics.</p></div>
            <div class="feature-card"><div class="feature-icon">💰</div><h3>Cost Effective</h3><p>Pay only for what you use. No infrastructure to manage, no servers to maintain.</p></div>
            <div class="feature-card"><div class="feature-icon">🌍</div><h3>Global Scale</h3><p>Deployed on Cloudflare's edge network. Your users get the same fast experience anywhere in the world.</p></div>
        </div>
    </section>
    <section class="security" id="security">
        <div class="security-content">
            <h2>Security You Can Trust</h2>
            <div class="security-grid">
                <div class="security-item"><h3>🔐 Cryptographically Secure</h3><p>6-digit OTP codes generated using cryptographically secure random number generators. 1 million possible combinations.</p></div>
                <div class="security-item"><h3>⏱️ Time-Limited</h3><p>OTP codes expire after 10 minutes. Single-use only—once verified, the code is immediately invalidated.</p></div>
                <div class="security-item"><h3>🛡️ Brute Force Protection</h3><p>Maximum 5 verification attempts per OTP code. After that, a new code must be requested.</p></div>
                <div class="security-item"><h3>🚦 Rate Limiting</h3><p>3 OTP requests per email per hour. Prevents abuse and email spam while maintaining usability.</p></div>
                <div class="security-item"><h3>🎫 JWT Tokens</h3><p>HMAC-SHA256 signed tokens with 7-hour expiration. Token blacklisting for secure logout.</p></div>
                <div class="security-item"><h3>📝 Audit Logging</h3><p>Comprehensive security event logging with 90-day retention. Track all authentication attempts and failures.</p></div>
                <div class="security-item"><h3>🌐 CORS Protection</h3><p>Configurable CORS policies per customer. IP allowlisting for additional security layers.</p></div>
                <div class="security-item"><h3>✅ GDPR Compliant</h3><p>Data export and deletion endpoints. Complete user data portability and right to be forgotten.</p></div>
            </div>
        </div>
    </section>
    <section class="code-examples" id="code-examples">
        <h2>Get Started in Minutes</h2>
        <p style="text-align: center; color: var(--text-secondary); margin-bottom: var(--spacing-xl);">Choose your framework and start integrating. All examples use the same simple API.</p>
        <div class="code-tabs">
            <button class="code-tab active" onclick="switchTab('vanilla')">Vanilla JS/TS</button>
            <button class="code-tab" onclick="switchTab('react')">React</button>
            <button class="code-tab" onclick="switchTab('svelte')">Svelte</button>
        </div>
        <div id="vanilla" class="code-block active"><pre><code>// Vanilla JavaScript/TypeScript Example
const API_URL = 'https://auth.idling.app';
async function requestOTP(email) {
  const response = await fetch(\`\${API_URL}/auth/request-otp\`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  if (!response.ok) throw new Error('Failed to request OTP');
  return await response.json();
}
async function verifyOTP(email, otp) {
  const response = await fetch(\`\${API_URL}/auth/verify-otp\`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp })
  });
  if (!response.ok) throw new Error('Invalid OTP');
  const data = await response.json();
  localStorage.setItem('auth_token', data.token);
  return data;
}</code></pre></div>
        <div id="react" class="code-block"><pre><code>// React Example
import React, { useState } from 'react';
const API_URL = 'https://auth.idling.app';
function LoginForm() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('email');
  const requestOTP = async () => {
    const response = await fetch(\`\${API_URL}/auth/request-otp\`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    if (response.ok) setStep('otp');
  };
  // ... rest of component
}</code></pre></div>
        <div id="svelte" class="code-block"><pre><code>&lt;!-- Svelte Example --&gt;
&lt;script&gt;
  let email = ''; let otp = ''; let step = 'email';
  const API_URL = 'https://auth.idling.app';
  async function requestOTP() {
    const response = await fetch(\`\${API_URL}/auth/request-otp\`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    if (response.ok) step = 'otp';
  }
&lt;/script&gt;</code></pre></div>
    </section>
    <section class="limitations">
        <h2>Limitations & Considerations</h2>
        <div class="limitations-list">
            <ul>
                <li><strong>Rate Limits</strong><p>3 OTP requests per email address per hour to prevent abuse and email spam.</p></li>
                <li><strong>OTP Expiration</strong><p>OTP codes expire after 10 minutes. Users must request a new code if expired.</p></li>
                <li><strong>Verification Attempts</strong><p>Maximum 5 verification attempts per OTP code. After that, a new code must be requested.</p></li>
                <li><strong>Token Expiration</strong><p>JWT tokens expire after 7 hours. Use the refresh endpoint to extend sessions.</p></li>
                <li><strong>Email Delivery</strong><p>OTP delivery depends on email provider reliability. Check spam folders if code doesn't arrive.</p></li>
                <li><strong>Multi-Tenancy</strong><p>API key authentication required for multi-tenant features. Contact us for enterprise setup.</p></li>
            </ul>
        </div>
    </section>
    <section class="code-examples" id="docs">
        <h2>Technical Documentation</h2>
        <p style="text-align: center; color: var(--text-secondary); margin-bottom: var(--spacing-xl);">Expand sections below for detailed technical information</p>
        <div class="accordion">
            <div class="accordion-header" onclick="toggleAccordion(this)"><h3>API Endpoints</h3><span class="accordion-icon">▼</span></div>
            <div class="accordion-content"><div class="accordion-body">
                <h4>Authentication Endpoints</h4>
                <ul>
                    <li><strong>POST /auth/request-otp</strong> - Request OTP code via email</li>
                    <li><strong>POST /auth/verify-otp</strong> - Verify OTP and receive JWT token</li>
                    <li><strong>GET /auth/me</strong> - Get current user info (requires Bearer token)</li>
                    <li><strong>POST /auth/logout</strong> - Logout and revoke token</li>
                    <li><strong>POST /auth/refresh</strong> - Refresh expiring JWT token</li>
                </ul>
            </div></div>
        </div>
        <div class="accordion">
            <div class="accordion-header" onclick="toggleAccordion(this)"><h3>Architecture</h3><span class="accordion-icon">▼</span></div>
            <div class="accordion-content"><div class="accordion-body">
                <h4>System Architecture</h4>
                <div class="mermaid-container"><pre class="mermaid">graph TB
    Client[Client Application] -->|1. Request OTP| API[Cloudflare Worker]
    API -->|2. Generate OTP| KV[Cloudflare KV]
    API -->|3. Send Email| Email[Resend/SendGrid]
    Email -->|4. Deliver OTP| User[User Email]
    User -->|5. Enter OTP| Client
    Client -->|6. Verify OTP| API
    API -->|7. Validate| KV
    API -->|8. Issue JWT| Client
    Client -->|9. Authenticated Requests| API</pre></div>
            </div></div>
        </div>
    </section>
    <footer class="footer">
        <p>OTP Authentication API - Powered by Cloudflare Workers</p>
        <p style="margin-top: var(--spacing-sm); font-size: 0.875rem;">Part of the Strixun Stream Suite</p>
    </footer>
    <script>
        function switchTab(tabName) {
            document.querySelectorAll('.code-block').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.code-tab').forEach(t => t.classList.remove('active'));
            document.getElementById(tabName).classList.add('active');
            event.target.classList.add('active');
        }
        function toggleAccordion(header) {
            const accordion = header.parentElement;
            const isActive = accordion.classList.contains('active');
            document.querySelectorAll('.accordion').forEach(a => a.classList.remove('active'));
            if (!isActive) accordion.classList.add('active');
        }
        document.querySelectorAll('a[href^="#"]').forEach(a => {
            a.addEventListener('click', function(e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        });
    </script>
</body>
</html>`;

