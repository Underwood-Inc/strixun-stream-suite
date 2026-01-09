<footer class="footer">
  <p>OTP Authentication API - Powered by Cloudflare Workers</p>
  <p class="footer-subtitle">
    Part of the Strixun Stream Suite
  </p>
</footer>

<style>
  .footer {
    background: var(--bg-dark);
    border-top: 1px solid var(--border);
    padding: var(--spacing-xl);
    text-align: center;
    color: var(--text-secondary);
    margin-top: var(--spacing-3xl);
  }

  .footer-subtitle {
    margin-top: var(--spacing-sm);
    font-size: 0.875rem;
  }

  @media (max-width: 768px) {
    .footer {
      padding: var(--spacing-lg);
    }

    .footer p {
      font-size: 0.875rem;
    }

    .footer-subtitle {
      font-size: 0.75rem;
    }
  }

  @media (max-width: 480px) {
    .footer {
      padding: var(--spacing-md);
      margin-top: var(--spacing-2xl);
    }

    .footer p {
      font-size: 0.8rem;
    }

    .footer-subtitle {
      font-size: 0.7rem;
    }
  }
</style>

