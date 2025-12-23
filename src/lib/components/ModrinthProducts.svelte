<script lang="ts">
  /**
   * ModrinthProducts Component
   * 
   * Displays a carousel of Modrinth products for promotion.
   * Automatically fetches download counts and follower counts from Modrinth API.
   */

  import { Card, Carousel } from '@components';
  import { onMount } from 'svelte';

  // Get base URL for asset paths (handles GitHub Pages subdirectory deployment)
  const BASE_URL = import.meta.env.BASE_URL;

  interface ModrinthProduct {
    title: string;
    description: string;
    url: string;
    slug: string;
    image?: string;
    downloads?: number;
    followers?: number;
    status?: string;
  }

  interface ModrinthAPIProject {
    id: string;
    slug: string;
    title: string;
    description: string;
    downloads: number;
    followers: number;
    project_type: string;
    status: string;
  }

  const baseProducts: Omit<ModrinthProduct, 'downloads' | 'followers'>[] = [
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

  let products: ModrinthProduct[] = baseProducts.map(p => ({
    ...p,
    downloads: undefined,
    followers: undefined
  }));

  let isLoading = true;

  async function fetchModrinthData(): Promise<void> {
    isLoading = true;
    try {
      // Fetch all projects in parallel
      const promises = baseProducts.map(async (product) => {
        try {
          const response = await fetch(
            `https://api.modrinth.com/v2/project/${product.slug}`,
            {
              headers: {
                'User-Agent': 'StrixunStreamSuite/1.0 (https://github.com/strixun)'
              }
            }
          );

          if (!response.ok) {
            console.warn(`[Modrinth] Failed to fetch ${product.slug}: ${response.status}`);
            return null;
          }

          const data = await response.json() as ModrinthAPIProject;
          return {
            slug: product.slug,
            downloads: data.downloads,
            followers: data.followers,
            status: data.status === 'approved' ? undefined : data.status
          };
        } catch (error) {
          console.error(`[Modrinth] Error fetching ${product.slug}:`, error);
          return null;
        }
      });

      const results = await Promise.all(promises);

      // Update products with fetched data
      products = baseProducts.map((baseProduct, index) => {
        const apiData = results[index];
        return {
          ...baseProduct,
          downloads: apiData?.downloads ?? undefined,
          followers: apiData?.followers ?? undefined,
          status: apiData?.status ?? baseProduct.status
        };
      });
    } catch (error) {
      console.error('[Modrinth] Error fetching product data:', error);
    } finally {
      isLoading = false;
    }
  }

  function formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  onMount(() => {
    fetchModrinthData();
  });

</script>

<div class="modrinth-products">
  <div class="modrinth-products__wrapper">
    <Carousel autoRotate={true} interval={6000} showIndicators={true} showControls={true}>
      {#each products as product}
        <a
          href={product.url}
          target="_blank"
          rel="noopener noreferrer"
          class="modrinth-product__link"
        >
          <Card clickable={false}>
            <div class="modrinth-product">
              {#if product.image}
                <img
                  src={product.image}
                  alt={`${product.title} brand image`}
                  class="modrinth-product__image"
                />
              {/if}
              <div class="modrinth-product__content">
                <h3 class="modrinth-product__title">{product.title}</h3>
                {#if product.status}
                  <span class="modrinth-product__status">{product.status}</span>
                {/if}
                <p class="modrinth-product__description">{product.description}</p>
                <div class="modrinth-product__stats">
                  {#if isLoading}
                    <div class="modrinth-product__loading">
                      <span class="modrinth-product__loading-spinner"></span>
                      <span class="modrinth-product__loading-text">Loading stats...</span>
                    </div>
                  {:else}
                    {#if product.downloads !== undefined}
                      <span class="modrinth-product__stat">
                        <strong>{formatNumber(product.downloads)}</strong> downloads
                      </span>
                    {/if}
                    {#if product.followers !== undefined}
                      <span class="modrinth-product__stat">
                        <strong>{formatNumber(product.followers)}</strong> {product.followers === 1 ? 'follower' : 'followers'}
                      </span>
                    {/if}
                  {/if}
                </div>
              </div>
            </div>
          </Card>
        </a>
      {/each}
    </Carousel>
  </div>
</div>

<style lang="scss">
  @use '@styles/mixins' as *;

  .modrinth-products {
    width: 100%;
    display: flex;
    flex-direction: column;
  }

  .modrinth-products__wrapper {
    width: 100%;
    height: 280px;
    max-height: 280px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  // Target carousel container to reduce padding
  :global(.carousel__swiper) {
    padding: 0 !important;
    height: 100% !important;
  }

  // Target carousel slides directly
  :global(.swiper-slide) {
    height: 280px !important;
    max-height: 280px !important;
  }

  :global(.swiper-slide > *) {
    height: 100% !important;
    max-height: 100% !important;
  }

  .modrinth-product__link {
    display: flex;
    flex-direction: column;
    text-decoration: none;
    color: inherit;
    width: 100%;
    height: 100%;
    max-height: 100%;
    cursor: pointer;
    overflow: hidden;
    
    &:hover,
    &:focus,
    &:active {
      text-decoration: none;
      color: inherit;
    }
    
    // Apply clickable card hover effects
    &:hover .card {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }
    
    &:active .card {
      transform: translateY(0);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }
    
    &:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
      border-radius: 4px;
    }
  }

  .modrinth-product {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    gap: 16px;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    padding: 16px;
    box-sizing: border-box;
  }

  .modrinth-product__image {
    width: 150px;
    min-width: 150px;
    height: 150px;
    max-height: 150px;
    object-fit: contain;
    object-position: top left;
    image-rendering: pixelated;
    image-rendering: -moz-crisp-edges;
    image-rendering: crisp-edges;
    flex-shrink: 0;
    background: var(--bg-dark);
    border-radius: 4px;
    padding: 8px;
    box-sizing: border-box;
  }

  .modrinth-product__content {
    display: flex;
    flex-direction: column;
    gap: 12px;
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    height: 100%;
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
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    @include scrollbar(6px);
    max-height: calc(100% - 80px); // Account for title, status, and stats
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

  .modrinth-product__loading {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text-secondary);
    font-size: 0.9em;
  }

  .modrinth-product__loading-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .modrinth-product__loading-text {
    color: var(--text-secondary);
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>

