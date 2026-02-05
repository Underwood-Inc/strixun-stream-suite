/**
 * MarkdownPastePlugin
 * Handles paste events for images, video URLs, and markdown content
 */

import { useEffect, useCallback } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $createParagraphNode,
  $insertNodes,
  $getSelection,
  $isRangeSelection,
  $isDecoratorNode,
  $isElementNode,
  COMMAND_PRIORITY_HIGH,
  PASTE_COMMAND,
  type LexicalNode,
} from 'lexical';
import { $generateNodesFromDOM } from '@lexical/html';
import { $createTextNode } from 'lexical';
import { isVideoUrl, parseVideoUrl } from '../transformers';
import { $createVideoEmbedNode, $createImageNode } from '../nodes';
import {
  $createCollapsibleContainerNode,
  $createCollapsibleContentNode,
  $createCollapsibleTitleNode,
} from './CollapsiblePlugin';
import { MAX_INLINE_IMAGE_SIZE } from '../constants';

/**
 * Simple markdown to HTML converter
 */
function markdownToHtml(markdown: string): string {
  let html = markdown
    // Code blocks (must be before other patterns)
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    // Headers
    .replace(/^######\s+(.*)$/gm, '<h6>$1</h6>')
    .replace(/^#####\s+(.*)$/gm, '<h5>$1</h5>')
    .replace(/^####\s+(.*)$/gm, '<h4>$1</h4>')
    .replace(/^###\s+(.*)$/gm, '<h3>$1</h3>')
    .replace(/^##\s+(.*)$/gm, '<h2>$1</h2>')
    .replace(/^#\s+(.*)$/gm, '<h1>$1</h1>')
    // Bold and italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/___(.+?)___/g, '<strong><em>$1</em></strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    // Strikethrough
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Images (must be BEFORE links since ![...] starts with ! and links would match the [...] part)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Blockquotes
    .replace(/^>\s+(.*)$/gm, '<blockquote>$1</blockquote>')
    // Horizontal rules
    .replace(/^[-*_]{3,}$/gm, '<hr />')
    // Unordered lists
    .replace(/^\s*[-*+]\s+(.*)$/gm, '<li>$1</li>')
    // Ordered lists
    .replace(/^\s*\d+\.\s+(.*)$/gm, '<li>$1</li>')
    // Paragraphs (lines that aren't already wrapped)
    .split('\n\n')
    .map(block => {
      block = block.trim();
      if (!block) return '';
      if (block.startsWith('<h') || block.startsWith('<pre') || 
          block.startsWith('<blockquote') || block.startsWith('<hr') ||
          block.startsWith('<li') || block.startsWith('<ul') || 
          block.startsWith('<ol') || block.startsWith('<img')) {
        return block;
      }
      return `<p>${block.replace(/\n/g, '<br />')}</p>`;
    })
    .join('\n');

  // Wrap consecutive <li> in <ul>
  html = html.replace(/(<li>.*?<\/li>\n?)+/g, '<ul>$&</ul>');
  // Merge consecutive blockquotes
  html = html.replace(/<\/blockquote>\n?<blockquote>/g, '\n');

  return html;
}

/**
 * Check if text is just a video URL
 */
function isPlainVideoUrl(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.includes('\n')) return false;
  return isVideoUrl(trimmed);
}

/**
 * Detects if text looks like markdown content
 */
function looksLikeMarkdown(text: string): boolean {
  const markdownPatterns = [
    /^#{1,6}\s+/m,           // Headers
    /^\s*[-*+]\s+/m,         // Unordered lists
    /^\s*\d+\.\s+/m,         // Ordered lists
    /\[.+?\]\(.+?\)/,        // Links
    /!\[.+?\]\(.+?\)/,       // Images
    /\*\*.+?\*\*/,           // Bold
    /\*.+?\*/,               // Italic
    /`[^`]+`/,               // Inline code
    /```[\s\S]*?```/,        // Code blocks
    /^\s*>/m,                // Blockquotes
    /^\s*[-*_]{3,}\s*$/m,    // Horizontal rules
  ];
  
  let matchCount = 0;
  for (const pattern of markdownPatterns) {
    if (pattern.test(text)) {
      matchCount++;
      if (matchCount >= 2) return true;
    }
  }
  
  // Single strong indicators
  if (/!\[.+?\]\(.+?\)/.test(text)) return true;
  if (/```[\s\S]*?```/.test(text)) return true;
  
  return false;
}

/**
 * MarkdownPastePlugin
 */
export function MarkdownPastePlugin() {
  const [editor] = useLexicalComposerContext();

  const handleImagePaste = useCallback((file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!file.type.startsWith('image/')) {
        resolve(false);
        return;
      }

      if (file.size > MAX_INLINE_IMAGE_SIZE) {
        console.warn(`[MarkdownPastePlugin] Image too large: ${file.size} bytes`);
        resolve(false);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        editor.update(() => {
          const imageNode = $createImageNode({
            src: base64,
            altText: file.name || 'Pasted image',
          });
          $insertNodes([imageNode]);
        }, { discrete: true });
        resolve(true);
      };
      reader.onerror = () => resolve(false);
      reader.readAsDataURL(file);
    });
  }, [editor]);

  useEffect(() => {
    return editor.registerCommand(
      PASTE_COMMAND,
      (event: ClipboardEvent) => {
        const clipboardData = event.clipboardData;
        if (!clipboardData) return false;

        // Handle image files
        const files = clipboardData.files;
        if (files && files.length > 0) {
          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.type.startsWith('image/')) {
              event.preventDefault();
              handleImagePaste(file);
              return true;
            }
          }
        }

        // Handle image items
        const items = clipboardData.items;
        if (items) {
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.startsWith('image/')) {
              const file = item.getAsFile();
              if (file) {
                event.preventDefault();
                handleImagePaste(file);
                return true;
              }
            }
          }
        }

        const text = clipboardData.getData('text/plain');
        if (!text) return false;

        // Handle video URLs
        if (isPlainVideoUrl(text)) {
          event.preventDefault();
          const videoInfo = parseVideoUrl(text.trim());
          if (videoInfo) {
            editor.update(() => {
              const selection = $getSelection();
              if ($isRangeSelection(selection) && !selection.isCollapsed()) {
                selection.removeText();
              }
              const videoNode = $createVideoEmbedNode(videoInfo);
              $insertNodes([videoNode]);
            }, { discrete: true });
            return true;
          }
        }

        // Handle markdown
        if (!looksLikeMarkdown(text)) {
          return false; // Let default paste handle it
        }

        event.preventDefault();

        // Convert markdown to HTML
        const html = markdownToHtml(text);
        
        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection) && !selection.isCollapsed()) {
            selection.removeText();
          }

          // Parse HTML
          const parser = new DOMParser();
          const dom = parser.parseFromString(html, 'text/html');
          
          // Walk DOM and convert to Lexical nodes, handling <img> explicitly
          const finalNodes: LexicalNode[] = [];
          
          function processNode(domNode: Node): void {
            if (domNode.nodeType === Node.ELEMENT_NODE) {
              const element = domNode as HTMLElement;
              
              // Handle <details> elements - convert to CollapsiblePlugin nodes
              if (element.tagName === 'DETAILS') {
                const details = element as HTMLDetailsElement;
                const isOpen = details.open;
                
                // Create the collapsible structure
                const container = $createCollapsibleContainerNode(isOpen);
                const title = $createCollapsibleTitleNode();
                const content = $createCollapsibleContentNode();
                
                // Find <summary> for the title
                const summary = details.querySelector('summary');
                if (summary) {
                  // Convert summary content to text
                  title.append($createTextNode(summary.textContent || 'Details'));
                } else {
                  title.append($createTextNode('Details'));
                }
                
                // Process everything else as content
                const contentNodes: LexicalNode[] = [];
                details.childNodes.forEach(child => {
                  if (child.nodeType === Node.ELEMENT_NODE) {
                    const childEl = child as HTMLElement;
                    if (childEl.tagName === 'SUMMARY') return; // Skip summary
                    
                    // Convert child element to Lexical nodes
                    const tempContainer = document.createElement('div');
                    tempContainer.appendChild(childEl.cloneNode(true));
                    const tempDom = parser.parseFromString(tempContainer.innerHTML, 'text/html');
                    const nodes = $generateNodesFromDOM(editor, tempDom);
                    for (const node of nodes) {
                      if ($isElementNode(node) || $isDecoratorNode(node)) {
                        contentNodes.push(node);
                      } else if (node.getTextContent().trim()) {
                        const para = $createParagraphNode();
                        para.append(node);
                        contentNodes.push(para);
                      }
                    }
                  } else if (child.nodeType === Node.TEXT_NODE) {
                    const text = child.textContent?.trim();
                    if (text) {
                      const para = $createParagraphNode();
                      para.append($createTextNode(text));
                      contentNodes.push(para);
                    }
                  }
                });
                
                // Ensure content has at least one paragraph
                if (contentNodes.length === 0) {
                  contentNodes.push($createParagraphNode());
                }
                
                // Append content nodes to content container
                contentNodes.forEach(node => content.append(node));
                
                // Build the collapsible structure
                container.append(title);
                container.append(content);
                finalNodes.push(container);
                return;
              }
              
              // Handle <img> elements directly - create ImageNode
              if (element.tagName === 'IMG') {
                const img = element as HTMLImageElement;
                const imageNode = $createImageNode({
                  src: img.src,
                  altText: img.alt || '',
                  width: img.width || undefined,
                  height: img.height || undefined,
                });
                // Wrap in paragraph for root insertion
                const para = $createParagraphNode();
                para.append(imageNode);
                finalNodes.push(para);
                return;
              }
              
              // For other elements, check if they contain special elements we handle
              const hasSpecialChildren = element.querySelectorAll('img, details').length > 0;
              if (hasSpecialChildren) {
                // Process children individually
                element.childNodes.forEach(child => processNode(child));
                return;
              }
              
              // No special elements - convert whole element
              const tempContainer = document.createElement('div');
              tempContainer.appendChild(element.cloneNode(true));
              const tempDom = parser.parseFromString(tempContainer.innerHTML, 'text/html');
              const nodes = $generateNodesFromDOM(editor, tempDom);
              for (const node of nodes) {
                if ($isElementNode(node) || $isDecoratorNode(node)) {
                  finalNodes.push(node);
                } else if (node.getTextContent().trim()) {
                  const para = $createParagraphNode();
                  para.append(node);
                  finalNodes.push(para);
                }
              }
            } else if (domNode.nodeType === Node.TEXT_NODE) {
              const text = domNode.textContent?.trim();
              if (text) {
                // Let $generateNodesFromDOM handle text wrapped properly
                const tempDom = parser.parseFromString(`<p>${text}</p>`, 'text/html');
                const nodes = $generateNodesFromDOM(editor, tempDom);
                finalNodes.push(...nodes.filter(n => $isElementNode(n) || $isDecoratorNode(n)));
              }
            }
          }
          
          // Process all body children
          dom.body.childNodes.forEach(child => processNode(child));
          
          if (finalNodes.length > 0) {
            $insertNodes(finalNodes);
          }
        }, { discrete: true });

        return true;
      },
      COMMAND_PRIORITY_HIGH
    );
  }, [editor, handleImagePaste]);

  return null;
}

export default MarkdownPastePlugin;
