/**
 * MetaTags component for rich social media previews
 * Provides Open Graph and Twitter Card meta tags for mod detail pages
 */

import { Helmet } from 'react-helmet-async';
import type { ModMetadata } from '../types/mod';

interface MetaTagsProps {
    mod: ModMetadata;
    baseUrl?: string;
}

/**
 * Get the base URL for the mods hub
 * Falls back to current origin if not provided
 */
function getBaseUrl(baseUrl?: string): string {
    if (baseUrl) return baseUrl;
    if (typeof window !== 'undefined') {
        return window.location.origin;
    }
    return 'https://mods.idling.app'; // Fallback for SSR
}

/**
 * Format description for meta tags
 * Truncates to 200 characters and removes markdown
 */
function formatDescription(description: string): string {
    // Remove markdown links and formatting
    let cleaned = description
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Remove markdown links
        .replace(/\*\*([^\*]+)\*\*/g, '$1') // Remove bold
        .replace(/\*([^\*]+)\*/g, '$1') // Remove italic
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

export function ModMetaTags({ mod, baseUrl }: MetaTagsProps) {
    const siteBaseUrl = getBaseUrl(baseUrl);
    const modUrl = `${siteBaseUrl}/mods/${mod.slug}`;
    const description = formatDescription(mod.description);
    const title = `${mod.title} - Strixun Stream Suite Mods`;
    const categoryDisplay = getCategoryDisplayName(mod.category);
    
    // Use dedicated OG image endpoint for rich preview with dark background and gold border
    // The OG image is generated server-side with theming
    const API_BASE_URL = import.meta.env.VITE_MODS_API_URL || 'https://mods-api.idling.app';
    const ogImageUrl = `${API_BASE_URL}/mods/${mod.slug}/og-image`;
    const imageUrl = ogImageUrl; // Use OG image endpoint for rich preview
    
    // Build a rich description with mod details
    const richDescription = `${description} | ${categoryDisplay} mod by ${mod.authorEmail} | ${mod.downloadCount} downloads | Latest version: ${mod.latestVersion}`;

    return (
        <Helmet>
            {/* Primary Meta Tags */}
            <title>{title}</title>
            <meta name="title" content={title} />
            <meta name="description" content={description} />
            <link rel="canonical" href={modUrl} />

            {/* Open Graph / Facebook */}
            <meta property="og:type" content="website" />
            <meta property="og:url" content={modUrl} />
            <meta property="og:title" content={title} />
            <meta property="og:description" content={richDescription} />
            <meta property="og:image" content={imageUrl} />
            <meta property="og:image:width" content="1200" />
            <meta property="og:image:height" content="630" />
            <meta property="og:image:alt" content={`${mod.title} - ${categoryDisplay} mod for Strixun Stream Suite`} />
            <meta property="og:site_name" content="Strixun Stream Suite Mods" />
            <meta property="og:locale" content="en_US" />

            {/* Twitter Card */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:url" content={modUrl} />
            <meta name="twitter:title" content={title} />
            <meta name="twitter:description" content={richDescription} />
            <meta name="twitter:image" content={imageUrl} />
            <meta name="twitter:image:alt" content={`${mod.title} - ${categoryDisplay} mod for Strixun Stream Suite`} />
            <meta name="twitter:site" content="@strixun" />
            <meta name="twitter:creator" content="@strixun" />

            {/* Additional Meta Tags */}
            <meta name="theme-color" content="#d4af37" />
            <meta name="apple-mobile-web-app-capable" content="yes" />
            <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
            <meta name="apple-mobile-web-app-title" content="Stream Suite Mods" />

            {/* Article-specific tags for better categorization */}
            <meta property="article:author" content={mod.authorEmail} />
            <meta property="article:published_time" content={mod.createdAt} />
            <meta property="article:modified_time" content={mod.updatedAt} />
            <meta property="article:section" content={categoryDisplay} />
            {mod.tags.map((tag) => (
                <meta key={tag} property="article:tag" content={tag} />
            ))}
        </Helmet>
    );
}

