<script lang="ts">
  /**
   * Lexical Editor Component for Svelte
   * 
   * Wrapper component that bridges Lexical's framework-agnostic core to Svelte
   */
  
  import { CodeNode } from '@lexical/code';
  import { $generateHtmlFromNodes as generateHtmlFromNodes, $generateNodesFromDOM as generateNodesFromDOM } from '@lexical/html';
  import { LinkNode } from '@lexical/link';
  import { ListItemNode, ListNode } from '@lexical/list';
  import { HeadingNode, QuoteNode } from '@lexical/rich-text';
  import {
    createEditor,
    $createParagraphNode as createParagraphNode,
    $getRoot as getRoot,
    $getSelection as getSelection,
    $isRangeSelection as isRangeSelection,
    TextNode,
    ParagraphNode
  } from 'lexical';
  import { onDestroy, onMount } from 'svelte';
  import { MermaidNode, $createMermaidNode as createMermaidNode } from './MermaidNode';
  
  export let initialContent: string | null = null;
  export let onChange: ((content: string) => void) | null = null;
  export let placeholder: string = 'Start typing...';
  
  let editorContainer: HTMLDivElement;
  let editor: ReturnType<typeof createEditor> | null = null;
  let isReady = false;
  
  // Initialize Mermaid
  onMount(async () => {
    // Wait for container to be bound (use tick to ensure DOM is ready)
    if (!editorContainer) {
      console.error('[LexicalEditor] Container not found on mount');
      return;
    }
    
    if (typeof window !== 'undefined') {
      const mermaidModule = await import('mermaid');
      mermaidModule.default.initialize({
        startOnLoad: true,
        theme: 'dark',
        securityLevel: 'loose',
      });
    }
    
    // Create editor
    editor = createEditor({
      namespace: 'notes-editor',
      nodes: [
        TextNode, // REQUIRED for text input
        ParagraphNode, // REQUIRED for paragraphs
        HeadingNode,
        ListNode,
        ListItemNode,
        QuoteNode,
        CodeNode,
        LinkNode,
        MermaidNode,
      ],
      onError: (error) => {
        console.error('[LexicalEditor] Error:', error);
      },
      theme: {
        text: {
          bold: 'editor-text-bold',
          italic: 'editor-text-italic',
          underline: 'editor-text-underline',
          strikethrough: 'editor-text-strikethrough',
          code: 'editor-text-code',
        },
        list: {
          nested: {
            listitem: 'editor-nested-listitem',
          },
          ol: 'editor-list-ol',
          ul: 'editor-list-ul',
          listitem: 'editor-listitem',
        },
        link: 'editor-link',
        mermaid: 'editor-mermaid',
      },
      editable: true,
    });
    
    console.log('[LexicalEditor] Initializing editor, container:', editorContainer);
    
    // Mount editor to DOM (this makes it contentEditable automatically)
    // IMPORTANT: Don't set contentEditable manually - Lexical handles this
    editor.setRootElement(editorContainer);
    
    console.log('[LexicalEditor] Editor mounted, contentEditable:', editorContainer.contentEditable);
    console.log('[LexicalEditor] Editor editable state:', editor.isEditable());
    
    // Initialize with empty paragraph if no content
    editor.update(() => {
      const root = getRoot();
      console.log('[LexicalEditor] Root children:', root.getChildrenSize());
      if (root.getChildrenSize() === 0) {
        const paragraph = createParagraphNode();
        root.append(paragraph);
        console.log('[LexicalEditor] Added initial paragraph');
      }
    }, { discrete: true });
    
    // Handle content changes
    editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        if (onChange && editor) {
          try {
            const html = generateHtmlFromNodes(editor, null);
            onChange(html);
          } catch (error) {
            console.error('[LexicalEditor] Failed to generate HTML:', error);
          }
        }
      });
    });
    
    // Load initial content if provided
    if (initialContent && editor) {
      const editorInstance = editor; // Capture for closure
      editorInstance.update(() => {
        const parser = new DOMParser();
        const dom = parser.parseFromString(initialContent, 'text/html');
        const nodes = generateNodesFromDOM(editorInstance, dom);
        const root = getRoot();
        root.clear();
        if (nodes.length > 0) {
          root.append(...nodes);
        } else {
          // Ensure at least one paragraph
          const paragraph = createParagraphNode();
          root.append(paragraph);
        }
      });
    }
    
    // Ensure editor is editable
    if (!editor.isEditable()) {
      console.warn('[LexicalEditor] Editor is not editable, setting editable state');
      // Editor should already be editable from config, but double-check
    }
    
    // Focus the editor to make it interactive
    setTimeout(() => {
      if (editorContainer && editor) {
        // Ensure the container can receive focus
        editorContainer.focus();
        console.log('[LexicalEditor] Editor focused, editable:', editor.isEditable());
        console.log('[LexicalEditor] Container contentEditable:', editorContainer.contentEditable);
        
        // Test if we can get selection
        editor.getEditorState().read(() => {
          const selection = getSelection();
          console.log('[LexicalEditor] Initial selection:', selection);
        });
      }
    }, 100);
    
    isReady = true;
  });
  
  onDestroy(() => {
    if (editor) {
      editor.setRootElement(null);
      editor = null;
    }
  });
  
  /**
   * Get current editor content as HTML
   */
  export function getContent(): Promise<string> {
    return new Promise((resolve) => {
      if (!editor) {
        resolve('');
        return;
      }
      
      editor.getEditorState().read(() => {
        const html = generateHtmlFromNodes(editor!, null);
        resolve(html);
      });
    });
  }
  
  /**
   * Set editor content from HTML
   */
  export function setContent(html: string): void {
    if (!editor) return;
    
    editor.update(() => {
      const parser = new DOMParser();
      const dom = parser.parseFromString(html, 'text/html');
        const nodes = generateNodesFromDOM(editor!, dom);
        const root = getRoot();
      root.clear();
      root.append(...nodes);
    });
  }
  
  /**
   * Insert Mermaid diagram
   */
  export function insertMermaid(diagram: string): void {
    if (!editor) return;
    
    editor.update(() => {
      const mermaidNode = createMermaidNode(diagram);
      const selection = getSelection();
      if (selection && isRangeSelection(selection)) {
        selection.insertNodes([mermaidNode]);
      } else {
        const root = getRoot();
        root.append(mermaidNode);
      }
    });
  }
  
  /**
   * Get editor instance (for toolbar)
   */
  export function getEditor() {
    return editor;
  }
  
  /**
   * Format text commands
   */
  export function formatBold(): void {
    if (!editor) return;
    editor.update(() => {
      const selection = getSelection();
      if (selection && isRangeSelection(selection)) {
        selection.formatText('bold');
      }
    });
  }
  
  export function formatItalic(): void {
    if (!editor) return;
    editor.update(() => {
      const selection = getSelection();
      if (selection && isRangeSelection(selection)) {
        selection.formatText('italic');
      }
    });
  }
  
  export function formatUnderline(): void {
    if (!editor) return;
    editor.update(() => {
      const selection = getSelection();
      if (selection && isRangeSelection(selection)) {
        selection.formatText('underline');
      }
    });
  }
  
  export function formatStrikethrough(): void {
    if (!editor) return;
    editor.update(() => {
      const selection = getSelection();
      if (selection && isRangeSelection(selection)) {
        selection.formatText('strikethrough');
      }
    });
  }
  
  export function formatCode(): void {
    if (!editor) return;
    editor.update(() => {
      const selection = getSelection();
      if (selection && isRangeSelection(selection)) {
        selection.formatText('code');
      }
    });
  }
</script>

<div class="lexical-editor-wrapper">
  <div 
    bind:this={editorContainer} 
    class="lexical-editor"
    spellcheck="true"
    data-lexical-editor="true"
    data-placeholder={placeholder}
    tabindex="0"
    role="textbox"
    aria-label="Rich text editor"
  />
  {#if !isReady}
    <div class="editor-loading">Loading editor...</div>
  {/if}
</div>

<style lang="scss">
  @use '@styles/animations' as *;
  
  .lexical-editor-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 400px;
  }
  
  .lexical-editor {
    width: 100%;
    height: 100%;
    min-height: 400px;
    padding: 16px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 16px;
    line-height: 1.6;
    outline: none;
    overflow-y: auto;
    cursor: text;
    
    // Ensure editor is visible and interactive
    &[contenteditable="true"] {
      cursor: text;
      user-select: text;
      -webkit-user-select: text;
      
      &:focus {
        outline: 2px solid var(--accent);
        outline-offset: -2px;
      }
      
      &:empty::before {
        content: attr(data-placeholder);
        color: var(--text-secondary);
        pointer-events: none;
      }
    }
    
    // Ensure editor can receive focus and input
    &:focus {
      outline: 2px solid var(--accent);
      outline-offset: -2px;
    }
    
    // Text formatting
    :global(.editor-text-bold) {
      font-weight: bold;
    }
    
    :global(.editor-text-italic) {
      font-style: italic;
    }
    
    :global(.editor-text-underline) {
      text-decoration: underline;
    }
    
    :global(.editor-text-strikethrough) {
      text-decoration: line-through;
    }
    
    :global(.editor-text-code) {
      background: var(--bg-secondary);
      padding: 2px 4px;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
    }
    
    // Lists
    :global(.editor-list-ol),
    :global(.editor-list-ul) {
      margin: 8px 0;
      padding-left: 24px;
    }
    
    :global(.editor-listitem) {
      margin: 4px 0;
    }
    
    // Links
    :global(.editor-link) {
      color: var(--accent);
      text-decoration: underline;
      cursor: pointer;
    }
    
    :global(.editor-link:hover) {
      color: var(--accent-hover);
    }
    
    // Mermaid diagrams
    :global(.editor-mermaid) {
      margin: 16px 0;
    }
    
    :global(.mermaid-diagram-container) {
      display: flex;
      justify-content: center;
      margin: 16px 0;
    }
    
    :global(.mermaid) {
      max-width: 100%;
    }
  }
  
  .editor-loading {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: var(--text-secondary);
  }
</style>

