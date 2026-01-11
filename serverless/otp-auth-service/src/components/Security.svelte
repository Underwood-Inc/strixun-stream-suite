<script lang="ts">
  import ObfuscatedText from '@shared-components/svelte/ObfuscatedText.svelte';
</script>

<section class="security" id="security">
  <div class="security-content">
    <h2>Security You Can Trust</h2>
    <div class="security-grid">
      <div class="security-item">
        <h3>✦ Cryptographically Secure</h3>
        <p><ObfuscatedText text="9" length={1} />-digit OTP codes generated using cryptographically secure random number generators. <ObfuscatedText text="1 billion" length={9} /> possible combinations.</p>
      </div>
      <div class="security-item">
        <h3>⏱ Time-Limited</h3>
        <p>OTP codes expire after <ObfuscatedText text="10" length={2} /> minutes. Single-use only—once verified, the code is immediately invalidated.</p>
      </div>
      <div class="security-item">
        <h3>▣ Brute Force Protection</h3>
        <p>Maximum <ObfuscatedText text="5" length={1} /> verification attempts per OTP code. After that, a new code must be requested.</p>
      </div>
      <div class="security-item">
        <h3>⚠ Rate Limiting</h3>
        <p><ObfuscatedText text="3" length={1} /> OTP requests per email per hour. Prevents abuse and email spam while maintaining usability.</p>
      </div>
      <div class="security-item">
        <h3>◉ JWT Tokens</h3>
        <p>HMAC-SHA256 signed tokens with <ObfuscatedText text="7" length={1} />-hour expiration. Token blacklisting for secure logout.</p>
      </div>
      <div class="security-item">
        <h3>◈ Audit Logging</h3>
        <p>Comprehensive security event logging with <ObfuscatedText text="30" length={2} />-day retention. Track all authentication attempts and failures.</p>
      </div>
      <div class="security-item">
        <h3>★ CORS Protection</h3>
        <p>Configurable CORS policies per customer. IP allowlisting for additional security layers.</p>
      </div>
      <div class="security-item">
        <h3>✓ GDPR Compliant</h3>
        <p>Data export and deletion endpoints. Complete user data portability and right to be forgotten.</p>
      </div>
      <div class="security-item">
        <h3>⏲ Timing Attack Protection</h3>
        <p>Constant-time comparison for OTP verification prevents timing-based side-channel attacks.</p>
      </div>
      <div class="security-item">
        <h3>🔒 Email Enumeration Prevention</h3>
        <p>Generic error messages prevent attackers from discovering valid email addresses in your system.</p>
      </div>
      <div class="security-item">
        <h3>🛡 Dynamic Throttling</h3>
        <p>Intelligent rate limiting adjusts based on suspicious patterns. Multi-layer protection with email and IP tracking.</p>
      </div>
      <div class="security-item">
        <h3>🌐 OAuth 2.0 / OIDC Compliant</h3>
        <p>Full OAuth 2.0 and OpenID Connect compliance. Standard JWT claims (sub, iss, aud, exp, iat, jti) with CSRF protection.</p>
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

