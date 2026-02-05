/**
 * RichTextEditor Constants
 * URL matchers, limits, and configuration
 */

import { DEFAULT_UPLOAD_LIMITS } from '@strixun/api-framework';

/** Maximum size for a single inline image (from shared framework) */
export const MAX_INLINE_IMAGE_SIZE = DEFAULT_UPLOAD_LIMITS.maxInlineImageSize;

/** Maximum total payload size for rich text content (from shared framework) */
export const MAX_RICH_TEXT_PAYLOAD = DEFAULT_UPLOAD_LIMITS.maxRichTextPayloadSize;

/** URL regex pattern for auto-linking */
export const URL_MATCHER = /((https?:\/\/(www\.)?)|(www\.))[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/;

/** Email regex pattern for auto-linking */
export const EMAIL_MATCHER = /(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))/;

/** Auto-link matchers for Lexical AutoLinkPlugin */
export const AUTO_LINK_MATCHERS = [
  (text: string) => {
    const match = URL_MATCHER.exec(text);
    if (match === null) return null;
    const fullMatch = match[0];
    return {
      index: match.index,
      length: fullMatch.length,
      text: fullMatch,
      url: fullMatch.startsWith('http') ? fullMatch : `https://${fullMatch}`,
    };
  },
  (text: string) => {
    const match = EMAIL_MATCHER.exec(text);
    if (match === null) return null;
    const fullMatch = match[0];
    return {
      index: match.index,
      length: fullMatch.length,
      text: fullMatch,
      url: `mailto:${fullMatch}`,
    };
  },
];

/** YouTube URL pattern for video embeds */
export const YOUTUBE_PATTERN = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/;

/** Vimeo URL pattern for video embeds */
export const VIMEO_PATTERN = /vimeo\.com\/(\d+)/;
