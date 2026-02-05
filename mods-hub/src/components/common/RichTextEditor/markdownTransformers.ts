/**
 * Markdown Transformers
 * Custom transformers including image, video, and collapsible support for markdown conversion
 */

import {
  TRANSFORMERS,
  TextMatchTransformer,
  ElementTransformer,
} from '@lexical/markdown';
import { $createParagraphNode, LexicalNode } from 'lexical';
import { $createImageNode, $isImageNode, ImageNode } from './ImageNode';
import {
  $createVideoEmbedNode,
  $isVideoEmbedNode,
  VideoEmbedNode,
  parseVideoUrl,
  isVideoUrl,
} from './VideoEmbedNode';
import {
  $createCollapsibleContainerNode,
  $createCollapsibleTitleNode,
  $createCollapsibleContentNode,
  $isCollapsibleContainerNode,
  CollapsibleContainerNode,
  CollapsibleTitleNode,
  CollapsibleContentNode,
} from '../CollapsiblePlugin';

/**
 * Image transformer for markdown syntax: ![alt text](url)
 * If the URL is a video URL (YouTube/Vimeo), creates a video embed instead
 */
export const IMAGE_TRANSFORMER: TextMatchTransformer = {
  dependencies: [ImageNode, VideoEmbedNode],
  export: (node) => {
    if ($isImageNode(node)) {
      return `![${node.getAltText()}](${node.getSrc()})`;
    }
    if ($isVideoEmbedNode(node)) {
      const platform = node.getPlatform();
      const videoId = node.getVideoId();
      const url = platform === 'youtube'
        ? `https://www.youtube.com/watch?v=${videoId}`
        : `https://vimeo.com/${videoId}`;
      return `![video](${url})`;
    }
    return null;
  },
  importRegExp: /!(?:\[([^[]*)\])(?:\(([^(]+)\))/,
  regExp: /!(?:\[([^[]*)\])(?:\(([^(]+)\))$/,
  replace: (textNode, match) => {
    const [, altText, src] = match;
    
    // Check if the URL is a video URL
    const videoInfo = parseVideoUrl(src || '');
    if (videoInfo) {
      const videoNode = $createVideoEmbedNode(videoInfo);
      textNode.replace(videoNode);
      return;
    }
    
    // Otherwise create an image node
    const imageNode = $createImageNode({
      src: src || '',
      altText: altText || '',
    });
    textNode.replace(imageNode);
  },
  trigger: ')',
  type: 'text-match',
};

/**
 * Video URL transformer - converts plain YouTube/Vimeo URLs to embeds
 */
export const VIDEO_URL_TRANSFORMER: TextMatchTransformer = {
  dependencies: [VideoEmbedNode],
  export: (node) => {
    if (!$isVideoEmbedNode(node)) {
      return null;
    }
    const platform = node.getPlatform();
    const videoId = node.getVideoId();
    return platform === 'youtube'
      ? `https://www.youtube.com/watch?v=${videoId}`
      : `https://vimeo.com/${videoId}`;
  },
  importRegExp: /(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|vimeo\.com\/)[^\s]+)/,
  regExp: /(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|vimeo\.com\/)[^\s]+)$/,
  replace: (textNode, match) => {
    const [, url] = match;
    const videoInfo = parseVideoUrl(url);
    if (videoInfo) {
      const videoNode = $createVideoEmbedNode(videoInfo);
      textNode.replace(videoNode);
    }
  },
  trigger: ' ',
  type: 'text-match',
};

/**
 * Collapsible/Details transformer for markdown
 * Matches: <details><summary>Title</summary>Content</details>
 */
export const COLLAPSIBLE_TRANSFORMER: ElementTransformer = {
  dependencies: [CollapsibleContainerNode, CollapsibleTitleNode, CollapsibleContentNode],
  export: (node: LexicalNode) => {
    if (!$isCollapsibleContainerNode(node)) {
      return null;
    }
    const children = node.getChildren();
    if (children.length !== 2) return null;
    
    const titleNode = children[0];
    const contentNode = children[1];
    
    // Get text content from title and content nodes
    const titleText = titleNode.getTextContent();
    const contentText = contentNode.getTextContent();
    
    return `<details>\n<summary>${titleText}</summary>\n${contentText}\n</details>`;
  },
  regExp: /^<details>\s*$/,
  replace: (parentNode, _children, match, isImport) => {
    // This handles the opening tag - actual content parsing happens in paste plugin
    const container = $createCollapsibleContainerNode(true);
    const title = $createCollapsibleTitleNode();
    const content = $createCollapsibleContentNode();
    
    title.append($createParagraphNode());
    content.append($createParagraphNode());
    container.append(title, content);
    
    parentNode.replace(container);
  },
  type: 'element',
};

/**
 * All transformers including custom ones
 * Use this instead of the default TRANSFORMERS from @lexical/markdown
 */
export const EXTENDED_TRANSFORMERS = [
  IMAGE_TRANSFORMER,
  VIDEO_URL_TRANSFORMER,
  COLLAPSIBLE_TRANSFORMER,
  ...TRANSFORMERS,
];

// Re-export for convenience
export { isVideoUrl, parseVideoUrl };

/**
 * Clean HTML tags from text, preserving text content
 */
function stripHtmlTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .trim();
}

/**
 * Convert markdown syntax to plain text (for collapsible content)
 */
function cleanMarkdownSyntax(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')        // Remove header syntax
    .replace(/\*\*([^*]+)\*\*/g, '$1')  // Bold **text** -> text
    .replace(/\*([^*]+)\*/g, '$1')      // Italic *text* -> text
    .replace(/__([^_]+)__/g, '$1')      // Bold __text__ -> text
    .replace(/_([^_]+)_/g, '$1')        // Italic _text_ -> text
    .replace(/`([^`]+)`/g, '$1')        // Inline code `code` -> code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links [text](url) -> text
    .trim();
}

/**
 * Pre-process text to convert <details> HTML blocks to a format
 * that can be handled by the paste plugin
 */
export function preprocessDetailsBlocks(text: string): {
  processed: string;
  detailsBlocks: Array<{ title: string; content: string }>;
} {
  const detailsRegex = /<details>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/gi;
  const detailsBlocks: Array<{ title: string; content: string }> = [];
  
  let processed = text;
  let match;
  
  // Need to collect all matches first since we're modifying the string
  const matches: Array<{ full: string; title: string; content: string }> = [];
  while ((match = detailsRegex.exec(text)) !== null) {
    matches.push({
      full: match[0],
      title: match[1].trim(),
      content: match[2].trim(),
    });
  }
  
  for (const m of matches) {
    // Clean the title - strip HTML and markdown
    const cleanTitle = cleanMarkdownSyntax(stripHtmlTags(m.title));
    
    // Clean the content - strip HTML and markdown
    const cleanContent = cleanMarkdownSyntax(stripHtmlTags(m.content));
    
    detailsBlocks.push({ title: cleanTitle, content: cleanContent });
    
    // Replace with a placeholder that we'll handle separately
    processed = processed.replace(m.full, `\n[COLLAPSIBLE:${detailsBlocks.length - 1}]\n`);
  }
  
  return { processed, detailsBlocks };
}
