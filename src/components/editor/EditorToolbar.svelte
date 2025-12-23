<script lang="ts">
  /**
   * Editor Toolbar Component
   * 
   * Provides formatting buttons for the rich text editor
   */
  
  import type { LexicalEditor } from 'lexical';
  import { 
    $getSelection, 
    $isRangeSelection,
    FORMAT_TEXT_COMMAND,
    FORMAT_ELEMENT_COMMAND,
    $createHeadingNode,
    HeadingTagType
  } from 'lexical';
  import { $isHeadingNode } from '@lexical/rich-text';
  import { INSERT_UNORDERED_LIST_COMMAND, INSERT_ORDERED_LIST_COMMAND } from '@lexical/list';
  import { $createLinkNode } from '@lexical/link';
  
  export let editor: LexicalEditor | null = null;
  
  let isBold = false;
  let isItalic = false;
  let isUnderline = false;
  let isStrikethrough = false;
  let isCode = false;
  let headingLevel: HeadingTagType | null = null;
  
  /**
   * Update toolbar state based on selection
   */
  function updateToolbar(): void {
    if (!editor) return;
    
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (selection && $isRangeSelection(selection)) {
        isBold = selection.hasFormat('bold');
        isItalic = selection.hasFormat('italic');
        isUnderline = selection.hasFormat('underline');
        isStrikethrough = selection.hasFormat('strikethrough');
        isCode = selection.hasFormat('code');
        
        // Check heading
        const anchorNode = selection.anchor.getNode();
        const parent = anchorNode.getParent();
        if ($isHeadingNode(parent)) {
          headingLevel = parent.getTag();
        } else {
          headingLevel = null;
        }
      }
    });
  }
  
  /**
   * Format text
   */
  function formatText(format: 'bold' | 'italic' | 'underline' | 'strikethrough' | 'code'): void {
    if (!editor) return;
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
    setTimeout(updateToolbar, 0);
  }
  
  /**
   * Set heading
   */
  function setHeading(level: HeadingTagType | null): void {
    if (!editor) return;
    editor.update(() => {
      const selection = $getSelection();
      if (selection && $isRangeSelection(selection)) {
        if (level) {
          const heading = $createHeadingNode(level);
          selection.insertNodes([heading]);
        }
      }
    });
    setTimeout(updateToolbar, 0);
  }
  
  /**
   * Insert list
   */
  function insertList(ordered: boolean): void {
    if (!editor) return;
    if (ordered) {
      editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
    } else {
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
    }
  }
  
  // Update toolbar on selection change
  if (editor) {
    editor.registerUpdateListener(() => {
      updateToolbar();
    });
  }
</script>

<div class="editor-toolbar">
  <div class="toolbar-group">
    <button 
      class="toolbar-btn" 
      class:active={isBold}
      on:click={() => formatText('bold')}
      title="Bold (Ctrl+B)"
    >
      <strong>B</strong>
    </button>
    <button 
      class="toolbar-btn" 
      class:active={isItalic}
      on:click={() => formatText('italic')}
      title="Italic (Ctrl+I)"
    >
      <em>I</em>
    </button>
    <button 
      class="toolbar-btn" 
      class:active={isUnderline}
      on:click={() => formatText('underline')}
      title="Underline (Ctrl+U)"
    >
      <u>U</u>
    </button>
    <button 
      class="toolbar-btn" 
      class:active={isStrikethrough}
      on:click={() => formatText('strikethrough')}
      title="Strikethrough"
    >
      <s>S</s>
    </button>
    <button 
      class="toolbar-btn" 
      class:active={isCode}
      on:click={() => formatText('code')}
      title="Code"
    >
      &lt;/&gt;
    </button>
  </div>
  
  <div class="toolbar-group">
    <select 
      class="toolbar-select"
      value={headingLevel || ''}
      on:change={(e) => setHeading(e.currentTarget.value as HeadingTagType || null)}
      title="Heading"
    >
      <option value="">Normal</option>
      <option value="h1">Heading 1</option>
      <option value="h2">Heading 2</option>
      <option value="h3">Heading 3</option>
      <option value="h4">Heading 4</option>
    </select>
  </div>
  
  <div class="toolbar-group">
    <button 
      class="toolbar-btn" 
      on:click={() => insertList(false)}
      title="Bullet List"
    >
      •
    </button>
    <button 
      class="toolbar-btn" 
      on:click={() => insertList(true)}
      title="Numbered List"
    >
      1.
    </button>
  </div>
</div>

<style lang="scss">
  @use '@styles/animations' as *;
  
  .editor-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
    border-radius: 8px 8px 0 0;
    flex-wrap: wrap;
  }
  
  .toolbar-group {
    display: flex;
    align-items: center;
    gap: 4px;
    padding-right: 8px;
    border-right: 1px solid var(--border);
    
    &:last-child {
      border-right: none;
    }
  }
  
  .toolbar-btn {
    padding: 6px 10px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    color: var(--text);
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s ease;
    
    &:hover {
      background: var(--bg);
      border-color: var(--border);
    }
    
    &.active {
      background: var(--accent);
      color: var(--bg-dark);
      border-color: var(--accent);
    }
  }
  
  .toolbar-select {
    padding: 6px 8px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text);
    font-size: 14px;
    cursor: pointer;
    
    &:hover {
      border-color: var(--accent);
    }
  }
</style>

