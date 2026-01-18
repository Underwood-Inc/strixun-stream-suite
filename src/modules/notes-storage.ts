/**
 * Notes Storage Module
 * 
 * Cloud-only storage for notes/notebooks via Streamkit API
 * All operations require authentication
 */

import * as API from './streamkit-api-client';

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
  const noteData = {
    id: notebookId,
    title: metadata.title,
    content: typeof content === 'string' ? content : JSON.stringify(content),
    createdAt: metadata.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  try {
    // Try to update existing note
    await API.notes.update(notebookId, noteData);
  } catch (err) {
    // If update fails (note doesn't exist), create it
    await API.notes.create(noteData);
  }
}

/**
 * Load notebook from cloud
 */
export async function loadNotebook(notebookId: string): Promise<Notebook> {
  const data = await API.notes.get(notebookId);
  
  return {
    notebookId: data.id,
    content: data.content,
    metadata: {
      title: data.title,
      lastEdited: data.updatedAt,
      createdAt: data.createdAt,
    },
    timestamp: data.updatedAt,
  };
}

/**
 * List notebooks from cloud
 */
export async function listNotebooks(): Promise<NotebookMetadata[]> {
  const notes = await API.notes.list();
  
  return notes.map(note => ({
    id: note.id,
    title: note.title,
    lastEdited: note.updatedAt,
    createdAt: note.createdAt,
  }));
}

/**
 * Delete notebook from cloud
 */
export async function deleteNotebook(notebookId: string): Promise<void> {
  await API.notes.delete(notebookId);
}

