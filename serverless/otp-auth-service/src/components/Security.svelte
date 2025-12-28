<section class="security" id="security">
  <div class="security-content">
    <h2>Security You Can Trust</h2>
    <div class="security-grid">
      <div class="security-item">
        <h3>[AUTH] Cryptographically Secure</h3>
        <p>9-digit OTP codes generated using cryptographically secure random number generators. 1 billion possible combinations.</p>
      </div>
      <div class="security-item">
        <h3>[TIME] Time-Limited</h3>
        <p>OTP codes expire after 10 minutes. Single-use only—once verified, the code is immediately invalidated.</p>
      </div>
      <div class="security-item">
        <h3>[PROTECT] Brute Force Protection</h3>
        <p>Maximum 5 verification attempts per OTP code. After that, a new code must be requested.</p>
      </div>
      <div class="security-item">
        <h3>[EMOJI] Rate Limiting</h3>
        <p>3 OTP requests per email per hour. Prevents abuse and email spam while maintaining usability.</p>
      </div>
      <div class="security-item">
        <h3>[EMOJI] JWT Tokens</h3>
        <p>HMAC-SHA256 signed tokens with 7-hour expiration. Token blacklisting for secure logout.</p>
      </div>
      <div class="security-item">
        <h3>[NOTE] Audit Logging</h3>
        <p>Comprehensive security event logging with 90-day retention. Track all authentication attempts and failures.</p>
      </div>
      <div class="security-item">
        <h3>[WEB] CORS Protection</h3>
        <p>Configurable CORS policies per customer. IP allowlisting for additional security layers.</p>
      </div>
      <div class="security-item">
        <h3>[SUCCESS] GDPR Compliant</h3>
        <p>Data export and deletion endpoints. Complete user data portability and right to be forgotten.</p>
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
  }
</style>

