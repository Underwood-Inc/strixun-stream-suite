<script lang="ts">
  import CodeBlock from '../../lib/CodeBlock.svelte';
</script>

<h4>Customer Isolation</h4>
<p>All data is completely isolated per customer using KV key prefixes:</p>
<ul>
  <li>OTP codes: <code>cust_{'{'}customerId{'}'}_otp_{'{'}emailHash{'}'}</code></li>
  <li>Customer data: <code>cust_{'{'}customerId{'}'}_customer_{'{'}customerId{'}'}</code></li>
  <li>Rate limits: <code>cust_{'{'}customerId{'}'}_ratelimit_{'{'}email{'}'}</code></li>
</ul>

<h4>API Key Authentication</h4>
<p>Multi-tenant features require API key authentication. API keys are for tenant identification and configuration, NOT for customer authorization (JWT handles that):</p>
<CodeBlock code='X-OTP-API-Key: otp_live_sk_...' language="http" />
<p><strong>IMPORTANT:</strong> API keys use the <code>X-OTP-API-Key</code> header. The <code>Authorization</code> header is reserved for JWT tokens only.</p>

<h4>Per-Customer Configuration</h4>
<ul>
  <li>Custom email templates</li>
  <li>Custom email providers (Resend, SendGrid, AWS SES)</li>
  <li>Custom rate limits</li>
  <li>Custom CORS policies</li>
  <li>IP allowlisting</li>
</ul>

