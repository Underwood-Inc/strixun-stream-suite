<script lang="ts">
  import StatusFlair from '@shared-components/svelte/StatusFlair.svelte';
</script>

<section class="self-hosting" id="self-hosting">
  <div class="self-hosting-content">
    <h2>Outgrown the <StatusFlair status="in-testing">Free Tier</StatusFlair>? We've Got You Covered </h2>
    <p class="self-hosting-subtitle">
      Great news! This application is completely open-source on GitHub, so you can self-host with unlimited rate limits. 
      Or sit tight—<StatusFlair status="wip">subscription tiers with enhanced limits</StatusFlair> are coming soon.
    </p>
    
    <div class="self-hosting-grid">
      <div class="self-hosting-card">
        <h3> Self-Host on GitHub</h3>
        <p>
          The entire codebase is open-source and available on GitHub. Deploy it on your own infrastructure 
          with complete control over rate limits, configuration, and data.
        </p>
        <ul>
          <li>Unlimited rate limits</li>
          <li>Full control over configuration</li>
          <li>Complete data ownership</li>
          <li>Custom email providers</li>
          <li>Deploy anywhere (Cloudflare, AWS, GCP, etc.)</li>
        </ul>
        <div class="card-cta">
          <a href="https://github.com/Underwood-Inc/strixun-stream-suite/tree/master/serverless/otp-auth-service" target="_blank" rel="noopener noreferrer" class="btn btn-github">
            <span> ★ </span> View on GitHub
          </a>
        </div>
      </div>

      <div class="self-hosting-card">
        <StatusFlair status="wip">
          <h3>★ Subscription Tiers <span class="coming-soon-badge">Coming Soon</span></h3>
        </StatusFlair>
        <p>
          Don't want to manage infrastructure? <StatusFlair status="wip">Subscription tiers with enhanced rate limits</StatusFlair> are on the way. 
          Get notified when they launch and keep using our managed service.
        </p>
        <ul>
          <li>Enhanced rate limits</li>
          <li>Priority support</li>
          <li>Advanced analytics</li>
          <li>Custom email templates</li>
          <li>Dedicated infrastructure</li>
        </ul>
        <div class="card-cta">
          <a href="#code-examples" class="btn btn-secondary">
            Get Notified
          </a>
        </div>
      </div>

      <div class="self-hosting-card">
        <h3> ★ Why Choose Self-Hosting?</h3>
        <p>
          Self-hosting gives you complete freedom and control. Perfect for enterprises, high-traffic applications, 
          or when you need custom configurations.
        </p>
        <ul>
          <li>No usage limits</li>
          <li>Full source code access</li>
          <li>Custom modifications allowed</li>
          <li>No vendor lock-in</li>
          <li>Community-driven improvements</li>
        </ul>
        <div class="card-cta">
          <a href="#docs" class="btn btn-secondary">
            View Documentation
          </a>
        </div>
      </div>
    </div>

    <div class="self-hosting-cta">
      <a href="https://github.com/Underwood-Inc/strixun-stream-suite" target="_blank" rel="noopener noreferrer" class="btn btn-primary">
        <svg class="star-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
        Star on GitHub
      </a>
      <StatusFlair status="in-testing">
        <a href="#code-examples" class="btn btn-secondary">
          Continue with Free Tier
        </a>
      </StatusFlair>
    </div>
  </div>
</section>

<style>
  .self-hosting {
    background: linear-gradient(135deg, var(--bg-dark) 0%, var(--card) 100%);
    padding: var(--spacing-3xl) var(--spacing-xl);
    margin: var(--spacing-3xl) 0;
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
  }

  .self-hosting-content {
    max-width: 1200px;
    margin: 0 auto;
  }

  .self-hosting h2 {
    text-align: center;
    font-size: clamp(2rem, 4vw, 3rem);
    margin-bottom: var(--spacing-lg);
    color: var(--accent);
  }

  .self-hosting-subtitle {
    text-align: center;
    font-size: clamp(1.1rem, 2vw, 1.25rem);
    color: var(--text-secondary);
    margin-bottom: var(--spacing-2xl);
    max-width: 800px;
    margin-left: auto;
    margin-right: auto;
  }

  .self-hosting-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: var(--spacing-lg);
    margin-bottom: var(--spacing-2xl);
  }

  .self-hosting-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--spacing-xl);
    transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
    position: relative;
    overflow: hidden;
    width: 100%;
    min-width: 0;
  }

  .self-hosting-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, var(--accent), var(--accent-light));
    transform: scaleX(0);
    transition: transform 0.3s;
  }

  .self-hosting-card:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-lg);
    border-color: var(--accent);
  }

  .self-hosting-card:hover::before {
    transform: scaleX(1);
  }

  .self-hosting-card h3 {
    font-size: 1.5rem;
    margin-bottom: var(--spacing-md);
    color: var(--accent);
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .self-hosting-card p {
    color: var(--text-secondary);
    line-height: 1.7;
    margin-bottom: var(--spacing-md);
  }

  .self-hosting-card ul {
    list-style: none;
    margin: var(--spacing-md) 0;
    padding: 0;
  }

  .self-hosting-card li {
    padding: var(--spacing-xs) 0;
    color: var(--text-secondary);
    padding-left: var(--spacing-lg);
    position: relative;
  }

  .self-hosting-card li::before {
    content: '';
    position: absolute;
    left: 0;
    color: var(--success);
    font-weight: bold;
  }

  .card-cta {
    margin-top: var(--spacing-lg);
  }

  .self-hosting-cta {
    display: flex;
    gap: var(--spacing-md);
    justify-content: center;
    flex-wrap: wrap;
    margin-top: var(--spacing-2xl);
  }

  .btn {
    padding: var(--spacing-sm) var(--spacing-lg);
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

  .btn-primary {
    background: var(--accent);
    border-color: var(--accent-dark);
    color: #000;
    box-shadow: 0 4px 0 var(--accent-dark);
  }

  .btn-primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 0 var(--accent-dark);
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-xs);
  }

  .star-icon {
    width: 16px;
    height: 16px;
    fill: currentColor;
    stroke: currentColor;
    flex-shrink: 0;
  }

  .btn-secondary {
    border-color: var(--border-light);
    color: var(--text);
  }

  .btn-secondary:hover {
    background: var(--border);
    border-color: var(--border-light);
  }

  .btn-github {
    background: var(--bg-dark);
    border-color: var(--border-light);
    color: var(--text);
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .btn-github:hover {
    background: var(--card);
    border-color: var(--accent);
    color: var(--accent);
  }

  .coming-soon-badge {
    display: inline-block;
    background: var(--accent);
    color: #000;
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--radius-sm);
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-left: var(--spacing-sm);
  }

  @media (max-width: 768px) {
    .self-hosting {
      padding: var(--spacing-2xl) var(--spacing-md);
    }

    .self-hosting-grid {
      grid-template-columns: 1fr;
      gap: var(--spacing-md);
    }

    .self-hosting-card {
      padding: var(--spacing-md);
    }

    .self-hosting-card:hover {
      transform: translateY(-2px);
    }

    .self-hosting-card h3 {
      font-size: 1.25rem;
    }

    .self-hosting-cta {
      flex-direction: column;
      align-items: stretch;
    }

    .btn {
      width: 100%;
      text-align: center;
      justify-content: center;
    }
  }

  @media (max-width: 480px) {
    .self-hosting {
      padding: var(--spacing-xl) var(--spacing-sm);
      margin: var(--spacing-2xl) 0;
    }

    .self-hosting h2 {
      font-size: 1.75rem;
      margin-bottom: var(--spacing-md);
    }

    .self-hosting-subtitle {
      font-size: 0.95rem;
      margin-bottom: var(--spacing-lg);
    }

    .self-hosting-grid {
      gap: var(--spacing-sm);
      margin-bottom: var(--spacing-lg);
    }

    .self-hosting-card {
      padding: var(--spacing-sm);
    }

    .self-hosting-card:hover {
      transform: none;
    }

    .self-hosting-card h3 {
      font-size: 1.1rem;
      flex-wrap: wrap;
    }

    .self-hosting-card p {
      font-size: 0.875rem;
    }

    .self-hosting-card li {
      font-size: 0.875rem;
    }

    .coming-soon-badge {
      font-size: 0.65rem;
      padding: 2px var(--spacing-xs);
      margin-left: var(--spacing-xs);
    }

    .btn {
      padding: var(--spacing-xs) var(--spacing-md);
      font-size: 0.75rem;
    }

    .star-icon {
      width: 14px;
      height: 14px;
    }
  }
</style>

