<script lang="ts">
  import CodeBlock from '../../lib/CodeBlock.svelte';

  const errorResponseExample = `{
  "type": "https://tools.ietf.org/html/rfc7231#section-6.5.1",
  "title": "Bad Request",
  "status": 400,
  "detail": "Valid email address required",
  "instance": "https://auth.idling.app/auth/request-otp"
}`;
</script>

<h4>Error Response Format</h4>
<p>All errors follow RFC 7807 Problem Details format:</p>
<CodeBlock code={errorResponseExample} language="json" />

<h4>Common Error Codes</h4>
<ul>
  <li><strong>400 Bad Request</strong> - Invalid input (email format, OTP format)</li>
  <li><strong>401 Unauthorized</strong> - Invalid/expired token, invalid OTP</li>
  <li><strong>404 Not Found</strong> - OTP not found or expired</li>
  <li><strong>429 Too Many Requests</strong> - Rate limit or quota exceeded</li>
  <li><strong>500 Internal Server Error</strong> - Server error</li>
</ul>

<h4>Rate Limit Headers</h4>
<p>Rate limit information included in response headers:</p>
<ul>
  <li><strong>X-RateLimit-Limit</strong> - Maximum requests allowed</li>
  <li><strong>X-RateLimit-Remaining</strong> - Remaining requests</li>
  <li><strong>X-RateLimit-Reset</strong> - Time when limit resets (Unix timestamp)</li>
  <li><strong>Retry-After</strong> - Seconds to wait before retrying (429 responses)</li>
</ul>

