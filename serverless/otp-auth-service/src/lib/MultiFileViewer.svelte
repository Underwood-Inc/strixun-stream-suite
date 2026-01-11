<script lang="ts">
  import CodeBlock from './CodeBlock.svelte';

  export let files: Array<{
    name: string;
    path: string;
    language: string;
    content: string;
    description?: string;
  }> = [];
  
  let activeFile = 0;
  
  function selectFile(index: number) {
    activeFile = index;
  }
  
  function getFileIcon(filename: string): string {
    if (filename.endsWith('.tsx') || filename.endsWith('.jsx')) return '⚛';
    if (filename.endsWith('.ts')) return 'TS';
    if (filename.endsWith('.js')) return 'JS';
    if (filename.endsWith('.svelte')) return 'S';
    if (filename.endsWith('.json')) return '{}';
    if (filename.endsWith('.html')) return 'H';
    if (filename.endsWith('.css') || filename.endsWith('.scss')) return '🎨';
    if (filename.endsWith('.env')) return '🔒';
    return '📄';
  }
</script>

<div class="multi-file-viewer">
  <div class="file-sidebar">
    <div class="sidebar-header">
      <span class="folder-icon">📁</span>
      <span class="project-name">project</span>
    </div>
    <div class="file-list">
      {#each files as file, index}
        <button
          class="file-item"
          class:active={activeFile === index}
          on:click={() => selectFile(index)}
        >
          <span class="file-icon">{getFileIcon(file.name)}</span>
          <span class="file-name">{file.name}</span>
        </button>
      {/each}
    </div>
  </div>
  
  <div class="file-content">
    <div class="file-tabs">
      <div class="tab active">
        <span class="tab-icon">{getFileIcon(files[activeFile].name)}</span>
        <span class="tab-name">{files[activeFile].name}</span>
        <span class="tab-path">{files[activeFile].path}</span>
      </div>
    </div>
    
    {#key activeFile}
      {#if files[activeFile].description}
        <div class="file-description">
          {@html files[activeFile].description}
        </div>
      {/if}
      
      <div class="code-container">
        <CodeBlock 
          code={files[activeFile].content} 
          language={files[activeFile].language}
        />
      </div>
    {/key}
  </div>
</div>

<style>
  .multi-file-viewer {
    display: flex;
    background: var(--card);
    border: 2px solid var(--border);
    border-radius: var(--radius-md);
    overflow: hidden;
    min-height: 500px;
    max-height: 700px;
  }

  .file-sidebar {
    width: 250px;
    background: var(--bg-dark);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
  }

  .sidebar-header {
    padding: var(--spacing-md);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    font-weight: 600;
    color: var(--text);
  }

  .folder-icon {
    font-size: 1.1rem;
  }

  .project-name {
    font-size: 0.875rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .file-list {
    padding: var(--spacing-sm);
    overflow-y: auto;
    flex: 1;
  }

  .file-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-xs) var(--spacing-sm);
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    font-size: 0.875rem;
  }

  .file-item:hover {
    background: var(--border);
    color: var(--text);
  }

  .file-item.active {
    background: var(--accent);
    color: #000;
    font-weight: 600;
  }

  .file-icon {
    font-size: 1rem;
    font-weight: 600;
    min-width: 20px;
    text-align: center;
  }

  .file-name {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .file-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .file-tabs {
    display: flex;
    background: var(--bg-dark);
    border-bottom: 1px solid var(--border);
    padding: 0 var(--spacing-sm);
  }

  .tab {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--card);
    border: 1px solid var(--border);
    border-bottom: none;
    border-radius: var(--radius-sm) var(--radius-sm) 0 0;
    margin-top: var(--spacing-xs);
    font-size: 0.875rem;
    color: var(--text);
  }

  .tab.active {
    background: var(--card);
    border-bottom-color: var(--card);
  }

  .tab-icon {
    font-size: 1rem;
    font-weight: 600;
  }

  .tab-name {
    font-weight: 500;
  }

  .tab-path {
    color: var(--text-secondary);
    font-size: 0.75rem;
    margin-left: var(--spacing-xs);
  }

  .file-description {
    padding: var(--spacing-md);
    background: #fff3cd;
    border-bottom: 1px solid #ffc107;
    color: #856404;
    font-size: 0.875rem;
    line-height: 1.5;
  }

  .file-description :global(strong) {
    font-weight: 600;
  }

  .code-container {
    flex: 1;
    overflow: auto;
  }

  @media (max-width: 768px) {
    .multi-file-viewer {
      flex-direction: column;
      max-height: 600px;
    }

    .file-sidebar {
      width: 100%;
      border-right: none;
      border-bottom: 1px solid var(--border);
      max-height: 200px;
    }

    .tab-path {
      display: none;
    }
  }
</style>
