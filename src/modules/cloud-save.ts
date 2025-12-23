/**
 * Cloud Save Module
 * 
 * Authenticated cloud backup/restore for app state
 * Excludes notes (which has separate cloud storage)
 */

import { authenticatedFetch } from '../stores/auth';
import type { StorageBackup } from '../types';

export interface CloudSaveMetadata {
  name?: string;
  description?: string;
}

export interface CloudSave {
  slot: string;
  timestamp: string;
  backupTimestamp: string;
  version: number;
  size: number;
  metadata: CloudSaveMetadata;
  exportedCategories: string[];
}

/**
 * Save app state to cloud
 */
export async function saveToCloud(
  backup: StorageBackup,
  slot: string = 'default',
  metadata: CloudSaveMetadata = {}
): Promise<void> {
  const response = await authenticatedFetch(`/cloud-save/save?slot=${encodeURIComponent(slot)}`, {
    method: 'POST',
    body: JSON.stringify({
      backup,
      metadata,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to save to cloud');
  }
}

/**
 * Load app state from cloud
 */
export async function loadFromCloud(slot: string = 'default'): Promise<StorageBackup> {
  const response = await authenticatedFetch(`/cloud-save/load?slot=${encodeURIComponent(slot)}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to load from cloud');
  }
  
  const data = await response.json();
  return data.backup;
}

/**
 * List all cloud saves
 */
export async function listCloudSaves(): Promise<CloudSave[]> {
  const response = await authenticatedFetch('/cloud-save/list');
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to list cloud saves');
  }
  
  const data = await response.json();
  return data.saves || [];
}

/**
 * Delete a cloud save
 */
export async function deleteCloudSave(slot: string): Promise<void> {
  const response = await authenticatedFetch(`/cloud-save/delete?slot=${encodeURIComponent(slot)}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete cloud save');
  }
}

