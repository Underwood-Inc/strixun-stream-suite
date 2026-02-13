# Cloudflare Pages Functions - Mods Hub

This directory contains Cloudflare Pages Functions that run server-side to enhance the Mods Hub application.

## What are Cloudflare Pages Functions?

Cloudflare Pages Functions are serverless functions that run on Cloudflare's edge network. They intercept requests before they reach your static site, allowing you to add dynamic server-side logic.

## Functions in this Directory

### `[[path]].ts` - Server-Side Meta Tag Injection

**Purpose**: Injects Open Graph meta tags server-side for social media crawlers.

**Problem**: Social media crawlers (Facebook, Twitter, Discord, LinkedIn, etc.) don't execute JavaScript. When they crawl a mod detail page, they only see the initial HTML without the meta tags that React adds dynamically via `react-helmet-async`.

**Solution**: This function intercepts requests to mod detail pages (`/:slug`), fetches the mod data from the API, and injects the Open Graph meta tags into the HTML before sending it to the crawler.

**How it Works**:

1. **Request Interception**: The function intercepts all HTML requests to potential mod detail pages (single-segment paths like `/my-awesome-mod`).

2. **Mod Data Fetching**: It fetches the mod metadata from the Mods API (`/mods/:slug` endpoint).

3. **Meta Tag Generation**: It generates comprehensive Open Graph and Twitter Card meta tags including:
   - Title and description
   - Thumbnail image (via `/mods/:slug/og-image` endpoint)
   - Author information
   - Download count and version info
   - Category and tags

4. **HTML Injection**: It injects the meta tags into the `<head>` section of the HTML before the closing `</head>` tag.

5. **Response**: The modified HTML is returned to the crawler with all meta tags in place.

**Benefits**:

- ✓ Social media platforms can properly preview mod links with rich cards
- ✓ Thumbnails display correctly in Discord, Twitter, Facebook, LinkedIn, etc.
- ✓ Mod information is visible in link previews
- ✓ No changes needed to the React application
- ✓ Works for both crawlers and regular users

**Configuration**:

The function uses environment variables to determine the API base URL:

- `MODS_API_URL` or `VITE_MODS_API_URL`: The base URL for the Mods API
- Defaults to `https://mods-api.idling.app` if not set

**Deployment**:

When you deploy the Mods Hub to Cloudflare Pages, this function is automatically deployed with your site. No additional configuration is needed.

**Testing**:

To test the function locally:

1. Build the site: `pnpm build`
2. Run the preview server: `pnpm preview`
3. Visit a mod detail page: `http://localhost:4173/my-mod-slug`
4. View the page source to see the injected meta tags

To test with social media crawlers:

1. Deploy to Cloudflare Pages
2. Share a mod link on Discord, Twitter, or Facebook
3. Verify the rich preview displays correctly with thumbnail and mod info

**Excluded Paths**:

The function does NOT process these paths (they're passed through to the SPA):

- `/login`
- `/admin`
- `/manage`
- `/browse`
- `/upload`
- `/r2`
- `/health`
- `/api`
- Root path `/`

**Performance**:

- The function only runs for HTML requests to mod detail pages
- It makes a single API call to fetch mod data
- The HTML modification is minimal and fast
- Cloudflare's edge network ensures low latency worldwide

## File Naming Convention

- `[[path]].ts` - The double brackets `[[...]]` create a catch-all route that matches any path
- This allows the function to intercept all requests and selectively process mod detail pages

## TypeScript Support

All functions are written in TypeScript for type safety and better developer experience. Cloudflare Pages automatically compiles TypeScript functions during deployment.

## Learn More

- [Cloudflare Pages Functions Documentation](https://developers.cloudflare.com/pages/platform/functions/)
- [Open Graph Protocol](https://ogp.me/)
- [Twitter Card Documentation](https://developer.twitter.com/en/docs/twitter-for-websites/cards/overview/abouts-cards)
