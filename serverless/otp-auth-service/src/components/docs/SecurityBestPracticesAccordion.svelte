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

<h4>Token Storage</h4>
<ul>
  <li><strong>Web Apps:</strong> Store in httpOnly cookies (preferred) or localStorage</li>
  <li><strong>Mobile Apps:</strong> Use secure storage (Keychain/Keystore)</li>
  <li><strong>Never:</strong> Store tokens in URL parameters or plain cookies</li>
</ul>

<h4>HTTPS Only</h4>
<p>Always use HTTPS in production. The API only accepts HTTPS connections.</p>

<h4>CORS Configuration</h4>
<p>Configure allowed origins in your customer settings to prevent unauthorized access.</p>

<h4>IP Allowlisting</h4>
<p>For additional security, configure IP allowlists in customer settings.</p>

<h4>Token Refresh</h4>
<p>Implement automatic token refresh before expiration to maintain seamless customer experience.</p>

