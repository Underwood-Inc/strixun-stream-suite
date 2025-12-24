var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-zPZknG/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// landing-html.js
var landing_html_default = `<!DOCTYPE html>
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
            <a href="/" class="logo">\u{1F510} OTP Auth API</a>
            <div class="header-actions">
                <a href="#code-examples" class="btn btn-secondary">Get Started</a>
                <a href="#docs" class="btn btn-primary">Documentation</a>
            </div>
        </div>
    </header>
    <section class="hero">
        <h1>Passwordless Authentication Made Simple</h1>
        <p>Secure, scalable OTP authentication API built for modern applications. No passwords, no complexity\u2014just email verification that works.</p>
        <div class="hero-cta">
            <a href="#code-examples" class="btn btn-primary">Start Integrating</a>
            <a href="#security" class="btn btn-secondary">Learn About Security</a>
        </div>
    </section>
    <section class="features">
        <h2>Why Choose OTP Auth?</h2>
        <div class="features-grid">
            <div class="feature-card"><div class="feature-icon">\u26A1</div><h3>Lightning Fast</h3><p>Built on Cloudflare Workers for global edge deployment. Sub-100ms response times worldwide.</p></div>
            <div class="feature-card"><div class="feature-icon">\u{1F512}</div><h3>Enterprise Security</h3><p>Cryptographically secure OTP codes, JWT tokens, rate limiting, and comprehensive audit logging.</p></div>
            <div class="feature-card"><div class="feature-icon">\u{1F680}</div><h3>Easy Integration</h3><p>Simple REST API that works with any framework. React, Svelte, Vue, or vanilla JavaScript\u2014we've got you covered.</p></div>
            <div class="feature-card"><div class="feature-icon">\u{1F4CA}</div><h3>Multi-Tenant Ready</h3><p>Built for SaaS applications. Complete customer isolation, per-tenant rate limiting, and usage analytics.</p></div>
            <div class="feature-card"><div class="feature-icon">\u{1F4B0}</div><h3>Cost Effective</h3><p>Pay only for what you use. No infrastructure to manage, no servers to maintain.</p></div>
            <div class="feature-card"><div class="feature-icon">\u{1F30D}</div><h3>Global Scale</h3><p>Deployed on Cloudflare's edge network. Your users get the same fast experience anywhere in the world.</p></div>
        </div>
    </section>
    <section class="security" id="security">
        <div class="security-content">
            <h2>Security You Can Trust</h2>
            <div class="security-grid">
                <div class="security-item"><h3>\u{1F510} Cryptographically Secure</h3><p>6-digit OTP codes generated using cryptographically secure random number generators. 1 million possible combinations.</p></div>
                <div class="security-item"><h3>\u23F1\uFE0F Time-Limited</h3><p>OTP codes expire after 10 minutes. Single-use only\u2014once verified, the code is immediately invalidated.</p></div>
                <div class="security-item"><h3>\u{1F6E1}\uFE0F Brute Force Protection</h3><p>Maximum 5 verification attempts per OTP code. After that, a new code must be requested.</p></div>
                <div class="security-item"><h3>\u{1F6A6} Rate Limiting</h3><p>3 OTP requests per email per hour. Prevents abuse and email spam while maintaining usability.</p></div>
                <div class="security-item"><h3>\u{1F3AB} JWT Tokens</h3><p>HMAC-SHA256 signed tokens with 7-hour expiration. Token blacklisting for secure logout.</p></div>
                <div class="security-item"><h3>\u{1F4DD} Audit Logging</h3><p>Comprehensive security event logging with 90-day retention. Track all authentication attempts and failures.</p></div>
                <div class="security-item"><h3>\u{1F310} CORS Protection</h3><p>Configurable CORS policies per customer. IP allowlisting for additional security layers.</p></div>
                <div class="security-item"><h3>\u2705 GDPR Compliant</h3><p>Data export and deletion endpoints. Complete user data portability and right to be forgotten.</p></div>
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
            <div class="accordion-header" onclick="toggleAccordion(this)"><h3>API Endpoints</h3><span class="accordion-icon">\u25BC</span></div>
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
            <div class="accordion-header" onclick="toggleAccordion(this)"><h3>Architecture</h3><span class="accordion-icon">\u25BC</span></div>
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
    <\/script>
</body>
</html>`;

// openapi-json.js
var openapi_json_default = JSON.parse(`{
  "openapi": "3.1.0",
  "info": {
    "title": "OTP Auth API",
    "description": "Secure, passwordless OTP authentication API built for modern applications. Enterprise-grade security with multi-tenancy support.",
    "version": "2.0.0",
    "contact": {
      "name": "OTP Auth API Support",
      "url": "https://auth.idling.app"
    },
    "license": {
      "name": "Proprietary"
    }
  },
  "servers": [
    {
      "url": "https://auth.idling.app",
      "description": "Production server"
    }
  ],
  "tags": [
    {
      "name": "Authentication",
      "description": "OTP-based authentication endpoints"
    },
    {
      "name": "User",
      "description": "User information and session management"
    },
    {
      "name": "Admin",
      "description": "Administrative endpoints (requires authentication)"
    },
    {
      "name": "Health",
      "description": "Health check endpoints"
    }
  ],
  "paths": {
    "/auth/request-otp": {
      "post": {
        "tags": ["Authentication"],
        "summary": "Request OTP code",
        "description": "Request a 6-digit OTP code to be sent to the specified email address",
        "operationId": "requestOTP",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/RequestOTPRequest"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "OTP sent successfully",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/RequestOTPResponse"
                }
              }
            }
          },
          "400": {
            "description": "Bad request",
            "content": {
              "application/problem+json": {
                "schema": {
                  "$ref": "#/components/schemas/ProblemDetails"
                }
              }
            }
          },
          "429": {
            "description": "Rate limit exceeded",
            "content": {
              "application/problem+json": {
                "schema": {
                  "$ref": "#/components/schemas/ProblemDetails"
                }
              }
            },
            "headers": {
              "Retry-After": {
                "schema": {
                  "type": "integer"
                },
                "description": "Seconds to wait before retrying"
              }
            }
          }
        }
      }
    },
    "/auth/verify-otp": {
      "post": {
        "tags": ["Authentication"],
        "summary": "Verify OTP code",
        "description": "Verify the OTP code and receive a JWT access token",
        "operationId": "verifyOTP",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/VerifyOTPRequest"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "OTP verified successfully",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/TokenResponse"
                }
              }
            }
          },
          "401": {
            "description": "Invalid OTP code",
            "content": {
              "application/problem+json": {
                "schema": {
                  "$ref": "#/components/schemas/ProblemDetails"
                }
              }
            }
          },
          "404": {
            "description": "OTP not found or expired",
            "content": {
              "application/problem+json": {
                "schema": {
                  "$ref": "#/components/schemas/ProblemDetails"
                }
              }
            }
          },
          "429": {
            "description": "Too many attempts",
            "content": {
              "application/problem+json": {
                "schema": {
                  "$ref": "#/components/schemas/ProblemDetails"
                }
              }
            }
          }
        }
      }
    },
    "/auth/me": {
      "get": {
        "tags": ["User"],
        "summary": "Get current user",
        "description": "Get information about the currently authenticated user",
        "operationId": "getMe",
        "security": [
          {
            "BearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "User information",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/User"
                }
              }
            }
          },
          "401": {
            "description": "Unauthorized",
            "content": {
              "application/problem+json": {
                "schema": {
                  "$ref": "#/components/schemas/ProblemDetails"
                }
              }
            }
          }
        }
      }
    },
    "/auth/logout": {
      "post": {
        "tags": ["User"],
        "summary": "Logout",
        "description": "Logout and revoke the current access token",
        "operationId": "logout",
        "security": [
          {
            "BearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Logged out successfully",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/LogoutResponse"
                }
              }
            }
          },
          "401": {
            "description": "Unauthorized",
            "content": {
              "application/problem+json": {
                "schema": {
                  "$ref": "#/components/schemas/ProblemDetails"
                }
              }
            }
          }
        }
      }
    },
    "/auth/refresh": {
      "post": {
        "tags": ["User"],
        "summary": "Refresh token",
        "description": "Refresh an expiring access token",
        "operationId": "refreshToken",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/RefreshTokenRequest"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Token refreshed successfully",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/TokenResponse"
                }
              }
            }
          },
          "401": {
            "description": "Invalid or expired token",
            "content": {
              "application/problem+json": {
                "schema": {
                  "$ref": "#/components/schemas/ProblemDetails"
                }
              }
            }
          }
        }
      }
    },
    "/admin/customers/me": {
      "get": {
        "tags": ["Admin"],
        "summary": "Get customer information",
        "description": "Get information about the current customer (requires API key or JWT)",
        "operationId": "getCustomer",
        "security": [
          {
            "BearerAuth": []
          },
          {
            "ApiKeyAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Customer information",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Customer"
                }
              }
            }
          },
          "401": {
            "description": "Unauthorized"
          }
        }
      }
    },
    "/admin/customers/{customerId}/api-keys": {
      "get": {
        "tags": ["Admin"],
        "summary": "List API keys",
        "description": "Get all API keys for a customer",
        "operationId": "listApiKeys",
        "security": [
          {
            "BearerAuth": []
          },
          {
            "ApiKeyAuth": []
          }
        ],
        "parameters": [
          {
            "name": "customerId",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "List of API keys",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ApiKeysResponse"
                }
              }
            }
          }
        }
      },
      "post": {
        "tags": ["Admin"],
        "summary": "Create API key",
        "description": "Create a new API key for the customer",
        "operationId": "createApiKey",
        "security": [
          {
            "BearerAuth": []
          },
          {
            "ApiKeyAuth": []
          }
        ],
        "parameters": [
          {
            "name": "customerId",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CreateApiKeyRequest"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "API key created",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ApiKeyResponse"
                }
              }
            }
          }
        }
      }
    },
    "/admin/audit-logs": {
      "get": {
        "tags": ["Admin"],
        "summary": "Get audit logs",
        "description": "Get audit logs for the customer with optional filtering",
        "operationId": "getAuditLogs",
        "security": [
          {
            "BearerAuth": []
          },
          {
            "ApiKeyAuth": []
          }
        ],
        "parameters": [
          {
            "name": "startDate",
            "in": "query",
            "schema": {
              "type": "string",
              "format": "date"
            }
          },
          {
            "name": "endDate",
            "in": "query",
            "schema": {
              "type": "string",
              "format": "date"
            }
          },
          {
            "name": "eventType",
            "in": "query",
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Audit logs",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/AuditLogsResponse"
                }
              }
            }
          }
        }
      }
    },
    "/admin/analytics": {
      "get": {
        "tags": ["Admin"],
        "summary": "Get analytics",
        "description": "Get analytics data for the customer",
        "operationId": "getAnalytics",
        "security": [
          {
            "BearerAuth": []
          },
          {
            "ApiKeyAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Analytics data",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Analytics"
                }
              }
            }
          }
        }
      }
    },
    "/health": {
      "get": {
        "tags": ["Health"],
        "summary": "Health check",
        "description": "Check the health status of the service",
        "operationId": "healthCheck",
        "responses": {
          "200": {
            "description": "Service is healthy",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HealthResponse"
                }
              }
            }
          },
          "503": {
            "description": "Service is degraded or unhealthy"
          }
        }
      }
    }
  },
  "components": {
    "securitySchemes": {
      "BearerAuth": {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "description": "JWT token obtained from /auth/verify-otp"
      },
      "ApiKeyAuth": {
        "type": "apiKey",
        "in": "header",
        "name": "X-OTP-API-Key",
        "description": "API key for multi-tenant authentication"
      }
    },
    "schemas": {
      "RequestOTPRequest": {
        "type": "object",
        "required": ["email"],
        "properties": {
          "email": {
            "type": "string",
            "format": "email",
            "example": "user@example.com"
          }
        }
      },
      "RequestOTPResponse": {
        "type": "object",
        "properties": {
          "success": {
            "type": "boolean",
            "example": true
          },
          "message": {
            "type": "string",
            "example": "OTP sent to email"
          },
          "expiresIn": {
            "type": "integer",
            "description": "OTP expiration time in seconds",
            "example": 600
          },
          "remaining": {
            "type": "integer",
            "description": "Remaining OTP requests for this email",
            "example": 2
          }
        }
      },
      "VerifyOTPRequest": {
        "type": "object",
        "required": ["email", "otp"],
        "properties": {
          "email": {
            "type": "string",
            "format": "email",
            "example": "user@example.com"
          },
          "otp": {
            "type": "string",
            "pattern": "^[0-9]{6}$",
            "example": "123456"
          }
        }
      },
      "TokenResponse": {
        "type": "object",
        "properties": {
          "access_token": {
            "type": "string",
            "description": "JWT access token",
            "example": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
          },
          "token_type": {
            "type": "string",
            "example": "Bearer"
          },
          "expires_in": {
            "type": "integer",
            "description": "Token expiration in seconds",
            "example": 25200
          },
          "scope": {
            "type": "string",
            "example": "openid email profile"
          },
          "sub": {
            "type": "string",
            "description": "Subject (user ID)",
            "example": "user_abc123"
          },
          "email": {
            "type": "string",
            "format": "email",
            "example": "user@example.com"
          },
          "email_verified": {
            "type": "boolean",
            "example": true
          }
        }
      },
      "User": {
        "type": "object",
        "properties": {
          "sub": {
            "type": "string",
            "description": "Subject (user ID)"
          },
          "email": {
            "type": "string",
            "format": "email"
          },
          "email_verified": {
            "type": "boolean"
          },
          "iss": {
            "type": "string",
            "description": "Issuer"
          },
          "aud": {
            "type": "string",
            "description": "Audience (customer ID)"
          }
        }
      },
      "LogoutResponse": {
        "type": "object",
        "properties": {
          "success": {
            "type": "boolean",
            "example": true
          },
          "message": {
            "type": "string",
            "example": "Logged out successfully"
          }
        }
      },
      "RefreshTokenRequest": {
        "type": "object",
        "required": ["token"],
        "properties": {
          "token": {
            "type": "string",
            "description": "Current access token to refresh"
          }
        }
      },
      "Customer": {
        "type": "object",
        "properties": {
          "customerId": {
            "type": "string"
          },
          "email": {
            "type": "string",
            "format": "email"
          },
          "name": {
            "type": "string"
          },
          "status": {
            "type": "string",
            "enum": ["active", "suspended", "pending"]
          },
          "plan": {
            "type": "string"
          },
          "createdAt": {
            "type": "string",
            "format": "date-time"
          }
        }
      },
      "CreateApiKeyRequest": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string",
            "description": "Name for the API key",
            "example": "Production API Key"
          }
        }
      },
      "ApiKeyResponse": {
        "type": "object",
        "properties": {
          "apiKey": {
            "type": "string",
            "description": "The API key (only shown once)",
            "example": "otp_live_sk_..."
          },
          "keyId": {
            "type": "string",
            "description": "Unique identifier for the key"
          }
        }
      },
      "ApiKeysResponse": {
        "type": "object",
        "properties": {
          "apiKeys": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/ApiKey"
            }
          }
        }
      },
      "ApiKey": {
        "type": "object",
        "properties": {
          "keyId": {
            "type": "string"
          },
          "name": {
            "type": "string"
          },
          "createdAt": {
            "type": "string",
            "format": "date-time"
          },
          "lastUsed": {
            "type": "string",
            "format": "date-time",
            "nullable": true
          },
          "status": {
            "type": "string",
            "enum": ["active", "revoked"]
          }
        }
      },
      "AuditLogsResponse": {
        "type": "object",
        "properties": {
          "success": {
            "type": "boolean"
          },
          "period": {
            "type": "object",
            "properties": {
              "start": {
                "type": "string",
                "format": "date"
              },
              "end": {
                "type": "string",
                "format": "date"
              }
            }
          },
          "total": {
            "type": "integer"
          },
          "events": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/AuditLog"
            }
          }
        }
      },
      "AuditLog": {
        "type": "object",
        "properties": {
          "eventType": {
            "type": "string"
          },
          "timestamp": {
            "type": "string",
            "format": "date-time"
          }
        },
        "additionalProperties": true
      },
      "Analytics": {
        "type": "object",
        "properties": {
          "today": {
            "type": "object",
            "properties": {
              "otpRequests": {
                "type": "integer"
              },
              "otpVerifications": {
                "type": "integer"
              },
              "successfulLogins": {
                "type": "integer"
              },
              "failedAttempts": {
                "type": "integer"
              },
              "emailsSent": {
                "type": "integer"
              },
              "successRate": {
                "type": "number"
              }
            }
          }
        }
      },
      "HealthResponse": {
        "type": "object",
        "properties": {
          "status": {
            "type": "string",
            "enum": ["healthy", "degraded", "unhealthy"]
          },
          "service": {
            "type": "string"
          },
          "version": {
            "type": "string"
          },
          "timestamp": {
            "type": "string",
            "format": "date-time"
          }
        }
      },
      "ProblemDetails": {
        "type": "object",
        "properties": {
          "type": {
            "type": "string",
            "format": "uri"
          },
          "title": {
            "type": "string"
          },
          "status": {
            "type": "integer"
          },
          "detail": {
            "type": "string"
          },
          "instance": {
            "type": "string",
            "format": "uri"
          }
        }
      }
    }
  }
}`);

// utils/cache.js
var customerCache = /* @__PURE__ */ new Map();
var cacheTTL = 5 * 60 * 1e3;
async function getCustomerCached(customerId, getCustomerFn) {
  if (!customerId) return null;
  const cacheKey = `customer_${customerId}`;
  const cached = customerCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < cacheTTL) {
    return cached.data;
  }
  const customer = await getCustomerFn(customerId);
  if (customer) {
    customerCache.set(cacheKey, {
      data: customer,
      timestamp: Date.now()
    });
  }
  return customer;
}
__name(getCustomerCached, "getCustomerCached");
function invalidateCustomerCache(customerId) {
  if (customerId) {
    customerCache.delete(`customer_${customerId}`);
  }
}
__name(invalidateCustomerCache, "invalidateCustomerCache");

// utils/crypto.js
function generateOTP() {
  const array = new Uint32Array(2);
  crypto.getRandomValues(array);
  const value = (Number(array[0]) * 4294967296 + Number(array[1])) % 1e6;
  return value.toString().padStart(6, "0");
}
__name(generateOTP, "generateOTP");
async function hashEmail(email) {
  const encoder = new TextEncoder();
  const data = encoder.encode(email.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(hashEmail, "hashEmail");
async function generateUserId(email) {
  const hash = await hashEmail(email);
  return `user_${hash.substring(0, 12)}`;
}
__name(generateUserId, "generateUserId");
async function createJWT(payload, secret) {
  const header = {
    alg: "HS256",
    typ: "JWT"
  };
  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const signatureInput = `${headerB64}.${payloadB64}`;
  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(signatureInput));
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, "").replace(/\+/g, "-").replace(/_/g, "/");
  return `${signatureInput}.${signatureB64}`;
}
__name(createJWT, "createJWT");
async function verifyJWT(token, secret) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;
    const encoder = new TextEncoder();
    const signatureInput = `${headerB64}.${payloadB64}`;
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const signature = Uint8Array.from(
      atob(signatureB64.replace(/-/g, "+").replace(/_/g, "/")),
      (c) => c.charCodeAt(0)
    );
    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signature,
      encoder.encode(signatureInput)
    );
    if (!isValid) return null;
    const payload = JSON.parse(
      atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"))
    );
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1e3)) {
      return null;
    }
    return payload;
  } catch (error) {
    return null;
  }
}
__name(verifyJWT, "verifyJWT");
function getJWTSecret(env) {
  if (!env.JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is required. Set it via: wrangler secret put JWT_SECRET");
  }
  return env.JWT_SECRET;
}
__name(getJWTSecret, "getJWTSecret");
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(hashPassword, "hashPassword");
async function generateApiKey(prefix = "otp_live_sk_") {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const base64 = btoa(String.fromCharCode(...array)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  return `${prefix}${base64}`;
}
__name(generateApiKey, "generateApiKey");
async function hashApiKey(apiKey) {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(hashApiKey, "hashApiKey");
function constantTimeEquals(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
__name(constantTimeEquals, "constantTimeEquals");

// utils/email.js
function escapeHtml(str) {
  if (!str) return "";
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  };
  return String(str).replace(/[&<>"']/g, (m) => map[m]);
}
__name(escapeHtml, "escapeHtml");
function renderEmailTemplate(template, variables, isHtml = false) {
  if (!template) return "";
  let rendered = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "gi");
    const replacement = isHtml && key !== "otp" ? escapeHtml(value || "") : value || "";
    rendered = rendered.replace(regex, replacement);
  }
  return rendered;
}
__name(renderEmailTemplate, "renderEmailTemplate");
function getDefaultEmailTemplate() {
  return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .otp-code { 
                    font-size: 32px; 
                    font-weight: bold; 
                    letter-spacing: 8px; 
                    text-align: center;
                    background: #f4f4f4;
                    padding: 20px;
                    border-radius: 8px;
                    margin: 20px 0;
                    font-family: monospace;
                }
                .footer { 
                    margin-top: 30px; 
                    font-size: 12px; 
                    color: #666; 
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Your Verification Code</h1>
                <p>Use this code to verify your email address:</p>
                <div class="otp-code">{{otp}}</div>
                <p>This code will expire in <strong>{{expiresIn}} minutes</strong>.</p>
                <p>If you didn't request this code, please ignore this email.</p>
                <div class="footer">
                    <p>{{appName}}</p>
                    <p>This is an automated message, please do not reply.</p>
                </div>
            </div>
        </body>
        </html>
    `;
}
__name(getDefaultEmailTemplate, "getDefaultEmailTemplate");
function getDefaultTextTemplate() {
  return `Your Verification Code

Use this code to verify your email address: {{otp}}

This code will expire in {{expiresIn}} minutes.

If you didn't request this code, please ignore this email.

{{appName}}
This is an automated message, please do not reply.`;
}
__name(getDefaultTextTemplate, "getDefaultTextTemplate");
var ResendProvider = class {
  static {
    __name(this, "ResendProvider");
  }
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = "https://api.resend.com";
  }
  async sendEmail({ from, to, subject, html, text }) {
    const response = await fetch(`${this.baseUrl}/emails`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        html,
        text
      })
    });
    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        errorData = { message: errorText };
      }
      throw new Error(`Resend API error: ${response.status} - ${errorData.message || errorText}`);
    }
    return await response.json();
  }
};
var SendGridProvider = class {
  static {
    __name(this, "SendGridProvider");
  }
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = "https://api.sendgrid.com/v3";
  }
  async sendEmail({ from, to, subject, html, text }) {
    const response = await fetch(`${this.baseUrl}/mail/send`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: to }]
        }],
        from: { email: from },
        subject,
        content: [
          { type: "text/plain", value: text },
          { type: "text/html", value: html }
        ]
      })
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SendGrid API error: ${response.status} - ${errorText}`);
    }
    return { success: true };
  }
};
function getEmailProvider(customer, env) {
  if (customer && customer.config && customer.config.emailProvider) {
    const providerConfig = customer.config.emailProvider;
    if (providerConfig.type === "sendgrid" && providerConfig.apiKey) {
      return new SendGridProvider(providerConfig.apiKey);
    }
    if (providerConfig.type === "resend" && providerConfig.apiKey) {
      return new ResendProvider(providerConfig.apiKey);
    }
  }
  if (!env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY not configured. Set it via: wrangler secret put RESEND_API_KEY");
  }
  return new ResendProvider(env.RESEND_API_KEY);
}
__name(getEmailProvider, "getEmailProvider");

// services/customer.js
function getCustomerKey(customerId, key) {
  return customerId ? `cust_${customerId}_${key}` : key;
}
__name(getCustomerKey, "getCustomerKey");
function generateCustomerId() {
  const array = new Uint8Array(6);
  crypto.getRandomValues(array);
  const hex = Array.from(array).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `cust_${hex}`;
}
__name(generateCustomerId, "generateCustomerId");
async function getCustomer(customerId, env) {
  const customerKey = `customer_${customerId}`;
  const customer = await env.OTP_AUTH_KV.get(customerKey, { type: "json" });
  return customer;
}
__name(getCustomer, "getCustomer");
async function storeCustomer(customerId, customerData, env) {
  const customerKey = `customer_${customerId}`;
  await env.OTP_AUTH_KV.put(customerKey, JSON.stringify(customerData));
}
__name(storeCustomer, "storeCustomer");

// services/api-key.js
async function generateApiKey2(prefix = "otp_live_sk_") {
  return await generateApiKey(prefix);
}
__name(generateApiKey2, "generateApiKey");
async function createApiKeyForCustomer(customerId, name, env) {
  const apiKey = await generateApiKey2("otp_live_sk_");
  const apiKeyHash = await hashApiKey(apiKey);
  const keyId = `key_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const apiKeyData = {
    customerId,
    keyId,
    name: name || "Default API Key",
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    lastUsed: null,
    status: "active"
  };
  const apiKeyKey = `apikey_${apiKeyHash}`;
  await env.OTP_AUTH_KV.put(apiKeyKey, JSON.stringify(apiKeyData));
  const customerApiKeysKey = `customer_${customerId}_apikeys`;
  const existingKeys = await env.OTP_AUTH_KV.get(customerApiKeysKey, { type: "json" }) || [];
  existingKeys.push({
    keyId,
    name: apiKeyData.name,
    createdAt: apiKeyData.createdAt,
    lastUsed: null,
    status: "active"
  });
  await env.OTP_AUTH_KV.put(customerApiKeysKey, JSON.stringify(existingKeys));
  return { apiKey, keyId };
}
__name(createApiKeyForCustomer, "createApiKeyForCustomer");
async function verifyApiKey(apiKey, env) {
  const apiKeyHash = await hashApiKey(apiKey);
  const apiKeyKey = `apikey_${apiKeyHash}`;
  const keyData = await env.OTP_AUTH_KV.get(apiKeyKey, { type: "json" });
  if (!keyData || keyData.status !== "active") {
    return null;
  }
  keyData.lastUsed = (/* @__PURE__ */ new Date()).toISOString();
  await env.OTP_AUTH_KV.put(apiKeyKey, JSON.stringify(keyData));
  const customerApiKeysKey = `customer_${keyData.customerId}_apikeys`;
  const customerKeys = await env.OTP_AUTH_KV.get(customerApiKeysKey, { type: "json" }) || [];
  const keyIndex = customerKeys.findIndex((k) => k.keyId === keyData.keyId);
  if (keyIndex >= 0) {
    customerKeys[keyIndex].lastUsed = keyData.lastUsed;
    await env.OTP_AUTH_KV.put(customerApiKeysKey, JSON.stringify(customerKeys));
  }
  const customer = await getCustomer(keyData.customerId, env);
  if (!customer) {
    return null;
  }
  if (customer.status !== "active") {
    return null;
  }
  return {
    customerId: keyData.customerId,
    keyId: keyData.keyId
  };
}
__name(verifyApiKey, "verifyApiKey");

// services/rate-limit.js
function getPlanLimits(plan = "free") {
  const plans = {
    free: {
      otpRequestsPerHour: 3,
      otpRequestsPerDay: 1e3,
      // Hard cap for free tier
      otpRequestsPerMonth: 1e4,
      // Hard cap for free tier
      ipRequestsPerHour: 10,
      ipRequestsPerDay: 50,
      maxUsers: 100
    },
    pro: {
      otpRequestsPerHour: 10,
      otpRequestsPerDay: 1e4,
      otpRequestsPerMonth: 1e5,
      ipRequestsPerHour: 50,
      ipRequestsPerDay: 500,
      maxUsers: 1e3
    },
    enterprise: {
      otpRequestsPerHour: 100,
      otpRequestsPerDay: 1e5,
      otpRequestsPerMonth: 1e6,
      ipRequestsPerHour: 500,
      ipRequestsPerDay: 5e3,
      maxUsers: 1e4
    }
  };
  return plans[plan] || plans.free;
}
__name(getPlanLimits, "getPlanLimits");
function calculateDynamicAdjustment(emailStats, ipStats) {
  let adjustment = 0;
  if (emailStats.requestsLast24h < 3) {
    adjustment += 2;
  }
  if (emailStats.requestsLast24h > 10) {
    adjustment -= 1;
  }
  if (emailStats.totalRequests > 0 && emailStats.failedAttempts / emailStats.totalRequests > 0.5) {
    adjustment -= 2;
  }
  if (emailStats.lastSuccessfulLogin && Date.now() - new Date(emailStats.lastSuccessfulLogin).getTime() < 7 * 24 * 60 * 60 * 1e3) {
    adjustment += 1;
  }
  if (ipStats.requestsLast24h > 20) {
    adjustment -= 1;
  }
  if (ipStats.failedAttempts > 10) {
    adjustment -= 1;
  }
  return Math.max(-2, Math.min(2, adjustment));
}
__name(calculateDynamicAdjustment, "calculateDynamicAdjustment");
async function getUsageStats(emailHash, ipHash, customerId, env) {
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1e3;
  const emailStatsKey = customerId ? `cust_${customerId}_stats_email_${emailHash}` : `stats_email_${emailHash}`;
  const emailStatsData = await env.OTP_AUTH_KV.get(emailStatsKey, { type: "json" }) || {
    totalRequests: 0,
    requestsLast24h: 0,
    failedAttempts: 0,
    lastSuccessfulLogin: null,
    requestTimestamps: []
  };
  emailStatsData.requestTimestamps = (emailStatsData.requestTimestamps || []).filter((ts) => ts > oneDayAgo);
  emailStatsData.requestsLast24h = emailStatsData.requestTimestamps.length;
  const ipStatsKey = customerId ? `cust_${customerId}_stats_ip_${ipHash}` : `stats_ip_${ipHash}`;
  const ipStatsData = await env.OTP_AUTH_KV.get(ipStatsKey, { type: "json" }) || {
    requestsLast24h: 0,
    failedAttempts: 0,
    requestTimestamps: []
  };
  ipStatsData.requestTimestamps = (ipStatsData.requestTimestamps || []).filter((ts) => ts > oneDayAgo);
  ipStatsData.requestsLast24h = ipStatsData.requestTimestamps.length;
  return {
    emailStats: emailStatsData,
    ipStats: ipStatsData
  };
}
__name(getUsageStats, "getUsageStats");
async function updateUsageStats(emailHash, ipHash, customerId, success, env) {
  const now = Date.now();
  const emailStatsKey = customerId ? `cust_${customerId}_stats_email_${emailHash}` : `stats_email_${emailHash}`;
  const emailStats = await env.OTP_AUTH_KV.get(emailStatsKey, { type: "json" }) || {
    totalRequests: 0,
    requestsLast24h: 0,
    failedAttempts: 0,
    lastSuccessfulLogin: null,
    requestTimestamps: []
  };
  emailStats.totalRequests = (emailStats.totalRequests || 0) + 1;
  emailStats.requestTimestamps = emailStats.requestTimestamps || [];
  emailStats.requestTimestamps.push(now);
  if (!success) {
    emailStats.failedAttempts = (emailStats.failedAttempts || 0) + 1;
  } else {
    emailStats.lastSuccessfulLogin = (/* @__PURE__ */ new Date()).toISOString();
  }
  if (emailStats.requestTimestamps.length > 1e3) {
    emailStats.requestTimestamps = emailStats.requestTimestamps.slice(-1e3);
  }
  await env.OTP_AUTH_KV.put(emailStatsKey, JSON.stringify(emailStats), { expirationTtl: 2592e3 });
  const ipStatsKey = customerId ? `cust_${customerId}_stats_ip_${ipHash}` : `stats_ip_${ipHash}`;
  const ipStats = await env.OTP_AUTH_KV.get(ipStatsKey, { type: "json" }) || {
    requestsLast24h: 0,
    failedAttempts: 0,
    requestTimestamps: []
  };
  ipStats.requestTimestamps = ipStats.requestTimestamps || [];
  ipStats.requestTimestamps.push(now);
  if (!success) {
    ipStats.failedAttempts = (ipStats.failedAttempts || 0) + 1;
  }
  if (ipStats.requestTimestamps.length > 1e3) {
    ipStats.requestTimestamps = ipStats.requestTimestamps.slice(-1e3);
  }
  await env.OTP_AUTH_KV.put(ipStatsKey, JSON.stringify(ipStats), { expirationTtl: 2592e3 });
}
__name(updateUsageStats, "updateUsageStats");
async function hashIP(ip) {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").substring(0, 16);
}
__name(hashIP, "hashIP");
async function checkOTPRateLimit(emailHash, customerId, ipAddress, getCustomerCachedFn, env) {
  try {
    let customer = null;
    let plan = "free";
    let rateLimitPerHour = 3;
    if (customerId) {
      customer = await getCustomerCachedFn(customerId);
      if (customer) {
        plan = customer.plan || "free";
        if (customer.config && customer.config.rateLimits) {
          rateLimitPerHour = customer.config.rateLimits.otpRequestsPerHour || 3;
        }
      }
    }
    const planLimits = getPlanLimits(plan);
    const ipHash = await hashIP(ipAddress || "unknown");
    const { emailStats, ipStats } = await getUsageStats(emailHash, ipHash, customerId, env);
    const adjustment = calculateDynamicAdjustment(emailStats, ipStats);
    const adjustedRateLimit = Math.max(1, rateLimitPerHour + adjustment);
    const ipRateLimitKey = customerId ? `cust_${customerId}_ratelimit_ip_${ipHash}` : `ratelimit_ip_${ipHash}`;
    const ipRateLimitData = await env.OTP_AUTH_KV.get(ipRateLimitKey);
    let ipRateLimit = null;
    if (ipRateLimitData) {
      try {
        ipRateLimit = typeof ipRateLimitData === "string" ? JSON.parse(ipRateLimitData) : ipRateLimitData;
      } catch (e) {
        ipRateLimit = null;
      }
    }
    const now = Date.now();
    const oneHour = 60 * 60 * 1e3;
    if (ipRateLimit && ipRateLimit.resetAt && now <= new Date(ipRateLimit.resetAt).getTime()) {
      if (ipRateLimit.requests >= planLimits.ipRequestsPerHour) {
        return {
          allowed: false,
          remaining: 0,
          resetAt: ipRateLimit.resetAt,
          reason: "ip_rate_limit_exceeded"
        };
      }
      ipRateLimit.requests = (ipRateLimit.requests || 0) + 1;
    } else {
      const resetAt2 = new Date(now + oneHour).toISOString();
      ipRateLimit = {
        requests: 1,
        resetAt: resetAt2
      };
    }
    await env.OTP_AUTH_KV.put(ipRateLimitKey, JSON.stringify(ipRateLimit), { expirationTtl: 3600 });
    const rateLimitKey = customerId ? `cust_${customerId}_ratelimit_otp_${emailHash}` : `ratelimit_otp_${emailHash}`;
    const rateLimitData = await env.OTP_AUTH_KV.get(rateLimitKey);
    let rateLimit = null;
    if (rateLimitData) {
      try {
        rateLimit = typeof rateLimitData === "string" ? JSON.parse(rateLimitData) : rateLimitData;
      } catch (e) {
        rateLimit = null;
      }
    }
    if (rateLimit && rateLimit.resetAt && now <= new Date(rateLimit.resetAt).getTime()) {
      if (rateLimit.otpRequests >= adjustedRateLimit) {
        return {
          allowed: false,
          remaining: 0,
          resetAt: rateLimit.resetAt,
          reason: "email_rate_limit_exceeded"
        };
      }
      rateLimit.otpRequests = (rateLimit.otpRequests || 0) + 1;
      await env.OTP_AUTH_KV.put(rateLimitKey, JSON.stringify(rateLimit), { expirationTtl: 3600 });
      return {
        allowed: true,
        remaining: adjustedRateLimit - rateLimit.otpRequests,
        resetAt: rateLimit.resetAt
      };
    }
    const resetAt = new Date(now + oneHour).toISOString();
    const newRateLimit = {
      otpRequests: 1,
      failedAttempts: 0,
      resetAt
    };
    await env.OTP_AUTH_KV.put(rateLimitKey, JSON.stringify(newRateLimit), { expirationTtl: 3600 });
    return {
      allowed: true,
      remaining: adjustedRateLimit - 1,
      resetAt
    };
  } catch (error) {
    console.error("Rate limit check error:", error);
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + 36e5).toISOString(),
      reason: "rate_limit_error"
    };
  }
}
__name(checkOTPRateLimit, "checkOTPRateLimit");
async function recordOTPRequest(emailHash, ipAddress, customerId, env) {
  try {
    const ipHash = await hashIP(ipAddress || "unknown");
    await updateUsageStats(emailHash, ipHash, customerId, true, env);
  } catch (error) {
    console.error("Failed to record OTP request:", error);
  }
}
__name(recordOTPRequest, "recordOTPRequest");
async function recordOTPFailure(emailHash, ipAddress, customerId, env) {
  try {
    const ipHash = await hashIP(ipAddress || "unknown");
    await updateUsageStats(emailHash, ipHash, customerId, false, env);
  } catch (error) {
    console.error("Failed to record OTP failure:", error);
  }
}
__name(recordOTPFailure, "recordOTPFailure");

// services/analytics.js
async function trackResponseTime(customerId, endpoint, responseTime, env) {
  if (!customerId) return;
  try {
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const metricsKey = `metrics_${customerId}_${today}_${endpoint}`;
    const existing = await env.OTP_AUTH_KV.get(metricsKey, { type: "json" }) || {
      endpoint,
      date: today,
      responseTimes: [],
      count: 0,
      sum: 0
    };
    existing.responseTimes.push(responseTime);
    existing.count++;
    existing.sum += responseTime;
    if (existing.responseTimes.length > 1e3) {
      existing.responseTimes = existing.responseTimes.slice(-1e3);
    }
    const sorted = [...existing.responseTimes].sort((a, b) => a - b);
    existing.avgResponseTime = existing.sum / existing.count;
    existing.p50ResponseTime = sorted[Math.floor(sorted.length * 0.5)] || 0;
    existing.p95ResponseTime = sorted[Math.floor(sorted.length * 0.95)] || 0;
    existing.p99ResponseTime = sorted[Math.floor(sorted.length * 0.99)] || 0;
    await env.OTP_AUTH_KV.put(metricsKey, JSON.stringify(existing), { expirationTtl: 2592e3 });
  } catch (error) {
    console.error("Response time tracking error:", error);
  }
}
__name(trackResponseTime, "trackResponseTime");
async function trackError(customerId, category, message, endpoint, env) {
  if (!customerId) return;
  try {
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const errorKey = `errors_${customerId}_${today}`;
    const existing = await env.OTP_AUTH_KV.get(errorKey, { type: "json" }) || {
      customerId,
      date: today,
      errors: [],
      byCategory: {},
      byEndpoint: {},
      total: 0
    };
    existing.errors.push({
      category,
      message,
      endpoint,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    existing.byCategory[category] = (existing.byCategory[category] || 0) + 1;
    existing.byEndpoint[endpoint] = (existing.byEndpoint[endpoint] || 0) + 1;
    existing.total++;
    if (existing.errors.length > 1e3) {
      existing.errors = existing.errors.slice(-1e3);
    }
    await env.OTP_AUTH_KV.put(errorKey, JSON.stringify(existing), { expirationTtl: 2592e3 });
  } catch (error) {
    console.error("Error tracking error:", error);
  }
}
__name(trackError, "trackError");
async function trackUsage(customerId, metric, increment = 1, env) {
  if (!customerId) return;
  try {
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const usageKey = `usage_${customerId}_${today}`;
    const existingUsage = await env.OTP_AUTH_KV.get(usageKey, { type: "json" }) || {
      customerId,
      date: today,
      otpRequests: 0,
      otpVerifications: 0,
      successfulLogins: 0,
      failedAttempts: 0,
      emailsSent: 0,
      apiCalls: 0,
      storageUsed: 0,
      lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (existingUsage[metric] !== void 0) {
      existingUsage[metric] = (existingUsage[metric] || 0) + increment;
    } else {
      existingUsage[metric] = increment;
    }
    existingUsage.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
    await env.OTP_AUTH_KV.put(usageKey, JSON.stringify(existingUsage), { expirationTtl: 2592e3 });
  } catch (error) {
    console.error("Usage tracking error:", error);
  }
}
__name(trackUsage, "trackUsage");
async function getUsage(customerId, startDate, endDate, env) {
  const usage = {
    customerId,
    period: { start: startDate, end: endDate },
    otpRequests: 0,
    otpVerifications: 0,
    successfulLogins: 0,
    failedAttempts: 0,
    emailsSent: 0,
    apiCalls: 0,
    storageUsed: 0,
    dailyBreakdown: []
  };
  const start = new Date(startDate);
  const end = new Date(endDate);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split("T")[0];
    const usageKey = `usage_${customerId}_${dateStr}`;
    const dayUsage = await env.OTP_AUTH_KV.get(usageKey, { type: "json" });
    if (dayUsage) {
      usage.otpRequests += dayUsage.otpRequests || 0;
      usage.otpVerifications += dayUsage.otpVerifications || 0;
      usage.successfulLogins += dayUsage.successfulLogins || 0;
      usage.failedAttempts += dayUsage.failedAttempts || 0;
      usage.emailsSent += dayUsage.emailsSent || 0;
      usage.apiCalls += dayUsage.apiCalls || 0;
      usage.storageUsed += dayUsage.storageUsed || 0;
      usage.dailyBreakdown.push({
        date: dateStr,
        otpRequests: dayUsage.otpRequests || 0,
        otpVerifications: dayUsage.otpVerifications || 0,
        successfulLogins: dayUsage.successfulLogins || 0,
        failedAttempts: dayUsage.failedAttempts || 0,
        emailsSent: dayUsage.emailsSent || 0
      });
    }
  }
  usage.successRate = usage.otpRequests > 0 ? (usage.otpVerifications / usage.otpRequests * 100).toFixed(2) : 0;
  return usage;
}
__name(getUsage, "getUsage");
async function getMonthlyUsage(customerId, env) {
  const now = /* @__PURE__ */ new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const endDate = now.toISOString().split("T")[0];
  return getUsage(customerId, startDate, endDate, env);
}
__name(getMonthlyUsage, "getMonthlyUsage");
async function checkQuota(customerId, getCustomerCachedFn, getPlanLimitsFn, env) {
  if (!customerId) {
    return { allowed: true };
  }
  try {
    const customer = await getCustomerCachedFn(customerId);
    if (!customer) {
      return { allowed: false, reason: "customer_not_found" };
    }
    const planLimits = getPlanLimitsFn(customer.plan);
    const customerLimits = customer.config?.rateLimits || {};
    const quota = {
      otpRequestsPerDay: customerLimits.otpRequestsPerDay ?? planLimits.otpRequestsPerDay,
      otpRequestsPerMonth: customerLimits.otpRequestsPerMonth ?? planLimits.otpRequestsPerMonth,
      maxUsers: customerLimits.maxUsers ?? planLimits.maxUsers
    };
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const todayUsage = await env.OTP_AUTH_KV.get(`usage_${customerId}_${today}`, { type: "json" });
    const dailyRequests = todayUsage?.otpRequests || 0;
    if (dailyRequests >= quota.otpRequestsPerDay) {
      return {
        allowed: false,
        reason: "daily_quota_exceeded",
        quota,
        usage: { daily: dailyRequests, monthly: null }
      };
    }
    const monthlyUsage = await getMonthlyUsage(customerId, env);
    if (monthlyUsage.otpRequests >= quota.otpRequestsPerMonth) {
      return {
        allowed: false,
        reason: "monthly_quota_exceeded",
        quota,
        usage: { daily: dailyRequests, monthly: monthlyUsage.otpRequests }
      };
    }
    return {
      allowed: true,
      quota,
      usage: {
        daily: dailyRequests,
        monthly: monthlyUsage.otpRequests,
        remainingDaily: quota.otpRequestsPerDay - dailyRequests,
        remainingMonthly: quota.otpRequestsPerMonth - monthlyUsage.otpRequests
      }
    };
  } catch (error) {
    console.error("Quota check error:", error);
    return { allowed: true };
  }
}
__name(checkQuota, "checkQuota");

// services/webhooks.js
async function signWebhook(payload, secret) {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(payload));
  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, data);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(signWebhook, "signWebhook");
async function sendWebhook(customerId, event, data, env) {
  try {
    const customer = await getCustomer(customerId, env);
    if (!customer || !customer.config || !customer.config.webhookConfig) {
      return;
    }
    const webhookConfig = customer.config.webhookConfig;
    if (!webhookConfig.url) {
      return;
    }
    if (webhookConfig.events && webhookConfig.events.length > 0) {
      if (!webhookConfig.events.includes(event) && !webhookConfig.events.includes("*")) {
        return;
      }
    }
    const payload = {
      event,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      customerId,
      data
    };
    const signature = webhookConfig.secret ? await signWebhook(payload, webhookConfig.secret) : null;
    const response = await fetch(webhookConfig.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-OTP-Event": event,
        "X-OTP-Timestamp": payload.timestamp,
        ...signature && { "X-OTP-Signature": signature }
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      console.error("Webhook delivery failed:", {
        customerId,
        event,
        url: webhookConfig.url,
        status: response.status,
        statusText: response.statusText
      });
      const retryKey = `webhook_retry_${customerId}_${Date.now()}`;
      await env.OTP_AUTH_KV.put(retryKey, JSON.stringify({
        customerId,
        event,
        data,
        url: webhookConfig.url,
        attempts: 1,
        nextRetry: new Date(Date.now() + 6e4).toISOString()
        // 1 minute
      }), { expirationTtl: 86400 });
    } else {
      console.log("Webhook delivered successfully:", { customerId, event });
    }
  } catch (error) {
    console.error("Webhook error:", error);
  }
}
__name(sendWebhook, "sendWebhook");

// services/security.js
async function logSecurityEvent(customerId, eventType, details, env) {
  try {
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const auditKey = `audit_${customerId}_${today}`;
    const existing = await env.OTP_AUTH_KV.get(auditKey, { type: "json" }) || {
      customerId,
      date: today,
      events: []
    };
    existing.events.push({
      eventType,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      ...details
    });
    if (existing.events.length > 1e3) {
      existing.events = existing.events.slice(-1e3);
    }
    await env.OTP_AUTH_KV.put(auditKey, JSON.stringify(existing), { expirationTtl: 7776e3 });
  } catch (error) {
    console.error("Security logging error:", error);
  }
}
__name(logSecurityEvent, "logSecurityEvent");
function isIPInCIDR(ip, cidr) {
  try {
    const [network, prefixLength] = cidr.split("/");
    const prefix = parseInt(prefixLength, 10);
    const ipParts = ip.split(".").map(Number);
    const networkParts = network.split(".").map(Number);
    if (ipParts.length !== 4 || networkParts.length !== 4) {
      return false;
    }
    const ipNum = (ipParts[0] << 24) + (ipParts[1] << 16) + (ipParts[2] << 8) + ipParts[3];
    const networkNum = (networkParts[0] << 24) + (networkParts[1] << 16) + (networkParts[2] << 8) + networkParts[3];
    const mask = 4294967295 << 32 - prefix >>> 0;
    return (ipNum & mask) === (networkNum & mask);
  } catch (error) {
    return false;
  }
}
__name(isIPInCIDR, "isIPInCIDR");
async function checkIPAllowlist(customerId, ip, env) {
  if (!customerId || !ip) return true;
  try {
    const customer = await getCustomer(customerId, env);
    if (!customer || !customer.config || !customer.config.allowedIPs) {
      return true;
    }
    const allowedIPs = customer.config.allowedIPs;
    if (allowedIPs.includes("*")) {
      return true;
    }
    if (allowedIPs.includes(ip)) {
      return true;
    }
    for (const allowed of allowedIPs) {
      if (allowed.includes("/")) {
        if (isIPInCIDR(ip, allowed)) {
          return true;
        }
      }
    }
    return false;
  } catch (error) {
    console.error("IP allowlist check error:", error);
    return true;
  }
}
__name(checkIPAllowlist, "checkIPAllowlist");

// worker.js
async function getCustomerCached2(customerId, env) {
  if (!customerId) return null;
  return getCustomerCached(customerId, async (id) => await getCustomer(id, env));
}
__name(getCustomerCached2, "getCustomerCached");
function invalidateCustomerCache2(customerId) {
  return invalidateCustomerCache(customerId);
}
__name(invalidateCustomerCache2, "invalidateCustomerCache");
function getCorsHeaders2(env, request, customer = null) {
  const origin = request.headers.get("Origin");
  let allowedOrigins = [];
  if (customer && customer.config && customer.config.allowedOrigins && customer.config.allowedOrigins.length > 0) {
    allowedOrigins = customer.config.allowedOrigins;
  }
  if (allowedOrigins.length === 0) {
    allowedOrigins = env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()) : [];
  }
  let allowOrigin = "*";
  if (allowedOrigins.length > 0) {
    const matchedOrigin = allowedOrigins.find((allowed) => {
      if (allowed === "*") return true;
      if (allowed.endsWith("*")) {
        const prefix = allowed.slice(0, -1);
        return origin && origin.startsWith(prefix);
      }
      return origin === allowed;
    });
    allowOrigin = matchedOrigin === "*" ? "*" : matchedOrigin || null;
  }
  return {
    "Access-Control-Allow-Origin": allowOrigin || "null",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-OTP-API-Key, X-Requested-With, X-CSRF-Token",
    "Access-Control-Allow-Credentials": allowOrigin !== "*" ? "true" : "false",
    "Access-Control-Max-Age": "86400",
    // Security headers
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
  };
}
__name(getCorsHeaders2, "getCorsHeaders");
var generateOTP2 = generateOTP;
var hashEmail2 = hashEmail;
var generateUserId2 = generateUserId;
var createJWT2 = createJWT;
var verifyJWT2 = verifyJWT;
var getJWTSecret2 = getJWTSecret;
var hashPassword2 = hashPassword;
var constantTimeEquals2 = constantTimeEquals;
async function checkOTPRateLimit2(emailHash, customerId, ipAddress, env) {
  return checkOTPRateLimit(emailHash, customerId, ipAddress, (id) => getCustomerCached2(id, env), env);
}
__name(checkOTPRateLimit2, "checkOTPRateLimit");
async function recordOTPRequest2(emailHash, ipAddress, customerId, env) {
  return recordOTPRequest(emailHash, ipAddress, customerId, env);
}
__name(recordOTPRequest2, "recordOTPRequest");
async function recordOTPFailure2(emailHash, ipAddress, customerId, env) {
  return recordOTPFailure(emailHash, ipAddress, customerId, env);
}
__name(recordOTPFailure2, "recordOTPFailure");
var renderEmailTemplate2 = renderEmailTemplate;
var getDefaultEmailTemplate2 = getDefaultEmailTemplate;
var getDefaultTextTemplate2 = getDefaultTextTemplate;
function validateSecrets(env) {
  const missing = [];
  const warnings = [];
  if (!env.JWT_SECRET) {
    missing.push("JWT_SECRET");
  }
  if (!env.RESEND_API_KEY) {
    missing.push("RESEND_API_KEY");
  }
  if (!env.RESEND_FROM_EMAIL) {
    missing.push("RESEND_FROM_EMAIL");
  }
  if (!env.ALLOWED_ORIGINS && env.ENVIRONMENT === "production") {
    warnings.push("ALLOWED_ORIGINS (recommended for production)");
  }
  return {
    valid: missing.length === 0,
    missing,
    warnings
  };
}
__name(validateSecrets, "validateSecrets");
async function checkErrorRateAlert(customerId, env) {
  try {
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const usageKey = `usage_${customerId}_${today}`;
    const errorKey = `errors_${customerId}_${today}`;
    const usage = await env.OTP_AUTH_KV.get(usageKey, { type: "json" }) || { otpRequests: 0 };
    const errors = await env.OTP_AUTH_KV.get(errorKey, { type: "json" }) || { total: 0 };
    const totalRequests = usage.otpRequests || 0;
    const totalErrors = errors.total || 0;
    if (totalRequests > 0) {
      const errorRate = totalErrors / totalRequests * 100;
      if (errorRate > 5) {
        await sendWebhook(customerId, "error_rate_high", {
          errorRate: errorRate.toFixed(2),
          totalRequests,
          totalErrors,
          threshold: 5
        }, env);
        console.warn(`High error rate for customer ${customerId}: ${errorRate.toFixed(2)}%`);
      }
    }
  } catch (error) {
    console.error("Error rate check failed:", error);
  }
}
__name(checkErrorRateAlert, "checkErrorRateAlert");
var getEmailProvider2 = getEmailProvider;
async function sendOTPEmail(email, otp, customerId, env) {
  if (!env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY not configured");
  }
  let customer = null;
  let emailConfig = null;
  let fromEmail = env.RESEND_FROM_EMAIL;
  let fromName = "OTP Auth Service";
  let subjectTemplate = "Your Verification Code - {{appName}}";
  let htmlTemplate = null;
  let textTemplate = null;
  let templateVariables = {
    appName: "OTP Auth Service",
    brandColor: "#007bff",
    footerText: "This is an automated message, please do not reply.",
    supportUrl: null,
    logoUrl: null
  };
  if (customerId) {
    customer = await getCustomerCached2(customerId, env);
    if (customer && customer.config && customer.config.emailConfig) {
      emailConfig = customer.config.emailConfig;
      if (emailConfig.fromEmail) {
        fromEmail = emailConfig.fromEmail;
      }
      if (emailConfig.fromName) {
        fromName = emailConfig.fromName;
      }
      if (emailConfig.subjectTemplate) {
        subjectTemplate = emailConfig.subjectTemplate;
      }
      if (emailConfig.htmlTemplate) {
        htmlTemplate = emailConfig.htmlTemplate;
      }
      if (emailConfig.textTemplate) {
        textTemplate = emailConfig.textTemplate;
      }
      if (emailConfig.variables) {
        templateVariables = { ...templateVariables, ...emailConfig.variables };
      }
    }
  }
  if (!fromEmail) {
    throw new Error("RESEND_FROM_EMAIL must be set to your verified domain email (e.g., noreply@yourdomain.com). Set it via: wrangler secret put RESEND_FROM_EMAIL");
  }
  const variables = {
    ...templateVariables,
    otp,
    expiresIn: "10",
    userEmail: email,
    appName: templateVariables.appName || customer?.companyName || "OTP Auth Service"
  };
  const html = renderEmailTemplate2(htmlTemplate || getDefaultEmailTemplate2(), variables, true);
  const text = renderEmailTemplate2(textTemplate || getDefaultTextTemplate2(), variables, false);
  const subject = renderEmailTemplate2(subjectTemplate, variables, false);
  const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail;
  const provider = getEmailProvider2(customer, env);
  try {
    const result = await provider.sendEmail({
      from,
      to: email,
      subject,
      html,
      text
    });
    console.log("Email sent successfully:", result);
    return result;
  } catch (error) {
    console.error("Email sending error:", {
      message: error.message,
      stack: error.stack,
      email: email.toLowerCase().trim(),
      customerId,
      provider: customer?.config?.emailProvider?.type || "resend"
    });
    throw error;
  }
}
__name(sendOTPEmail, "sendOTPEmail");
async function handlePublicSignup(request, env) {
  try {
    const body = await request.json();
    const { email, companyName, password } = body;
    if (!email || !companyName || !password) {
      return new Response(JSON.stringify({ error: "Email, company name, and password are required" }), {
        status: 400,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "Valid email address required" }), {
        status: 400,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    if (password.length < 8) {
      return new Response(JSON.stringify({ error: "Password must be at least 8 characters" }), {
        status: 400,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const emailLower = email.toLowerCase().trim();
    const emailHash = await hashEmail2(emailLower);
    const signupKey = `signup_${emailHash}`;
    const existingSignup = await env.OTP_AUTH_KV.get(signupKey, { type: "json" });
    if (existingSignup && new Date(existingSignup.expiresAt) > /* @__PURE__ */ new Date()) {
      return new Response(JSON.stringify({
        error: "Signup already in progress. Check your email for verification.",
        expiresAt: existingSignup.expiresAt
      }), {
        status: 400,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const verificationToken = generateVerificationToken();
    const verificationCode = generateOTP2();
    const passwordHash = await hashPassword2(password);
    const signupData = {
      email: emailLower,
      companyName,
      passwordHash,
      verificationToken,
      verificationCode,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1e3).toISOString()
      // 24 hours
    };
    await env.OTP_AUTH_KV.put(signupKey, JSON.stringify(signupData), { expirationTtl: 86400 });
    try {
      const emailProvider = getEmailProvider2(null, env);
      await emailProvider.sendEmail({
        from: env.RESEND_FROM_EMAIL || "noreply@otpauth.com",
        to: emailLower,
        subject: "Verify your OTP Auth Service account",
        html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="utf-8">
                        <style>
                            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                            .code { font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; background: #f4f4f4; padding: 20px; border-radius: 8px; margin: 20px 0; font-family: monospace; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <h1>Verify Your Account</h1>
                            <p>Your verification code is:</p>
                            <div class="code">${verificationCode}</div>
                            <p>Or click this link to verify: <a href="https://otpauth.com/verify?token=${verificationToken}">Verify Account</a></p>
                            <p>This code expires in 24 hours.</p>
                        </div>
                    </body>
                    </html>
                `,
        text: `Your verification code is: ${verificationCode}

Or visit: https://otpauth.com/verify?token=${verificationToken}

This code expires in 24 hours.`
      });
    } catch (error) {
      console.error("Failed to send verification email:", error);
      return new Response(JSON.stringify({
        error: "Failed to send verification email",
        message: error.message
      }), {
        status: 500,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify({
      success: true,
      message: "Signup successful. Check your email for verification code.",
      expiresAt: signupData.expiresAt
    }), {
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: "Failed to sign up",
      message: error.message
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handlePublicSignup, "handlePublicSignup");
async function handleVerifySignup(request, env) {
  try {
    const body = await request.json();
    const { email, token, code } = body;
    if (!email) {
      return new Response(JSON.stringify({ error: "Email required" }), {
        status: 400,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    if (!token && !code) {
      return new Response(JSON.stringify({ error: "Token or code required" }), {
        status: 400,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const emailLower = email.toLowerCase().trim();
    const emailHash = await hashEmail2(emailLower);
    const signupKey = `signup_${emailHash}`;
    const signupData = await env.OTP_AUTH_KV.get(signupKey, { type: "json" });
    if (!signupData) {
      return new Response(JSON.stringify({ error: "Signup not found or expired" }), {
        status: 404,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    if (new Date(signupData.expiresAt) < /* @__PURE__ */ new Date()) {
      await env.OTP_AUTH_KV.delete(signupKey);
      return new Response(JSON.stringify({ error: "Verification expired" }), {
        status: 400,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const isValid = token && signupData.verificationToken === token || code && signupData.verificationCode === code;
    if (!isValid) {
      return new Response(JSON.stringify({ error: "Invalid verification token or code" }), {
        status: 401,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const customerId = generateCustomerId();
    const customerData = {
      customerId,
      name: signupData.companyName,
      email: emailLower,
      companyName: signupData.companyName,
      plan: "free",
      status: "active",
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      passwordHash: signupData.passwordHash,
      configVersion: 1,
      config: {
        emailConfig: {
          fromEmail: null,
          fromName: signupData.companyName,
          subjectTemplate: "Your {{appName}} Verification Code",
          htmlTemplate: null,
          textTemplate: null,
          variables: {
            appName: signupData.companyName,
            brandColor: "#007bff",
            footerText: `\xA9 ${(/* @__PURE__ */ new Date()).getFullYear()} ${signupData.companyName}`,
            supportUrl: null,
            logoUrl: null
          }
        },
        rateLimits: {
          otpRequestsPerHour: 3,
          otpRequestsPerDay: 50,
          maxUsers: 100
        },
        webhookConfig: {
          url: null,
          secret: null,
          events: []
        },
        allowedOrigins: []
      },
      features: {
        customEmailTemplates: false,
        webhooks: false,
        analytics: false,
        sso: false
      }
    };
    await storeCustomer(customerId, customerData, env);
    const { apiKey, keyId } = await createApiKeyForCustomer(customerId, "Initial API Key", env);
    await env.OTP_AUTH_KV.delete(signupKey);
    return new Response(JSON.stringify({
      success: true,
      customerId,
      apiKey,
      // Only returned once!
      keyId,
      message: "Account verified and created successfully. Save your API key - it will not be shown again.",
      customer: {
        customerId,
        name: customerData.name,
        email: customerData.email,
        companyName: customerData.companyName,
        plan: customerData.plan,
        status: customerData.status
      }
    }), {
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: "Failed to verify signup",
      message: error.message
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleVerifySignup, "handleVerifySignup");
async function handleRegisterCustomer(request, env) {
  try {
    const body = await request.json();
    const { name, email, companyName, plan = "free" } = body;
    if (!name || !email || !companyName) {
      return new Response(JSON.stringify({ error: "Name, email, and company name are required" }), {
        status: 400,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "Valid email address required" }), {
        status: 400,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const customerId = generateCustomerId();
    const customerData = {
      customerId,
      name,
      email: email.toLowerCase().trim(),
      companyName,
      plan,
      status: "pending_verification",
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      configVersion: 1,
      config: {
        emailConfig: {
          fromEmail: null,
          // Will be set when domain is verified
          fromName: companyName,
          subjectTemplate: "Your {{appName}} Verification Code",
          htmlTemplate: null,
          // Default template used if null
          textTemplate: null,
          variables: {
            appName: companyName,
            brandColor: "#007bff",
            footerText: `\xA9 ${(/* @__PURE__ */ new Date()).getFullYear()} ${companyName}`,
            supportUrl: null,
            logoUrl: null
          }
        },
        rateLimits: {
          otpRequestsPerHour: 10,
          // Default, will be overridden by plan
          otpRequestsPerDay: 100,
          maxUsers: 1e4
        },
        webhookConfig: {
          url: null,
          secret: null,
          events: []
        },
        allowedOrigins: [],
        // Empty = allow all (for development)
        allowedIPs: []
        // Empty = allow all IPs
      },
      features: {
        customEmailTemplates: plan !== "free",
        webhooks: plan !== "free",
        analytics: plan !== "free",
        sso: plan === "enterprise"
      }
    };
    if (plan === "free") {
      customerData.config.rateLimits = {
        otpRequestsPerHour: 3,
        otpRequestsPerDay: 50,
        maxUsers: 100
      };
    } else if (plan === "starter") {
      customerData.config.rateLimits = {
        otpRequestsPerHour: 10,
        otpRequestsPerDay: 500,
        maxUsers: 1e3
      };
    } else if (plan === "pro") {
      customerData.config.rateLimits = {
        otpRequestsPerHour: 50,
        otpRequestsPerDay: 5e3,
        maxUsers: 1e4
      };
    } else if (plan === "enterprise") {
      customerData.config.rateLimits = {
        otpRequestsPerHour: 1e3,
        otpRequestsPerDay: 1e5,
        maxUsers: 1e6
      };
    }
    await storeCustomer(customerId, customerData, env);
    const { apiKey, keyId } = await createApiKeyForCustomer(customerId, "Initial API Key", env);
    return new Response(JSON.stringify({
      success: true,
      customerId,
      apiKey,
      // Only returned once!
      keyId,
      message: "Customer registered successfully. Save your API key - it will not be shown again.",
      customer: {
        customerId,
        name,
        email: customerData.email,
        companyName,
        plan,
        status: customerData.status
      }
    }), {
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Customer registration error:", error);
    return new Response(JSON.stringify({
      error: "Failed to register customer",
      message: error.message,
      details: env.ENVIRONMENT === "development" ? error.stack : void 0
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleRegisterCustomer, "handleRegisterCustomer");
async function handleListApiKeys(request, env, customerId) {
  try {
    const customerApiKeysKey = `customer_${customerId}_apikeys`;
    const keys = await env.OTP_AUTH_KV.get(customerApiKeysKey, { type: "json" }) || [];
    const keysMetadata = keys.map((k) => ({
      keyId: k.keyId,
      name: k.name,
      createdAt: k.createdAt,
      lastUsed: k.lastUsed,
      status: k.status
    }));
    return new Response(JSON.stringify({
      success: true,
      keys: keysMetadata
    }), {
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: "Failed to list API keys",
      message: error.message
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleListApiKeys, "handleListApiKeys");
async function handleCreateApiKey(request, env, customerId) {
  try {
    const body = await request.json();
    const { name = "New API Key" } = body;
    const customer = await getCustomer(customerId, env);
    if (!customer) {
      return new Response(JSON.stringify({ error: "Customer not found" }), {
        status: 404,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const { apiKey, keyId } = await createApiKeyForCustomer(customerId, name, env);
    return new Response(JSON.stringify({
      success: true,
      apiKey,
      // Only returned once!
      keyId,
      name,
      message: "API key created successfully. Save your API key - it will not be shown again."
    }), {
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: "Failed to create API key",
      message: error.message
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleCreateApiKey, "handleCreateApiKey");
function validateEmailTemplate(template) {
  if (!template) return true;
  return template.includes("{{otp}}");
}
__name(validateEmailTemplate, "validateEmailTemplate");
async function validateCustomerConfig(config, customer) {
  const errors = [];
  if (config.emailConfig) {
    if (config.emailConfig.fromEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.emailConfig.fromEmail)) {
      errors.push("Invalid fromEmail format");
    }
    if (config.emailConfig.htmlTemplate && !validateEmailTemplate(config.emailConfig.htmlTemplate)) {
      errors.push("HTML template must contain {{otp}} variable");
    }
    if (config.emailConfig.textTemplate && !validateEmailTemplate(config.emailConfig.textTemplate)) {
      errors.push("Text template must contain {{otp}} variable");
    }
  }
  if (config.rateLimits) {
    const planLimits = getPlanLimits2(customer.plan);
    if (config.rateLimits.otpRequestsPerHour > planLimits.otpRequestsPerHour) {
      errors.push(`otpRequestsPerHour cannot exceed plan limit of ${planLimits.otpRequestsPerHour}`);
    }
    if (config.rateLimits.otpRequestsPerDay > planLimits.otpRequestsPerDay) {
      errors.push(`otpRequestsPerDay cannot exceed plan limit of ${planLimits.otpRequestsPerDay}`);
    }
    if (config.rateLimits.maxUsers > planLimits.maxUsers) {
      errors.push(`maxUsers cannot exceed plan limit of ${planLimits.maxUsers}`);
    }
  }
  if (config.webhookConfig && config.webhookConfig.url) {
    try {
      new URL(config.webhookConfig.url);
    } catch (e) {
      errors.push("Invalid webhook URL format");
    }
  }
  if (config.allowedOrigins && !Array.isArray(config.allowedOrigins)) {
    errors.push("allowedOrigins must be an array");
  }
  return {
    valid: errors.length === 0,
    errors
  };
}
__name(validateCustomerConfig, "validateCustomerConfig");
function getPlanLimits2(plan) {
  const limits = {
    free: {
      otpRequestsPerHour: 3,
      otpRequestsPerDay: 1e3,
      // Hard cap for free tier
      otpRequestsPerMonth: 1e4,
      // Hard cap for free tier
      ipRequestsPerHour: 10,
      ipRequestsPerDay: 50,
      maxUsers: 100
    },
    starter: {
      otpRequestsPerHour: 10,
      otpRequestsPerDay: 500,
      otpRequestsPerMonth: 5e3,
      ipRequestsPerHour: 20,
      ipRequestsPerDay: 200,
      maxUsers: 1e3
    },
    pro: {
      otpRequestsPerHour: 50,
      otpRequestsPerDay: 5e3,
      otpRequestsPerMonth: 1e5,
      ipRequestsPerHour: 200,
      ipRequestsPerDay: 2e3,
      maxUsers: 1e4
    },
    enterprise: {
      otpRequestsPerHour: 1e3,
      otpRequestsPerDay: 1e5,
      otpRequestsPerMonth: 1e6,
      ipRequestsPerHour: 5e3,
      ipRequestsPerDay: 5e4,
      maxUsers: 1e6
    }
  };
  return limits[plan] || limits.free;
}
__name(getPlanLimits2, "getPlanLimits");
async function handleGetConfig(request, env, customerId) {
  try {
    const customer = await getCustomer(customerId, env);
    if (!customer) {
      return new Response(JSON.stringify({ error: "Customer not found" }), {
        status: 404,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify({
      success: true,
      config: customer.config || {},
      configVersion: customer.configVersion || 1,
      plan: customer.plan,
      features: customer.features
    }), {
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: "Failed to get configuration",
      message: error.message
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleGetConfig, "handleGetConfig");
async function handleUpdateConfig(request, env, customerId) {
  try {
    const customer = await getCustomer(customerId, env);
    if (!customer) {
      return new Response(JSON.stringify({ error: "Customer not found" }), {
        status: 404,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const body = await request.json();
    const { config } = body;
    if (!config) {
      return new Response(JSON.stringify({ error: "Configuration object required" }), {
        status: 400,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const existingConfig = customer.config || {};
    const mergedConfig = {
      emailConfig: { ...existingConfig.emailConfig, ...config.emailConfig || {} },
      rateLimits: { ...existingConfig.rateLimits, ...config.rateLimits || {} },
      webhookConfig: { ...existingConfig.webhookConfig, ...config.webhookConfig || {} },
      allowedOrigins: config.allowedOrigins !== void 0 ? config.allowedOrigins : existingConfig.allowedOrigins
    };
    const validation = await validateCustomerConfig(mergedConfig, customer);
    if (!validation.valid) {
      return new Response(JSON.stringify({
        error: "Invalid configuration",
        errors: validation.errors
      }), {
        status: 400,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    customer.config = mergedConfig;
    customer.configVersion = (customer.configVersion || 1) + 1;
    customer.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    await storeCustomer(customerId, customer, env);
    invalidateCustomerCache2(customerId);
    return new Response(JSON.stringify({
      success: true,
      config: customer.config,
      configVersion: customer.configVersion,
      message: "Configuration updated successfully"
    }), {
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: "Failed to update configuration",
      message: error.message
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleUpdateConfig, "handleUpdateConfig");
async function handleUpdateEmailConfig(request, env, customerId) {
  try {
    const customer = await getCustomer(customerId, env);
    if (!customer) {
      return new Response(JSON.stringify({ error: "Customer not found" }), {
        status: 404,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const body = await request.json();
    const emailConfig = body;
    const existingConfig = customer.config || {};
    const existingEmailConfig = existingConfig.emailConfig || {};
    const mergedEmailConfig = { ...existingEmailConfig, ...emailConfig };
    const validation = await validateCustomerConfig({ emailConfig: mergedEmailConfig }, customer);
    if (!validation.valid) {
      return new Response(JSON.stringify({
        error: "Invalid email configuration",
        errors: validation.errors
      }), {
        status: 400,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    if (!customer.config) customer.config = {};
    customer.config.emailConfig = mergedEmailConfig;
    customer.configVersion = (customer.configVersion || 1) + 1;
    customer.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    await storeCustomer(customerId, customer, env);
    invalidateCustomerCache2(customerId);
    return new Response(JSON.stringify({
      success: true,
      emailConfig: customer.config.emailConfig,
      message: "Email configuration updated successfully"
    }), {
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: "Failed to update email configuration",
      message: error.message
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleUpdateEmailConfig, "handleUpdateEmailConfig");
async function handleUpdateCustomerStatus(request, env, customerId, newStatus) {
  try {
    const customer = await getCustomer(customerId, env);
    if (!customer) {
      return new Response(JSON.stringify({ error: "Customer not found" }), {
        status: 404,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const validStatuses = ["active", "suspended", "cancelled", "pending_verification"];
    if (!validStatuses.includes(newStatus)) {
      return new Response(JSON.stringify({
        error: "Invalid status",
        validStatuses
      }), {
        status: 400,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const oldStatus = customer.status;
    customer.status = newStatus;
    customer.statusChangedAt = (/* @__PURE__ */ new Date()).toISOString();
    customer.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    await storeCustomer(customerId, customer, env);
    console.log(`Customer ${customerId} status changed from ${oldStatus} to ${newStatus}`);
    return new Response(JSON.stringify({
      success: true,
      customerId,
      oldStatus,
      newStatus,
      statusChangedAt: customer.statusChangedAt,
      message: `Customer status updated to ${newStatus}`
    }), {
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: "Failed to update customer status",
      message: error.message
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleUpdateCustomerStatus, "handleUpdateCustomerStatus");
async function handleSuspendCustomer(request, env, customerId) {
  return handleUpdateCustomerStatus(request, env, customerId, "suspended");
}
__name(handleSuspendCustomer, "handleSuspendCustomer");
async function handleActivateCustomer(request, env, customerId) {
  return handleUpdateCustomerStatus(request, env, customerId, "active");
}
__name(handleActivateCustomer, "handleActivateCustomer");
async function handleAdminGetMe(request, env, customerId) {
  try {
    const customer = await getCustomer(customerId, env);
    if (!customer) {
      return new Response(JSON.stringify({ error: "Customer not found" }), {
        status: 404,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify({
      success: true,
      customer: {
        customerId: customer.customerId,
        name: customer.name,
        email: customer.email,
        companyName: customer.companyName,
        plan: customer.plan,
        status: customer.status,
        createdAt: customer.createdAt,
        features: customer.features
      }
    }), {
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: "Failed to get customer info",
      message: error.message
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleAdminGetMe, "handleAdminGetMe");
async function handleUpdateMe(request, env, customerId) {
  try {
    const customer = await getCustomer(customerId, env);
    if (!customer) {
      return new Response(JSON.stringify({ error: "Customer not found" }), {
        status: 404,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const body = await request.json();
    const { name, companyName } = body;
    if (name !== void 0) {
      customer.name = name;
    }
    if (companyName !== void 0) {
      customer.companyName = companyName;
    }
    customer.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    await storeCustomer(customerId, customer, env);
    return new Response(JSON.stringify({
      success: true,
      customer: {
        customerId: customer.customerId,
        name: customer.name,
        email: customer.email,
        companyName: customer.companyName,
        plan: customer.plan,
        status: customer.status
      },
      message: "Customer info updated successfully"
    }), {
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: "Failed to update customer info",
      message: error.message
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleUpdateMe, "handleUpdateMe");
function generateVerificationToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(generateVerificationToken, "generateVerificationToken");
async function verifyDomainDNS(domain, token) {
  try {
    const dnsQuery = `_otpauth-verify.${domain}`;
    const dohUrl = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(dnsQuery)}&type=TXT`;
    const response = await fetch(dohUrl, {
      headers: {
        "Accept": "application/dns-json"
      }
    });
    if (!response.ok) {
      return false;
    }
    const data = await response.json();
    if (data.Answer && Array.isArray(data.Answer)) {
      for (const answer of data.Answer) {
        if (answer.type === 16 && answer.data) {
          const recordValue = answer.data.replace(/^"|"$/g, "");
          if (recordValue === token) {
            return true;
          }
        }
      }
    }
    return false;
  } catch (error) {
    console.error("DNS verification error:", error);
    return false;
  }
}
__name(verifyDomainDNS, "verifyDomainDNS");
async function handleRequestDomainVerification(request, env, customerId) {
  try {
    const body = await request.json();
    const { domain } = body;
    if (!domain || !/^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/.test(domain)) {
      return new Response(JSON.stringify({ error: "Valid domain name required" }), {
        status: 400,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const token = generateVerificationToken();
    const domainKey = `domain_${domain}`;
    const verificationData = {
      domain,
      customerId,
      token,
      status: "pending",
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3).toISOString()
      // 7 days
    };
    await env.OTP_AUTH_KV.put(domainKey, JSON.stringify(verificationData), { expirationTtl: 604800 });
    const dnsRecord = {
      type: "TXT",
      name: `_otpauth-verify.${domain}`,
      value: token,
      ttl: 3600
    };
    return new Response(JSON.stringify({
      success: true,
      domain,
      status: "pending",
      dnsRecord,
      instructions: `Add a TXT record to your DNS with name "_otpauth-verify.${domain}" and value "${token}". Then call POST /admin/domains/${domain}/verify to check verification.`
    }), {
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: "Failed to request domain verification",
      message: error.message
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleRequestDomainVerification, "handleRequestDomainVerification");
async function handleGetDomainStatus(request, env, domain) {
  try {
    const domainKey = `domain_${domain}`;
    const verificationData = await env.OTP_AUTH_KV.get(domainKey, { type: "json" });
    if (!verificationData) {
      return new Response(JSON.stringify({
        error: "Domain verification not found",
        domain,
        status: "not_started"
      }), {
        status: 404,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify({
      success: true,
      domain: verificationData.domain,
      status: verificationData.status,
      createdAt: verificationData.createdAt,
      verifiedAt: verificationData.verifiedAt || null,
      expiresAt: verificationData.expiresAt
    }), {
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: "Failed to get domain status",
      message: error.message
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleGetDomainStatus, "handleGetDomainStatus");
async function handleVerifyDomain(request, env, customerId, domain) {
  try {
    const domainKey = `domain_${domain}`;
    const verificationData = await env.OTP_AUTH_KV.get(domainKey, { type: "json" });
    if (!verificationData) {
      return new Response(JSON.stringify({
        error: "Domain verification not found. Request verification first.",
        domain
      }), {
        status: 404,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    if (verificationData.customerId !== customerId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    if (verificationData.status === "verified") {
      return new Response(JSON.stringify({
        success: true,
        domain,
        status: "verified",
        verifiedAt: verificationData.verifiedAt,
        message: "Domain is already verified"
      }), {
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    if (new Date(verificationData.expiresAt) < /* @__PURE__ */ new Date()) {
      return new Response(JSON.stringify({
        error: "Verification expired. Please request a new verification.",
        domain
      }), {
        status: 400,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const isVerified = await verifyDomainDNS(domain, verificationData.token);
    if (isVerified) {
      verificationData.status = "verified";
      verificationData.verifiedAt = (/* @__PURE__ */ new Date()).toISOString();
      await env.OTP_AUTH_KV.put(domainKey, JSON.stringify(verificationData));
      const customer = await getCustomer(customerId, env);
      if (customer) {
        if (!customer.config) customer.config = {};
        if (!customer.config.emailConfig) customer.config.emailConfig = {};
        if (!customer.config.emailConfig.fromEmail) {
          customer.config.emailConfig.fromEmail = `noreply@${domain}`;
        }
        await storeCustomer(customerId, customer, env);
      }
      return new Response(JSON.stringify({
        success: true,
        domain,
        status: "verified",
        verifiedAt: verificationData.verifiedAt,
        message: "Domain verified successfully"
      }), {
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    } else {
      return new Response(JSON.stringify({
        success: false,
        domain,
        status: "pending",
        message: "DNS record not found or token mismatch. Please check your DNS configuration."
      }), {
        status: 400,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({
      error: "Failed to verify domain",
      message: error.message
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleVerifyDomain, "handleVerifyDomain");
async function checkQuota2(customerId, env) {
  return checkQuota(customerId, async (id) => await getCustomerCached2(id, env), getPlanLimits2, env);
}
__name(checkQuota2, "checkQuota");
async function handleGetAnalytics(request, env, customerId) {
  try {
    const url = new URL(request.url);
    const startDate = url.searchParams.get("startDate") || new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3).toISOString().split("T")[0];
    const endDate = url.searchParams.get("endDate") || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const granularity = url.searchParams.get("granularity") || "day";
    const usage = await getUsage(customerId, startDate, endDate, env);
    const metrics = {
      otpRequests: usage.otpRequests,
      otpVerifications: usage.otpVerifications,
      successRate: parseFloat(usage.successRate),
      emailsSent: usage.emailsSent,
      uniqueUsers: 0,
      // TODO: Track unique users
      newUsers: 0
      // TODO: Track new users
    };
    const response = {
      success: true,
      period: {
        start: startDate,
        end: endDate
      },
      metrics,
      dailyBreakdown: granularity === "day" ? usage.dailyBreakdown : void 0
    };
    return new Response(JSON.stringify(response), {
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: "Failed to get analytics",
      message: error.message
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleGetAnalytics, "handleGetAnalytics");
async function handleGetRealtimeAnalytics(request, env, customerId) {
  try {
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const now = /* @__PURE__ */ new Date();
    const todayUsage = await env.OTP_AUTH_KV.get(`usage_${customerId}_${today}`, { type: "json" }) || {};
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];
    const yesterdayUsage = await env.OTP_AUTH_KV.get(`usage_${customerId}_${yesterdayStr}`, { type: "json" }) || {};
    const last24Hours = {
      otpRequests: (todayUsage.otpRequests || 0) + (yesterdayUsage.otpRequests || 0),
      otpVerifications: (todayUsage.otpVerifications || 0) + (yesterdayUsage.otpVerifications || 0)
    };
    const responseTimeMetrics = {};
    const endpoints = ["request-otp", "verify-otp", "me", "logout", "refresh"];
    for (const endpoint of endpoints) {
      const metricsKey = `metrics_${customerId}_${today}_${endpoint}`;
      const metrics = await env.OTP_AUTH_KV.get(metricsKey, { type: "json" });
      if (metrics) {
        responseTimeMetrics[endpoint] = {
          avg: metrics.avgResponseTime || 0,
          p50: metrics.p50ResponseTime || 0,
          p95: metrics.p95ResponseTime || 0,
          p99: metrics.p99ResponseTime || 0
        };
      }
    }
    const errorKey = `errors_${customerId}_${today}`;
    const errorData = await env.OTP_AUTH_KV.get(errorKey, { type: "json" }) || { total: 0 };
    const totalRequests = todayUsage.otpRequests || 0;
    const errorRate = totalRequests > 0 ? (errorData.total / totalRequests * 100).toFixed(2) : 0;
    return new Response(JSON.stringify({
      success: true,
      currentHour: {
        otpRequests: todayUsage.otpRequests || 0,
        otpVerifications: todayUsage.otpVerifications || 0,
        activeUsers: 0
        // TODO: Track active users
      },
      last24Hours,
      responseTimeMetrics,
      errorRate: parseFloat(errorRate),
      lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
    }), {
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: "Failed to get real-time analytics",
      message: error.message
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleGetRealtimeAnalytics, "handleGetRealtimeAnalytics");
async function handleGetErrorAnalytics(request, env, customerId) {
  try {
    const url = new URL(request.url);
    const startDate = url.searchParams.get("startDate") || new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3).toISOString().split("T")[0];
    const endDate = url.searchParams.get("endDate") || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const category = url.searchParams.get("category");
    const errors = [];
    const byCategory = {};
    const byEndpoint = {};
    let total = 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split("T")[0];
      const errorKey = `errors_${customerId}_${dateStr}`;
      const dayErrors = await env.OTP_AUTH_KV.get(errorKey, { type: "json" });
      if (dayErrors) {
        const filteredErrors = category ? dayErrors.errors.filter((e) => e.category === category) : dayErrors.errors;
        errors.push(...filteredErrors);
        for (const [cat, count] of Object.entries(dayErrors.byCategory || {})) {
          if (!category || cat === category) {
            byCategory[cat] = (byCategory[cat] || 0) + count;
          }
        }
        for (const [ep, count] of Object.entries(dayErrors.byEndpoint || {})) {
          byEndpoint[ep] = (byEndpoint[ep] || 0) + count;
        }
        total += category ? filteredErrors.length : dayErrors.total;
      }
    }
    return new Response(JSON.stringify({
      success: true,
      period: { start: startDate, end: endDate },
      total,
      byCategory,
      byEndpoint,
      recentErrors: errors.slice(-100)
      // Last 100 errors
    }), {
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: "Failed to get error analytics",
      message: error.message
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleGetErrorAnalytics, "handleGetErrorAnalytics");
async function handleRotateApiKey(request, env, customerId, keyId) {
  try {
    const customerApiKeysKey = `customer_${customerId}_apikeys`;
    const customerKeys = await env.OTP_AUTH_KV.get(customerApiKeysKey, { type: "json" }) || [];
    const keyIndex = customerKeys.findIndex((k) => k.keyId === keyId);
    if (keyIndex < 0) {
      return new Response(JSON.stringify({ error: "API key not found" }), {
        status: 404,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const { apiKey: newApiKey, keyId: newKeyId } = await createApiKeyForCustomer(
      customerId,
      `${customerKeys[keyIndex].name} (rotated)`,
      env
    );
    customerKeys[keyIndex].status = "rotated";
    customerKeys[keyIndex].rotatedAt = (/* @__PURE__ */ new Date()).toISOString();
    customerKeys[keyIndex].replacedBy = newKeyId;
    await env.OTP_AUTH_KV.put(customerApiKeysKey, JSON.stringify(customerKeys));
    await logSecurityEvent(customerId, "api_key_rotated", {
      oldKeyId: keyId,
      newKeyId
    }, env);
    return new Response(JSON.stringify({
      success: true,
      apiKey: newApiKey,
      // Only returned once!
      keyId: newKeyId,
      oldKeyId: keyId,
      message: "API key rotated successfully. Old key will work for 7 days. Save your new API key - it will not be shown again."
    }), {
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: "Failed to rotate API key",
      message: error.message
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleRotateApiKey, "handleRotateApiKey");
async function handleGetOnboarding(request, env, customerId) {
  try {
    const onboardingKey = `onboarding_${customerId}`;
    const onboarding = await env.OTP_AUTH_KV.get(onboardingKey, { type: "json" }) || {
      customerId,
      step: 1,
      completed: false,
      steps: {
        accountCreated: false,
        emailVerified: false,
        apiKeyGenerated: false,
        firstTestCompleted: false,
        webhookConfigured: false,
        emailTemplateConfigured: false
      },
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    return new Response(JSON.stringify({
      success: true,
      onboarding
    }), {
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: "Failed to get onboarding status",
      message: error.message
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleGetOnboarding, "handleGetOnboarding");
async function handleUpdateOnboarding(request, env, customerId) {
  try {
    const body = await request.json();
    const { step, completed, steps } = body;
    const onboardingKey = `onboarding_${customerId}`;
    const existing = await env.OTP_AUTH_KV.get(onboardingKey, { type: "json" }) || {
      customerId,
      step: 1,
      completed: false,
      steps: {
        accountCreated: false,
        emailVerified: false,
        apiKeyGenerated: false,
        firstTestCompleted: false,
        webhookConfigured: false,
        emailTemplateConfigured: false
      },
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (step !== void 0) existing.step = step;
    if (completed !== void 0) existing.completed = completed;
    if (steps) existing.steps = { ...existing.steps, ...steps };
    existing.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    await env.OTP_AUTH_KV.put(onboardingKey, JSON.stringify(existing), { expirationTtl: 2592e3 });
    return new Response(JSON.stringify({
      success: true,
      onboarding: existing
    }), {
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: "Failed to update onboarding",
      message: error.message
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleUpdateOnboarding, "handleUpdateOnboarding");
async function handleTestOTP(request, env, customerId) {
  try {
    const body = await request.json();
    const { email } = body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "Valid email address required" }), {
        status: 400,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const testRequest = new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify({ email })
    });
    const response = await handleRequestOTP(testRequest, env, customerId);
    if (response.ok) {
      const onboardingKey = `onboarding_${customerId}`;
      const onboarding = await env.OTP_AUTH_KV.get(onboardingKey, { type: "json" }) || {};
      onboarding.steps = onboarding.steps || {};
      onboarding.steps.firstTestCompleted = true;
      onboarding.step = Math.max(onboarding.step || 1, 4);
      await env.OTP_AUTH_KV.put(onboardingKey, JSON.stringify(onboarding), { expirationTtl: 2592e3 });
    }
    return response;
  } catch (error) {
    return new Response(JSON.stringify({
      error: "Failed to test OTP",
      message: error.message
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleTestOTP, "handleTestOTP");
async function handleExportUserData(request, env, customerId, userId) {
  try {
    const userKey = getCustomerKey(customerId, `user_${userId.replace("user_", "")}`);
    const user = await env.OTP_AUTH_KV.get(userKey, { type: "json" });
    if (!user) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const emailHash = await hashEmail2(user.email);
    const exportData = {
      userId: user.userId,
      email: user.email,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin
      // Note: OTP codes are not stored after use, so no OTP history
      // Sessions are stored but don't contain sensitive data
    };
    return new Response(JSON.stringify({
      success: true,
      data: exportData,
      exportedAt: (/* @__PURE__ */ new Date()).toISOString()
    }), {
      headers: {
        ...getCorsHeaders2(env, request),
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="user-data-${userId}.json"`
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: "Failed to export user data",
      message: error.message
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleExportUserData, "handleExportUserData");
async function handleDeleteUserData(request, env, customerId, userId) {
  try {
    const userKey = getCustomerKey(customerId, `user_${userId.replace("user_", "")}`);
    const user = await env.OTP_AUTH_KV.get(userKey, { type: "json" });
    if (!user) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const emailHash = await hashEmail2(user.email);
    await env.OTP_AUTH_KV.delete(userKey);
    const sessionKey = getCustomerKey(customerId, `session_${userId}`);
    await env.OTP_AUTH_KV.delete(sessionKey);
    const latestOtpKey = getCustomerKey(customerId, `otp_latest_${emailHash}`);
    await env.OTP_AUTH_KV.delete(latestOtpKey);
    await logSecurityEvent(customerId, "user_data_deleted", {
      userId,
      email: user.email,
      deletedAt: (/* @__PURE__ */ new Date()).toISOString()
    }, env);
    return new Response(JSON.stringify({
      success: true,
      message: "User data deleted successfully"
    }), {
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: "Failed to delete user data",
      message: error.message
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleDeleteUserData, "handleDeleteUserData");
async function handleGetAuditLogs(request, env, customerId) {
  try {
    const url = new URL(request.url);
    const startDate = url.searchParams.get("startDate") || new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3).toISOString().split("T")[0];
    const endDate = url.searchParams.get("endDate") || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const eventType = url.searchParams.get("eventType");
    const events = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split("T")[0];
      const auditKey = `audit_${customerId}_${dateStr}`;
      const dayAudit = await env.OTP_AUTH_KV.get(auditKey, { type: "json" });
      if (dayAudit && dayAudit.events) {
        const filteredEvents = eventType ? dayAudit.events.filter((e) => e.eventType === eventType) : dayAudit.events;
        events.push(...filteredEvents);
      }
    }
    events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return new Response(JSON.stringify({
      success: true,
      period: { start: startDate, end: endDate },
      total: events.length,
      events: events.slice(0, 1e3)
      // Limit to 1000 most recent
    }), {
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: "Failed to get audit logs",
      message: error.message
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleGetAuditLogs, "handleGetAuditLogs");
async function handleRevokeApiKey(request, env, customerId, keyId) {
  try {
    const customerApiKeysKey = `customer_${customerId}_apikeys`;
    const customerKeys = await env.OTP_AUTH_KV.get(customerApiKeysKey, { type: "json" }) || [];
    const keyIndex = customerKeys.findIndex((k) => k.keyId === keyId);
    if (keyIndex < 0) {
      return new Response(JSON.stringify({ error: "API key not found" }), {
        status: 404,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    customerKeys[keyIndex].status = "revoked";
    customerKeys[keyIndex].revokedAt = (/* @__PURE__ */ new Date()).toISOString();
    await env.OTP_AUTH_KV.put(customerApiKeysKey, JSON.stringify(customerKeys));
    return new Response(JSON.stringify({
      success: true,
      message: "API key revoked successfully"
    }), {
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: "Failed to revoke API key",
      message: error.message
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleRevokeApiKey, "handleRevokeApiKey");
async function handleRequestOTP(request, env, customerId = null) {
  try {
    const body = await request.json();
    const { email } = body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({
        type: "https://tools.ietf.org/html/rfc7231#section-6.5.1",
        title: "Bad Request",
        status: 400,
        detail: "Valid email address required",
        instance: request.url
      }), {
        status: 400,
        headers: {
          ...getCorsHeaders2(env, request),
          "Content-Type": "application/problem+json"
        }
      });
    }
    const quotaCheck = await checkQuota2(customerId, env);
    if (!quotaCheck.allowed) {
      if (customerId) {
        await sendWebhook(customerId, "quota.exceeded", {
          reason: quotaCheck.reason,
          quota: quotaCheck.quota,
          usage: quotaCheck.usage
        }, env);
      }
      return new Response(JSON.stringify({
        type: "https://tools.ietf.org/html/rfc6585#section-4",
        title: "Too Many Requests",
        status: 429,
        detail: "Quota exceeded",
        instance: request.url,
        reason: quotaCheck.reason,
        quota: quotaCheck.quota,
        usage: quotaCheck.usage
      }), {
        status: 429,
        headers: {
          ...getCorsHeaders2(env, request),
          "Content-Type": "application/problem+json",
          "X-Quota-Limit": quotaCheck.quota?.otpRequestsPerDay?.toString() || "",
          "X-Quota-Remaining": quotaCheck.usage?.remainingDaily?.toString() || "0",
          "Retry-After": "3600"
          // Retry after 1 hour
        }
      });
    }
    const emailHash = await hashEmail2(email);
    const clientIP = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "unknown";
    const rateLimit = await checkOTPRateLimit2(emailHash, customerId, clientIP, env);
    if (!rateLimit.allowed) {
      await recordOTPFailure2(emailHash, clientIP, customerId, env);
      return new Response(JSON.stringify({
        type: "https://tools.ietf.org/html/rfc6585#section-4",
        title: "Too Many Requests",
        status: 429,
        detail: "Too many requests. Please try again later.",
        instance: request.url,
        retry_after: Math.ceil((new Date(rateLimit.resetAt).getTime() - Date.now()) / 1e3),
        reset_at: rateLimit.resetAt,
        remaining: rateLimit.remaining,
        reason: rateLimit.reason || "rate_limit_exceeded"
      }), {
        status: 429,
        headers: {
          ...getCorsHeaders2(env, request),
          "Content-Type": "application/problem+json",
          "Retry-After": Math.ceil((new Date(rateLimit.resetAt).getTime() - Date.now()) / 1e3).toString()
        }
      });
    }
    const otp = generateOTP2();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1e3);
    const otpKey = getCustomerKey(customerId, `otp_${emailHash}_${Date.now()}`);
    await env.OTP_AUTH_KV.put(otpKey, JSON.stringify({
      email: email.toLowerCase().trim(),
      otp,
      expiresAt: expiresAt.toISOString(),
      attempts: 0
    }), { expirationTtl: 600 });
    const latestOtpKey = getCustomerKey(customerId, `otp_latest_${emailHash}`);
    await env.OTP_AUTH_KV.put(latestOtpKey, otpKey, { expirationTtl: 600 });
    try {
      const emailResult = await sendOTPEmail(email, otp, customerId, env);
      console.log("OTP email sent successfully:", emailResult);
      if (customerId) {
        await trackUsage(customerId, "otpRequests", 1, env);
        await trackUsage(customerId, "emailsSent", 1, env);
        await sendWebhook(customerId, "otp.requested", {
          email: email.toLowerCase().trim(),
          expiresIn: 600
        }, env);
      }
      await recordOTPRequest2(emailHash, clientIP, customerId, env);
    } catch (error) {
      console.error("Failed to send OTP email:", {
        message: error.message,
        stack: error.stack,
        email: email.toLowerCase().trim(),
        hasResendKey: !!env.RESEND_API_KEY
      });
      return new Response(JSON.stringify({
        error: "Failed to send email. Please check your email address and try again.",
        details: env.ENVIRONMENT === "development" ? error.message : void 0
      }), {
        status: 500,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify({
      success: true,
      message: "OTP sent to email",
      expiresIn: 600,
      remaining: rateLimit.remaining
    }), {
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("OTP request error:", {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return new Response(JSON.stringify({
      type: "https://tools.ietf.org/html/rfc7231#section-6.6.1",
      title: "Internal Server Error",
      status: 500,
      detail: "Failed to request OTP",
      instance: request.url
    }), {
      status: 500,
      headers: {
        ...getCorsHeaders2(env, request),
        "Content-Type": "application/problem+json"
      }
    });
  }
}
__name(handleRequestOTP, "handleRequestOTP");
async function handleVerifyOTP(request, env, customerId = null) {
  try {
    const body = await request.json();
    const { email, otp } = body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({
        type: "https://tools.ietf.org/html/rfc7231#section-6.5.1",
        title: "Bad Request",
        status: 400,
        detail: "Valid email address required",
        instance: request.url
      }), {
        status: 400,
        headers: {
          ...getCorsHeaders2(env, request),
          "Content-Type": "application/problem+json"
        }
      });
    }
    if (!otp || !/^\d{6}$/.test(otp)) {
      return new Response(JSON.stringify({
        type: "https://tools.ietf.org/html/rfc7231#section-6.5.1",
        title: "Bad Request",
        status: 400,
        detail: "Valid 6-digit OTP required",
        instance: request.url
      }), {
        status: 400,
        headers: {
          ...getCorsHeaders2(env, request),
          "Content-Type": "application/problem+json"
        }
      });
    }
    const emailHash = await hashEmail2(email);
    const emailLower = email.toLowerCase().trim();
    const latestOtpKey = getCustomerKey(customerId, `otp_latest_${emailHash}`);
    const latestOtpKeyValue = await env.OTP_AUTH_KV.get(latestOtpKey);
    const clientIP = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "unknown";
    const genericOTPError = {
      type: "https://tools.ietf.org/html/rfc7235#section-3.1",
      title: "Unauthorized",
      status: 401,
      detail: "Invalid or expired OTP code. Please request a new OTP code.",
      instance: request.url
    };
    if (!latestOtpKeyValue) {
      await recordOTPFailure2(emailHash, clientIP, customerId, env);
      return new Response(JSON.stringify(genericOTPError), {
        status: 401,
        headers: {
          ...getCorsHeaders2(env, request),
          "Content-Type": "application/problem+json"
        }
      });
    }
    const otpDataStr = await env.OTP_AUTH_KV.get(latestOtpKeyValue);
    if (!otpDataStr) {
      await recordOTPFailure2(emailHash, clientIP, customerId, env);
      return new Response(JSON.stringify(genericOTPError), {
        status: 401,
        headers: {
          ...getCorsHeaders2(env, request),
          "Content-Type": "application/problem+json"
        }
      });
    }
    let otpData;
    try {
      otpData = JSON.parse(otpDataStr);
    } catch (e) {
      await recordOTPFailure2(emailHash, clientIP, customerId, env);
      return new Response(JSON.stringify(genericOTPError), {
        status: 401,
        headers: {
          ...getCorsHeaders2(env, request),
          "Content-Type": "application/problem+json"
        }
      });
    }
    if (!constantTimeEquals2(otpData.email || "", emailLower)) {
      await recordOTPFailure2(emailHash, clientIP, customerId, env);
      return new Response(JSON.stringify(genericOTPError), {
        status: 401,
        headers: {
          ...getCorsHeaders2(env, request),
          "Content-Type": "application/problem+json"
        }
      });
    }
    if (new Date(otpData.expiresAt) < /* @__PURE__ */ new Date()) {
      await env.OTP_AUTH_KV.delete(latestOtpKeyValue);
      await env.OTP_AUTH_KV.delete(latestOtpKey);
      await recordOTPFailure2(emailHash, clientIP, customerId, env);
      return new Response(JSON.stringify(genericOTPError), {
        status: 401,
        headers: {
          ...getCorsHeaders2(env, request),
          "Content-Type": "application/problem+json"
        }
      });
    }
    if (otpData.attempts >= 5) {
      await env.OTP_AUTH_KV.delete(latestOtpKeyValue);
      await env.OTP_AUTH_KV.delete(latestOtpKey);
      await recordOTPFailure2(emailHash, clientIP, customerId, env);
      return new Response(JSON.stringify({
        type: "https://tools.ietf.org/html/rfc6585#section-4",
        title: "Too Many Requests",
        status: 429,
        detail: "Too many attempts. Please request a new OTP.",
        instance: request.url,
        remaining_attempts: 0
      }), {
        status: 429,
        headers: {
          ...getCorsHeaders2(env, request),
          "Content-Type": "application/problem+json"
        }
      });
    }
    const isValidOTP = constantTimeEquals2(otpData.otp || "", otp);
    if (!isValidOTP) {
      otpData.attempts++;
      await env.OTP_AUTH_KV.put(latestOtpKeyValue, JSON.stringify(otpData), { expirationTtl: 600 });
      if (customerId) {
        await trackUsage(customerId, "failedAttempts", 1, env);
        await sendWebhook(customerId, "otp.failed", {
          email: emailLower,
          remainingAttempts: 5 - otpData.attempts
        }, env);
      }
      await recordOTPFailure2(emailHash, clientIP, customerId, env);
      return new Response(JSON.stringify({
        ...genericOTPError,
        remaining_attempts: 5 - otpData.attempts
      }), {
        status: 401,
        headers: {
          ...getCorsHeaders2(env, request),
          "Content-Type": "application/problem+json"
        }
      });
    }
    await env.OTP_AUTH_KV.delete(latestOtpKeyValue);
    await env.OTP_AUTH_KV.delete(latestOtpKey);
    await recordOTPRequest2(emailHash, clientIP, customerId, env);
    if (customerId) {
      await trackUsage(customerId, "otpVerifications", 1, env);
      await trackUsage(customerId, "successfulLogins", 1, env);
      await sendWebhook(customerId, "otp.verified", {
        userId,
        email: emailLower
      }, env);
      const wasNewUser = !user || !user.createdAt || new Date(user.createdAt).toISOString().split("T")[0] === (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      if (wasNewUser) {
        await sendWebhook(customerId, "user.created", {
          userId,
          email: emailLower
        }, env);
      }
      await sendWebhook(customerId, "user.logged_in", {
        userId,
        email: emailLower
      }, env);
    }
    const userId = await generateUserId2(emailLower);
    const userKey = getCustomerKey(customerId, `user_${emailHash}`);
    let user = await env.OTP_AUTH_KV.get(userKey, { type: "json" });
    if (!user) {
      user = {
        userId,
        email: emailLower,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        lastLogin: (/* @__PURE__ */ new Date()).toISOString()
      };
      await env.OTP_AUTH_KV.put(userKey, JSON.stringify(user), { expirationTtl: 31536e3 });
    } else {
      user.lastLogin = (/* @__PURE__ */ new Date()).toISOString();
      await env.OTP_AUTH_KV.put(userKey, JSON.stringify(user), { expirationTtl: 31536e3 });
    }
    const csrfToken = crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16))).map((b) => b.toString(16).padStart(2, "0")).join("");
    const expiresAt = new Date(Date.now() + 7 * 60 * 60 * 1e3);
    const expiresIn = 7 * 60 * 60;
    const now = Math.floor(Date.now() / 1e3);
    const tokenPayload = {
      // Standard JWT Claims
      sub: userId,
      // Subject (user identifier)
      iss: "auth.idling.app",
      // Issuer
      aud: customerId || "default",
      // Audience (customer/tenant)
      exp: Math.floor(expiresAt.getTime() / 1e3),
      // Expiration time
      iat: now,
      // Issued at
      jti: crypto.randomUUID ? crypto.randomUUID() : (
        // JWT ID (unique token identifier)
        Array.from(crypto.getRandomValues(new Uint8Array(16))).map((b) => b.toString(16).padStart(2, "0")).join("")
      ),
      // OAuth 2.0 / OpenID Connect Claims
      email: emailLower,
      email_verified: true,
      // OTP verification confirms email
      // Custom Claims
      userId,
      // Backward compatibility
      customerId: customerId || null,
      // Multi-tenant customer ID
      csrf: csrfToken
      // CSRF token included in JWT
    };
    const jwtSecret = getJWTSecret2(env);
    const accessToken = await createJWT2(tokenPayload, jwtSecret);
    const sessionKey = getCustomerKey(customerId, `session_${userId}`);
    await env.OTP_AUTH_KV.put(sessionKey, JSON.stringify({
      userId,
      email: emailLower,
      token: await hashEmail2(accessToken),
      // Store hash of token
      expiresAt: expiresAt.toISOString(),
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    }), { expirationTtl: 25200 });
    return new Response(JSON.stringify({
      // OAuth 2.0 Standard Fields
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: expiresIn,
      // Additional Standard Fields
      scope: "openid email profile",
      // OIDC scopes
      // User Information (OIDC UserInfo)
      sub: userId,
      // Subject identifier
      email: emailLower,
      email_verified: true,
      // Backward Compatibility (deprecated, use access_token)
      token: accessToken,
      userId,
      expiresAt: expiresAt.toISOString()
    }), {
      headers: {
        ...getCorsHeaders2(env, request),
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        // OAuth 2.0 requirement
        "Pragma": "no-cache"
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: "Failed to verify OTP",
      message: error.message
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleVerifyOTP, "handleVerifyOTP");
async function handleGetMe(request, env) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authorization header required" }), {
        status: 401,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const token = authHeader.substring(7);
    const jwtSecret = getJWTSecret2(env);
    const payload = await verifyJWT2(token, jwtSecret);
    if (!payload) {
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 401,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const customerId = payload.customerId || null;
    const emailHash = await hashEmail2(payload.email);
    const userKey = getCustomerKey(customerId, `user_${emailHash}`);
    const user = await env.OTP_AUTH_KV.get(userKey, { type: "json" });
    if (!user) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify({
      // Standard OIDC Claims
      sub: user.userId,
      // Subject identifier (required)
      email: user.email,
      email_verified: true,
      // Additional Standard Claims
      iss: "auth.idling.app",
      // Issuer
      aud: customerId || "default",
      // Audience
      // Custom Claims (backward compatibility)
      userId: user.userId,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin
    }), {
      headers: {
        ...getCorsHeaders2(env, request),
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        // OAuth 2.0 requirement
        "Pragma": "no-cache"
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      type: "https://tools.ietf.org/html/rfc7231#section-6.6.1",
      title: "Internal Server Error",
      status: 500,
      detail: "Failed to get user info",
      instance: request.url
    }), {
      status: 500,
      headers: {
        ...getCorsHeaders2(env, request),
        "Content-Type": "application/problem+json"
      }
    });
  }
}
__name(handleGetMe, "handleGetMe");
async function handleGetQuota(request, env) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authorization header required" }), {
        status: 401,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const token = authHeader.substring(7);
    const jwtSecret = getJWTSecret2(env);
    const payload = await verifyJWT2(token, jwtSecret);
    if (!payload) {
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 401,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const customerId = payload.customerId || null;
    const quotaInfo = await checkQuota2(customerId, env);
    if (!quotaInfo.allowed && !quotaInfo.quota) {
      return new Response(JSON.stringify({
        success: true,
        quota: {
          otpRequestsPerDay: 1e3,
          otpRequestsPerMonth: 1e4
        },
        usage: {
          daily: 0,
          monthly: 0,
          remainingDaily: 1e3,
          remainingMonthly: 1e4
        }
      }), {
        headers: {
          ...getCorsHeaders2(env, request),
          "Content-Type": "application/json"
        }
      });
    }
    return new Response(JSON.stringify({
      success: true,
      quota: quotaInfo.quota || {
        otpRequestsPerDay: 1e3,
        otpRequestsPerMonth: 1e4
      },
      usage: quotaInfo.usage || {
        daily: 0,
        monthly: 0,
        remainingDaily: 1e3,
        remainingMonthly: 1e4
      }
    }), {
      headers: {
        ...getCorsHeaders2(env, request),
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: "Failed to get quota information",
      message: error.message
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleGetQuota, "handleGetQuota");
async function handleLogout(request, env) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authorization header required" }), {
        status: 401,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const token = authHeader.substring(7);
    const jwtSecret = getJWTSecret2(env);
    const payload = await verifyJWT2(token, jwtSecret);
    if (!payload) {
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 401,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const customerId = payload.customerId || null;
    const tokenHash = await hashEmail2(token);
    const blacklistKey = getCustomerKey(customerId, `blacklist_${tokenHash}`);
    await env.OTP_AUTH_KV.put(blacklistKey, JSON.stringify({
      token: tokenHash,
      revokedAt: (/* @__PURE__ */ new Date()).toISOString()
    }), { expirationTtl: 25200 });
    const sessionKey = getCustomerKey(customerId, `session_${payload.userId}`);
    await env.OTP_AUTH_KV.delete(sessionKey);
    return new Response(JSON.stringify({
      success: true,
      message: "Logged out successfully"
    }), {
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: "Failed to logout",
      message: error.message
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleLogout, "handleLogout");
async function handleRefresh(request, env) {
  try {
    const body = await request.json();
    const { token } = body;
    if (!token) {
      return new Response(JSON.stringify({ error: "Token required" }), {
        status: 400,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const jwtSecret = getJWTSecret2(env);
    const payload = await verifyJWT2(token, jwtSecret);
    if (!payload) {
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 401,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const customerId = payload.customerId || null;
    const tokenHash = await hashEmail2(token);
    const blacklistKey = getCustomerKey(customerId, `blacklist_${tokenHash}`);
    const blacklisted = await env.OTP_AUTH_KV.get(blacklistKey);
    if (blacklisted) {
      return new Response(JSON.stringify({ error: "Token has been revoked" }), {
        status: 401,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const newCsrfToken = crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16))).map((b) => b.toString(16).padStart(2, "0")).join("");
    const expiresAt = new Date(Date.now() + 7 * 60 * 60 * 1e3);
    const newTokenPayload = {
      userId: payload.userId,
      email: payload.email,
      customerId,
      // Preserve customer ID
      csrf: newCsrfToken,
      // New CSRF token for refreshed session
      exp: Math.floor(expiresAt.getTime() / 1e3),
      iat: Math.floor(Date.now() / 1e3)
    };
    const newToken = await createJWT2(newTokenPayload, jwtSecret);
    const sessionKey = getCustomerKey(customerId, `session_${payload.userId}`);
    await env.OTP_AUTH_KV.put(sessionKey, JSON.stringify({
      userId: payload.userId,
      email: payload.email,
      token: await hashEmail2(newToken),
      expiresAt: expiresAt.toISOString(),
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    }), { expirationTtl: 25200 });
    return new Response(JSON.stringify({
      success: true,
      token: newToken,
      expiresAt: expiresAt.toISOString()
    }), {
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: "Failed to refresh token",
      message: error.message
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleRefresh, "handleRefresh");
async function authenticateRequest(request, env) {
  const authHeader = request.headers.get("Authorization");
  let apiKey = null;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    apiKey = authHeader.substring(7);
  } else {
    apiKey = request.headers.get("X-OTP-API-Key");
  }
  if (!apiKey) {
    return null;
  }
  const authResult = await verifyApiKey(apiKey, env);
  return authResult;
}
__name(authenticateRequest, "authenticateRequest");
async function handleLandingPage(request, env) {
  return new Response(landing_html_default, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600"
    }
  });
}
__name(handleLandingPage, "handleLandingPage");
var worker_default = {
  async fetch(request, env, ctx) {
    const startTime = performance.now();
    const url = new URL(request.url);
    const path = url.pathname;
    let customerId = null;
    let endpoint = path.split("/").pop() || "unknown";
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: getCorsHeaders2(env, request)
      });
    }
    try {
      if ((path === "/" || path === "") && request.method === "GET") {
        return handleLandingPage(request, env);
      }
      if (path === "/openapi.json" && request.method === "GET") {
        try {
          return new Response(JSON.stringify(openapi_json_default, null, 2), {
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "public, max-age=3600",
              ...getCorsHeaders2(env, request)
            }
          });
        } catch (error) {
          return new Response(JSON.stringify({ error: "Failed to load OpenAPI spec" }), {
            status: 500,
            headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
          });
        }
      }
      if (path.startsWith("/dashboard") && request.method === "GET") {
        if (path === "/dashboard" || path === "/dashboard/") {
          return new Response(`
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <title>Dashboard - Setup Required</title>
                            <style>
                                body { font-family: system-ui; background: #1a1611; color: #f9f9f9; padding: 2rem; }
                                .container { max-width: 800px; margin: 0 auto; }
                                code { background: #252017; padding: 0.2rem 0.4rem; border-radius: 4px; }
                            </style>
                        </head>
                        <body>
                            <div class="container">
                                <h1>\u{1F527} Dashboard Setup Required</h1>
                                <p>The developer dashboard needs to be built and integrated.</p>
                                <h2>Steps:</h2>
                                <ol>
                                    <li>Navigate to <code>serverless/otp-auth-service/dashboard</code></li>
                                    <li>Run <code>pnpm build</code> to build the dashboard</li>
                                    <li>The built files will be in <code>dashboard/dist/</code></li>
                                    <li>Update <code>worker.js</code> to serve the built dashboard files</li>
                                </ol>
                                <p><strong>Note:</strong> The dashboard is a Svelte + TypeScript SPA that needs to be built before serving.</p>
                            </div>
                        </body>
                        </html>
                    `, {
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              ...getCorsHeaders2(env, request)
            }
          });
        }
        return new Response("Dashboard not yet built. Please build the dashboard first.", {
          status: 404,
          headers: getCorsHeaders2(env, request)
        });
      }
      if (path === "/signup" && request.method === "POST") {
        return handlePublicSignup(request, env);
      }
      if (path === "/signup/verify" && request.method === "POST") {
        return handleVerifySignup(request, env);
      }
      if (path === "/admin/customers" && request.method === "POST") {
        return handleRegisterCustomer(request, env);
      }
      if (path === "/health" && request.method === "GET") {
        try {
          await env.OTP_AUTH_KV.get("health_check", { type: "text" });
          const secretValidation = validateSecrets(env);
          const healthStatus = {
            status: secretValidation.valid ? "healthy" : "degraded",
            service: "otp-auth-service",
            version: "2.0.0",
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          };
          if (!secretValidation.valid) {
            healthStatus.warnings = {
              missing_secrets: secretValidation.missing,
              message: `Required secrets not configured: ${secretValidation.missing.join(", ")}. Set them via: wrangler secret put <SECRET_NAME>`
            };
          }
          if (secretValidation.warnings.length > 0) {
            healthStatus.warnings = healthStatus.warnings || {};
            healthStatus.warnings.recommended = secretValidation.warnings;
          }
          return new Response(JSON.stringify(healthStatus), {
            status: secretValidation.valid ? 200 : 503,
            headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            status: "unhealthy",
            service: "otp-auth-service",
            error: "KV check failed",
            details: env.ENVIRONMENT === "development" ? error.message : void 0
          }), {
            status: 503,
            headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
          });
        }
      }
      if (path === "/health/ready" && request.method === "GET") {
        try {
          await env.OTP_AUTH_KV.get("health_check", { type: "text" });
          const secretValidation = validateSecrets(env);
          if (!secretValidation.valid) {
            return new Response(JSON.stringify({
              status: "not_ready",
              reason: "missing_secrets",
              missing: secretValidation.missing,
              warnings: secretValidation.warnings,
              message: `Required secrets not configured: ${secretValidation.missing.join(", ")}. Set them via: wrangler secret put <SECRET_NAME>`
            }), {
              status: 503,
              headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
            });
          }
          return new Response(JSON.stringify({
            status: "ready",
            warnings: secretValidation.warnings.length > 0 ? secretValidation.warnings : void 0
          }), {
            headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            status: "not_ready",
            reason: "kv_check_failed",
            error: env.ENVIRONMENT === "development" ? error.message : void 0
          }), {
            status: 503,
            headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
          });
        }
      }
      if (path === "/health/live" && request.method === "GET") {
        return new Response(JSON.stringify({ status: "alive" }), {
          headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
        });
      }
      if (path === "/admin/customers/me" && request.method === "GET") {
        const auth2 = await authenticateRequest(request, env);
        if (!auth2) {
          return new Response(JSON.stringify({ error: "Authentication required" }), {
            status: 401,
            headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
          });
        }
        return handleAdminGetMe(request, env, auth2.customerId);
      }
      if (path === "/admin/customers/me" && request.method === "PUT") {
        const auth2 = await authenticateRequest(request, env);
        if (!auth2) {
          return new Response(JSON.stringify({ error: "Authentication required" }), {
            status: 401,
            headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
          });
        }
        return handleUpdateMe(request, env, auth2.customerId);
      }
      if (path === "/admin/domains/verify" && request.method === "POST") {
        const auth2 = await authenticateRequest(request, env);
        if (!auth2) {
          return new Response(JSON.stringify({ error: "Authentication required" }), {
            status: 401,
            headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
          });
        }
        return handleRequestDomainVerification(request, env, auth2.customerId);
      }
      const domainStatusMatch = path.match(/^\/admin\/domains\/([^\/]+)\/status$/);
      if (domainStatusMatch && request.method === "GET") {
        const domain = domainStatusMatch[1];
        const auth2 = await authenticateRequest(request, env);
        if (!auth2) {
          return new Response(JSON.stringify({ error: "Authentication required" }), {
            status: 401,
            headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
          });
        }
        return handleGetDomainStatus(request, env, domain);
      }
      const domainVerifyMatch = path.match(/^\/admin\/domains\/([^\/]+)\/verify$/);
      if (domainVerifyMatch && request.method === "POST") {
        const domain = domainVerifyMatch[1];
        const auth2 = await authenticateRequest(request, env);
        if (!auth2) {
          return new Response(JSON.stringify({ error: "Authentication required" }), {
            status: 401,
            headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
          });
        }
        return handleVerifyDomain(request, env, auth2.customerId, domain);
      }
      if (path === "/admin/analytics" && request.method === "GET") {
        const auth2 = await authenticateRequest(request, env);
        if (!auth2) {
          return new Response(JSON.stringify({ error: "Authentication required" }), {
            status: 401,
            headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
          });
        }
        return handleGetAnalytics(request, env, auth2.customerId);
      }
      if (path === "/admin/analytics/realtime" && request.method === "GET") {
        const auth2 = await authenticateRequest(request, env);
        if (!auth2) {
          return new Response(JSON.stringify({ error: "Authentication required" }), {
            status: 401,
            headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
          });
        }
        return handleGetRealtimeAnalytics(request, env, auth2.customerId);
      }
      if (path === "/admin/analytics/errors" && request.method === "GET") {
        const auth2 = await authenticateRequest(request, env);
        if (!auth2) {
          return new Response(JSON.stringify({ error: "Authentication required" }), {
            status: 401,
            headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
          });
        }
        return handleGetErrorAnalytics(request, env, auth2.customerId);
      }
      if (path === "/admin/onboarding" && request.method === "GET") {
        const auth2 = await authenticateRequest(request, env);
        if (!auth2) {
          return new Response(JSON.stringify({ error: "Authentication required" }), {
            status: 401,
            headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
          });
        }
        return handleGetOnboarding(request, env, auth2.customerId);
      }
      if (path === "/admin/onboarding" && request.method === "PUT") {
        const auth2 = await authenticateRequest(request, env);
        if (!auth2) {
          return new Response(JSON.stringify({ error: "Authentication required" }), {
            status: 401,
            headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
          });
        }
        return handleUpdateOnboarding(request, env, auth2.customerId);
      }
      if (path === "/admin/onboarding/test-otp" && request.method === "POST") {
        const auth2 = await authenticateRequest(request, env);
        if (!auth2) {
          return new Response(JSON.stringify({ error: "Authentication required" }), {
            status: 401,
            headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
          });
        }
        return handleTestOTP(request, env, auth2.customerId);
      }
      const exportUserMatch = path.match(/^\/admin\/users\/([^\/]+)\/export$/);
      if (exportUserMatch && request.method === "GET") {
        const userId = exportUserMatch[1];
        const auth2 = await authenticateRequest(request, env);
        if (!auth2) {
          return new Response(JSON.stringify({ error: "Authentication required" }), {
            status: 401,
            headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
          });
        }
        return handleExportUserData(request, env, auth2.customerId, userId);
      }
      const deleteUserMatch = path.match(/^\/admin\/users\/([^\/]+)$/);
      if (deleteUserMatch && request.method === "DELETE") {
        const userId = deleteUserMatch[1];
        const auth2 = await authenticateRequest(request, env);
        if (!auth2) {
          return new Response(JSON.stringify({ error: "Authentication required" }), {
            status: 401,
            headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
          });
        }
        return handleDeleteUserData(request, env, auth2.customerId, userId);
      }
      if (path === "/admin/audit-logs" && request.method === "GET") {
        const auth2 = await authenticateRequest(request, env);
        if (!auth2) {
          return new Response(JSON.stringify({ error: "Authentication required" }), {
            status: 401,
            headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
          });
        }
        return handleGetAuditLogs(request, env, auth2.customerId);
      }
      if (path === "/admin/config" && request.method === "GET") {
        const auth2 = await authenticateRequest(request, env);
        if (!auth2) {
          return new Response(JSON.stringify({ error: "Authentication required" }), {
            status: 401,
            headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
          });
        }
        return handleGetConfig(request, env, auth2.customerId);
      }
      if (path === "/admin/config" && request.method === "PUT") {
        const auth2 = await authenticateRequest(request, env);
        if (!auth2) {
          return new Response(JSON.stringify({ error: "Authentication required" }), {
            status: 401,
            headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
          });
        }
        return handleUpdateConfig(request, env, auth2.customerId);
      }
      if (path === "/admin/config/email" && request.method === "PUT") {
        const auth2 = await authenticateRequest(request, env);
        if (!auth2) {
          return new Response(JSON.stringify({ error: "Authentication required" }), {
            status: 401,
            headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
          });
        }
        return handleUpdateEmailConfig(request, env, auth2.customerId);
      }
      const customerApiKeysMatch = path.match(/^\/admin\/customers\/([^\/]+)\/api-keys$/);
      if (customerApiKeysMatch) {
        const pathCustomerId = customerApiKeysMatch[1];
        const auth2 = await authenticateRequest(request, env);
        if (!auth2) {
          return new Response(JSON.stringify({ error: "Authentication required" }), {
            status: 401,
            headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
          });
        }
        if (auth2.customerId !== pathCustomerId) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
          });
        }
        if (request.method === "GET") {
          return handleListApiKeys(request, env, auth2.customerId);
        }
        if (request.method === "POST") {
          return handleCreateApiKey(request, env, auth2.customerId);
        }
      }
      const revokeApiKeyMatch = path.match(/^\/admin\/customers\/([^\/]+)\/api-keys\/([^\/]+)$/);
      if (revokeApiKeyMatch && request.method === "DELETE") {
        const pathCustomerId = revokeApiKeyMatch[1];
        const keyId = revokeApiKeyMatch[2];
        const auth2 = await authenticateRequest(request, env);
        if (!auth2) {
          return new Response(JSON.stringify({ error: "Authentication required" }), {
            status: 401,
            headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
          });
        }
        if (auth2.customerId !== pathCustomerId) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
          });
        }
        return handleRevokeApiKey(request, env, auth2.customerId, keyId);
      }
      const rotateApiKeyMatch = path.match(/^\/admin\/customers\/([^\/]+)\/api-keys\/([^\/]+)\/rotate$/);
      if (rotateApiKeyMatch && request.method === "POST") {
        const pathCustomerId = rotateApiKeyMatch[1];
        const keyId = rotateApiKeyMatch[2];
        const auth2 = await authenticateRequest(request, env);
        if (!auth2) {
          return new Response(JSON.stringify({ error: "Authentication required" }), {
            status: 401,
            headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
          });
        }
        if (auth2.customerId !== pathCustomerId) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
          });
        }
        return handleRotateApiKey(request, env, auth2.customerId, keyId);
      }
      const suspendCustomerMatch = path.match(/^\/admin\/customers\/([^\/]+)\/suspend$/);
      if (suspendCustomerMatch && request.method === "POST") {
        const pathCustomerId = suspendCustomerMatch[1];
        const auth2 = await authenticateRequest(request, env);
        if (!auth2) {
          return new Response(JSON.stringify({ error: "Authentication required" }), {
            status: 401,
            headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
          });
        }
        return handleSuspendCustomer(request, env, pathCustomerId);
      }
      const activateCustomerMatch = path.match(/^\/admin\/customers\/([^\/]+)\/activate$/);
      if (activateCustomerMatch && request.method === "POST") {
        const pathCustomerId = activateCustomerMatch[1];
        const auth2 = await authenticateRequest(request, env);
        if (!auth2) {
          return new Response(JSON.stringify({ error: "Authentication required" }), {
            status: 401,
            headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
          });
        }
        return handleActivateCustomer(request, env, pathCustomerId);
      }
      const updateStatusMatch = path.match(/^\/admin\/customers\/([^\/]+)\/status$/);
      if (updateStatusMatch && request.method === "PUT") {
        const pathCustomerId = updateStatusMatch[1];
        const auth2 = await authenticateRequest(request, env);
        if (!auth2) {
          return new Response(JSON.stringify({ error: "Authentication required" }), {
            status: 401,
            headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
          });
        }
        const body = await request.json();
        const { status } = body;
        if (!status) {
          return new Response(JSON.stringify({ error: "Status required" }), {
            status: 400,
            headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
          });
        }
        return handleUpdateCustomerStatus(request, env, pathCustomerId, status);
      }
      let customer = null;
      const auth = await authenticateRequest(request, env);
      if (auth) {
        customerId = auth.customerId;
        customer = await getCustomerCached2(customerId, env);
        const clientIP = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "unknown";
        const ipAllowed = await checkIPAllowlist(customerId, clientIP, env);
        if (!ipAllowed) {
          await logSecurityEvent(customerId, "ip_blocked", {
            ip: clientIP,
            endpoint: path,
            method: request.method
          }, env);
          return new Response(JSON.stringify({ error: "IP address not allowed" }), {
            status: 403,
            headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
          });
        }
        await logSecurityEvent(customerId, "api_key_auth", {
          keyId: auth.keyId,
          endpoint: path,
          method: request.method,
          ip: clientIP
        }, env);
      } else if (path.startsWith("/auth/") || path.startsWith("/admin/")) {
        const clientIP = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "unknown";
        await logSecurityEvent(null, "auth_failed", {
          endpoint: path,
          method: request.method,
          ip: clientIP
        }, env);
      }
      if (path === "/auth/request-otp" && request.method === "POST") {
        const originalHandler = handleRequestOTP;
        return originalHandler(request, env, customerId);
      }
      if (path === "/auth/verify-otp" && request.method === "POST") {
        const originalHandler = handleVerifyOTP;
        return originalHandler(request, env, customerId);
      }
      if (path === "/auth/me" && request.method === "GET") {
        return handleGetMe(request, env);
      }
      if (path === "/auth/quota" && request.method === "GET") {
        return handleGetQuota(request, env);
      }
      if (path === "/auth/logout" && request.method === "POST") {
        return handleLogout(request, env);
      }
      if (path === "/auth/refresh" && request.method === "POST") {
        return handleRefresh(request, env);
      }
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    } catch (error) {
      console.error("Request handler error:", error);
      if (customerId) {
        await trackError(customerId, "internal", error.message, endpoint, env);
        await checkErrorRateAlert(customerId, env);
      }
      const errorResponse = new Response(JSON.stringify({
        error: "Internal server error",
        message: env.ENVIRONMENT === "development" ? error.message : void 0
      }), {
        status: 500,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
      const responseTime = performance.now() - startTime;
      if (customerId) {
        await trackResponseTime(customerId, endpoint, responseTime, env);
      }
      return errorResponse;
    } finally {
      const responseTime = performance.now() - startTime;
      if (customerId && path.startsWith("/auth/")) {
        await trackResponseTime(customerId, endpoint, responseTime, env);
      }
    }
  }
};

// ../../node_modules/.pnpm/wrangler@4.56.0/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../node_modules/.pnpm/wrangler@4.56.0/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-zPZknG/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// ../../node_modules/.pnpm/wrangler@4.56.0/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-zPZknG/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
