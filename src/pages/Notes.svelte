<script lang="ts">
  /**
   * Notes/Notebook Page
   * 
   * Rich text editor with Mermaid support for notes and notebooks
   * REQUIRES AUTHENTICATION - All notes are cloud-only
   */
  
  import { onMount, onDestroy } from 'svelte';
  import LexicalEditor from '../components/editor/LexicalEditor.svelte';
  import EditorToolbar from '../components/editor/EditorToolbar.svelte';
  import MermaidBuilder from '../components/editor/MermaidBuilder.svelte';
  import LoginModal from '../components/auth/LoginModal.svelte';
  import { 
    listNotebooks,
    loadNotebook,
    saveNotebook,
    deleteNotebook,
    type NotebookMetadata,
    type Notebook
  } from '../modules/notes-storage';
  import { isAuthenticated, user, clearAuth } from '../stores/auth';
  import { showToast } from '../stores/toast-queue';
  import { stagger } from '../core/animations';
  
  let notebooks: NotebookMetadata[] = [];
  let currentNotebook: Notebook | null = null;
  let currentNotebookId: string | null = null;
  let editorComponent: LexicalEditor | null = null;
  let isLoading = false;
  let isSaving = false;
  let saveStatus = '';
  let showNotebookList = true;
  let newNotebookTitle = '';
  let showNewNotebookDialog = false;
  let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  let lastContentHash = '';
  let hasUnsavedChanges = false;
  let showLoginModal = false;
  let showMermaidBuilder = false;
  let editorInstance: ReturnType<typeof import('lexical').createEditor> | null = null;
  
  // Auto-save debounce (30 seconds) - saves to cloud only
  const AUTO_SAVE_DELAY = 30000;
  
  // Update editor instance when component is ready
  $: if (editorComponent) {
    editorInstance = editorComponent.getEditor();
  }
  
  onMount(async () => {
    // NO automatic API calls - user must manually load notebooks
    if (!$isAuthenticated) {
      showLoginModal = true;
    }
  });
  
  // Watch for authentication changes - only show/hide login modal, NO automatic API calls
  $: if (!$isAuthenticated && !showLoginModal) {
    showLoginModal = true;
  }
  
  function handleLoginClose(): void {
    showLoginModal = false;
  }
  
  async function handleLogout(): Promise<void> {
    clearAuth();
    currentNotebook = null;
    currentNotebookId = null;
    notebooks = [];
    showNotebookList = true;
    showLoginModal = true;
  }
  
  onDestroy(() => {
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
    }
  });
  
  /**
   * Load list of notebooks from cloud
   */
  async function loadNotebooks(): Promise<void> {
    if (!$isAuthenticated) {
      showLoginModal = true;
      return;
    }
    
    try {
      isLoading = true;
      notebooks = await listNotebooks();
    } catch (error) {
      console.error('[Notes] Failed to load notebooks:', error);
      showToast({ message: 'Failed to load notebooks', type: 'error' });
      if (error instanceof Error && error.message.includes('Not authenticated')) {
        showLoginModal = true;
      }
    } finally {
      isLoading = false;
    }
  }
  
  /**
   * Load a notebook from cloud
   */
  async function loadNotebookById(notebookId: string): Promise<void> {
    if (!$isAuthenticated) {
      showLoginModal = true;
      return;
    }
    
    try {
      isLoading = true;
      currentNotebookId = notebookId;
      
      const notebook = await loadNotebook(notebookId);
      
      currentNotebook = notebook;
      showNotebookList = false;
      
      // Load content into editor
      if (editorComponent) {
        const content = typeof notebook.content === 'string' 
          ? notebook.content 
          : JSON.stringify(notebook.content);
        editorComponent.setContent(content);
        lastContentHash = hashContent(content);
        hasUnsavedChanges = false;
      }
    } catch (error) {
      console.error('[Notes] Failed to load notebook:', error);
      showToast({ message: 'Failed to load notebook', type: 'error' });
      if (error instanceof Error && error.message.includes('Not authenticated')) {
        showLoginModal = true;
      }
    } finally {
      isLoading = false;
    }
  }
  
  /**
   * Create new notebook (cloud-only)
   */
  async function createNotebook(): Promise<void> {
    if (!$isAuthenticated) {
      showLoginModal = true;
      return;
    }
    
    if (!newNotebookTitle.trim()) {
      showToast({ message: 'Please enter a notebook title', type: 'error' });
      return;
    }
    
    try {
      const notebookId = `notebook_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const now = new Date().toISOString();
      
      // Save directly to cloud
      await saveNotebook(notebookId, '', {
        title: newNotebookTitle.trim(),
        createdAt: now,
      });
      
      newNotebookTitle = '';
      showNewNotebookDialog = false;
      await loadNotebooks();
      await loadNotebookById(notebookId);
      
      showToast({ message: 'Notebook created', type: 'success' });
    } catch (error) {
      console.error('[Notes] Failed to create notebook:', error);
      showToast({ message: 'Failed to create notebook', type: 'error' });
      if (error instanceof Error && error.message.includes('Not authenticated')) {
        showLoginModal = true;
      }
    }
  }
  
  /**
   * Save current notebook to cloud
   */
  async function saveCurrentNotebook(forceSave = false): Promise<void> {
    if (!$isAuthenticated) {
      showLoginModal = true;
      return;
    }
    
    if (!currentNotebook || !editorComponent) return;
    
    try {
      isSaving = true;
      saveStatus = 'Saving...';
      
      const content = await editorComponent.getContent();
      const contentHash = hashContent(content);
      
      // Only save if content changed
      if (!forceSave && contentHash === lastContentHash) {
        saveStatus = 'No changes';
        setTimeout(() => saveStatus = '', 2000);
        return;
      }
      
      // Save directly to cloud
      await saveNotebook(
        currentNotebook.notebookId,
        content,
        currentNotebook.metadata
      );
      
      // Update local state
      currentNotebook = {
        ...currentNotebook,
        content,
        metadata: {
          ...currentNotebook.metadata,
          lastEdited: new Date().toISOString(),
        },
      };
      lastContentHash = contentHash;
      hasUnsavedChanges = false;
      saveStatus = 'Saved';
      
      showToast({ message: 'Notebook saved', type: 'success', title: 'Success' });
      
      // Reload notebook list to update lastEdited
      await loadNotebooks();
      
      setTimeout(() => saveStatus = '', 2000);
    } catch (error) {
      console.error('[Notes] Failed to save notebook:', error);
      saveStatus = 'Save failed';
      showToast({ message: 'Failed to save notebook', type: 'error' });
      if (error instanceof Error && error.message.includes('Not authenticated')) {
        showLoginModal = true;
      }
      setTimeout(() => saveStatus = '', 3000);
    } finally {
      isSaving = false;
    }
  }
  
  /**
   * Handle editor content change
   * Auto-saves to cloud after debounce
   */
  function handleContentChange(content: string): void {
    const contentHash = hashContent(content);
    hasUnsavedChanges = contentHash !== lastContentHash;
    
    // Debounce auto-save to cloud
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
    }
    
    autoSaveTimer = setTimeout(() => {
      if (hasUnsavedChanges && currentNotebook && $isAuthenticated) {
        saveCurrentNotebook();
      }
    }, AUTO_SAVE_DELAY);
  }
  
  /**
   * Hash content for change detection
   */
  function hashContent(content: string): string {
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }
  
  /**
   * Delete notebook from cloud
   */
  async function deleteNotebookById(notebookId: string): Promise<void> {
    if (!$isAuthenticated) {
      showLoginModal = true;
      return;
    }
    
    if (!confirm('Are you sure you want to delete this notebook? This cannot be undone.')) {
      return;
    }
    
    try {
      await deleteNotebook(notebookId);
      
      if (currentNotebookId === notebookId) {
        currentNotebook = null;
        currentNotebookId = null;
        showNotebookList = true;
      }
      
      await loadNotebooks();
      showToast({ message: 'Notebook deleted', type: 'success' });
    } catch (error) {
      console.error('[Notes] Failed to delete notebook:', error);
      showToast({ message: 'Failed to delete notebook', type: 'error' });
      if (error instanceof Error && error.message.includes('Not authenticated')) {
        showLoginModal = true;
      }
    }
  }
  
  /**
   * Go back to notebook list
   */
  function goBack(): void {
    if (hasUnsavedChanges && currentNotebook && $isAuthenticated) {
      if (confirm('You have unsaved changes. Save before leaving?')) {
        saveCurrentNotebook(true);
      }
    }
    showNotebookList = true;
    currentNotebook = null;
    currentNotebookId = null;
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
    }
  }
  
  /**
   * Insert Mermaid diagram
   */
  function insertMermaid(): void {
    showMermaidBuilder = true;
  }
  
  /**
   * Handle Mermaid diagram save from builder
   */
  function handleMermaidSave(diagram: string): void {
    if (editorComponent && diagram.trim()) {
      editorComponent.insertMermaid(diagram);
      showToast({ message: 'Mermaid diagram inserted', type: 'success' });
    }
    showMermaidBuilder = false;
  }
  
</script>

<div class="notes-page" use:stagger={{ preset: 'fadeIn', stagger: 80, config: { duration: 300 } }}>
  {#if !$isAuthenticated}
    <div class="auth-required">
      <div class="auth-required-content">
        <h1>📝 Notes & Notebooks</h1>
        <p>Sign in to access your notes and notebooks</p>
        <button class="btn btn-primary" on:click={() => showLoginModal = true}>
          Sign In
        </button>
      </div>
    </div>
  {:else if showNotebookList}
    <div class="notebook-list">
      <div class="notebook-list-header">
        <div>
          <h1>📝 Notes & Notebooks</h1>
          <p class="user-info">Signed in as {$user?.email}</p>
        </div>
        <div class="header-actions">
          <button 
            class="btn btn-secondary" 
            on:click={loadNotebooks}
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : '🔄 Refresh'}
          </button>
          <button 
            class="btn btn-primary" 
            on:click={() => showNewNotebookDialog = true}
          >
            + New Notebook
          </button>
          <button class="btn btn-secondary" on:click={handleLogout}>
            Logout
          </button>
        </div>
      </div>
      
      {#if showNewNotebookDialog}
        <div class="new-notebook-dialog">
          <input 
            type="text" 
            bind:value={newNotebookTitle}
            placeholder="Notebook title..."
            class="notebook-title-input"
            on:keydown={(e) => e.key === 'Enter' && createNotebook()}
          />
          <div class="dialog-actions">
            <button class="btn btn-primary" on:click={createNotebook}>Create</button>
            <button class="btn btn-secondary" on:click={() => {
              showNewNotebookDialog = false;
              newNotebookTitle = '';
            }}>Cancel</button>
          </div>
        </div>
      {/if}
      
      {#if isLoading}
        <div class="loading">Loading notebooks...</div>
      {:else if notebooks.length === 0}
        <div class="empty-state">
          <p>No notebooks yet. Create your first notebook to get started!</p>
        </div>
      {:else}
        <div class="notebook-grid">
          {#each notebooks as notebook}
            <div class="notebook-card" on:click={() => loadNotebookById(notebook.id)}>
              <h3>{notebook.title}</h3>
              <p class="notebook-meta">
                Last edited: {new Date(notebook.lastEdited).toLocaleDateString()}
              </p>
              <button 
                class="btn-delete"
                on:click|stopPropagation={() => deleteNotebookById(notebook.id)}
              >
                Delete
              </button>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {:else}
    <div class="notebook-editor">
      <div class="editor-header">
        <button class="btn btn-secondary" on:click={goBack}>← Back</button>
        <h2>{currentNotebook?.metadata.title || 'Untitled'}</h2>
        <div class="editor-actions">
          <button class="btn btn-secondary" on:click={insertMermaid}>📊 Insert Mermaid</button>
          <button 
            class="btn btn-primary" 
            on:click={() => saveCurrentNotebook(true)}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
          {#if saveStatus}
            <span class="save-status">{saveStatus}</span>
          {/if}
          {#if hasUnsavedChanges}
            <span class="unsaved-indicator">●</span>
          {/if}
        </div>
      </div>
      
      <div class="editor-container">
        {#if currentNotebook}
          <div class="editor-wrapper">
            <EditorToolbar editor={editorInstance} />
            <LexicalEditor
              bind:this={editorComponent}
              initialContent={typeof currentNotebook.content === 'string' ? currentNotebook.content : ''}
              onChange={handleContentChange}
              placeholder="Start writing your notes..."
            />
          </div>
        {/if}
      </div>
    </div>
  {/if}
  
  {#if showLoginModal}
    <LoginModal onClose={handleLoginClose} />
  {/if}
  
  <MermaidBuilder 
    isOpen={showMermaidBuilder}
    onSave={handleMermaidSave}
    onClose={() => showMermaidBuilder = false}
  />
</div>

<style lang="scss">
  @use '@styles/animations' as *;
  
  .notes-page {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  
  .notebook-list {
    padding: 24px;
    max-width: 1200px;
    margin: 0 auto;
    width: 100%;
  }
  
  .auth-required {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: 400px;
  }
  
  .auth-required-content {
    text-align: center;
    padding: 48px;
    
    h1 {
      margin: 0 0 16px 0;
      font-size: 32px;
      color: var(--text);
    }
    
    p {
      margin: 0 0 24px 0;
      color: var(--text-secondary);
      font-size: 16px;
    }
  }
  
  .notebook-list-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 24px;
    
    h1 {
      margin: 0 0 4px 0;
      font-size: 28px;
      color: var(--text);
    }
    
    .user-info {
      margin: 0;
      font-size: 12px;
      color: var(--text-secondary);
    }
    
    .header-actions {
      display: flex;
      gap: 8px;
      align-items: center;
    }
  }
  
  .new-notebook-dialog {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 24px;
    
    .notebook-title-input {
      width: 100%;
      padding: 12px;
      margin-bottom: 12px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 4px;
      color: var(--text);
      font-size: 16px;
    }
    
    .dialog-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }
  }
  
  .notebook-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 16px;
  }
  
  .notebook-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
    
    &:hover {
      border-color: var(--accent);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
    
    h3 {
      margin: 0 0 8px 0;
      font-size: 18px;
      color: var(--text);
    }
    
    .notebook-meta {
      margin: 0;
      font-size: 12px;
      color: var(--text-secondary);
    }
    
    .btn-delete {
      position: absolute;
      top: 8px;
      right: 8px;
      padding: 4px 8px;
      background: var(--error);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      opacity: 0;
      transition: opacity 0.2s;
    }
    
    &:hover .btn-delete {
      opacity: 1;
    }
  }
  
  .empty-state {
    text-align: center;
    padding: 48px;
    color: var(--text-secondary);
  }
  
  .notebook-editor {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
  }
  
  .editor-header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 24px;
    background: var(--card);
    border-bottom: 1px solid var(--border);
    
    h2 {
      margin: 0;
      flex: 1;
      font-size: 20px;
      color: var(--text);
    }
    
    .editor-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .save-status {
      font-size: 12px;
      color: var(--text-secondary);
    }
    
    .unsaved-indicator {
      color: var(--warning);
      font-size: 16px;
    }
  }
  
  .editor-container {
    flex: 1;
    overflow: hidden;
    padding: 24px;
    background: var(--bg);
  }
  
  .editor-wrapper {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
  }
  
  .btn {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s;
    
    &.btn-primary {
      background: var(--accent);
      color: white;
      
      &:hover:not(:disabled) {
        background: var(--accent-hover);
      }
      
      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }
    
    &.btn-secondary {
      background: var(--bg-secondary);
      color: var(--text);
      border: 1px solid var(--border);
      
      &:hover {
        background: var(--card);
      }
    }
  }
  
  .loading {
    text-align: center;
    padding: 48px;
    color: var(--text-secondary);
  }
</style>

