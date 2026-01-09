<script lang="ts">
  import Tooltip from '@shared-components/svelte/Tooltip.svelte';
  import StatusFlair from '@shared-components/svelte/StatusFlair.svelte';
  import InTestingTooltip from './InTestingTooltip.svelte';
  
  export let dashboardLink: string = '/dashboard';
</script>

<section class="features">
  <h2>Why Choose OTP Auth?</h2>
  <div class="features-grid">
    <div class="feature-card">
      <h3><span class="feature-icon">▸</span> Lightning Fast</h3>
      <p>Built on Cloudflare Workers for global edge deployment. Sub-100ms response times worldwide.</p>
    </div>
    <div class="feature-card">
      <h3><span class="feature-icon">◆</span> Enterprise Security</h3>
      <p>Cryptographically secure OTP codes, JWT tokens, rate limiting, and comprehensive audit logging.</p>
    </div>
    <div class="feature-card">
      <h3><span class="feature-icon">◉</span> Easy Integration</h3>
      <p>Simple REST API that works with any framework. React, Svelte, Vue, or vanilla JavaScript—we've got you covered.</p>
    </div>
    <Tooltip 
      component={InTestingTooltip} 
      componentProps={{
        featureName: "Multi-Tenant Ready",
        icon: "▣",
        description: "This feature is currently being tested and refined. Some functionality may be limited or subject to change.",
        additionalInfo: "Expected stable release: Q2 2026"
      }}
      level="info" 
      position="top"
    >
      <StatusFlair status="in-testing">
        <div class="feature-card">
          <h3><span class="feature-icon">▣</span> Multi-Tenant Ready</h3>
          <p>Built for SaaS applications. Complete customer isolation, per-tenant rate limiting, and usage analytics.</p>
        </div>
      </StatusFlair>
    </Tooltip>
    <div class="feature-card">
      <h3><span class="feature-icon">$</span> Cost Effective</h3>
      <p>Pay only for what you use. No infrastructure to manage, no servers to maintain.</p>
    </div>
    <div class="feature-card">
      <h3><span class="feature-icon">◎</span> Global Scale</h3>
      <p>Deployed on Cloudflare's edge network. Your customers get the same fast experience anywhere in the world.</p>
    </div>
    <div class="feature-card">
      <h3><span class="feature-icon">▣</span> Open Source & Self-Hostable</h3>
      <p>Completely open-source on GitHub. Self-host with unlimited rate limits or wait for subscription tiers. </p>
    </div>
    <Tooltip 
      component={InTestingTooltip} 
      componentProps={{
        featureName: "Developer Dashboard",
        icon: "◈",
        description: "The dashboard is functional but still being refined. Advanced analytics and custom reporting features coming soon.",
        additionalInfo: "Current features: API keys, audit logs, basic analytics"
      }}
      level="info" 
      position="top"
    >
      <StatusFlair status="in-testing">
        <div class="feature-card">
          <h3><span class="feature-icon">◈</span> Developer Dashboard</h3>
          <p>Manage API keys, view audit logs, monitor analytics, and track usage—all from a beautiful, intuitive dashboard.</p>
          <div class="feature-cta">
            <a href={dashboardLink} class="btn btn-secondary">Open Dashboard </a>
          </div>
        </div>
      </StatusFlair>
    </Tooltip>
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
    width: 100%;
    min-width: 0;
  }

  .feature-card:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-lg);
    border-color: var(--border-light);
  }

  .feature-card h3 {
    display: flex;
    align-items: center;
    font-size: 1.25rem;
    margin-bottom: var(--spacing-sm);
    color: var(--accent);
  }

  .feature-icon {
    display: inline-block;
    font-size: 1.5rem;
    margin-right: 0.5rem;
    line-height: 1;
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

    .features-grid {
      grid-template-columns: 1fr;
      gap: var(--spacing-md);
    }

    .feature-card {
      padding: var(--spacing-md);
    }

    .feature-card h3 {
      font-size: 1.1rem;
    }

    .feature-icon {
      font-size: 1.25rem;
    }
  }

  @media (max-width: 480px) {
    .features {
      padding: var(--spacing-xl) var(--spacing-sm);
    }

    .features h2 {
      font-size: 1.75rem;
      margin-bottom: var(--spacing-lg);
    }

    .features-grid {
      gap: var(--spacing-sm);
    }

    .feature-card {
      padding: var(--spacing-sm);
    }

    .feature-card h3 {
      font-size: 1rem;
    }

    .feature-card p {
      font-size: 0.875rem;
    }

    .btn {
      padding: var(--spacing-xs) var(--spacing-sm);
      font-size: 0.75rem;
    }
  }
</style>

