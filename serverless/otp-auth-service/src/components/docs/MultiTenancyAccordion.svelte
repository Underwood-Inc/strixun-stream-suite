<script lang="ts">
  import CodeBlock from '../../lib/CodeBlock.svelte';
  import MermaidDiagram from '../../lib/MermaidDiagram.svelte';

  const kvStorageDiagram = `graph TB
    subgraph "Tenant A Data (cust_abc123_*)"
        OTP1["<strong>OTP Codes</strong><br/>otp_{emailHash}_{timestamp}<br/>TTL: 600s (10 min)"]
        SESSION1["<strong>Sessions</strong><br/>session_{userId}<br/>TTL: 25200s (7 hrs)"]
        USER1["<strong>User Data</strong><br/>user_{emailHash}<br/>TTL: 31536000s (1 yr)"]
        RATELIMIT1["<strong>Rate Limits</strong><br/>ratelimit_otp_{emailHash}<br/>TTL: 3600s (1 hr)"]
        ANALYTICS1["<strong>Analytics</strong><br/>analytics_{date}<br/>TTL: 2592000s (30 days)"]
    end
    
    subgraph "Tenant B Data (cust_xyz789_*)"
        OTP2["<strong>OTP Codes</strong>"]
        SESSION2["<strong>Sessions</strong>"]
        USER2["<strong>User Data</strong>"]
    end
    
    subgraph "Global Data (no prefix)"
        APIKEY["<strong>API Keys</strong><br/>apikey_{hash}<br/>No TTL (persistent)"]
        CUSTOMER["<strong>Tenant Config</strong><br/>customer_{tenantId}<br/>No TTL (persistent)"]
        BLACKLIST["<strong>JWT Blacklist</strong><br/>blacklist_{tokenHash}<br/>TTL: 25200s (7 hrs)"]
    end
    
    classDef tenantAStyle fill:#1a1611,stroke:#6495ed,stroke-width:2px,color:#f9f9f9
    classDef tenantBStyle fill:#252017,stroke:#edae49,stroke-width:2px,color:#f9f9f9
    classDef globalStyle fill:#1a1611,stroke:#28a745,stroke-width:2px,color:#f9f9f9
    
    class OTP1,SESSION1,USER1,RATELIMIT1,ANALYTICS1 tenantAStyle
    class OTP2,SESSION2,USER2 tenantBStyle
    class APIKEY,CUSTOMER,BLACKLIST globalStyle`;

  const dataIsolationDiagram = `graph LR
    subgraph "Tenant A (cust_abc123)"
        A1["Alice's OTP:<br/>cust_abc123_otp_hash1"]
        A2["Bob's Session:<br/>cust_abc123_session_user456"]
    end
    
    subgraph "Tenant B (cust_xyz789)"
        B1["Carol's OTP:<br/>cust_xyz789_otp_hash2"]
        B2["Dave's Session:<br/>cust_xyz789_session_user789"]
    end
    
    A1 -.->|"❌ Cannot Access"| B1
    A2 -.->|"❌ Cannot Access"| B2
    
    classDef tenantAStyle fill:#252017,stroke:#6495ed,stroke-width:3px,color:#f9f9f9
    classDef tenantBStyle fill:#1a1611,stroke:#edae49,stroke-width:3px,color:#f9f9f9
    
    class A1,A2 tenantAStyle
    class B1,B2 tenantBStyle`;
</script>

<h4>Tenant Isolation (NOT Customer Isolation)</h4>
<p><strong>Important Terminology:</strong> The service uses "customerId" in the code, but this actually refers to <strong>tenant ID</strong>. Each <strong>tenant</strong> (organization/company) can have many <strong>customers</strong> (end users who log in).</p>
<p>All data is completely isolated per tenant using KV key prefixes:</p>

<h4>KV Storage Architecture</h4>
<MermaidDiagram diagram={kvStorageDiagram} />

<h4>Key Patterns</h4>
<ul>
  <li><strong>OTP codes:</strong> <code>cust_{'{'}tenantId{'}'}_otp_{'{'}emailHash{'}'}_{'{'}timestamp{'}'}</code></li>
  <li><strong>Sessions:</strong> <code>cust_{'{'}tenantId{'}'}_session_{'{'}userId{'}'}</code></li>
  <li><strong>User data:</strong> <code>cust_{'{'}tenantId{'}'}_user_{'{'}emailHash{'}'}</code></li>
  <li><strong>Rate limits:</strong> <code>cust_{'{'}tenantId{'}'}_ratelimit_otp_{'{'}emailHash{'}'}</code></li>
  <li><strong>Analytics:</strong> <code>cust_{'{'}tenantId{'}'}_analytics_{'{'}date{'}'}</code></li>
  <li><strong>API Keys (global):</strong> <code>apikey_{'{'}hash{'}'}</code></li>
  <li><strong>Tenant config (global):</strong> <code>customer_{'{'}tenantId{'}'}</code></li>
</ul>

<h4>Data Isolation Guarantee</h4>
<MermaidDiagram diagram={dataIsolationDiagram} />
<p>Tenants cannot access each other's data due to KV key prefixing. All data queries include the tenant ID prefix, ensuring complete isolation at the storage layer.</p>

<h4>API Key Authentication</h4>
<p>Multi-tenant features require API key authentication. API keys identify the <strong>tenant</strong> (which organization), NOT individual customers (JWT handles that):</p>
<CodeBlock code='X-OTP-API-Key: otp_live_sk_...' language="http" />
<p><strong>IMPORTANT:</strong> API keys use the <code>X-OTP-API-Key</code> header. The <code>Authorization</code> header is reserved for JWT tokens only.</p>

<h4>Per-Tenant Configuration</h4>
<ul>
  <li>Custom email templates</li>
  <li>Custom email providers (Resend, SendGrid, AWS SES)</li>
  <li>Custom rate limits</li>
  <li>Custom CORS policies</li>
  <li>IP allowlisting</li>
</ul>

