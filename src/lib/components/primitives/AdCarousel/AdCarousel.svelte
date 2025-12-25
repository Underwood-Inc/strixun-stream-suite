<script lang="ts">
  /**
   * AdCarousel Component
   * 
   * Wrapper for shared AdCarousel component with main app's storage adapter.
   */

  import AdCarouselShared from '@shared-components/ad-carousel/AdCarousel.svelte';
  import { storage } from '../../../../modules/storage';
  
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
  export let className: string = '';
</script>

<AdCarouselShared
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
  storage={storageAdapter}
>
  <slot />
</AdCarouselShared>
