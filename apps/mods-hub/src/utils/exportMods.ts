/**
 * Export utilities for mods data
 */

import type { ModMetadata } from '../types/mod';

/**
 * Export mods to CSV format
 */
export function exportModsToCSV(mods: ModMetadata[], filename: string = 'mods-export.csv'): void {
  if (mods.length === 0) {
    alert('No mods to export');
    return;
  }
  
  const headers = [
    'Title',
    'Author Display Name',
    'Author ID',
    'Status',
    'Category',
    'Tags',
    'Downloads',
    'Created At',
    'Updated At',
    'Slug',
    'Mod ID'
  ];
  
  const rows = mods.map(mod => [
    mod.title,
    mod.authorDisplayName || 'Unknown User',
    mod.authorId, // userId from OTP auth (never export email)
    mod.status,
    mod.category,
    mod.tags.join('; '),
    mod.downloadCount.toString(),
    new Date(mod.createdAt).toISOString(),
    new Date(mod.updatedAt).toISOString(),
    mod.slug,
    mod.modId
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Export mods to JSON format
 */
export function exportModsToJSON(mods: ModMetadata[], filename: string = 'mods-export.json'): void {
  if (mods.length === 0) {
    alert('No mods to export');
    return;
  }
  
  const jsonContent = JSON.stringify(mods, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

