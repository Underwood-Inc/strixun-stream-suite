<script lang="ts">
  import Tooltip from '@shared-components/svelte/Tooltip.svelte';
  import StatusFlair from '@shared-components/svelte/StatusFlair.svelte';
</script>

<section class="security" id="security">
  <div class="security-content">
    <h2>Security You Can Trust</h2>
    <div class="security-grid">
      <div class="security-item">
        <h3>✦ Cryptographically Secure</h3>
        <p>9-digit OTP codes generated using cryptographically secure random number generators. 1,000,000,000 possible combinations.</p>
      </div>
      <div class="security-item">
        <Tooltip
          text="<strong>Why 10 Minutes?</strong><br><br>
          10 minutes balances security with user experience:<br><br>
          • Long enough for email delivery delays<br>
          • Short enough to prevent replay attacks<br>
          • Industry standard for OTP systems<br>
          • Reduces window for interception<br><br>
          <strong>Single-Use Enforcement:</strong><br>
          Once verified, the OTP is immediately invalidated in KV storage, preventing reuse even within the time window."
          position="top"
          level="info"
          interactive={true}
          maxWidth="400px"
          maxHeight="300px"
        >
          <h3 style="cursor: help; text-decoration: underline dotted;">⏱ Time-Limited</h3>
        </Tooltip>
        <p>OTP codes expire after 10 minutes. Single-use only—once verified, the code is immediately invalidated.</p>
      </div>
      <div class="security-item">
        <Tooltip
          text="<strong>The Math Behind 5 Attempts:</strong><br><br>
          With 1 billion possible 9-digit combinations:<br>
          • 5 attempts = 1 in 200,000,000 chance<br>
          • Statistically impossible to brute force<br>
          • Industry standard (<a href='https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#implement-proper-password-strength-controls' target='_blank' rel='noopener noreferrer' style='color: #6495ed;'>OWASP recommended</a>)<br><br>
          <strong>What Happens After 5 Attempts:</strong><br>
          • OTP is invalidated immediately<br>
          • Customer must request a new code<br>
          • Attempt counter stored in KV (<a href='https://github.com/Underwood-Inc/strixun-stream-suite/blob/master/serverless/otp-auth-service/handlers/auth/verify-otp.ts' target='_blank' rel='noopener noreferrer' style='color: #6495ed;'>see code</a>)<br>
          • Tracked per-OTP, not per-customer<br><br>
          This prevents automated attacks while allowing legitimate users to recover from typos."
          position="top"
          level="info"
          interactive={true}
          maxWidth="450px"
          maxHeight="320px"
        >
          <h3 style="cursor: help; text-decoration: underline dotted;">▣ Brute Force Protection</h3>
        </Tooltip>
        <p>Maximum 5 verification attempts per OTP code. After that, a new code must be requested.</p>
      </div>
      <div class="security-item">
        <Tooltip
          text="<strong>Dynamic Rate Limiting Details:</strong><br><br>
          <strong>Base Limits (by plan):</strong><br>
          • Free: 3 requests/hour<br>
          • Pro: 10 requests/hour<br>
          • Enterprise: 100 requests/hour<br>
          (<a href='https://github.com/Underwood-Inc/strixun-stream-suite/blob/master/serverless/otp-auth-service/services/rate-limit.ts#L62-L90' target='_blank' rel='noopener noreferrer' style='color: #6495ed;'>see code</a>)<br><br>
          <strong>Dynamic Adjustment:</strong><br>
          The system automatically adjusts limits (-2 to +2) based on:<br>
          • Recent usage patterns (24h activity)<br>
          • Failed attempt history<br>
          • Suspicious behavior detection<br>
          • IP-based tracking patterns<br>
          (<a href='https://github.com/Underwood-Inc/strixun-stream-suite/blob/master/serverless/otp-auth-service/services/rate-limit.ts#L92-L141' target='_blank' rel='noopener noreferrer' style='color: #6495ed;'>see algorithm</a>)<br><br>
          <strong>Custom Configuration:</strong><br>
          Each customer can override with custom rate limits in their settings.<br><br>
          Super admins are exempt from all rate limits."
          position="top"
          level="info"
          interactive={true}
          maxWidth="450px"
        >
          <h3 style="cursor: help; text-decoration: underline dotted;">⚠ Rate Limiting</h3>
        </Tooltip>
        <p>Plan-based OTP rate limits with intelligent dynamic adjustment. Adapts to usage patterns and detects suspicious behavior to prevent abuse.</p>
      </div>
      <div class="security-item">
        <Tooltip
          text="<strong>JWT Structure (<a href='https://datatracker.ietf.org/doc/html/rfc7519' target='_blank' rel='noopener noreferrer' style='color: #6495ed;'>RFC 7519</a>):</strong><br><br>
          <strong>Algorithm:</strong> HMAC-SHA256 (HS256)<br>
          <strong>Expiration:</strong> 7 hours from issuance<br>
          (<a href='https://github.com/Underwood-Inc/strixun-stream-suite/blob/master/serverless/otp-auth-service/handlers/auth/jwt-creation.ts#L148-L169' target='_blank' rel='noopener noreferrer' style='color: #6495ed;'>see code</a>)<br><br>
          <strong>Standard Claims Included:</strong><br>
          • sub (subject) - Customer ID<br>
          • iss (issuer) - auth.idling.app<br>
          • aud (audience) - Customer ID<br>
          • exp (expiration) - Unix timestamp<br>
          • iat (issued at) - Unix timestamp<br>
          • jti (JWT ID) - Unique token ID<br>
          • email, email_verified, csrf<br><br>
          <strong>✓ Blacklisting System:</strong><br>
          Tokens stored in KV on logout. All requests check blacklist before accepting token, ensuring immediate invalidation."
          position="top"
          level="info"
          interactive={true}
          maxWidth="450px"
          maxHeight="380px"
        >
          <h3 style="cursor: help; text-decoration: underline dotted;">◉ JWT Tokens</h3>
        </Tooltip>
        <p>HMAC-SHA256 signed tokens with 7-hour expiration. Token blacklisting for secure logout.</p>
      </div>
      <div class="security-item">
        <Tooltip
          text="<strong>Events Logged:</strong><br><br>
          • OTP request (email sent)<br>
          • OTP verification attempts (success/fail)<br>
          • Login/logout events<br>
          • Rate limit violations<br>
          • Suspicious activity detection<br>
          • API key usage<br><br>
          <strong>Log Structure:</strong><br>
          • Timestamp (<a href='https://en.wikipedia.org/wiki/ISO_8601' target='_blank' rel='noopener noreferrer' style='color: #6495ed;'>ISO 8601</a>)<br>
          • Event type and result<br>
          • IP address (hashed)<br>
          • User agent<br>
          • Customer ID<br><br>
          <strong>Access & Retention:</strong><br>
          Logs accessible via API endpoint. 30-day automatic retention. Export available in JSON format."
          position="top"
          level="info"
          interactive={true}
          maxWidth="450px"
          maxHeight="380px"
        >
          <h3 style="cursor: help; text-decoration: underline dotted;">◈ Audit Logging</h3>
        </Tooltip>
        <p>Comprehensive security event logging with 30-day retention. Track all authentication attempts and failures.</p>
      </div>
      <div class="security-item">
        <Tooltip
          text="<strong>What is CORS?</strong><br><br>
          <a href='https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS' target='_blank' rel='noopener noreferrer' style='color: #6495ed;'>Cross-Origin Resource Sharing</a> controls which domains can access your authentication API from browsers.<br><br>
          <strong>Configuration Options:</strong><br>
          • Allowed origins (domains)<br>
          • Allowed methods (GET, POST, etc.)<br>
          • Allowed headers<br>
          • Credentials support<br>
          • Max age (preflight cache)<br>
          (<a href='https://github.com/Underwood-Inc/strixun-stream-suite/blob/master/serverless/otp-auth-service/utils/cors.ts' target='_blank' rel='noopener noreferrer' style='color: #6495ed;'>see implementation</a>)<br><br>
          <strong>IP Allowlisting:</strong><br>
          Optional additional layer restricting API access to specific IP ranges. Useful for:<br>
          • Internal tools<br>
          • Server-to-server auth<br>
          • Corporate network restrictions"
          position="top"
          level="info"
          interactive={true}
          maxWidth="450px"
          maxHeight="380px"
        >
          <h3 style="cursor: help; text-decoration: underline dotted;">★ CORS Protection</h3>
        </Tooltip>
        <p>Configurable CORS policies per customer. IP allowlisting for additional security layers.</p>
      </div>
      <div class="security-item">
        <Tooltip
          text="<strong>GDPR Compliance Features:</strong><br><br>
          <strong>✓ Right to Access (<a href='https://gdpr-info.eu/art-15-gdpr/' target='_blank' rel='noopener noreferrer' style='color: #6495ed;'>Art. 15</a>):</strong><br>
          • Export all customer data via API<br>
          • JSON format for portability<br>
          • Includes customer data & audit logs<br><br>
          <strong>✓ Right to Erasure (<a href='https://gdpr-info.eu/art-17-gdpr/' target='_blank' rel='noopener noreferrer' style='color: #6495ed;'>Art. 17</a>):</strong><br>
          • Complete data deletion endpoint<br>
          • Removes all PII and sessions<br>
          • <strong>Executed immediately</strong> (not 72 hours)<br><br>
          <strong>✓ Data Minimization:</strong><br>
          • Only essential data collected<br>
          • Email addresses hashed in logs<br>
          • No unnecessary tracking<br><br>
          <strong>⚠ Data Residency:</strong><br>
          Cloudflare Workers global edge network. No explicit EU-only data residency configured yet. Data may be processed globally per <a href='https://www.cloudflare.com/trust-hub/gdpr/' target='_blank' rel='noopener noreferrer' style='color: #ff8c00;'>Cloudflare's GDPR compliance</a>."
          position="top"
          level="info"
          interactive={true}
          maxWidth="450px"
          maxHeight="380px"
        >
          <h3 style="cursor: help; text-decoration: underline dotted;">✓ GDPR Compliant</h3>
        </Tooltip>
        <p>Data export and deletion endpoints. Complete customer data portability and right to be forgotten.</p>
      </div>
      <div class="security-item">
        <Tooltip
          text="<strong>What Are Timing Attacks?</strong><br><br>
          Attackers measure how long verification takes. Traditional string comparison returns immediately when characters don't match, creating timing differences. (<a href='https://en.wikipedia.org/wiki/Timing_attack' target='_blank' rel='noopener noreferrer' style='color: #6495ed;'>Learn more</a>)<br><br>
          <strong>Example Attack:</strong><br>
          • Try '100000000' - fails in 1ms<br>
          • Try '900000000' - fails in 9ms<br>
          • Attacker learns first digit is '9'<br>
          • Repeat for each digit<br><br>
          <strong>✓ Our Defense:</strong><br>
          Constant-time comparison checks ALL digits regardless of matches. Every verification takes exactly the same time, revealing no information to attackers.<br><br>
          <strong>Implementation:</strong><br>
          <a href='https://github.com/Underwood-Inc/strixun-stream-suite/blob/master/serverless/otp-auth-service/utils/crypto.ts#L145-L161' target='_blank' rel='noopener noreferrer' style='color: #6495ed;'>constantTimeEquals() function</a> resists timing analysis."
          position="top"
          level="info"
          interactive={true}
          maxWidth="450px"
          maxHeight="380px"
        >
          <h3 style="cursor: help; text-decoration: underline dotted;">⏲ Timing Attack Protection</h3>
        </Tooltip>
        <p>Constant-time comparison for OTP verification prevents timing-based side-channel attacks.</p>
      </div>
      <div class="security-item">
        <Tooltip
          text="<strong>The Attack Vector:</strong><br><br>
          Attackers try to discover which email addresses are valid in your system by observing different responses. (<a href='https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/03-Identity_Management_Testing/04-Testing_for_Account_Enumeration_and_Guessable_User_Account' target='_blank' rel='noopener noreferrer' style='color: #6495ed;'>OWASP Guide</a>)<br><br>
          <strong>Vulnerable System:</strong><br>
          • 'user@example.com' → 'OTP sent'<br>
          • 'invalid@example.com' → 'Email not found'<br>
          Attacker now knows first email is valid!<br><br>
          <strong>✓ Our Protection:</strong><br>
          Same generic response for ALL email addresses:<br>
          'If this email exists, an OTP was sent'<br><br>
          <strong>Security vs UX Balance:</strong><br>
          • Slightly less helpful error messages<br>
          • Prevents customer enumeration attacks<br>
          • Protects your customer base privacy<br>
          • Industry best practice"
          position="top"
          level="info"
          interactive={true}
          maxWidth="450px"
          maxHeight="380px"
        >
          <h3 style="cursor: help; text-decoration: underline dotted;">🔒 Email Enumeration Prevention</h3>
        </Tooltip>
        <p>Generic error messages prevent attackers from discovering valid email addresses in your system.</p>
      </div>
      <div class="security-item">
        <Tooltip
          text="<strong>How Dynamic Throttling Works:</strong><br><br>
          Goes beyond static rate limits by analyzing behavior patterns in real-time.<br><br>
          <strong>Suspicious Pattern Detection:</strong><br>
          • High request volume in 24h<br>
          • Multiple failed attempts<br>
          • Unusual IP activity<br>
          • Rapid sequential requests<br><br>
          <strong>Automatic Response:</strong><br>
          • Reduces available requests (-2 to +2 adjustment)<br>
          • Combines email + IP tracking<br>
          • Adapts per-customer, not globally<br><br>
          <strong>Multi-Layer Protection:</strong><br>
          • Email-based throttling<br>
          • IP-based throttling<br>
          • Combined heuristics<br>
          • Works alongside static rate limits"
          position="top"
          level="info"
          interactive={true}
          maxWidth="400px"
          maxHeight="360px"
        >
          <h3 style="cursor: help; text-decoration: underline dotted;">🛡 Dynamic Throttling</h3>
        </Tooltip>
        <p>Intelligent rate limiting adjusts based on suspicious patterns. Multi-layer protection with email and IP tracking.</p>
      </div>
      <div class="security-item">
        <Tooltip
          text="<strong>Current Implementation:</strong><br><br>
          <strong>✓ JWT with OIDC-Compatible Claims:</strong><br>
          • Standard claims: sub, iss, aud, exp, iat, jti (<a href='https://github.com/Underwood-Inc/strixun-stream-suite/blob/master/serverless/otp-auth-service/handlers/auth/jwt-creation.ts#L148-L169' target='_blank' rel='noopener noreferrer' style='color: #6495ed;'>see code</a>)<br>
          • email, email_verified claims<br>
          • <a href='https://datatracker.ietf.org/doc/html/rfc6749#section-5.1' target='_blank' rel='noopener noreferrer' style='color: #6495ed;'>OAuth 2.0 token response format</a><br>
          • scope: 'openid email profile'<br>
          • CSRF token in JWT payload<br><br>
          <strong>⚠ Not Yet Implemented:</strong><br>
          • <strong>Authorization Code Flow</strong> - Standard OAuth flow for web apps (<a href='https://datatracker.ietf.org/doc/html/rfc6749#section-4.1' target='_blank' rel='noopener noreferrer' style='color: #6495ed;'>RFC 6749</a>)<br>
          • <strong>PKCE Support</strong> - Proof Key for Code Exchange, security for mobile apps (<a href='https://datatracker.ietf.org/doc/html/rfc7636' target='_blank' rel='noopener noreferrer' style='color: #6495ed;'>RFC 7636</a>)<br>
          • <strong>Customer Info Endpoint</strong> - OIDC /userinfo endpoint for profile data (<a href='https://openid.net/specs/openid-connect-core-1_0.html#UserInfo' target='_blank' rel='noopener noreferrer' style='color: #6495ed;'>OIDC Spec</a>)<br>
          • <strong>Token Introspection</strong> - Validate and inspect tokens (<a href='https://datatracker.ietf.org/doc/html/rfc7662' target='_blank' rel='noopener noreferrer' style='color: #6495ed;'>RFC 7662</a>)<br>
          • <strong>Refresh Tokens</strong> - Long-lived tokens to renew access (<a href='https://datatracker.ietf.org/doc/html/rfc6749#section-6' target='_blank' rel='noopener noreferrer' style='color: #6495ed;'>RFC 6749</a>)<br><br>
          <strong>Note:</strong> We issue JWTs with OIDC-compatible claims and OAuth-style responses, but do not yet implement full OAuth 2.0/OIDC flows. Planned for future release."
          position="top"
          level="warning"
          interactive={true}
          maxWidth="450px"
          maxHeight="400px"
        >
          <StatusFlair status="wip">
            <h3 style="cursor: help; text-decoration: underline dotted;">🌐 JWT with OIDC Claims</h3>
          </StatusFlair>
        </Tooltip>
        <p><strong>Partial:</strong> JWT tokens with OIDC-compatible claims (sub, iss, aud, exp, iat, jti, email) and OAuth 2.0 response format. Full OAuth 2.0/OIDC flows planned.</p>
      </div>
    </div>
  </div>
</section>

<style>
  .security {
    background: var(--bg-dark);
    padding: var(--spacing-3xl) var(--spacing-xl);
    margin: var(--spacing-3xl) 0;
  }

  .security-content {
    max-width: 1200px;
    margin: 0 auto;
  }

  .security h2 {
    text-align: center;
    font-size: clamp(2rem, 4vw, 3rem);
    margin-bottom: var(--spacing-2xl);
    color: var(--accent);
  }

  .security-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: var(--spacing-lg);
  }

  .security-item {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--spacing-lg);
    border-left: 4px solid var(--success);
  }

  .security-item h3 {
    color: var(--success);
    margin-bottom: var(--spacing-sm);
  }

  .security-item p {
    color: var(--text-secondary);
  }

  @media (max-width: 768px) {
    .security {
      padding: var(--spacing-2xl) var(--spacing-md);
    }

    .security-grid {
      grid-template-columns: 1fr;
      gap: var(--spacing-md);
    }

    .security-item {
      padding: var(--spacing-md);
    }

    .security-item h3 {
      font-size: 1rem;
    }

    .security-item p {
      font-size: 0.875rem;
    }
  }

  @media (max-width: 480px) {
    .security {
      padding: var(--spacing-xl) var(--spacing-sm);
      margin: var(--spacing-2xl) 0;
    }

    .security h2 {
      font-size: 1.75rem;
      margin-bottom: var(--spacing-lg);
    }

    .security-grid {
      gap: var(--spacing-sm);
    }

    .security-item {
      padding: var(--spacing-sm);
    }

    .security-item h3 {
      font-size: 0.9rem;
    }

    .security-item p {
      font-size: 0.8rem;
    }
  }
</style>

