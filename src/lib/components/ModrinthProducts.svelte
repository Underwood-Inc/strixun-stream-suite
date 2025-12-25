<script lang="ts">
  /**
   * ModrinthProducts Component
   * 
   * Displays a carousel of Modrinth products for promotion.
   * Uses ModrinthProductCarousel for rendering.
   */

  import ModrinthProductCarousel, { type ModrinthProduct } from './ModrinthProductCarousel.svelte';

  // Get base URL for asset paths (handles GitHub Pages subdirectory deployment)
  const BASE_URL = import.meta.env.BASE_URL;

  const products: ModrinthProduct[] = [
    {
      title: 'Rituals',
      description: 'Introducing Rituals—a custom datapack/mod that brings mystical totems and ritual magic into your world. Craft totems, display items, and trigger powerful effects through immersive rituals.',
      url: 'https://modrinth.com/project/totem-rituals',
      slug: 'totem-rituals',
      image: `${BASE_URL}rituals-brand.png`
    },
    {
      title: 'strixun | Pack A',
      description: 'Dive into my personal mega-pack with a massive collection of mods, all carefully curated for balanced progression and immersive gameplay. My Rituals mod combined with the gamerules disable raids true and disable health regen true are advised.',
      url: 'https://modrinth.com/modpack/strixun-pack-a',
      slug: 'strixun-pack-a',
      image: `${BASE_URL}strixun-pack-a-brand.png`
    },
    {
      title: 'compressy',
      description: 'A Fabric mod to add automatic support for near infinite compression of any block that is placeable! Fancy tooltips and roman numerals included.',
      url: 'https://modrinth.com/mod/compressy',
      slug: 'compressy',
      image: `${BASE_URL}compressy-brand.png`,
      status: 'Under review'
    }
  ];
</script>

<div class="modrinth-products">
  <ModrinthProductCarousel {products} />
</div>

<style lang="scss">
  .modrinth-products {
    width: 100%;
    display: flex;
    flex-direction: column;
  }
</style>

