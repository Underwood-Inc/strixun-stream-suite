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

  import AdCarousel from './AdCarousel.svelte';
  import TwitchSupportCard from './TwitchSupportCard.svelte';
  import { localStorageAdapter, type StorageAdapter } from './storage';

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
  export let storage: StorageAdapter = localStorageAdapter; // Allow custom storage adapter
</script>

<AdCarousel
  {position}
  {autoRotate}
  {interval}
  {showIndicators}
  {showControls}
  {width}
  {maxHeight}
  {storageKey}
  {defaultDimmed}
  {className}
  {storage}
>
  <TwitchSupportCard {channelUrl} />
</AdCarousel>

