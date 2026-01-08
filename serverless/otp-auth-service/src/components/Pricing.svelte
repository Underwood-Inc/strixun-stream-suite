<script lang="ts">
  import StatusFlair from '@shared-components/svelte/StatusFlair.svelte';
  import Tooltip from '@shared-components/svelte/Tooltip.svelte';
  import ObfuscatedText from '@shared-components/svelte/ObfuscatedText.svelte';
  import InDevelopmentTooltip from './InDevelopmentTooltip.svelte';
</script>

<section class="pricing" id="pricing">
  <h2>Simple, Transparent Pricing</h2>
  <p class="subtitle">
    Start with the free tier. Upgrade as you grow. No hidden fees.
  </p>
  
  <div class="dev-notice">
    <strong>▸ Note:</strong> Paid subscription tiers are currently in development. 
    <Tooltip 
      component={InDevelopmentTooltip}
      componentProps={{
        featureName: "Free Tier Status",
        icon: "⚠",
        description: "The free tier is currently under active development and testing. Full functionality is not yet available.",
        additionalInfo: "Expected to be production-ready: Q3 2026"
      }}
      level="warning"
      position="top"
    >
      <StatusFlair status="in-testing">
        <span class="testing-text">The <strong>Free tier is fully functional</strong> and ready to use now!</span>
      </StatusFlair>
    </Tooltip>
  </div>

  <div class="pricing-grid">
    <!-- Free Tier -->
    <div class="pricing-card">
      <div class="pricing-header">
        <h3>Free</h3>
        <div class="price">
          <span class="amount">$0</span>
          <span class="period">/month</span>
        </div>
      </div>
      <div class="pricing-body">
        <ul class="features">
          <li>✓ 1,000 OTP requests/month</li>
          <li>✓ 50 requests/day</li>
          <li>✓ Basic email templates</li>
          <li>✓ API key access</li>
          <li>✓ Community support</li>
          <li>✓ 100 max users</li>
        </ul>
        <a href="/dashboard" class="btn btn-secondary">Get Started Free</a>
      </div>
    </div>

    <!-- Starter Tier -->
    <Tooltip 
      component={InDevelopmentTooltip}
      componentProps={{
        featureName: "Starter Plan",
        icon: "▹",
        description: "Subscription billing is currently in development and not yet available. This tier will include automatic billing through Stripe.",
        additionalInfo: "Expected release: Q3/Q4 2026"
      }}
      level="warning"
      position="top"
    >
      <StatusFlair status="wip">
        <div class="pricing-card disabled">
          <div class="badge badge-dev">Coming Soon</div>
          <div class="pricing-header">
            <h3>Starter</h3>
            <div class="price">
              <span class="amount">$<ObfuscatedText text="29" length={2} /></span>
              <span class="period">/month</span>
            </div>
          </div>
          <div class="pricing-body">
            <ul class="features">
              <li>✓ <ObfuscatedText text="10,000" length={6} /> OTP requests/month</li>
              <li>✓ <ObfuscatedText text="500" length={3} /> requests/day</li>
              <li>✓ Custom email templates</li>
              <li>✓ Webhooks</li>
              <li>✓ Email support</li>
              <li>✓ <ObfuscatedText text="1,000" length={5} /> max users</li>
              <li>✓ Custom domain</li>
            </ul>
            <button class="btn btn-secondary" disabled>Coming Soon</button>
          </div>
        </div>
      </StatusFlair>
    </Tooltip>

    <!-- Pro Tier -->
    <Tooltip 
      component={InDevelopmentTooltip}
      componentProps={{
        featureName: "Pro Plan",
        icon: "★",
        description: "Subscription billing is currently in development and not yet available. This tier will include automatic billing through Stripe.",
        additionalInfo: "Expected release: Q3/Q4 2026"
      }}
      level="warning"
      position="top"
    >
      <StatusFlair status="wip">
        <div class="pricing-card featured disabled">
          <div class="badge badge-dev">Coming Soon</div>
          <div class="pricing-header">
            <h3>Pro</h3>
            <div class="price">
              <span class="amount">$<ObfuscatedText text="99" length={2} /></span>
              <span class="period">/month</span>
            </div>
          </div>
          <div class="pricing-body">
            <ul class="features">
              <li>✓ <ObfuscatedText text="100,000" length={7} /> OTP requests/month</li>
              <li>✓ <ObfuscatedText text="5,000" length={5} /> requests/day</li>
              <li>✓ All Starter features</li>
              <li>✓ Analytics dashboard</li>
              <li>✓ Priority support</li>
              <li>✓ <ObfuscatedText text="10,000" length={6} /> max users</li>
              <li>✓ SSO support</li>
              <li>✓ SLA <ObfuscatedText text="99.9" length={4} />%</li>
            </ul>
            <button class="btn btn-primary" disabled>Coming Soon</button>
          </div>
        </div>
      </StatusFlair>
    </Tooltip>

    <!-- Enterprise Tier -->
    <div class="pricing-card">
        <div class="pricing-header">
          <h3>Enterprise</h3>
          <div class="price">
            <span class="amount">Custom</span>
          </div>
        </div>
        <div class="pricing-body">
          <ul class="features">
            <li>✓ Unlimited OTP requests</li>
            <li>✓ Unlimited users</li>
            <li>✓ All Pro features</li>
            <li>✓ Dedicated support</li>
            <li>✓ Custom SLA</li>
            <li>✓ On-premise option</li>
            <li>✓ Custom integrations</li>
            <li>✓ SLA <ObfuscatedText text="99.99" length={5} />%</li>
          </ul>
        <a href="mailto:support@idling.app" class="btn btn-secondary">Contact Sales</a>
      </div>
    </div>
  </div>

  <div class="pricing-note">
    <p>
      <strong>▹ Usage-Based Add-Ons:</strong> Need more? Pay $<ObfuscatedText text="0.001" length={5} /> per additional OTP request above your plan limit. No surprises.
    </p>
  </div>
</section>

<style>
  .pricing {
    padding: var(--spacing-3xl) var(--spacing-xl);
    max-width: 1200px;
    margin: 0 auto;
    background: var(--bg-dark);
  }

  .pricing h2 {
    text-align: center;
    font-size: clamp(2rem, 4vw, 3rem);
    margin-bottom: var(--spacing-lg);
    color: var(--accent);
  }

  .subtitle {
    text-align: center;
    color: var(--text-secondary);
    margin-bottom: var(--spacing-2xl);
    font-size: 1.1rem;
  }

  .pricing-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr));
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-xl);
  }

  @media (min-width: 1200px) {
    .pricing-grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  @media (max-width: 1199px) and (min-width: 769px) {
    .pricing-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .pricing-card {
    background: var(--card);
    border: 2px solid var(--border);
    border-radius: var(--radius-lg);
    padding: var(--spacing-lg);
    transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
    position: relative;
    display: flex;
    flex-direction: column;
    min-width: 0;
    width: 100%;
  }

  .pricing-card:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-lg);
    border-color: var(--accent);
  }

  .pricing-card.featured {
    border-color: var(--accent);
    border-width: 3px;
    transform: scale(1.05);
  }

  .pricing-card.featured:hover {
    transform: scale(1.05) translateY(-4px);
  }

  .badge {
    position: absolute;
    top: -12px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--accent);
    color: #000;
    padding: var(--spacing-xs) var(--spacing-md);
    border-radius: var(--radius-sm);
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .badge-dev {
    background: var(--warning);
    color: #000;
  }

  .dev-notice {
    background: #fff3cd;
    border: 2px solid #ffc107;
    border-radius: var(--radius-md);
    padding: var(--spacing-md) var(--spacing-lg);
    margin-bottom: var(--spacing-xl);
    color: #856404;
    text-align: center;
  }

  .dev-notice strong {
    color: #000;
  }

  .dev-notice .testing-text {
    display: inline-block;
    text-decoration: underline orange 2px;
    border: dashed solid orange;
    border-radius: var(--radius-sm);
    background: transparent;
  }

  .pricing-card.disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .pricing-card.disabled .btn {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .pricing-header {
    text-align: center;
    margin-bottom: var(--spacing-lg);
    padding-bottom: var(--spacing-lg);
    border-bottom: 2px solid var(--border);
  }

  .pricing-header h3 {
    font-size: 1.5rem;
    margin-bottom: var(--spacing-md);
    color: var(--accent);
  }

  .price {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: var(--spacing-xs);
  }

  .amount {
    font-size: 2.5rem;
    font-weight: 700;
    color: var(--text);
  }

  .period {
    font-size: 1rem;
    color: var(--text-secondary);
  }

  .pricing-body {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .features {
    list-style: none;
    padding: 0;
    margin: 0 0 var(--spacing-xl) 0;
    flex: 1;
  }

  .features li {
    padding: var(--spacing-xs) 0;
    color: var(--text-secondary);
    font-size: 0.875rem;
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
    text-align: center;
    width: 100%;
  }

  .btn-primary {
    background: var(--accent);
    border-color: var(--accent-dark);
    color: #000;
    box-shadow: 0 4px 0 var(--accent-dark);
  }

  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 0 var(--accent-dark);
  }

  .btn-primary:active {
    transform: translateY(2px);
    box-shadow: 0 2px 0 var(--accent-dark);
  }

  .btn-secondary {
    background: transparent;
    border-color: var(--border-light);
    color: var(--text);
  }

  .btn-secondary:hover {
    background: var(--border);
    border-color: var(--accent);
  }

  .pricing-note {
    text-align: center;
    background: var(--card);
    border: 2px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--spacing-lg);
    color: var(--text-secondary);
  }

  .pricing-note strong {
    color: var(--accent);
  }

  @media (max-width: 768px) {
    .pricing {
      padding: var(--spacing-2xl) var(--spacing-md);
    }

    .pricing-grid {
      grid-template-columns: 1fr;
      gap: var(--spacing-lg);
    }

    .pricing-card {
      padding: var(--spacing-lg);
    }

    .pricing-card.featured {
      transform: scale(1);
    }

    .pricing-card.featured:hover {
      transform: translateY(-4px);
    }

    .pricing-card:hover {
      transform: translateY(-2px);
    }

    .amount {
      font-size: 2rem;
    }

    .features li {
      font-size: 0.8rem;
    }
  }

  @media (max-width: 480px) {
    .pricing {
      padding: var(--spacing-xl) var(--spacing-sm);
    }

    .pricing h2 {
      font-size: 1.75rem;
      margin-bottom: var(--spacing-md);
    }

    .subtitle {
      font-size: 1rem;
      margin-bottom: var(--spacing-lg);
    }

    .dev-notice {
      padding: var(--spacing-sm) var(--spacing-md);
      font-size: 0.875rem;
    }

    .pricing-grid {
      gap: var(--spacing-md);
    }

    .pricing-card {
      padding: var(--spacing-md);
    }

    .pricing-card:hover {
      transform: none;
    }

    .pricing-header h3 {
      font-size: 1.25rem;
    }

    .amount {
      font-size: 1.75rem;
    }

    .period {
      font-size: 0.875rem;
    }

    .features li {
      font-size: 0.75rem;
      padding: var(--spacing-xs) 0;
    }

    .btn {
      padding: var(--spacing-xs) var(--spacing-md);
      font-size: 0.75rem;
    }

    .pricing-note {
      padding: var(--spacing-md);
      font-size: 0.875rem;
    }

    .badge {
      font-size: 0.65rem;
      padding: var(--spacing-xs) var(--spacing-sm);
    }
  }
</style>
