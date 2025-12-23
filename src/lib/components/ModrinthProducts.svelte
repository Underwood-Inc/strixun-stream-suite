<script lang="ts">
  /**
   * ModrinthProducts Component
   * 
   * Displays a carousel of Modrinth products for promotion.
   */

  import { Carousel, Card } from '@components';

  interface ModrinthProduct {
    title: string;
    description: string;
    url: string;
    downloads?: string;
    followers?: string;
    status?: string;
  }

  const products: ModrinthProduct[] = [
    {
      title: 'Rituals',
      description: 'Introducing Rituals—a custom datapack/mod that brings mystical totems and ritual magic into your world. Craft totems, display items, and trigger powerful effects through immersive rituals.',
      url: 'https://modrinth.com/project/rituals',
      downloads: '989',
      followers: '8'
    },
    {
      title: 'strixun | Pack A',
      description: 'Dive into my personal mega-pack with a massive collection of mods, all carefully curated for balanced progression and immersive gameplay. My Rituals mod combined with the gamerules disable raids true and disable health regen true are advised.',
      url: 'https://modrinth.com/modpack/strixun-pack-a',
      downloads: '158',
      followers: '1'
    },
    {
      title: 'compressy',
      description: 'A Fabric mod to add automatic support for near infinite compression of any block that is placeable! Fancy tooltips and roman numerals included.',
      url: 'https://modrinth.com/mod/compressy',
      downloads: '8',
      followers: '1',
      status: 'Under review'
    }
  ];

  function handleProductClick(url: string): void {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
</script>

<div class="modrinth-products">
  <Carousel autoRotate={true} interval={6000} showIndicators={true} showControls={true}>
    {#each products as product}
      <Card clickable={true} onCardClick={() => handleProductClick(product.url)}>
        <div class="modrinth-product">
          <h3 class="modrinth-product__title">{product.title}</h3>
          {#if product.status}
            <span class="modrinth-product__status">{product.status}</span>
          {/if}
          <p class="modrinth-product__description">{product.description}</p>
          <div class="modrinth-product__stats">
            {#if product.downloads}
              <span class="modrinth-product__stat">
                <strong>{product.downloads}</strong> downloads
              </span>
            {/if}
            {#if product.followers}
              <span class="modrinth-product__stat">
                <strong>{product.followers}</strong> {product.followers === '1' ? 'follower' : 'followers'}
              </span>
            {/if}
          </div>
        </div>
      </Card>
    {/each}
  </Carousel>
</div>

<style lang="scss">
  .modrinth-products {
    width: 100%;
  }

  .modrinth-product {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .modrinth-product__title {
    margin: 0;
    font-size: 1.2em;
    color: var(--text);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .modrinth-product__status {
    font-size: 0.85em;
    color: var(--muted);
    font-style: italic;
  }

  .modrinth-product__description {
    margin: 0;
    color: var(--text-secondary);
    line-height: 1.5;
    flex: 1;
  }

  .modrinth-product__stats {
    display: flex;
    gap: 16px;
    margin-top: auto;
    padding-top: 8px;
    border-top: 1px solid var(--border);
  }

  .modrinth-product__stat {
    font-size: 0.9em;
    color: var(--text-secondary);

    strong {
      color: var(--accent);
      font-weight: 600;
    }
  }
</style>

