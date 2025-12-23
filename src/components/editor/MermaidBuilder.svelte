<script lang="ts">
  /**
   * Mermaid Diagram Builder Component
   * 
   * Provides a UI for creating and editing Mermaid diagrams
   */
  
  import { onMount } from 'svelte';
  import mermaid from 'mermaid';
  
  export let isOpen = false;
  export let initialDiagram = '';
  export let onSave: ((diagram: string) => void) | null = null;
  export let onClose: (() => void) | null = null;
  
  let diagramCode = initialDiagram || 'graph TD\n    A[Start] --> B[Process]\n    B --> C[End]';
  let previewContainer: HTMLDivElement;
  let previewId = `mermaid-preview-${Date.now()}`;
  let error = '';
  
  // Common diagram templates
  const templates = {
    flowchart: 'graph TD\n    A[Start] --> B[Process]\n    B --> C[End]',
    sequence: 'sequenceDiagram\n    participant A\n    participant B\n    A->>B: Message',
    class: 'classDiagram\n    class Animal\n    class Dog\n    Animal <|-- Dog',
    state: 'stateDiagram-v2\n    [*] --> State1\n    State1 --> State2\n    State2 --> [*]',
    gantt: 'gantt\n    title Gantt Chart\n    dateFormat YYYY-MM-DD\n    section Section\n    Task :done, task1, 2024-01-01, 2024-01-10',
    pie: 'pie title Pie Chart\n    "Slice 1" : 30\n    "Slice 2" : 20\n    "Slice 3" : 50',
  };
  
  /**
   * Render preview
   */
  async function renderPreview(): Promise<void> {
    if (!previewContainer) return;
    
    error = '';
    previewContainer.innerHTML = '';
    
    try {
      // Initialize Mermaid if needed
      if (!(window as any).mermaidInitialized) {
        mermaid.initialize({
          startOnLoad: true,
          theme: 'dark',
          securityLevel: 'loose',
        });
        (window as any).mermaidInitialized = true;
      }
      
      // Create preview element
      const previewElement = document.createElement('div');
      previewElement.id = `${previewId}-${Date.now()}`;
      previewElement.className = 'mermaid';
      previewElement.textContent = diagramCode;
      previewContainer.appendChild(previewElement);
      
      // Render diagram
      await mermaid.run({
        nodes: [previewElement],
      });
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to render diagram';
      console.error('[MermaidBuilder] Render error:', err);
    }
  }
  
  /**
   * Use template
   */
  function useTemplate(templateKey: keyof typeof templates): void {
    diagramCode = templates[templateKey];
    renderPreview();
  }
  
  /**
   * Handle save
   */
  function handleSave(): void {
    if (onSave && diagramCode.trim()) {
      onSave(diagramCode.trim());
    }
    if (onClose) {
      onClose();
    }
  }
  
  /**
   * Handle close
   */
  function handleClose(): void {
    if (onClose) {
      onClose();
    }
  }
  
  // Render preview when diagram code changes
  $: if (isOpen && diagramCode) {
    const timer = setTimeout(() => {
      renderPreview();
    }, 500);
    return () => clearTimeout(timer);
  }
  
  // Initialize on mount
  onMount(() => {
    if (isOpen) {
      renderPreview();
    }
  });
  
  // Re-render when dialog opens
  $: if (isOpen) {
    diagramCode = initialDiagram || templates.flowchart;
    setTimeout(renderPreview, 100);
  }
</script>

{#if isOpen}
  <div class="mermaid-builder-overlay" on:click={handleClose} role="button" tabindex="0" on:keydown={(e) => e.key === 'Escape' && handleClose()}>
    <div class="mermaid-builder-modal" on:click|stopPropagation role="dialog">
      <div class="mermaid-builder-header">
        <h2>📊 Mermaid Diagram Builder</h2>
        <button class="close-btn" on:click={handleClose}>×</button>
      </div>
      
      <div class="mermaid-builder-content">
        <div class="builder-sidebar">
          <h3>Templates</h3>
          <div class="template-list">
            <button class="template-btn" on:click={() => useTemplate('flowchart')}>Flowchart</button>
            <button class="template-btn" on:click={() => useTemplate('sequence')}>Sequence</button>
            <button class="template-btn" on:click={() => useTemplate('class')}>Class Diagram</button>
            <button class="template-btn" on:click={() => useTemplate('state')}>State Diagram</button>
            <button class="template-btn" on:click={() => useTemplate('gantt')}>Gantt Chart</button>
            <button class="template-btn" on:click={() => useTemplate('pie')}>Pie Chart</button>
          </div>
          
          <div class="builder-help">
            <h4>Quick Reference</h4>
            <p><code>graph TD</code> - Top-down flowchart</p>
            <p><code>graph LR</code> - Left-right flowchart</p>
            <p><code>sequenceDiagram</code> - Sequence diagram</p>
            <p><code>classDiagram</code> - Class diagram</p>
          </div>
        </div>
        
        <div class="builder-main">
          <div class="code-editor-section">
            <label>Diagram Code:</label>
            <textarea 
              bind:value={diagramCode}
              class="diagram-code"
              placeholder="Enter Mermaid diagram code..."
              rows="15"
            />
          </div>
          
          <div class="preview-section">
            <label>Preview:</label>
            <div bind:this={previewContainer} class="preview-container"></div>
            {#if error}
              <div class="preview-error">{error}</div>
            {/if}
          </div>
        </div>
      </div>
      
      <div class="mermaid-builder-footer">
        <button class="btn btn-secondary" on:click={handleClose}>Cancel</button>
        <button class="btn btn-primary" on:click={handleSave} disabled={!diagramCode.trim()}>
          Insert Diagram
        </button>
      </div>
    </div>
  </div>
{/if}

<style lang="scss">
  @use '@styles/animations' as *;
  
  .mermaid-builder-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    @include fade-in;
  }
  
  .mermaid-builder-modal {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
    width: 90%;
    max-width: 1200px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }
  
  .mermaid-builder-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
    
    h2 {
      margin: 0;
      font-size: 1.25rem;
    }
    
    .close-btn {
      background: transparent;
      border: none;
      color: var(--text);
      font-size: 24px;
      cursor: pointer;
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: background 0.2s ease;
      
      &:hover {
        background: var(--bg-secondary);
      }
    }
  }
  
  .mermaid-builder-content {
    display: flex;
    flex: 1;
    overflow: hidden;
  }
  
  .builder-sidebar {
    width: 250px;
    padding: 16px;
    border-right: 1px solid var(--border);
    overflow-y: auto;
    background: var(--bg-secondary);
    
    h3 {
      margin: 0 0 12px 0;
      font-size: 1rem;
    }
    
    h4 {
      margin: 16px 0 8px 0;
      font-size: 0.9rem;
    }
  }
  
  .template-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 20px;
  }
  
  .template-btn {
    padding: 8px 12px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text);
    cursor: pointer;
    text-align: left;
    transition: all 0.2s ease;
    
    &:hover {
      background: var(--accent);
      border-color: var(--accent);
      color: var(--bg-dark);
    }
  }
  
  .builder-help {
    font-size: 0.85rem;
    color: var(--text-secondary);
    
    p {
      margin: 4px 0;
    }
    
    code {
      background: var(--bg);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.9em;
    }
  }
  
  .builder-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  .code-editor-section,
  .preview-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 16px;
    border-bottom: 1px solid var(--border);
    
    &:last-child {
      border-bottom: none;
    }
    
    label {
      margin-bottom: 8px;
      font-weight: 600;
      font-size: 0.9rem;
    }
  }
  
  .diagram-code {
    flex: 1;
    min-height: 200px;
    padding: 12px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text);
    font-family: 'Courier New', monospace;
    font-size: 14px;
    resize: vertical;
    
    &:focus {
      outline: none;
      border-color: var(--accent);
    }
  }
  
  .preview-container {
    flex: 1;
    min-height: 200px;
    padding: 16px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: auto;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .preview-error {
    margin-top: 8px;
    padding: 8px;
    background: rgba(220, 53, 69, 0.1);
    border: 1px solid rgba(220, 53, 69, 0.3);
    border-radius: 4px;
    color: #dc3545;
    font-size: 0.85rem;
  }
  
  .mermaid-builder-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 20px;
    border-top: 1px solid var(--border);
  }
</style>

