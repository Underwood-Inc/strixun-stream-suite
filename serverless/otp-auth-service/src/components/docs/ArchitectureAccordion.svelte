<script lang="ts">
  import MermaidDiagram from '../../lib/MermaidDiagram.svelte';

  const otpLifecycleDiagram = `sequenceDiagram
    participant C as Customer
    participant API as OTP Auth API
    participant KV as Cloudflare KV
    participant Email as Email Service
    
    C->>API: 1. POST /auth/request-otp<br/>{email, API-Key}
    API->>API: 2. Verify API key<br/>(get tenantId)
    API->>KV: 3. Check rate limits<br/>(tenant + email + IP)
    API->>API: 4. Generate 9-digit OTP<br/>(crypto.getRandomValues)
    API->>KV: 5. Store OTP<br/>(cust_{tenantId}_otp_{hash})<br/>TTL: 600s
    API->>Email: 6. Send email with OTP
    API-->>C: 7. {success, expiresIn: 600}
    
    C->>API: 8. POST /auth/verify-otp<br/>{email, otp, API-Key}
    API->>KV: 9. Retrieve OTP<br/>(timing-attack safe compare)
    API->>KV: 10. Delete OTP<br/>(single-use)
    API->>API: 11. Generate JWT<br/>(HMAC-SHA256, 7hr exp)
    API->>KV: 12. Create session<br/>(cust_{tenantId}_session_{userId})<br/>TTL: 25200s
    API-->>C: 13. {access_token, expires_in: 25200}`;

  const architectureDiagram = `graph TB
    Client["\`**Client Application**<br/>Web/Mobile App\`"] -->|"\`**1. Request OTP**\`"| API["\`**Cloudflare Worker**<br/>OTP Auth API\`"]
    API -->|"\`**2. Generate OTP**\`"| KV["\`**Cloudflare KV**<br/>Secure Storage\`"]
    API -->|"\`**3. Send Email**\`"| Email["\`**Email Service**<br/>Resend/SendGrid\`"]
    Email -->|"\`**4. Deliver OTP**\`"| Customer["\`**Customer Email**<br/>Inbox\`"]
    Customer -->|"\`**5. Enter OTP**\`"| Client
    Client -->|"\`**6. Verify OTP**\`"| API
    API -->|"\`**7. Validate**\`"| KV
    API -->|"\`**8. Issue JWT**\`"| Client
    Client -->|"\`**9. Authenticated Requests**\`"| API
    
    classDef clientStyle fill:#252017,stroke:#edae49,stroke-width:3px,color:#f9f9f9
    classDef apiStyle fill:#1a1611,stroke:#6495ed,stroke-width:3px,color:#f9f9f9
    classDef storageStyle fill:#252017,stroke:#28a745,stroke-width:3px,color:#f9f9f9
    classDef emailStyle fill:#1a1611,stroke:#f9df74,stroke-width:3px,color:#f9f9f9
    classDef customerStyle fill:#252017,stroke:#edae49,stroke-width:3px,color:#f9f9f9
    
    class Client clientStyle
    class API apiStyle
    class KV storageStyle
    class Email emailStyle
    class Customer customerStyle`;

  const multiTenantDiagram = `graph TB
    TenantA["\`**Tenant A**<br/>Company 1<br/>API Key: otp_live_A123\`"] -.->|"\`has many\`"| CustA1["\`**Customer**<br/>Alice\`"]
    TenantA -.->|"\`has many\`"| CustA2["\`**Customer**<br/>David\`"]
    
    TenantB["\`**Tenant B**<br/>Company 2<br/>API Key: otp_live_B456\`"] -.->|"\`has many\`"| CustB1["\`**Customer**<br/>Bob\`"]
    TenantB -.->|"\`has many\`"| CustB2["\`**Customer**<br/>Eve\`"]
    
    TenantC["\`**Tenant C**<br/>SaaS App<br/>API Key: otp_live_C789\`"] -.->|"\`has many\`"| CustC1["\`**Customer**<br/>Carol\`"]
    
    CustA1 --> KV["\`**Cloudflare KV**<br/>Tenant-Isolated Storage\`"]
    CustA2 --> KV
    CustB1 --> KV
    CustB2 --> KV
    CustC1 --> KV
    
    classDef tenantStyle fill:#1a1611,stroke:#6495ed,stroke-width:3px,color:#f9f9f9
    classDef customerStyle fill:#252017,stroke:#edae49,stroke-width:3px,color:#f9f9f9
    classDef storageStyle fill:#252017,stroke:#28a745,stroke-width:3px,color:#f9f9f9
    
    class TenantA,TenantB,TenantC tenantStyle
    class CustA1,CustA2,CustB1,CustB2,CustC1 customerStyle
    class KV storageStyle`;

  const twoLayerAuthDiagram = `graph LR
    Request["\`**API Request**\`"] --> Layer1["\`**Layer 1: API Key**<br/>X-OTP-API-Key<br/>Tenant Identification\`"]
    Request --> Layer2["\`**Layer 2: JWT Token**<br/>Authorization: Bearer<br/>Customer Authentication\`"]
    
    Layer1 --> TenantInfo["\`**Tenant Context**<br/>• Tenant ID<br/>• Subscription Tier<br/>• Rate Limits<br/>• Custom Config\`"]
    Layer2 --> CustomerInfo["\`**Customer Context**<br/>• Customer ID<br/>• Email<br/>• Display Name<br/>• Session\`"]
    
    TenantInfo --> Combined["\`**Combined Context**<br/>Request Processing\`"]
    CustomerInfo --> Combined
    
    classDef requestStyle fill:#252017,stroke:#edae49,stroke-width:3px,color:#f9f9f9
    classDef layerStyle fill:#1a1611,stroke:#6495ed,stroke-width:3px,color:#f9f9f9
    classDef infoStyle fill:#252017,stroke:#28a745,stroke-width:3px,color:#f9f9f9
    classDef combinedStyle fill:#1a1611,stroke:#f9df74,stroke-width:3px,color:#f9f9f9
    
    class Request requestStyle
    class Layer1,Layer2 layerStyle
    class TenantInfo,CustomerInfo infoStyle
    class Combined combinedStyle`;

  // SSO with HttpOnly Cookies diagram
  const ssoFlowDiagram = `sequenceDiagram
    participant User as User Browser
    participant Mods as mods.idling.app
    participant Short as s.idling.app
    participant Stream as streamkit.idling.app
    participant Auth as auth.idling.app
    participant KV as Cloudflare KV
    
    Note over User,KV: User logs in on first app
    User->>Mods: Visit mods.idling.app
    Mods->>User: Show login form
    User->>Auth: Request OTP (email)
    Auth->>KV: Store OTP (10min TTL)
    Auth-->>User: Send OTP via email
    User->>Auth: Verify OTP code
    Auth->>KV: Validate OTP
    Auth->>Auth: Generate JWT token
    Auth->>User: Set HttpOnly Cookie (Domain=.idling.app)
    User->>Mods: Authenticated!
    
    Note over User,KV: User visits second app - already logged in!
    User->>Short: Visit s.idling.app
    Short->>User: Check cookie
    User->>Short: Cookie sent automatically
    Short->>Auth: Validate token (/auth/me)
    Auth->>KV: Verify session
    Auth-->>Short: Customer info
    Short->>User: Authenticated! (No login needed)
    
    Note over User,KV: User visits third app - still logged in!
    User->>Stream: Visit streamkit.idling.app
    Stream->>User: Check cookie
    User->>Stream: Cookie sent automatically
    Stream->>Auth: Validate token (/auth/me)
    Auth->>KV: Verify session
    Auth-->>Stream: Customer info
    Stream->>User: Authenticated! (No login needed)`;

  // SSO Cookie Security diagram
  const ssoCookieSecurityDiagram = `graph TB
    Cookie["\`**HttpOnly Cookie**<br/>auth_token=eyJhbGc...\`"] --> Props["\`**Cookie Properties**\`"]
    
    Props --> Prop1["\`**Domain: .idling.app**<br/>Works on all subdomains\`"]
    Props --> Prop2["\`**HttpOnly: true**<br/>No JavaScript access<br/>XSS Protection\`"]
    Props --> Prop3["\`**Secure: true**<br/>HTTPS only<br/>MITM Protection\`"]
    Props --> Prop4["\`**SameSite: Lax**<br/>CSRF Protection\`"]
    Props --> Prop5["\`**Max-Age: 7 hours**<br/>Auto-expiry\`"]
    
    classDef cookieStyle fill:#252017,stroke:#edae49,stroke-width:3px,color:#f9f9f9
    classDef propStyle fill:#1a1611,stroke:#6495ed,stroke-width:3px,color:#f9f9f9
    
    class Cookie cookieStyle
    class Props,Prop1,Prop2,Prop3,Prop4,Prop5 propStyle`;

  // Inter-Tenant SSO Configuration diagram
  const interTenantSsoDiagram = `graph TB
    subgraph Customer["Customer: Acme Corp"]
        Key1["\`**API Key A**<br/>mods.acme.com<br/>isolationMode: none\`"]
        Key2["\`**API Key B**<br/>app.acme.com<br/>isolationMode: none\`"]
        Key3["\`**API Key C**<br/>admin.acme.com<br/>isolationMode: selective<br/>allowedKeyIds: [A, B]\`"]
        Key4["\`**API Key D**<br/>internal.acme.com<br/>isolationMode: complete\`"]
    end
    
    Session1["\`**User Session**<br/>Created on Key A\`"]
    
    Key1 -->|"\`Global SSO\`"| Session1
    Key2 -->|"\`Global SSO\`"| Session1
    Key3 -->|"\`Selective SSO\`"| Session1
    Key4 -.->|"\`Isolated\`"| Session1
    
    classDef keyStyle fill:#252017,stroke:#edae49,stroke-width:3px,color:#f9f9f9
    classDef sessionStyle fill:#1a1611,stroke:#28a745,stroke-width:3px,color:#f9f9f9
    classDef customerStyle fill:#0f0e0b,stroke:#3d3627,stroke-width:2px,color:#f9f9f9
    
    class Key1,Key2,Key3,Key4 keyStyle
    class Session1 sessionStyle
    class Customer customerStyle`;
</script>

<h4>Core OTP Authentication Flow</h4>
<MermaidDiagram diagram={architectureDiagram} />

<h4>Data Flow</h4>
<ol>
  <li>Client requests OTP by sending email address</li>
  <li>Worker generates cryptographically secure 9-digit code</li>
  <li>OTP stored in KV with 10-minute TTL</li>
  <li>Email sent via Resend/SendGrid with OTP code</li>
  <li>Customer receives email and enters code</li>
  <li>Client sends OTP for verification</li>
  <li>Worker validates OTP against KV store</li>
  <li>If valid, JWT token issued and OTP deleted</li>
  <li>Client uses JWT for authenticated requests</li>
</ol>

<h4>Detailed OTP Lifecycle (Sequence Diagram)</h4>
<MermaidDiagram diagram={otpLifecycleDiagram} />

<h4>Multi-Tenant Architecture</h4>
<MermaidDiagram diagram={multiTenantDiagram} />
<p>
  Each <strong>Tenant</strong> (organization/company) has its own API key and can have multiple 
  <strong>Customers</strong> (individual people who log in). Data is completely isolated per tenant 
  using prefixed KV keys: <code>cust_&#123;tenantId&#125;_*</code>
</p>

<h4>Two-Layer Authentication</h4>
<MermaidDiagram diagram={twoLayerAuthDiagram} />
<p>
  <strong>API Keys</strong> identify the <em>tenant</em> (which organization), while 
  <strong>JWT Tokens</strong> authenticate the <em>customer</em> (which specific person). 
  They work together but serve different purposes:
</p>
<ul>
  <li><strong>X-OTP-API-Key:</strong> Tenant identification, rate limits, configuration</li>
  <li><strong>Authorization: Bearer:</strong> Customer authentication, session management</li>
</ul>

<h4>Single Sign-On (SSO) with HttpOnly Cookies</h4>
<MermaidDiagram diagram={ssoFlowDiagram} />
<p>
  <strong>How SSO Works Across All Apps:</strong>
</p>
<ol>
  <li><strong>Login Once:</strong> User logs in on any app (e.g., mods.idling.app)</li>
  <li><strong>Shared Cookie:</strong> Auth service sets an HttpOnly cookie on <code>.idling.app</code> domain</li>
  <li><strong>Automatic Authentication:</strong> Cookie is automatically sent to all subdomains</li>
  <li><strong>Seamless Experience:</strong> User is instantly authenticated on all apps</li>
  <li><strong>Secure Logout:</strong> Logging out on any app clears the cookie for all apps</li>
</ol>
<p>
  <strong>Apps Using This SSO:</strong>
</p>
<ul>
  <li><strong>mods.idling.app</strong> - Mod Management Hub</li>
  <li><strong>s.idling.app</strong> / <strong>shorten.idling.app</strong> - URL Shortener Service</li>
  <li><strong>streamkit.idling.app</strong> - Stream Suite (OBS overlays, widgets)</li>
  <li><strong>design.idling.app</strong> - Component Library (Storybook)</li>
  <li><strong>docs.idling.app</strong> - Documentation &amp; API Reference</li>
</ul>

<h4>SSO Cookie Security</h4>
<MermaidDiagram diagram={ssoCookieSecurityDiagram} />
<p>
  <strong>Why HttpOnly Cookies for SSO?</strong>
</p>
<ul>
  <li><strong>XSS Protection:</strong> JavaScript cannot access HttpOnly cookies, preventing token theft</li>
  <li><strong>Automatic Sharing:</strong> Browser automatically sends cookie to all <code>.idling.app</code> subdomains</li>
  <li><strong>True SSO:</strong> Login once, authenticated everywhere - no manual token passing</li>
  <li><strong>No localStorage:</strong> Tokens never stored in client-side storage (vulnerable to XSS)</li>
  <li><strong>Secure by Default:</strong> HTTPS-only, CSRF protection, automatic expiry</li>
</ul>

<h4>Inter-Tenant SSO Configuration (API Key Level)</h4>
<p>
  For organizations with multiple applications (API keys), you can configure how authentication sessions are shared between them.
  This allows building custom SSO ecosystems where different apps can optionally share user sessions.
</p>
<MermaidDiagram diagram={interTenantSsoDiagram} />
<p>
  <strong>SSO Isolation Modes:</strong>
</p>
<ul>
  <li><strong><code>none</code> (default)</strong> - Global SSO enabled. Sessions created with this API key can be used by ALL other API keys owned by the same customer. Best for unified ecosystems.</li>
  <li><strong><code>selective</code></strong> - Selective SSO. Sessions are only shared with API keys listed in <code>allowedKeyIds</code>. Useful for grouping related apps.</li>
  <li><strong><code>complete</code></strong> - Complete isolation. Sessions are NOT shared with any other API keys. Use for sensitive admin apps or when complete separation is required.</li>
</ul>
<p>
  <strong>Note:</strong> API keys are for tenant/organization identification, NOT for user authentication. 
  JWT tokens (in HttpOnly cookies) handle actual user authentication. SSO config only controls whether 
  JWT sessions can be validated across different API keys owned by the same customer.
</p>

<h4>Storage</h4>
<ul>
  <li><strong>Cloudflare KV</strong> - OTP codes, customer sessions, customer data (tenant-isolated)</li>
  <li><strong>JWT Tokens</strong> - Stateless authentication (no server-side storage)</li>
  <li><strong>HttpOnly Cookies</strong> - Secure token storage in browser (XSS-safe, auto-transmitted)</li>
  <li><strong>Token Blacklist</strong> - Stored in KV for logout/revocation</li>
</ul>

