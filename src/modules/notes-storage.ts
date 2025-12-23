/**
 * Notes Storage Module
 * 
 * Cloud-only storage for notes/notebooks
 * All operations require authentication
 */

import { authenticatedFetch } from '../stores/auth';

export interface NotebookMetadata {
  id: string;
  title: string;
  lastEdited: string;
  createdAt: string;
}

export interface Notebook {
  notebookId: string;
  content: string | object;
  metadata: {
    title: string;
    lastEdited: string;
    createdAt: string;
  };
  timestamp: string;
}

/**
 * Save notebook to cloud
 */
export async function saveNotebook(
  notebookId: string,
  content: string | object,
  metadata: { title: string; createdAt?: string }
): Promise<void> {
  const response = await authenticatedFetch('/notes/save', {
    method: 'POST',
    body: JSON.stringify({
      notebookId,
      content,
      metadata: {
        ...metadata,
        lastEdited: new Date().toISOString(),
      },
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to save notebook');
  }
}

/**
 * Load notebook from cloud
 */
export async function loadNotebook(notebookId: string): Promise<Notebook> {
  const response = await authenticatedFetch(`/notes/load?notebookId=${encodeURIComponent(notebookId)}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to load notebook');
  }
  
  const data = await response.json();
  return {
    notebookId: data.notebookId,
    content: data.content,
    metadata: data.metadata,
    timestamp: data.timestamp,
  };
}

/**
 * List notebooks from cloud
 */
export async function listNotebooks(): Promise<NotebookMetadata[]> {
  const response = await authenticatedFetch('/notes/list');
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to list notebooks');
  }
  
  const data = await response.json();
  return data.notebooks || [];
}

/**
 * Delete notebook from cloud
 */
export async function deleteNotebook(notebookId: string): Promise<void> {
  const response = await authenticatedFetch(`/notes/delete?notebookId=${encodeURIComponent(notebookId)}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete notebook');
  }
}

