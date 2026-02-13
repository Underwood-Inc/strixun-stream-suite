/**
 * Test script for verifying server-side meta tag injection
 * 
 * This script simulates social media crawler requests to verify that
 * meta tags are properly injected into the HTML response.
 * 
 * Usage:
 *   ts-node test-meta-tags.ts <url>
 * 
 * Example:
 *   ts-node test-meta-tags.ts https://mods.idling.app/my-mod-slug
 *   ts-node test-meta-tags.ts http://localhost:4173/my-mod-slug
 */

interface TestResult {
  url: string;
  success: boolean;
  metaTags: {
    title?: string;
    description?: string;
    ogTitle?: string;
    ogDescription?: string;
    ogImage?: string;
    ogUrl?: string;
    twitterCard?: string;
    twitterTitle?: string;
    twitterDescription?: string;
    twitterImage?: string;
  };
  errors: string[];
}

/**
 * Extract meta tag content from HTML
 */
function extractMetaTag(html: string, property: string, attribute: 'property' | 'name' = 'property'): string | undefined {
  const regex = new RegExp(`<meta ${attribute}="${property}" content="([^"]*)"`, 'i');
  const match = html.match(regex);
  return match ? match[1] : undefined;
}

/**
 * Extract title from HTML
 */
function extractTitle(html: string): string | undefined {
  const match = html.match(/<title>([^<]*)<\/title>/i);
  return match ? match[1] : undefined;
}

/**
 * Test meta tags for a given URL
 */
async function testMetaTags(url: string): Promise<TestResult> {
  const result: TestResult = {
    url,
    success: false,
    metaTags: {},
    errors: [],
  };

  try {
    // Simulate a social media crawler request
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      result.errors.push(`HTTP ${response.status}: ${response.statusText}`);
      return result;
    }

    const html = await response.text();

    // Extract meta tags
    result.metaTags.title = extractTitle(html);
    result.metaTags.description = extractMetaTag(html, 'description', 'name');
    result.metaTags.ogTitle = extractMetaTag(html, 'og:title');
    result.metaTags.ogDescription = extractMetaTag(html, 'og:description');
    result.metaTags.ogImage = extractMetaTag(html, 'og:image');
    result.metaTags.ogUrl = extractMetaTag(html, 'og:url');
    result.metaTags.twitterCard = extractMetaTag(html, 'twitter:card', 'name');
    result.metaTags.twitterTitle = extractMetaTag(html, 'twitter:title', 'name');
    result.metaTags.twitterDescription = extractMetaTag(html, 'twitter:description', 'name');
    result.metaTags.twitterImage = extractMetaTag(html, 'twitter:image', 'name');

    // Validate required meta tags
    const requiredTags = [
      { key: 'title', value: result.metaTags.title },
      { key: 'og:title', value: result.metaTags.ogTitle },
      { key: 'og:description', value: result.metaTags.ogDescription },
      { key: 'og:image', value: result.metaTags.ogImage },
      { key: 'og:url', value: result.metaTags.ogUrl },
      { key: 'twitter:card', value: result.metaTags.twitterCard },
    ];

    for (const tag of requiredTags) {
      if (!tag.value) {
        result.errors.push(`Missing required meta tag: ${tag.key}`);
      }
    }

    // Check if OG image URL is valid
    if (result.metaTags.ogImage && !result.metaTags.ogImage.startsWith('http')) {
      result.errors.push(`Invalid og:image URL: ${result.metaTags.ogImage}`);
    }

    result.success = result.errors.length === 0;
  } catch (error) {
    result.errors.push(`Error: ${error instanceof Error ? error.message : String(error)}`);
  }

  return result;
}

/**
 * Print test results
 */
function printResults(result: TestResult): void {
  console.log('\n=== Meta Tag Test Results ===\n');
  console.log(`URL: ${result.url}`);
  console.log(`Status: ${result.success ? '✓ PASS' : '✗ FAIL'}\n`);

  if (result.errors.length > 0) {
    console.log('Errors:');
    result.errors.forEach(error => console.log(`  ✗ ${error}`));
    console.log('');
  }

  console.log('Meta Tags:');
  console.log(`  Title: ${result.metaTags.title || '(missing)'}`);
  console.log(`  Description: ${result.metaTags.description || '(missing)'}`);
  console.log('');
  console.log('Open Graph:');
  console.log(`  og:title: ${result.metaTags.ogTitle || '(missing)'}`);
  console.log(`  og:description: ${result.metaTags.ogDescription || '(missing)'}`);
  console.log(`  og:image: ${result.metaTags.ogImage || '(missing)'}`);
  console.log(`  og:url: ${result.metaTags.ogUrl || '(missing)'}`);
  console.log('');
  console.log('Twitter Card:');
  console.log(`  twitter:card: ${result.metaTags.twitterCard || '(missing)'}`);
  console.log(`  twitter:title: ${result.metaTags.twitterTitle || '(missing)'}`);
  console.log(`  twitter:description: ${result.metaTags.twitterDescription || '(missing)'}`);
  console.log(`  twitter:image: ${result.metaTags.twitterImage || '(missing)'}`);
  console.log('');
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: ts-node test-meta-tags.ts <url>');
    console.error('Example: ts-node test-meta-tags.ts https://mods.idling.app/my-mod-slug');
    process.exit(1);
  }

  const url = args[0];
  const result = await testMetaTags(url);
  printResults(result);

  process.exit(result.success ? 0 : 1);
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { testMetaTags, type TestResult };
