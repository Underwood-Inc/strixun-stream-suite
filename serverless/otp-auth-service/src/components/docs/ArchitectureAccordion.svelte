<script lang="ts">
  import MermaidDiagram from '../../lib/MermaidDiagram.svelte';

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
</script>

<h4>System Architecture</h4>
<MermaidDiagram diagram={architectureDiagram} />

<h4>Data Flow</h4>
<ol>
  <li>Client requests OTP by sending email address</li>
  <li>Worker generates cryptographically secure 6-digit code</li>
  <li>OTP stored in KV with 10-minute TTL</li>
  <li>Email sent via Resend/SendGrid with OTP code</li>
  <li>User receives email and enters code</li>
  <li>Client sends OTP for verification</li>
  <li>Worker validates OTP against KV store</li>
  <li>If valid, JWT token issued and OTP deleted</li>
  <li>Client uses JWT for authenticated requests</li>
</ol>

<h4>Storage</h4>
<ul>
  <li><strong>Cloudflare KV</strong> - OTP codes, user sessions, customer data</li>
  <li><strong>JWT Tokens</strong> - Stateless authentication (no server-side storage)</li>
  <li><strong>Token Blacklist</strong> - Stored in KV for logout/revocation</li>
</ul>

