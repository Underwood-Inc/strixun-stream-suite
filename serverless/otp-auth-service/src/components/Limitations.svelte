<section class="limitations">
  <h2>Limitations & Considerations</h2>
  <div class="limitations-list">
    <ul>
      <li>
        <strong>Rate Limits</strong>
        <p>3 OTP requests per email address per hour to prevent abuse and email spam.</p>
      </li>
      <li>
        <strong>OTP Expiration</strong>
        <p>OTP codes expire after 10 minutes. Users must request a new code if expired.</p>
      </li>
      <li>
        <strong>Verification Attempts</strong>
        <p>Maximum 5 verification attempts per OTP code. After that, a new code must be requested.</p>
      </li>
      <li>
        <strong>Token Expiration</strong>
        <p>JWT tokens expire after 7 hours. Use the refresh endpoint to extend sessions.</p>
      </li>
      <li>
        <strong>Email Delivery</strong>
        <p>OTP delivery depends on email provider reliability. Check spam folders if code doesn't arrive.</p>
      </li>
      <li>
        <strong>Multi-Tenancy</strong>
        <p>API key authentication required for multi-tenant features. Contact us for enterprise setup.</p>
      </li>
      <li>
        <strong>Exceeded Free Tier?</strong>
        <p>No problem! This application is open-source and can be self-hosted. Subscription tiers with enhanced rate limits are coming soon. [EMOJI]</p>
      </li>
    </ul>
  </div>
</section>

<style>
  .limitations {
    padding: var(--spacing-3xl) var(--spacing-xl);
    max-width: 1200px;
    margin: 0 auto;
  }

  .limitations h2 {
    text-align: center;
    font-size: clamp(2rem, 4vw, 3rem);
    margin-bottom: var(--spacing-2xl);
    color: var(--accent);
  }

  .limitations-list {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--spacing-xl);
  }

  .limitations-list ul {
    list-style: none;
    margin: 0;
  }

  .limitations-list li {
    padding: var(--spacing-md);
    border-bottom: 1px solid var(--border);
    color: var(--text-secondary);
  }

  .limitations-list li:last-child {
    border-bottom: none;
  }

  .limitations-list li strong {
    color: var(--accent);
    display: block;
    margin-bottom: var(--spacing-xs);
  }

  .limitations-list li p {
    margin: 0;
    color: var(--text-secondary);
  }

  @media (max-width: 768px) {
    .limitations {
      padding: var(--spacing-2xl) var(--spacing-md);
    }
  }
</style>

