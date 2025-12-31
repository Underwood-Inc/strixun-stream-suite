<script lang="ts">
  /**
   * RateLimitInfoCard Component
   * 
   * A reusable card component that explains how dynamic rate limiting works.
   * Can be used standalone or embedded in tooltips.
   * Supports dynamic content based on user's current rate limit status.
   * 
   * @example
   * ```svelte
   * <!-- Standalone card -->
   * <RateLimitInfoCard />
   * 
   * <!-- Compact version for tooltips -->
   * <RateLimitInfoCard compact={true} />
   * 
   * <!-- With dynamic user data -->
   * <RateLimitInfoCard 
   *   emailLimit={{ current: 1, max: 1 }}
   *   failedAttempts={3}
   * />
   * ```
   */

  export let compact: boolean = false;
  export let embedded: boolean = false; // When true, removes card styling (border, background, padding) for use in tooltips
  export let className: string = '';
  
  // Optional dynamic data
  export let emailLimit: { current: number; max: number; resetAt?: string } | null = null;
  export let failedAttempts: number | null = null;
  export let baseLimit: number = 3; // Default free tier base limit

  interface AdjustmentExample {
    scenario: string;
    base: number;
    adjustment: string;
    result: number;
    description: string;
    isCurrent?: boolean;
  }

  interface Recommendation {
    action: string;
    benefit: string;
    impact: string;
    priority: 'high' | 'medium' | 'low';
  }

  // Calculate current scenario and recommendations
  $: currentScenario = emailLimit ? calculateCurrentScenario() : null;
  $: recommendations = currentScenario ? generateRecommendations() : [];
  $: examples = getExamples();

  function calculateCurrentScenario(): { scenario: string; adjustment: number; result: number } | null {
    if (!emailLimit) return null;
    
    const adjustment = emailLimit.max - baseLimit;
    
    // Determine scenario based on adjustment
    let scenario: string;
    if (adjustment >= 2) scenario = 'New User';
    else if (adjustment === 1) scenario = 'Trusted User';
    else if (adjustment === 0) scenario = 'Normal User';
    else if (adjustment === -1) scenario = 'Frequent Requester';
    else scenario = 'Suspicious Activity';
    
    return { scenario, adjustment, result: emailLimit.max };
  }

  function generateRecommendations(): Recommendation[] {
    const recs: Recommendation[] = [];
    
    if (!emailLimit) return recs;
    
    const adjustment = emailLimit.max - baseLimit;
    const currentLimit = emailLimit.max;
    
    // If they have a low limit, suggest ways to improve
    if (currentLimit < baseLimit) {
      // High failure rate penalty
      if (currentLimit === 1 && failedAttempts && failedAttempts > 0) {
        recs.push({
          action: 'Successfully complete a login',
          benefit: 'Reduces failure rate',
          impact: 'Could increase limit from 1 to 2-3/hour',
          priority: 'high'
        });
      }
      
      // Frequent requester penalty
      if (currentLimit === 2) {
        recs.push({
          action: 'Wait 24 hours',
          benefit: 'Resets request count',
          impact: 'Could increase limit from 2 to 3/hour',
          priority: 'high'
        });
      }
    }
    
    // Always suggest verified email bonus if they don't have it
    if (adjustment < 1) {
      recs.push({
        action: 'Successfully log in',
        benefit: 'Gets verified email bonus',
        impact: 'Adds +1 to your limit (up to 4/hour)',
        priority: adjustment < 0 ? 'high' : 'medium'
      });
    }
    
    // If they're at base limit, suggest new email bonus
    if (adjustment === 0) {
      recs.push({
        action: 'Wait 24 hours with no requests',
        benefit: 'Qualifies for new email bonus',
        impact: 'Could increase limit from 3 to 5/hour',
        priority: 'low'
      });
    }
    
    return recs;
  }

  function getExamples(): AdjustmentExample[] {
    const baseExamples: AdjustmentExample[] = [
      {
        scenario: 'New User',
        base: baseLimit,
        adjustment: '+2',
        result: baseLimit + 2,
        description: 'First time using this email'
      },
      {
        scenario: 'Trusted User',
        base: baseLimit,
        adjustment: '+1',
        result: baseLimit + 1,
        description: 'Recent successful login'
      },
      {
        scenario: 'Normal User',
        base: baseLimit,
        adjustment: '0',
        result: baseLimit,
        description: 'Standard usage pattern'
      },
      {
        scenario: 'Frequent Requester',
        base: baseLimit,
        adjustment: '-1',
        result: baseLimit - 1,
        description: 'Many requests recently'
      },
      {
        scenario: 'Suspicious Activity',
        base: baseLimit,
        adjustment: '-2',
        result: baseLimit - 2,
        description: 'High failure rate detected'
      }
    ];
    
    // Mark current scenario if we have data
    if (currentScenario) {
      return baseExamples.map(ex => ({
        ...ex,
        isCurrent: ex.scenario === currentScenario.scenario
      }));
    }
    
    return baseExamples;
  }

  function getAdjustmentColor(adjustment: string): string {
    if (adjustment.startsWith('+')) return 'var(--success)';
    if (adjustment.startsWith('-')) return 'var(--warning)';
    return 'var(--text-secondary)';
  }

  function getPriorityColor(priority: string): string {
    if (priority === 'high') return 'var(--warning)';
    if (priority === 'medium') return 'var(--info)';
    return 'var(--text-secondary)';
  }
</script>

<div class="rate-limit-info-card {className}" class:rate-limit-info-card--compact={compact} class:rate-limit-info-card--embedded={embedded}>
  <div class="rate-limit-info-card__header">
    <div class="rate-limit-info-card__icon">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 16v-4"/>
        <path d="M12 8h.01"/>
      </svg>
    </div>
    <h3 class="rate-limit-info-card__title">Dynamic Rate Limiting</h3>
  </div>

  <div class="rate-limit-info-card__content">
    <p class="rate-limit-info-card__description">
      Your rate limit adjusts based on your usage patterns. New and trusted users get more leeway, while suspicious activity gets restricted.
    </p>

    {#if currentScenario}
      <div class="rate-limit-info-card__current-status">
        <div class="rate-limit-info-card__current-label">Your Current Status:</div>
        <div class="rate-limit-info-card__current-scenario">
          <span class="rate-limit-info-card__current-scenario-name">{currentScenario.scenario}</span>
          <span class="rate-limit-info-card__current-scenario-limit">
            {currentScenario.result}/hour limit
          </span>
        </div>
        {#if emailLimit}
          <div class="rate-limit-info-card__current-usage">
            Using {emailLimit.current} of {emailLimit.max} requests
          </div>
        {/if}
      </div>
    {:else if !compact}
      <div class="rate-limit-info-card__base-info">
        <div class="rate-limit-info-card__base-label">Base Limit (Free Tier):</div>
        <div class="rate-limit-info-card__base-value">{baseLimit} requests/hour</div>
      </div>
    {/if}

    {#if recommendations.length > 0}
      <div class="rate-limit-info-card__recommendations">
        <div class="rate-limit-info-card__recommendations-header"> ★ How to Improve Your Limit:</div>
        <div class="rate-limit-info-card__recommendations-list">
          {#each recommendations as rec}
            <div class="rate-limit-info-card__recommendation" class:rate-limit-info-card__recommendation--high={rec.priority === 'high'}>
              <div class="rate-limit-info-card__recommendation-action">
                <span class="rate-limit-info-card__recommendation-icon"></span>
                <strong>{rec.action}</strong>
              </div>
              <div class="rate-limit-info-card__recommendation-benefit">
                {rec.benefit}: <span class="rate-limit-info-card__recommendation-impact">{rec.impact}</span>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <div class="rate-limit-info-card__examples">
      <div class="rate-limit-info-card__examples-header">How It Works:</div>
      <div class="rate-limit-info-card__examples-list">
        {#each examples as example}
          <div class="rate-limit-info-card__example" class:rate-limit-info-card__example--current={example.isCurrent}>
            <div class="rate-limit-info-card__example-scenario">
              {example.scenario}
              {#if example.isCurrent}
                <span class="rate-limit-info-card__example-current-badge">(You)</span>
              {/if}
            </div>
            <div class="rate-limit-info-card__example-calculation">
              <span class="rate-limit-info-card__example-base">{example.base}</span>
              <span class="rate-limit-info-card__example-adjustment" style="color: {getAdjustmentColor(example.adjustment)}">
                {example.adjustment}
              </span>
              <span class="rate-limit-info-card__example-equals">=</span>
              <span class="rate-limit-info-card__example-result">{example.result}/hour</span>
            </div>
            <div class="rate-limit-info-card__example-description">{example.description}</div>
          </div>
        {/each}
      </div>
    </div>

    {#if !compact}
      <div class="rate-limit-info-card__factors">
        <div class="rate-limit-info-card__factors-header">Adjustment Factors:</div>
        <ul class="rate-limit-info-card__factors-list">
          <li class="rate-limit-info-card__factor rate-limit-info-card__factor--positive">
            <span class="rate-limit-info-card__factor-icon">+</span>
            <span class="rate-limit-info-card__factor-text">New email bonus: +2 (less than 3 requests in 24h)</span>
          </li>
          <li class="rate-limit-info-card__factor rate-limit-info-card__factor--positive">
            <span class="rate-limit-info-card__factor-icon">+</span>
            <span class="rate-limit-info-card__factor-text">Verified email bonus: +1 (successful login in last 7 days)</span>
          </li>
          <li class="rate-limit-info-card__factor rate-limit-info-card__factor--negative">
            <span class="rate-limit-info-card__factor-icon">-</span>
            <span class="rate-limit-info-card__factor-text">Frequent email penalty: -1 (more than 10 requests in 24h)</span>
          </li>
          <li class="rate-limit-info-card__factor rate-limit-info-card__factor--negative">
            <span class="rate-limit-info-card__factor-icon">-</span>
            <span class="rate-limit-info-card__factor-text">High failure rate penalty: -2 (more than 50% failure rate)</span>
          </li>
        </ul>
      </div>
    {/if}
  </div>
</div>

<style lang="scss">
  @use '../../shared-styles/_variables.scss' as *;

  .rate-limit-info-card {
    display: flex;
    flex-direction: column;
    background: linear-gradient(135deg, var(--card) 0%, var(--bg-dark) 100%);
    border: 2px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--spacing-md);
    box-sizing: border-box;
    max-width: 100%;
    color: var(--text);
  }

  .rate-limit-info-card--compact {
    padding: var(--spacing-sm);
    border-width: 1px;
  }

  .rate-limit-info-card--embedded {
    background: transparent;
    border: none;
    border-radius: 0;
    padding: 0;
  }

  .rate-limit-info-card__header {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-md);
  }

  .rate-limit-info-card--compact .rate-limit-info-card__header {
    margin-bottom: var(--spacing-sm);
  }

  .rate-limit-info-card__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: rgba(100, 149, 237, 0.15);
    border-radius: var(--radius-sm);
    color: var(--info);
    flex-shrink: 0;
  }

  .rate-limit-info-card--compact .rate-limit-info-card__icon {
    width: 24px;
    height: 24px;
  }

  .rate-limit-info-card__icon svg {
    width: 20px;
    height: 20px;
  }

  .rate-limit-info-card--compact .rate-limit-info-card__icon svg {
    width: 16px;
    height: 16px;
  }

  .rate-limit-info-card__title {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text);
    margin: 0;
    line-height: 1.4;
  }

  .rate-limit-info-card--compact .rate-limit-info-card__title {
    font-size: 0.95rem;
  }

  .rate-limit-info-card__content {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .rate-limit-info-card--compact .rate-limit-info-card__content {
    gap: var(--spacing-sm);
  }

  .rate-limit-info-card__description {
    font-size: 0.9rem;
    color: var(--text-secondary);
    margin: 0;
    line-height: 1.5;
  }

  .rate-limit-info-card--compact .rate-limit-info-card__description {
    font-size: 0.85rem;
  }

  .rate-limit-info-card__base-info {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-sm);
    background: rgba(100, 149, 237, 0.1);
    border-radius: var(--radius-sm);
    border: 1px solid rgba(100, 149, 237, 0.2);
  }

  .rate-limit-info-card__base-label {
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .rate-limit-info-card__base-value {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--info);
  }

  .rate-limit-info-card__current-status {
    padding: var(--spacing-sm);
    background: rgba(237, 174, 73, 0.1);
    border-radius: var(--radius-sm);
    border: 1px solid rgba(237, 174, 73, 0.3);
    margin-bottom: var(--spacing-sm);
  }

  .rate-limit-info-card__current-label {
    font-size: 0.8rem;
    color: var(--text-secondary);
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .rate-limit-info-card__current-scenario {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-sm);
    margin-bottom: 4px;
  }

  .rate-limit-info-card__current-scenario-name {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--accent);
  }

  .rate-limit-info-card__current-scenario-limit {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text);
    font-family: monospace;
  }

  .rate-limit-info-card__current-usage {
    font-size: 0.75rem;
    color: var(--text-secondary);
    font-style: italic;
  }

  .rate-limit-info-card__recommendations {
    padding: var(--spacing-sm);
    background: rgba(40, 167, 69, 0.08);
    border-radius: var(--radius-sm);
    border: 1px solid rgba(40, 167, 69, 0.2);
    margin-bottom: var(--spacing-sm);
  }

  .rate-limit-info-card__recommendations-header {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--success);
    margin-bottom: var(--spacing-xs);
  }

  .rate-limit-info-card--compact .rate-limit-info-card__recommendations-header {
    font-size: 0.85rem;
  }

  .rate-limit-info-card__recommendations-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .rate-limit-info-card__recommendation {
    padding: var(--spacing-xs);
    background: rgba(255, 255, 255, 0.03);
    border-radius: var(--radius-sm);
    border-left: 2px solid var(--success);
  }

  .rate-limit-info-card__recommendation--high {
    border-left-color: var(--warning);
    background: rgba(255, 193, 7, 0.05);
  }

  .rate-limit-info-card__recommendation-action {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.85rem;
    color: var(--text);
    margin-bottom: 4px;
  }

  .rate-limit-info-card--compact .rate-limit-info-card__recommendation-action {
    font-size: 0.8rem;
  }

  .rate-limit-info-card__recommendation-icon {
    color: var(--success);
    font-weight: 700;
  }

  .rate-limit-info-card__recommendation--high .rate-limit-info-card__recommendation-icon {
    color: var(--warning);
  }

  .rate-limit-info-card__recommendation-benefit {
    font-size: 0.75rem;
    color: var(--text-secondary);
    padding-left: 20px;
    line-height: 1.4;
  }

  .rate-limit-info-card--compact .rate-limit-info-card__recommendation-benefit {
    font-size: 0.7rem;
  }

  .rate-limit-info-card__recommendation-impact {
    color: var(--accent);
    font-weight: 500;
  }

  .rate-limit-info-card__examples {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .rate-limit-info-card__examples-header {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text);
    margin-bottom: var(--spacing-xs);
  }

  .rate-limit-info-card--compact .rate-limit-info-card__examples-header {
    font-size: 0.85rem;
    margin-bottom: 4px;
  }

  .rate-limit-info-card__examples-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .rate-limit-info-card--compact .rate-limit-info-card__examples-list {
    gap: 4px;
  }

  .rate-limit-info-card__example {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: var(--spacing-xs);
    background: rgba(255, 255, 255, 0.03);
    border-radius: var(--radius-sm);
    border-left: 2px solid var(--border);
    transition: all 0.2s ease;
  }

  .rate-limit-info-card__example--current {
    background: rgba(237, 174, 73, 0.1);
    border-left-color: var(--accent);
    box-shadow: 0 0 0 1px rgba(237, 174, 73, 0.2);
  }

  .rate-limit-info-card--compact .rate-limit-info-card__example {
    padding: 6px;
  }

  .rate-limit-info-card__example-scenario {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text);
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .rate-limit-info-card__example-current-badge {
    font-size: 0.7rem;
    padding: 2px 6px;
    background: var(--accent);
    color: var(--bg-dark);
    border-radius: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .rate-limit-info-card--compact .rate-limit-info-card__example-scenario {
    font-size: 0.8rem;
  }

  .rate-limit-info-card__example-calculation {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.85rem;
    font-family: 'Courier New', monospace;
  }

  .rate-limit-info-card--compact .rate-limit-info-card__example-calculation {
    font-size: 0.75rem;
    gap: 4px;
  }

  .rate-limit-info-card__example-base {
    color: var(--text);
    font-weight: 600;
  }

  .rate-limit-info-card__example-adjustment {
    font-weight: 600;
  }

  .rate-limit-info-card__example-equals {
    color: var(--text-secondary);
  }

  .rate-limit-info-card__example-result {
    color: var(--accent);
    font-weight: 600;
  }

  .rate-limit-info-card__example-description {
    font-size: 0.75rem;
    color: var(--text-secondary);
    font-style: italic;
  }

  .rate-limit-info-card--compact .rate-limit-info-card__example-description {
    font-size: 0.7rem;
  }

  .rate-limit-info-card__factors {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    padding-top: var(--spacing-sm);
    border-top: 1px solid var(--border);
  }

  .rate-limit-info-card__factors-header {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text);
  }

  .rate-limit-info-card__factors-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    margin: 0;
    padding-left: var(--spacing-md);
    list-style: none;
  }

  .rate-limit-info-card__factor {
    display: flex;
    align-items: flex-start;
    gap: var(--spacing-xs);
    font-size: 0.85rem;
    line-height: 1.5;
  }

  .rate-limit-info-card__factor-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    font-weight: 700;
    font-size: 0.75rem;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .rate-limit-info-card__factor--positive .rate-limit-info-card__factor-icon {
    background: rgba(40, 167, 69, 0.2);
    color: var(--success);
  }

  .rate-limit-info-card__factor--negative .rate-limit-info-card__factor-icon {
    background: rgba(255, 193, 7, 0.2);
    color: var(--warning);
  }

  .rate-limit-info-card__factor-text {
    color: var(--text-secondary);
    flex: 1;
  }

  @media (max-width: 480px) {
    .rate-limit-info-card {
      padding: var(--spacing-sm);
    }

    .rate-limit-info-card__title {
      font-size: 1rem;
    }

    .rate-limit-info-card__description {
      font-size: 0.85rem;
    }
  }
</style>

