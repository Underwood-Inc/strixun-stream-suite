/**
 * Cloudflare Pages Function for Server-Side Meta Tag Injection
 * 
 * This function intercepts requests to mod detail pages (/:slug) and injects
 * Open Graph meta tags server-side so social media crawlers can read them.
 * 
 * Social media crawlers (Facebook, Twitter, Discord, LinkedIn, etc.) don't
 * execute JavaScript, so they can't see meta tags added by React. This function
 * fetches mod data from the API and injects the meta tags into the HTML before
 * sending it to the crawler.
 */

interface Env {
  MODS_API_URL?: string;
  VITE_MODS_API_URL?: string;
}

interface ModMetadata {
  modId: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  thumbnailUrl?: string;
  authorDisplayName?: string;
  downloadCount: number;
  latestVersion: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

interface ModDetailResponse {
  mod: ModMetadata;
  versions: any[];
}

/**
 * Check if the request is from a social media crawler
 */
function isCrawler(userAgent: string): boolean {
  const crawlerPatterns = [
    'facebookexternalhit',
    'Facebot',
    'Twitterbot',
    'LinkedInBot',
    'Slackbot',
    'Discordbot',
    'WhatsApp',
    'TelegramBot',
    'SkypeUriPreview',
    'Pinterest',
    'redditbot',
    'Embedly',
    'Applebot',
    'bingbot',
    'Googlebot',
  ];
  
  const ua = userAgent.toLowerCase();
  return crawlerPatterns.some(pattern => ua.includes(pattern.toLowerCase()));
}

/**
 * Fetch mod data from the API
 */
async function fetchModData(slug: string, env: Env): Promise<ModMetadata | null> {
  try {
    // Determine API base URL
    const apiBaseUrl = env.MODS_API_URL || env.VITE_MODS_API_URL || 'https://mods-api.idling.app';
    const apiUrl = `${apiBaseUrl}/mods/${slug}`;
    
    console.log('[SSR Meta] Fetching mod data:', { slug, apiUrl });
    
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.error('[SSR Meta] API request failed:', {
        status: response.status,
        statusText: response.statusText,
      });
      return null;
    }
    
    const data: ModDetailResponse = await response.json();
    console.log('[SSR Meta] Mod data fetched successfully:', {
      modId: data.mod.modId,
      title: data.mod.title,
    });
    
    return data.mod;
  } catch (error) {
    console.error('[SSR Meta] Error fetching mod data:', error);
    return null;
  }
}

/**
 * Format description for meta tags
 * Truncates to 200 characters and removes markdown
 */
function formatDescription(description: string): string {
  // Remove markdown links and formatting
  let cleaned = description
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove markdown links
    .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
    .replace(/\*([^*]+)\*/g, '$1') // Remove italic
    .replace(/#{1,6}\s+/g, '') // Remove headers
    .replace(/\n+/g, ' ') // Replace newlines with spaces
    .trim();
  
  // Truncate to 200 characters
  if (cleaned.length > 200) {
    cleaned = cleaned.substring(0, 197) + '...';
  }
  
  return cleaned || 'A mod for Strixun Stream Suite';
}

/**
 * Get category display name
 */
function getCategoryDisplayName(category: string): string {
  const categoryMap: Record<string, string> = {
    script: 'Script',
    overlay: 'Overlay',
    theme: 'Theme',
    asset: 'Asset',
    plugin: 'Plugin',
    other: 'Other',
  };
  return categoryMap[category] || category;
}

/**
 * Generate Open Graph meta tags for a mod
 */
function generateMetaTags(mod: ModMetadata, baseUrl: string): string {
  const modUrl = `${baseUrl}/${mod.slug}`;
  const description = formatDescription(mod.description);
  const title = `${mod.title} - Strixun Stream Suite Mods`;
  const categoryDisplay = getCategoryDisplayName(mod.category);
  
  // Use dedicated OG image endpoint for rich preview
  const apiBaseUrl = baseUrl.includes('localhost') ? 'http://localhost:8788' : 'https://mods-api.idling.app';
  const ogImageUrl = `${apiBaseUrl}/mods/${mod.slug}/og-image`;
  
  // Build a rich description with mod details
  const authorName = mod.authorDisplayName || 'Unknown User';
  const richDescription = `${description} | ${categoryDisplay} mod by ${authorName} | ${mod.downloadCount} downloads | Latest version: ${mod.latestVersion}`;
  
  return `
    <!-- Primary Meta Tags -->
    <title>${title}</title>
    <meta name="title" content="${title}" />
    <meta name="description" content="${description}" />
    <link rel="canonical" href="${modUrl}" />

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${modUrl}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${richDescription}" />
    <meta property="og:image" content="${ogImageUrl}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${mod.title} - ${categoryDisplay} mod for Strixun Stream Suite" />
    <meta property="og:site_name" content="Strixun Stream Suite Mods" />
    <meta property="og:locale" content="en_US" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:url" content="${modUrl}" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${richDescription}" />
    <meta name="twitter:image" content="${ogImageUrl}" />
    <meta name="twitter:image:alt" content="${mod.title} - ${categoryDisplay} mod for Strixun Stream Suite" />
    <meta name="twitter:site" content="@strixun" />
    <meta name="twitter:creator" content="@strixun" />

    <!-- Additional Meta Tags -->
    <meta name="theme-color" content="#d4af37" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Stream Suite Mods" />

    <!-- Article-specific tags for better categorization -->
    <meta property="article:author" content="${mod.authorDisplayName || 'Unknown User'}" />
    <meta property="article:published_time" content="${mod.createdAt}" />
    <meta property="article:modified_time" content="${mod.updatedAt}" />
    <meta property="article:section" content="${categoryDisplay}" />
    ${mod.tags.map((tag) => `<meta property="article:tag" content="${tag}" />`).join('\n    ')}
  `.trim();
}

/**
 * Inject meta tags into HTML
 */
function injectMetaTags(html: string, metaTags: string): string {
  // Find the closing </head> tag and inject meta tags before it
  const headCloseIndex = html.indexOf('</head>');
  if (headCloseIndex === -1) {
    console.error('[SSR Meta] Could not find </head> tag in HTML');
    return html;
  }
  
  // Remove existing default meta tags that might conflict
  let modifiedHtml = html.replace(
    /<meta name="description" content="[^"]*" \/>/g,
    ''
  );
  
  // Inject new meta tags
  modifiedHtml = modifiedHtml.substring(0, headCloseIndex) + 
    '\n    ' + metaTags + '\n  ' + 
    modifiedHtml.substring(headCloseIndex);
  
  return modifiedHtml;
}

/**
 * Main handler for Cloudflare Pages Function
 */
export async function onRequest(context: {
  request: Request;
  env: Env;
  next: () => Promise<Response>;
}): Promise<Response> {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  
  // Only process HTML requests to potential mod detail pages
  const acceptHeader = request.headers.get('Accept') || '';
  const isHtmlRequest = acceptHeader.includes('text/html') || acceptHeader.includes('*/*');
  
  if (!isHtmlRequest) {
    return next();
  }
  
  // Check if this is a mod detail page (/:slug pattern)
  // Exclude known routes like /login, /admin, /manage, etc.
  const excludedPaths = [
    '/login',
    '/admin',
    '/manage',
    '/browse',
    '/upload',
    '/r2',
    '/health',
    '/api',
  ];
  
  const isExcludedPath = excludedPaths.some(excluded => path.startsWith(excluded));
  const isRootPath = path === '/';
  
  // Only process if it looks like a mod detail page (/:slug)
  const pathSegments = path.split('/').filter(Boolean);
  const isSingleSegmentPath = pathSegments.length === 1 && !isExcludedPath && !isRootPath;
  
  if (!isSingleSegmentPath) {
    return next();
  }
  
  // Extract slug from path
  const slug = pathSegments[0];
  
  // Check if this is a crawler request
  const userAgent = request.headers.get('User-Agent') || '';
  const isCrawlerRequest = isCrawler(userAgent);
  
  console.log('[SSR Meta] Request details:', {
    path,
    slug,
    userAgent: userAgent.substring(0, 50),
    isCrawler: isCrawlerRequest,
  });
  
  // Always inject meta tags for mod detail pages (helps with initial page load too)
  // Fetch mod data from API
  const modData = await fetchModData(slug, env);
  
  if (!modData) {
    console.log('[SSR Meta] Mod not found, passing through to SPA');
    return next();
  }
  
  // Get the base HTML from the SPA
  const response = await next();
  
  // Only modify HTML responses
  const contentType = response.headers.get('Content-Type') || '';
  if (!contentType.includes('text/html')) {
    return response;
  }
  
  // Read the HTML
  let html = await response.text();
  
  // Generate and inject meta tags
  const baseUrl = `${url.protocol}//${url.host}`;
  const metaTags = generateMetaTags(modData, baseUrl);
  html = injectMetaTags(html, metaTags);
  
  console.log('[SSR Meta] Meta tags injected successfully for:', {
    slug,
    title: modData.title,
  });
  
  // Return modified HTML with proper headers
  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}
