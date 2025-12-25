<script lang="ts">
  /**
   * ProductCarousel Component
   * 
   * A reusable carousel component for displaying products with images, descriptions, and stats.
   * Accepts product data via props and renders them in a carousel format.
   * 
   * @example
   * ```svelte
   * <ProductCarousel 
   *   products={productData}
   *   autoRotate={true}
   *   interval={6000}
   *   fetchStats={fetchProductStats}
   * />
   * ```
   */

  import { Card, Carousel } from '@components';
  import { onMount } from 'svelte';

  export interface Product {
    title: string;
    description: string;
    url: string;
    slug?: string;
    image?: string;
    downloads?: number;
    followers?: number;
    status?: string;
    [key: string]: unknown; // Allow additional properties
  }

  export interface ProductStats {
    slug: string;
    downloads?: number;
    followers?: number;
    status?: string;
  }

  export let products: Product[] = [];
  export let autoRotate: boolean = true;
  export let interval: number = 6000;
  export let showIndicators: boolean = true;
  export let showControls: boolean = true;
  export let fetchStats: ((products: Product[]) => Promise<ProductStats[]>) | null = null;
  export let className: string = '';

  let isLoading = false;
  let displayProducts: Product[] = products;

  async function loadStats(): Promise<void> {
    if (!fetchStats || products.length === 0) {
      displayProducts = products;
      return;
    }

    isLoading = true;
    try {
      const stats = await fetchStats(products);
      
      // Merge stats with products
      displayProducts = products.map((product) => {
        const productStats = stats.find((stat) => stat.slug === product.slug);
        return {
          ...product,
          downloads: productStats?.downloads ?? product.downloads,
          followers: productStats?.followers ?? product.followers,
          status: productStats?.status ?? product.status
        };
      });
    } catch (error) {
      console.error('[ProductCarousel] Error fetching stats:', error);
      displayProducts = products;
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
    if (fetchStats) {
      loadStats();
    } else {
      displayProducts = products;
    }
  });

  // Update displayProducts when products change
  $: {
    if (fetchStats && products.length > 0) {
      loadStats();
    } else {
      displayProducts = products;
    }
  }
</script>

<div class="product-carousel {className}">
  <div class="product-carousel__wrapper">
    <Carousel {autoRotate} {interval} {showIndicators} {showControls}>
      {#each displayProducts as product}
        <a
          href={product.url}
          target="_blank"
          rel="noopener noreferrer"
          class="product-carousel__link"
        >
          <Card clickable={false}>
            <div class="product-carousel__item">
              {#if product.image}
                <img
                  src={product.image}
                  alt={`${product.title} brand image`}
                  class="product-carousel__image"
                />
              {/if}
              <div class="product-carousel__content">
                <h3 class="product-carousel__title">{product.title}</h3>
                {#if product.status}
                  <span class="product-carousel__status">{product.status}</span>
                {/if}
                <p class="product-carousel__description">{product.description}</p>
                <div class="product-carousel__stats">
                  {#if isLoading}
                    <div class="product-carousel__loading">
                      <span class="product-carousel__loading-spinner"></span>
                      <span class="product-carousel__loading-text">Loading stats...</span>
                    </div>
                  {:else}
                    {#if product.downloads !== undefined}
                      <span class="product-carousel__stat">
                        <strong>{formatNumber(product.downloads)}</strong> downloads
                      </span>
                    {/if}
                    {#if product.followers !== undefined}
                      <span class="product-carousel__stat">
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

  .product-carousel {
    width: 100%;
    display: flex;
    flex-direction: column;
  }

  .product-carousel__wrapper {
    width: 100%;
    height: 280px;
    max-height: 280px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  // Target carousel container to reduce padding - scoped to this component
  .product-carousel__wrapper :global(.carousel__swiper) {
    padding: 0;
    height: 100%;
  }

  // Target carousel slides directly - scoped to this component only
  .product-carousel__wrapper :global(.swiper-slide) {
    height: 280px;
    max-height: 280px;
  }

  .product-carousel__wrapper :global(.swiper-slide > *) {
    height: 100%;
    max-height: 100%;
  }

  .product-carousel__link {
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

  .product-carousel__item {
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

  .product-carousel__image {
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

  .product-carousel__content {
    display: flex;
    flex-direction: column;
    gap: 12px;
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    height: 100%;
  }

  .product-carousel__title {
    margin: 0;
    font-size: 1.2em;
    color: var(--text);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .product-carousel__status {
    font-size: 0.85em;
    color: var(--muted);
    font-style: italic;
  }

  .product-carousel__description {
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

  .product-carousel__stats {
    display: flex;
    gap: 16px;
    margin-top: auto;
    padding-top: 8px;
    border-top: 1px solid var(--border);
  }

  .product-carousel__stat {
    font-size: 0.9em;
    color: var(--text-secondary);

    strong {
      color: var(--accent);
      font-weight: 600;
    }
  }

  .product-carousel__loading {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text-secondary);
    font-size: 0.9em;
  }

  .product-carousel__loading-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .product-carousel__loading-text {
    color: var(--text-secondary);
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>

