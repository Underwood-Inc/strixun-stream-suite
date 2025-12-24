<script lang="ts">
  /**
   * TwitchSupportCard Component
   * 
   * A card that meeksly but convincingly asks viewers to support the streamer
   * by following/subscribing on Twitch. Designed to be friendly and non-intrusive.
   * Uses a proper anchor tag for semantic HTML and accessibility.
   * 
   * @example
   * ```svelte
   * <TwitchSupportCard channelUrl="https://www.twitch.tv/strixun" />
   * ```
   */

  export let channelUrl: string = 'https://www.twitch.tv/strixun';
  export let className: string = '';
</script>

<a
  href={channelUrl}
  target="_blank"
  rel="noopener noreferrer"
  class="twitch-support-card {className}"
>
  <div class="twitch-support-card__content">
    <div class="twitch-support-card__text">
      <h3 class="twitch-support-card__title">
        <span class="twitch-support-card__icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>
          </svg>
        </span>
        Support the Stream! 🎮
      </h3>
      <p class="twitch-support-card__message">
        Help keep these services alive and free! Follow or subscribe on Twitch to show your support.
      </p>
    </div>
    
    <div class="twitch-support-card__action">
      <span class="twitch-support-card__link">Visit Channel →</span>
    </div>
  </div>
</a>

<style lang="scss">
  @use '@styles/animations' as *;
  @use '@styles/mixins' as *;

  .twitch-support-card {
    height: 100%;
    max-height: 100%;
    display: flex;
    flex-direction: column;
    background: linear-gradient(135deg, var(--card) 0%, var(--bg-dark) 100%);
    border: 2px solid var(--border);
    border-radius: 8px;
    padding: 0;
    text-decoration: none;
    color: inherit;
    transition: border-color 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    @include gpu-accelerated;
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

  .twitch-support-card__content {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px 12px;
    box-sizing: border-box;
    overflow: hidden;
  }

  .twitch-support-card__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: rgba(145, 70, 255, 0.2);
    border-radius: 6px;
    color: #9146ff;
    flex-shrink: 0;
    vertical-align: middle;
    margin-right: 8px;

    svg {
      width: 18px;
      height: 18px;
    }
  }

  .twitch-support-card__text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .twitch-support-card__title {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text);
    margin: 0;
    line-height: 1.4;
    display: flex;
    align-items: center;
  }

  .twitch-support-card__message {
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin: 0;
    line-height: 1.4;
  }

  .twitch-support-card__action {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-top: 6px;
    border-top: 1px solid var(--border);
    margin-top: auto;
  }

  .twitch-support-card__link {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--accent);
    transition: all 0.2s ease;

    .twitch-support-card:hover & {
      color: var(--accent-light);
      transform: translateX(4px);
    }
  }

  // Responsive adjustments
  @media (max-width: 480px) {
    .twitch-support-card__content {
      padding: 12px;
      gap: 10px;
    }

    .twitch-support-card__title {
      font-size: 1rem;
    }

    .twitch-support-card__message {
      font-size: 0.8rem;
    }
  }
</style>

