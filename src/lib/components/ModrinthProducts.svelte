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
      title: 'Strixun: Trials of the Wild',
      description: 'Hardcore survival modpack with ~250 mods, all carefully curated for balanced progression and immersive gameplay covering categories such as exploration, levels, magic, combat, and world-overhaul mods. Includes Rituals for totem magic, buffs, farming, and defences, plus Compressy for massive block storage. Optional no-regen/no-raids gamerules & simpleskills ironman mode enabled for true hardcore players.',
      url: 'https://modrinth.com/modpack/strixun-trials-of-the-wild',
      slug: 'strixun-trials-of-the-wild',
      image: `${BASE_URL}strixun-pack-a-brand.png`
    },
    {
      title: 'compressy',
      description: 'A Fabric mod to add automatic support for near infinite compression of any block that is placeable! Fancy tooltips and roman numerals included.',
      url: 'https://modrinth.com/mod/compressy',
      slug: 'compressy',
      image: `${BASE_URL}compressy-brand.png`,
      // status: 'Under review'
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

