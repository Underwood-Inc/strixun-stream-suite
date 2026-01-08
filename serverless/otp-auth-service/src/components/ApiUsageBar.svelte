<script lang="ts">
  import { onMount } from 'svelte';

  let visible = false;
  let dailyUsage = 0;
  let dailyLimit = 1000;
  let monthlyUsage = 0;
  let monthlyLimit = 10000;

  const API_URL = typeof window !== 'undefined' ? window.location.origin : '';

  async function loadApiUsage() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token) {
      visible = false;
      return;
    }

    try {
      const response = await fetch(`${API_URL}/auth/quota`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          visible = false;
          if (typeof window !== 'undefined') {
            localStorage.removeItem('auth_token');
          }
        }
        return;
      }

      const data = await response.json();
      if (!data.success || !data.quota || !data.usage) {
        return;
      }

      visible = true;
      dailyUsage = data.usage.daily || 0;
      dailyLimit = data.quota.otpRequestsPerDay || 1000;
      monthlyUsage = data.usage.monthly || 0;
      monthlyLimit = data.quota.otpRequestsPerMonth || 10000;
    } catch (error) {
      console.error('Failed to load API usage:', error);
      visible = false;
    }
  }

  $: dailyPercent = Math.min(100, (dailyUsage / dailyLimit) * 100);
  $: monthlyPercent = Math.min(100, (monthlyUsage / monthlyLimit) * 100);
  $: dailyProgressClass = dailyPercent >= 90 ? 'danger' : dailyPercent >= 75 ? 'warning' : '';
  $: monthlyProgressClass = monthlyPercent >= 90 ? 'danger' : monthlyPercent >= 75 ? 'warning' : '';

  onMount(() => {
    loadApiUsage();
    const interval = setInterval(() => {
      if (typeof window !== 'undefined' && localStorage.getItem('auth_token')) {
        loadApiUsage();
      }
    }, 30000);
    return () => clearInterval(interval);
  });
</script>

{#if visible}
  <div class="api-usage-bar">
    <div class="api-usage-header">
      <div class="api-usage-title"> ★ API Usage</div>
      <div class="api-usage-stats">
        <div class="api-usage-stat">
          <span class="api-usage-stat-label">Daily:</span>
          <span class="api-usage-stat-value">{dailyUsage.toLocaleString()}</span>
          <span class="api-usage-stat-label">/</span>
          <span class="api-usage-stat-value">{dailyLimit.toLocaleString()}</span>
        </div>
        <div class="api-usage-stat">
          <span class="api-usage-stat-label">Monthly:</span>
          <span class="api-usage-stat-value">{monthlyUsage.toLocaleString()}</span>
          <span class="api-usage-stat-label">/</span>
          <span class="api-usage-stat-value">{monthlyLimit.toLocaleString()}</span>
        </div>
      </div>
    </div>
    <div class="api-usage-periods">
      <div class="api-usage-period">
        <div class="api-usage-period-label">Daily Usage</div>
        <div class="api-usage-progress-container">
          <div class="api-usage-progress-bar {dailyProgressClass}" style="width: {dailyPercent}%">
            {#if dailyPercent > 10}
              <span class="api-usage-progress-text">{Math.round(dailyPercent)}%</span>
            {/if}
          </div>
        </div>
      </div>
      <div class="api-usage-period">
        <div class="api-usage-period-label">Monthly Usage</div>
        <div class="api-usage-progress-container">
          <div class="api-usage-progress-bar {monthlyProgressClass}" style="width: {monthlyPercent}%">
            {#if monthlyPercent > 10}
              <span class="api-usage-progress-text">{Math.round(monthlyPercent)}%</span>
            {/if}
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .api-usage-bar {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--spacing-md) var(--spacing-lg);
    margin: var(--spacing-md) var(--spacing-xl);
    max-width: 1200px;
    margin-left: auto;
    margin-right: auto;
  }

  .api-usage-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-sm);
  }

  .api-usage-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .api-usage-stats {
    display: flex;
    gap: var(--spacing-lg);
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .api-usage-stat {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
  }

  .api-usage-stat-label {
    color: var(--muted);
  }

  .api-usage-stat-value {
    font-weight: 600;
    color: var(--text);
  }

  .api-usage-progress-container {
    position: relative;
    width: 100%;
    height: 24px;
    background: var(--bg-dark);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    overflow: hidden;
    margin-top: var(--spacing-sm);
  }

  .api-usage-progress-bar {
    height: 100%;
    background: linear-gradient(90deg, var(--accent), var(--accent-light));
    border-radius: var(--radius-sm);
    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-right: var(--spacing-xs);
    min-width: 0;
  }

  .api-usage-progress-bar.warning {
    background: linear-gradient(90deg, var(--warning), #ffd54f);
  }

  .api-usage-progress-bar.danger {
    background: linear-gradient(90deg, var(--danger), #ff6b6b);
  }

  .api-usage-progress-text {
    font-size: 0.75rem;
    font-weight: 700;
    color: #000;
    text-shadow: 0 1px 2px rgba(255, 255, 255, 0.3);
    white-space: nowrap;
  }

  .api-usage-periods {
    display: flex;
    gap: var(--spacing-md);
    margin-top: var(--spacing-sm);
  }

  .api-usage-period {
    flex: 1;
  }

  .api-usage-period-label {
    font-size: 0.75rem;
    color: var(--muted);
    margin-bottom: var(--spacing-xs);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  @media (max-width: 768px) {
    .api-usage-bar {
      margin: var(--spacing-md);
      padding: var(--spacing-sm) var(--spacing-md);
    }

    .api-usage-header {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--spacing-sm);
    }

    .api-usage-title {
      font-size: 0.8rem;
    }

    .api-usage-stats {
      flex-direction: row;
      gap: var(--spacing-md);
      width: 100%;
      font-size: 0.8rem;
    }

    .api-usage-periods {
      flex-direction: column;
      gap: var(--spacing-sm);
    }

    .api-usage-progress-container {
      height: 20px;
    }

    .api-usage-progress-text {
      font-size: 0.7rem;
    }
  }

  @media (max-width: 480px) {
    .api-usage-bar {
      margin: var(--spacing-sm);
      padding: var(--spacing-xs) var(--spacing-sm);
    }

    .api-usage-title {
      font-size: 0.75rem;
    }

    .api-usage-stats {
      flex-direction: column;
      gap: var(--spacing-xs);
      font-size: 0.75rem;
    }

    .api-usage-stat {
      gap: 4px;
    }

    .api-usage-stat-label {
      font-size: 0.7rem;
    }

    .api-usage-stat-value {
      font-size: 0.75rem;
    }

    .api-usage-progress-container {
      height: 18px;
    }

    .api-usage-period-label {
      font-size: 0.7rem;
    }

    .api-usage-progress-text {
      font-size: 0.65rem;
    }
  }
</style>

