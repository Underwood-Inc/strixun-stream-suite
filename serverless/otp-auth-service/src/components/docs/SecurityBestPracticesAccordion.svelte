<script lang="ts">
  import MermaidDiagram from '../../lib/MermaidDiagram.svelte';

  const rateLimitingDiagram = `graph TB
    REQUEST["Incoming OTP Request"] --> LAYER1["<strong>Layer 1: Plan Limits</strong><br/>Free: 3/hr | Pro: 10/hr | Enterprise: 100/hr"]
    LAYER1 --> LAYER2["<strong>Layer 2: Email Rate Limit</strong><br/>Max 3 requests per 60min per email<br/>(prevents spam)"]
    LAYER2 --> LAYER3["<strong>Layer 3: IP Rate Limit</strong><br/>Max 10 requests per hour per IP<br/>(prevents abuse)"]
    LAYER3 --> LAYER4["<strong>Layer 4: Dynamic Adjustment</strong><br/>• Failed attempts tracking<br/>• Suspicious behavior detection<br/>• Gradually increase limits for good behavior"]
    LAYER4 --> ALLOW["✓ Allow Request"]
    LAYER4 --> BLOCK["✗ 429 Too Many Requests"]
    
    classDef requestStyle fill:#252017,stroke:#edae49,stroke-width:3px,color:#f9f9f9
    classDef layerStyle fill:#1a1611,stroke:#6495ed,stroke-width:2px,color:#f9f9f9
    classDef allowStyle fill:#1a1611,stroke:#28a745,stroke-width:3px,color:#f9f9f9
    classDef blockStyle fill:#1a1611,stroke:#dc3545,stroke-width:3px,color:#f9f9f9
    
    class REQUEST requestStyle
    class LAYER1,LAYER2,LAYER3,LAYER4 layerStyle
    class ALLOW allowStyle
    class BLOCK blockStyle`;
</script>

<h4>Rate Limiting Architecture</h4>
<p>The service implements multi-layer rate limiting to prevent abuse while allowing legitimate usage:</p>
<MermaidDiagram diagram={rateLimitingDiagram} />

<h4>Token Storage (HttpOnly Cookie SSO)</h4>
<ul>
  <li><strong>Web Apps:</strong> MUST use HttpOnly cookies (set automatically by auth service)</li>
  <li><strong>Mobile Apps:</strong> Use secure storage (Keychain/Keystore)</li>
  <li><strong>Never:</strong> Store tokens in URL parameters, localStorage, or plain cookies</li>
</ul>
<p>
  <strong>CRITICAL:</strong> For web applications, tokens are ONLY stored in HttpOnly cookies set by the auth service. 
  Never manually store JWT tokens in localStorage or sessionStorage - this exposes your application to XSS attacks.
</p>

<h4>SSO Cookie Security Attributes</h4>
<p>The authentication cookie set by <code>/auth/verify-otp</code> includes these security attributes:</p>
<ul>
  <li><strong><code>HttpOnly</code></strong> - Prevents JavaScript access (XSS protection)</li>
  <li><strong><code>Secure</code></strong> - Only transmitted over HTTPS</li>
  <li><strong><code>SameSite=Lax</code></strong> - CSRF protection while allowing navigation</li>
  <li><strong><code>Domain=.idling.app</code></strong> - Shared across all subdomains for SSO</li>
  <li><strong><code>Path=/</code></strong> - Available to all routes</li>
  <li><strong><code>Max-Age=25200</code></strong> - 7-hour expiration (matches JWT)</li>
</ul>
<p>
  <strong>Implementation Note:</strong> Always use <code>credentials: 'include'</code> in fetch requests to send cookies automatically:
</p>
<pre><code class="language-javascript">// Correct: Cookie sent automatically
fetch('https://auth.idling.app/auth/me', &#123;
  credentials: 'include'
&#125;);

// WRONG: Cookie not sent
fetch('https://auth.idling.app/auth/me');</code></pre>

<h4>HTTPS Only</h4>
<p>Always use HTTPS in production. The API only accepts HTTPS connections. The <code>Secure</code> cookie attribute ensures tokens are never transmitted over unencrypted connections.</p>

<h4>CORS Configuration</h4>
<p>Configure allowed origins in your customer settings to prevent unauthorized access. For SSO to work across subdomains, ensure all participating domains are listed as allowed origins.</p>

<h4>IP Allowlisting</h4>
<p>For additional security, configure IP allowlists in customer settings.</p>

<h4>Session Management</h4>
<p>JWT tokens are valid for 7 hours and are automatically sent via HttpOnly cookies for SSO across all subdomains. No manual token refresh is needed - the browser automatically includes the cookie with each request.</p>

<h4>Logout and Session Invalidation</h4>
<p>Calling <code>POST /auth/logout</code> (with <code>credentials: 'include'</code>) will:</p>
<ul>
  <li>Clear the HttpOnly cookie (sets <code>Max-Age=0</code>)</li>
  <li>Invalidate the session server-side</li>
  <li>Log out from ALL apps sharing the SSO cookie (same domain)</li>
</ul>

