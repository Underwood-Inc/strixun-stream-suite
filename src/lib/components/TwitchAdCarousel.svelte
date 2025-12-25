<script lang="ts">
  /**
   * TwitchAdCarousel Component
   * 
   * A reusable floating ad carousel component that displays Twitch support content.
   * Wraps AdCarousel with TwitchSupportCard for easy reuse across the app.
   * 
   * @example
   * ```svelte
   * <TwitchAdCarousel 
   *   position="bottom-right"
   *   channelUrl="https://www.twitch.tv/strixun"
   * />
   * ```
   */

  import TwitchAdCarouselShared from '@shared-components/ad-carousel/TwitchAdCarousel.svelte';
  import { storage } from '../../modules/storage';
  
  // Create storage adapter from main app's storage module
  const storageAdapter = {
    get(key: string): unknown | null {
      return storage.get(key);
    },
    set(key: string, value: unknown): void {
      storage.set(key, value);
    }
  };

  export let position: 'bottom-left' | 'bottom-right' | 'bottom-center' = 'bottom-right';
  export let autoRotate: boolean = true;
  export let interval: number = 8000;
  export let showIndicators: boolean = true;
  export let showControls: boolean = false;
  export let width: number = 320;
  export let maxHeight: number = 200;
  export let storageKey: string = 'ui_ad_carousel_state';
  export let defaultDimmed: boolean = false;
  export let channelUrl: string = 'https://www.twitch.tv/strixun';
  export let className: string = '';
</script>

<TwitchAdCarouselShared
  {position}
  {autoRotate}
  {interval}
  {showIndicators}
  {showControls}
  {width}
  {maxHeight}
  {storageKey}
  {defaultDimmed}
  {channelUrl}
  {className}
  storage={storageAdapter}
/>

