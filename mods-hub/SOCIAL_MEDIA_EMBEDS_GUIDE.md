# Social Media Rich Embeds Guide

This guide explains how the Mods Hub handles social media rich embeds (Open Graph previews) for mod detail pages.

## Problem

Social media platforms (Discord, Twitter, Facebook, LinkedIn, etc.) use web crawlers to fetch link previews. These crawlers:

- **Don't execute JavaScript** - They only read the initial HTML
- **Need meta tags in the HTML** - Open Graph and Twitter Card meta tags must be in the server response
- **Can't see React-added tags** - Tags added by `react-helmet-async` are invisible to crawlers

**Result**: When sharing mod links, the preview showed generic site info instead of the specific mod's thumbnail and details.

## Solution

We implemented **server-side meta tag injection** using Cloudflare Pages Functions:

1. **Intercepts requests** to mod detail pages (`/:slug`)
2. **Fetches mod data** from the Mods API
3. **Injects Open Graph meta tags** into the HTML before sending to the crawler
4. **Returns modified HTML** with all meta tags in place

## How It Works

### Architecture

```
Social Media Crawler Request
         ↓
Cloudflare Pages Function (/functions/[[path]].ts)
         ↓
Checks if path is a mod detail page (/:slug)
         ↓
Fetches mod data from Mods API (/mods/:slug)
         ↓
Generates Open Graph meta tags
         ↓
Injects tags into HTML <head>
         ↓
Returns modified HTML to crawler
```

### Meta Tags Injected

For each mod detail page, the following meta tags are injected:

#### Primary Meta Tags
- `<title>` - Mod title with site name
- `<meta name="description">` - Mod description (truncated to 200 chars)
- `<link rel="canonical">` - Canonical URL for the mod

#### Open Graph (Facebook, LinkedIn, Discord)
- `og:type` - "website"
- `og:url` - Full URL to the mod page
- `og:title` - Mod title with site name
- `og:description` - Rich description with mod details
- `og:image` - Mod thumbnail via `/mods/:slug/og-image` endpoint
- `og:image:width` - 1200px
- `og:image:height` - 630px
- `og:image:alt` - Descriptive alt text
- `og:site_name` - "Strixun Stream Suite Mods"
- `og:locale` - "en_US"

#### Twitter Card
- `twitter:card` - "summary_large_image"
- `twitter:url` - Full URL to the mod page
- `twitter:title` - Mod title with site name
- `twitter:description` - Rich description with mod details
- `twitter:image` - Mod thumbnail
- `twitter:image:alt` - Descriptive alt text
- `twitter:site` - "@strixun"
- `twitter:creator` - "@strixun"

#### Article Tags (for better categorization)
- `article:author` - Mod uploader's display name
- `article:published_time` - Mod creation date
- `article:modified_time` - Mod update date
- `article:section` - Mod category
- `article:tag` - Each mod tag

## Testing

### Local Testing

1. **Build the site**:
   ```bash
   cd mods-hub
   pnpm build
   ```

2. **Run preview server**:
   ```bash
   pnpm preview
   ```

3. **Test a mod page**:
   ```bash
   curl -H "User-Agent: facebookexternalhit/1.1" http://localhost:4173/your-mod-slug
   ```

4. **Check for meta tags** in the HTML response

### Automated Testing

Use the provided test script:

```bash
cd mods-hub/functions
ts-node test-meta-tags.ts http://localhost:4173/your-mod-slug
```

The script will:
- Simulate a social media crawler request
- Extract all meta tags from the response
- Validate required tags are present
- Report any missing or invalid tags

### Production Testing

After deploying to Cloudflare Pages:

1. **Test with curl**:
   ```bash
   curl -H "User-Agent: facebookexternalhit/1.1" https://mods.idling.app/your-mod-slug
   ```

2. **Test with online tools**:
   - [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
   - [Twitter Card Validator](https://cards-dev.twitter.com/validator)
   - [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/)
   - [Open Graph Debugger](https://www.opengraph.xyz/)

3. **Test in real platforms**:
   - Share a mod link in Discord
   - Tweet a mod link
   - Post a mod link on Facebook
   - Share a mod link on LinkedIn

## Troubleshooting

### Meta tags not showing in social media preview

**Possible causes**:

1. **Cached preview** - Social media platforms cache link previews
   - **Solution**: Use the platform's debug tool to refresh the cache
   - Facebook: [Sharing Debugger](https://developers.facebook.com/tools/debug/)
   - Twitter: Wait 7 days or use [Card Validator](https://cards-dev.twitter.com/validator)
   - LinkedIn: [Post Inspector](https://www.linkedin.com/post-inspector/)

2. **Function not deployed** - The Cloudflare Pages Function may not be deployed
   - **Solution**: Redeploy the site to Cloudflare Pages
   - Check deployment logs for errors

3. **API not accessible** - The Mods API may not be accessible from Cloudflare's edge
   - **Solution**: Verify the API URL in environment variables
   - Check API CORS settings

4. **Invalid slug** - The slug may not match any mod
   - **Solution**: Verify the slug exists in the database
   - Check API response for 404 errors

### OG image not displaying

**Possible causes**:

1. **Image URL invalid** - The OG image endpoint may be returning an error
   - **Solution**: Test the endpoint directly: `https://mods-api.idling.app/mods/:slug/og-image`
   - Check API logs for errors

2. **Image too large** - Some platforms have size limits
   - **Solution**: Ensure OG images are under 8MB
   - Optimize image compression

3. **CORS issues** - The image may not be accessible due to CORS
   - **Solution**: Verify CORS headers on the OG image endpoint
   - Ensure `Access-Control-Allow-Origin` is set

### Function not running

**Possible causes**:

1. **Build error** - The TypeScript may not compile
   - **Solution**: Check build logs for TypeScript errors
   - Run `pnpm build` locally to test

2. **Path not matching** - The function may not be intercepting the right paths
   - **Solution**: Check the path matching logic in `[[path]].ts`
   - Verify excluded paths don't include mod detail pages

3. **Environment variables missing** - API URL may not be configured
   - **Solution**: Set `MODS_API_URL` or `VITE_MODS_API_URL` in Cloudflare Pages settings
   - Check environment variable names match

## Deployment

### Cloudflare Pages

The function is automatically deployed when you deploy the Mods Hub to Cloudflare Pages:

1. **Build command**: `pnpm build`
2. **Output directory**: `dist`
3. **Functions directory**: `functions` (auto-detected)

### Environment Variables

Set these in Cloudflare Pages dashboard:

- `MODS_API_URL` - Base URL for the Mods API (e.g., `https://mods-api.idling.app`)
- `VITE_MODS_API_URL` - Alternative name (same value)

### Verification

After deployment:

1. Check deployment logs for function compilation
2. Test a mod detail page with curl (see Testing section)
3. Verify meta tags in HTML response
4. Test with social media debug tools

## Performance

- **Cold start**: ~50-100ms (Cloudflare edge)
- **API call**: ~100-200ms (fetch mod data)
- **HTML modification**: ~5-10ms (inject meta tags)
- **Total overhead**: ~150-300ms

The function only runs for:
- HTML requests (not API calls, images, etc.)
- Mod detail pages (not other routes)
- First request (subsequent requests may be cached)

## Maintenance

### Updating Meta Tags

To change the meta tags generated:

1. Edit `mods-hub/functions/[[path]].ts`
2. Modify the `generateMetaTags()` function
3. Deploy to Cloudflare Pages
4. Test with social media debug tools

### Adding New Platforms

To support additional platforms (e.g., WhatsApp, Telegram):

1. Add platform-specific meta tags in `generateMetaTags()`
2. Add platform's crawler user agent to `isCrawler()`
3. Test with platform's debug tool
4. Deploy and verify

### Monitoring

Monitor function performance in Cloudflare Pages dashboard:

- Function invocations
- Execution time
- Error rate
- Cache hit rate

## Best Practices

1. **Always test locally** before deploying
2. **Use debug tools** to refresh cached previews
3. **Monitor API errors** that may affect meta tag generation
4. **Keep images optimized** for fast loading
5. **Update meta tags** when mod data structure changes

## References

- [Open Graph Protocol](https://ogp.me/)
- [Twitter Card Documentation](https://developer.twitter.com/en/docs/twitter-for-websites/cards/overview/abouts-cards)
- [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/platform/functions/)
- [Facebook Sharing Best Practices](https://developers.facebook.com/docs/sharing/webmasters)
- [Discord Embed Limits](https://discord.com/developers/docs/resources/channel#embed-limits)
