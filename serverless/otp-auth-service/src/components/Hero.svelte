<script lang="ts">
  export let title: string = 'Passwordless Authentication Made Simple';
  export let description: string = 'Secure, scalable OTP authentication API built for modern applications. No passwords, no complexity—just email verification that works.';
  export let highlightText: string = 'Open-source and self-hostable.';
  export let dashboardLink: string = '/dashboard';
  export let getStartedLink: string = '#code-examples';
  export let selfHostLink: string = '#self-hosting';
</script>

<section class="hero">
  <h1>{title}</h1>
  <p>
    {description}
    <strong style="color: var(--accent);">{highlightText}</strong> 🐼
  </p>
  <div class="hero-cta">
    <a href={dashboardLink} class="btn btn-primary">Developer Dashboard</a>
    <a href={getStartedLink} class="btn btn-secondary">Start Integrating</a>
    <a href={selfHostLink} class="btn btn-secondary">Self-Host Option</a>
  </div>
</section>

<style>
  .hero {
    padding: var(--spacing-3xl) var(--spacing-xl);
    text-align: center;
    max-width: 1200px;
    margin: 0 auto;
  }

  .hero h1 {
    font-size: clamp(2.5rem, 5vw, 4rem);
    margin-bottom: var(--spacing-lg);
    background: linear-gradient(135deg, var(--accent), var(--accent-light));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    line-height: 1.2;
  }

  .hero p {
    font-size: clamp(1.1rem, 2vw, 1.5rem);
    color: var(--text-secondary);
    margin-bottom: var(--spacing-2xl);
    max-width: 800px;
    margin-left: auto;
    margin-right: auto;
    line-height: 1.7;
  }

  .hero-cta {
    display: flex;
    gap: var(--spacing-md);
    justify-content: center;
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
</style>





