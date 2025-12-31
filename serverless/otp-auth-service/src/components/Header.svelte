<script lang="ts">
  export let logo: string = '[EMOJI] OTP Auth API';
  export let dashboardLink: string = '/dashboard';
  export let getStartedLink: string = '#code-examples';
  export let docsLink: string = '#docs';
</script>

<header class="header">
  <div class="header-content">
    <a href="/" class="logo">{logo}</a>
    <div class="header-actions">
      <a href={dashboardLink} class="btn btn-secondary">Developer Dashboard</a>
      <a href={getStartedLink} class="btn btn-secondary">Get Started</a>
      <a href={docsLink} class="btn btn-primary">Documentation</a>
    </div>
  </div>
</header>

<style>
  .header {
    background: rgba(37, 32, 23, 0.95);
    border-bottom: 1px solid var(--border);
    padding: var(--spacing-md) var(--spacing-xl);
    position: sticky;
    top: 0;
    z-index: 100;
    backdrop-filter: blur(10px);
  }

  .header-content {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-lg);
  }

  .logo {
    font-size: 1.5rem;
    font-weight: 700;
    background: linear-gradient(135deg, var(--accent), var(--accent-light));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    text-decoration: none;
    white-space: nowrap;
  }

  .header-actions {
    display: flex;
    gap: var(--spacing-md);
    align-items: center;
    flex-wrap: wrap;
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

  .btn-secondary {
    border-color: var(--border-light);
    color: var(--text);
  }

  .btn-secondary:hover {
    background: var(--border);
    border-color: var(--border-light);
  }

  @media (max-width: 768px) {
    .header-content {
      flex-direction: column;
      align-items: flex-start;
    }

    .header-actions {
      width: 100%;
      justify-content: flex-start;
    }
  }
</style>


