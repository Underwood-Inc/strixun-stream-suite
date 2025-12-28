<script lang="ts">
  /**
   * ModrinthProductCarousel Component
   * 
   * A reusable carousel component specifically for Modrinth products.
   * Fetches download and follower stats from the Modrinth API.
   * 
   * @example
   * ```svelte
   * <ModrinthProductCarousel 
   *   products={modrinthProducts}
   *   autoRotate={true}
   *   interval={6000}
   * />
   * ```
   */

  import ProductCarousel, { type Product, type ProductStats } from './ProductCarousel.svelte';

  // Get base URL for asset paths (handles GitHub Pages subdirectory deployment)
  const BASE_URL = import.meta.env.BASE_URL;

  export interface ModrinthProduct extends Product {
    slug: string;
  }

  export interface ModrinthAPIProject {
    id: string;
    slug: string;
    title: string;
    description: string;
    downloads: number;
    followers: number;
    project_type: string;
    status: string;
  }

  export let products: ModrinthProduct[] = [];
  export let autoRotate: boolean = true;
  export let interval: number = 6000;
  export let showIndicators: boolean = true;
  export let showControls: boolean = true;
  export let className: string = '';

  async function fetchModrinthStats(productsToFetch: Product[]): Promise<ProductStats[]> {
    const promises = productsToFetch.map(async (product) => {
      const modrinthProduct = product as ModrinthProduct;
      if (!modrinthProduct.slug) {
        return { slug: modrinthProduct.slug || '' };
      }

      try {
        const response = await fetch(
          `https://api.modrinth.com/v2/project/${modrinthProduct.slug}`,
          {
            headers: {
              'User-Agent': 'StrixunStreamSuite/1.0 (https://github.com/strixun)'
            },
            // CRITICAL: Prevent caching of API calls
            cache: 'no-store',
          }
        );

        if (!response.ok) {
          console.warn(`[Modrinth] Failed to fetch ${modrinthProduct.slug}: ${response.status}`);
          return { slug: modrinthProduct.slug };
        }

        const data = await response.json() as ModrinthAPIProject;
        return {
          slug: modrinthProduct.slug,
          downloads: data.downloads,
          followers: data.followers,
          status: data.status === 'approved' ? undefined : data.status
        };
      } catch (error) {
        console.error(`[Modrinth] Error fetching ${modrinthProduct.slug}:`, error);
        return { slug: modrinthProduct.slug };
      }
    });

    return await Promise.all(promises);
  }
</script>

<ProductCarousel
  {products}
  {autoRotate}
  {interval}
  {showIndicators}
  {showControls}
  fetchStats={fetchModrinthStats}
  {className}
/>

