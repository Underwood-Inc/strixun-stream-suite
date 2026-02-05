/**
 * MarkdownPastePlugin
 * Converts pasted markdown content to Lexical nodes
 */

import { useEffect, useCallback } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $convertFromMarkdownString } from '@lexical/markdown';
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $insertNodes,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_HIGH,
  PASTE_COMMAND,
  createEditor,
  type LexicalNode,
} from 'lexical';
import { EXTENDED_TRANSFORMERS, isVideoUrl, parseVideoUrl, preprocessDetailsBlocks } from './markdownTransformers';
import {
  $createCollapsibleContainerNode,
  $createCollapsibleTitleNode,
  $createCollapsibleContentNode,
  CollapsibleContainerNode,
  CollapsibleContentNode,
  CollapsibleTitleNode,
} from '../CollapsiblePlugin';
import { $createVideoEmbedNode, VideoEmbedNode } from './VideoEmbedNode';
import { $createImageNode, ImageNode } from './ImageNode';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { CodeNode } from '@lexical/code';
import { LinkNode, AutoLinkNode } from '@lexical/link';
import { HorizontalRuleNode } from '@lexical/extension';
import { TableNode, TableCellNode, TableRowNode } from '@lexical/table';
import { MAX_INLINE_IMAGE_SIZE } from './constants';

/**
 * Check if text is just a video URL
 */
function isPlainVideoUrl(text: string): boolean {
  const trimmed = text.trim();
  // Check if it's a single line that's just a video URL
  if (trimmed.includes('\n')) return false;
  return isVideoUrl(trimmed);
}

/**
 * Detects if text looks like markdown content
 */
function looksLikeMarkdown(text: string): boolean {
  const markdownPatterns = [
    /^#{1,6}\s+/m,           // Headers: # Header
    /^\s*[-*+]\s+/m,         // Unordered lists: - item
    /^\s*\d+\.\s+/m,         // Ordered lists: 1. item
    /\[.+?\]\(.+?\)/,        // Links: [text](url)
    /!\[.+?\]\(.+?\)/,       // Images: ![alt](url)
    /\*\*.+?\*\*/,           // Bold: **text**
    /\*.+?\*/,               // Italic: *text*
    /`[^`]+`/,               // Inline code: `code`
    /```[\s\S]*?```/,        // Code blocks: ```code```
    /^\s*>/m,                // Blockquotes: > quote
    /^\s*[-*_]{3,}\s*$/m,    // Horizontal rules: ---
    /\|.+\|/,                // Tables: | col |
    /<details>/i,            // HTML details/summary
  ];
  
  // Check if multiple patterns match (more confidence it's markdown)
  let matchCount = 0;
  for (const pattern of markdownPatterns) {
    if (pattern.test(text)) {
      matchCount++;
      if (matchCount >= 2) return true;
    }
  }
  
  // Single strong indicator (like image syntax) is enough
  if (/!\[.+?\]\(.+?\)/.test(text)) return true;
  if (/```[\s\S]*?```/.test(text)) return true;
  if (/<details>[\s\S]*?<\/details>/i.test(text)) return true;
  
  return false;
}

/**
 * MarkdownPastePlugin - Intercepts paste events and converts markdown to Lexical
 * Also handles image paste from clipboard (screenshots, copied images)
 */
export function MarkdownPastePlugin() {
  const [editor] = useLexicalComposerContext();

  /**
   * Handle pasted image file
   * Uses discrete history entry so the paste can be undone as a single action
   */
  const handleImagePaste = useCallback((file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      // Validate it's an image
      if (!file.type.startsWith('image/')) {
        resolve(false);
        return;
      }

      // Check file size
      if (file.size > MAX_INLINE_IMAGE_SIZE) {
        console.warn(`[MarkdownPastePlugin] Image too large: ${file.size} bytes (max: ${MAX_INLINE_IMAGE_SIZE})`);
        resolve(false);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        
        // Use discrete: true to create a separate history entry for undo/redo
        editor.update(() => {
          const imageNode = $createImageNode({
            src: base64,
            altText: file.name || 'Pasted image',
          });
          $insertNodes([imageNode]);
        }, { discrete: true });
        
        resolve(true);
      };
      reader.onerror = () => {
        console.error('[MarkdownPastePlugin] Failed to read image file');
        resolve(false);
      };
      reader.readAsDataURL(file);
    });
  }, [editor]);

  useEffect(() => {
    return editor.registerCommand(
      PASTE_COMMAND,
      (event: ClipboardEvent) => {
        const clipboardData = event.clipboardData;
        if (!clipboardData) return false;

        // Check for image files in clipboard (screenshots, copied images)
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

        // Also check items for image data (some browsers use this)
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

        // Get the plain text from clipboard
        const text = clipboardData.getData('text/plain');
        if (!text) return false;

        // Check if it's a plain video URL (YouTube/Vimeo)
        if (isPlainVideoUrl(text)) {
          event.preventDefault();
          
          const videoInfo = parseVideoUrl(text.trim());
          if (videoInfo) {
            // Use discrete: true for proper undo/redo support
            editor.update(() => {
              const selection = $getSelection();
              if ($isRangeSelection(selection) && !selection.isCollapsed()) {
                selection.removeText();
              }
              
              const videoNode = $createVideoEmbedNode(videoInfo);
              // Insert at cursor position, not at root
              $insertNodes([videoNode]);
            }, { discrete: true });
            return true;
          }
        }

        // Check if it looks like markdown
        if (!looksLikeMarkdown(text)) {
          // Let default paste handling take over
          return false;
        }

        // Prevent default paste
        event.preventDefault();

        // Pre-process to extract <details> blocks
        const { processed, detailsBlocks } = preprocessDetailsBlocks(text);

        // Create a temporary headless editor to parse markdown without affecting the main editor
        const tempEditor = createEditor({
          nodes: [
            HeadingNode,
            QuoteNode,
            ListNode,
            ListItemNode,
            CodeNode,
            LinkNode,
            AutoLinkNode,
            HorizontalRuleNode,
            TableNode,
            TableCellNode,
            TableRowNode,
            ImageNode,
            VideoEmbedNode,
            CollapsibleContainerNode,
            CollapsibleContentNode,
            CollapsibleTitleNode,
          ],
        });

        // Parse markdown in the temp editor
        let nodesToInsert: LexicalNode[] = [];
        
        tempEditor.update(() => {
          $convertFromMarkdownString(processed, EXTENDED_TRANSFORMERS);
          
          // Handle collapsible placeholders
          if (detailsBlocks.length > 0) {
            const root = $getRoot();
            const allNodes = root.getAllTextNodes();
            
            for (const textNode of allNodes) {
              const content = textNode.getTextContent();
              const match = content.match(/\[COLLAPSIBLE:(\d+)\]/);
              
              if (match) {
                const index = parseInt(match[1], 10);
                const block = detailsBlocks[index];
                
                if (block) {
                  const container = $createCollapsibleContainerNode(true);
                  const title = $createCollapsibleTitleNode();
                  const contentNode = $createCollapsibleContentNode();
                  
                  const titlePara = $createParagraphNode();
                  titlePara.append($createTextNode(block.title));
                  title.append(titlePara);
                  
                  const contentLines = block.content.split('\n').filter(line => line.trim());
                  for (const line of contentLines) {
                    if (line.trim()) {
                      const para = $createParagraphNode();
                      para.append($createTextNode(line.trim()));
                      contentNode.append(para);
                    }
                  }
                  
                  if (contentNode.getChildrenSize() === 0) {
                    contentNode.append($createParagraphNode());
                  }
                  
                  container.append(title, contentNode);
                  
                  const parentParagraph = textNode.getParent();
                  if (parentParagraph) {
                    parentParagraph.replace(container);
                  }
                }
              }
            }
          }
          
          // Extract the children from the temp editor's root
          const root = $getRoot();
          nodesToInsert = root.getChildren();
        }, { discrete: true });

        // Now insert the parsed nodes into the actual editor at the cursor position
        editor.update(() => {
          const selection = $getSelection();
          
          // If there's a selection, delete it first
          if ($isRangeSelection(selection) && !selection.isCollapsed()) {
            selection.removeText();
          }

          // Clone nodes and insert at cursor position
          if (nodesToInsert.length > 0) {
            // We need to export and re-import nodes to move them between editors
            const clonedNodes = nodesToInsert.map(node => {
              const json = node.exportJSON();
              // Import the node into the current editor context
              const nodeClass = editor._nodes.get(json.type);
              if (nodeClass) {
                return nodeClass.klass.importJSON(json);
              }
              // Fallback: create a paragraph with the text content
              const para = $createParagraphNode();
              para.append($createTextNode(node.getTextContent()));
              return para;
            });
            
            $insertNodes(clonedNodes);
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
