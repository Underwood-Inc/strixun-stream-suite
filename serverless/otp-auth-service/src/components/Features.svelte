<script lang="ts">
  export let dashboardLink: string = '/dashboard';
</script>

<section class="features">
  <h2>Why Choose OTP Auth?</h2>
  <div class="features-grid">
    <div class="feature-card">
      <div class="feature-icon">[PERF]</div>
      <h3>Lightning Fast</h3>
      <p>Built on Cloudflare Workers for global edge deployment. Sub-100ms response times worldwide.</p>
    </div>
    <div class="feature-card">
      <div class="feature-icon">[EMOJI]</div>
      <h3>Enterprise Security</h3>
      <p>Cryptographically secure OTP codes, JWT tokens, rate limiting, and comprehensive audit logging.</p>
    </div>
    <div class="feature-card">
      <div class="feature-icon">[EMOJI]</div>
      <h3>Easy Integration</h3>
      <p>Simple REST API that works with any framework. React, Svelte, Vue, or vanilla JavaScript—we've got you covered.</p>
    </div>
    <div class="feature-card">
      <div class="feature-icon">[EMOJI]</div>
      <h3>Multi-Tenant Ready</h3>
      <p>Built for SaaS applications. Complete customer isolation, per-tenant rate limiting, and usage analytics.</p>
    </div>
    <div class="feature-card">
      <div class="feature-icon"></div>
      <h3>Cost Effective</h3>
      <p>Pay only for what you use. No infrastructure to manage, no servers to maintain.</p>
    </div>
    <div class="feature-card">
      <div class="feature-icon">[EMOJI]</div>
      <h3>Global Scale</h3>
      <p>Deployed on Cloudflare's edge network. Your users get the same fast experience anywhere in the world.</p>
    </div>
    <div class="feature-card">
      <div class="feature-icon"></div>
      <h3>Open Source & Self-Hostable</h3>
      <p>Completely open-source on GitHub. Self-host with unlimited rate limits or wait for subscription tiers. </p>
    </div>
    <div class="feature-card">
      <div class="feature-icon">[EMOJI]️</div>
      <h3>Developer Dashboard</h3>
      <p>Manage API keys, view audit logs, monitor analytics, and track usage—all from a beautiful, intuitive dashboard.</p>
      <div class="feature-cta">
        <a href={dashboardLink} class="btn btn-secondary">Open Dashboard </a>
      </div>
    </div>
  </div>
</section>

<style>
  .features {
    padding: var(--spacing-3xl) var(--spacing-xl);
    max-width: 1200px;
    margin: 0 auto;
  }

  .features h2 {
    text-align: center;
    font-size: clamp(2rem, 4vw, 3rem);
    margin-bottom: var(--spacing-2xl);
    color: var(--accent);
  }

  .features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: var(--spacing-lg);
    margin-bottom: var(--spacing-3xl);
  }

  .feature-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--spacing-xl);
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .feature-card:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-lg);
    border-color: var(--border-light);
  }

  .feature-icon {
    font-size: 2.5rem;
    margin-bottom: var(--spacing-md);
  }

  .feature-card h3 {
    font-size: 1.25rem;
    margin-bottom: var(--spacing-sm);
    color: var(--accent);
  }

  .feature-card p {
    color: var(--text-secondary);
  }

  .feature-cta {
    margin-top: var(--spacing-md);
  }

  .btn {
    padding: var(--spacing-sm) var(--spacing-md);
    border: 3px solid;
    border-radius: 0;
    font-size: 0.875rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    cursor: pointer;
    transition: all 0.1s cubic-bezier(0.4, 0, 0.2, 1);
    text-decoration: none;
    display: inline-block;
    background: transparent;
    color: var(--text);
  }

  .btn-secondary {
    border-color: var(--border-light);
    color: var(--text);
  }

  .btn-secondary:hover {
    background: var(--border);
    border-color: var(--border-light);
  }

  @media (max-width: 768px) {
    .features {
      padding: var(--spacing-2xl) var(--spacing-md);
    }
  }
</style>

