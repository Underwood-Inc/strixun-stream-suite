<script lang="ts">
  /**
   * SupportCard Component
   * 
   * A generic support card that encourages users to support the services.
   * Designed to be friendly and non-intrusive. Uses a proper anchor tag for 
   * semantic HTML and accessibility.
   * 
   * @example
   * ```svelte
   * <SupportCard supportUrl="https://example.com/support" />
   * ```
   */

  import OtpAuthLink from './OtpAuthLink.svelte';

  export let supportUrl: string = 'https://www.twitch.tv/strixun';
  export let className: string = '';
</script>

<a
  href={supportUrl}
  target="_blank"
  rel="noopener noreferrer"
  class="support-card {className}"
>
  <div class="support-card__content">
    <div class="support-card__text">
      <h3 class="support-card__title">
        <span class="support-card__icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </span>
        Support the Services! 💙
      </h3>
      <p class="support-card__message">
        Help keep these services running with generous free tiers! Your support helps maintain and improve the platform.
      </p>
    </div>
    
    <div class="support-card__action">
      <span class="support-card__powered-by-wrapper" role="none" on:click|stopPropagation on:keydown|stopPropagation>
        <OtpAuthLink />
      </span>
      <span class="support-card__link">Show Support →</span>
    </div>
  </div>
</a>

<style lang="scss">
  .support-card {
    height: 100%;
    max-height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--card);
    border: 2px solid var(--border);
    border-radius: 8px;
    padding: 0;
    text-decoration: none;
    color: inherit;
    transition: border-color 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    will-change: transform, opacity;
    box-sizing: border-box;
    margin: 0;
    overflow: hidden;

    &:hover {
      border-color: var(--accent);
      box-shadow: 0 2px 12px rgba(237, 174, 73, 0.25);
      text-decoration: none;
      color: inherit;
      // No transform to prevent size changes
    }

    &:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
  }

  .support-card__content {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px;
    box-sizing: border-box;
    overflow: hidden;
  }

  .support-card__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: rgba(237, 174, 73, 0.15);
    border-radius: 6px;
    color: var(--accent);
    flex-shrink: 0;
    vertical-align: middle;
    margin-right: 8px;

    svg {
      width: 18px;
      height: 18px;
    }
  }

  .support-card__text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .support-card__title {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text);
    margin: 0;
    line-height: 1.4;
    display: flex;
    align-items: center;
  }

  .support-card__message {
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin: 0;
    line-height: 1.4;
  }

  .support-card__action {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-top: 6px;
    border-top: 1px solid var(--border);
    margin-top: auto;
  }

  .support-card__powered-by-wrapper {
    flex-shrink: 0;
  }

  .support-card__link {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--accent);
    transition: color 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), text-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    display: inline-block;

    &::after {
      content: '';
      position: absolute;
      bottom: -2px;
      left: 0;
      width: 0;
      height: 2px;
      background: var(--accent);
      transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .support-card:hover & {
      color: var(--accent-light);
      transform: scale(1.08);
      text-shadow: 0 0 12px rgba(237, 174, 73, 0.6);

      &::after {
        width: 100%;
      }
    }
  }

  // Responsive adjustments
  @media (max-width: 480px) {
    .support-card__content {
      padding: 12px;
      gap: 10px;
    }

    .support-card__title {
      font-size: 1rem;
    }

    .support-card__message {
      font-size: 0.8rem;
    }
  }
</style>

