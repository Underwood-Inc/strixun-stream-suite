/**
 * Toast Notification Store
 * 
 * Manages toast notifications globally
 */

import { writable } from 'svelte/store';

export interface ToastOptions {
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
  action?: { label: string; handler: () => void };
}

interface Toast extends ToastOptions {
  id: string;
}

export const toasts = writable<Toast[]>([]);

let toastId = 0;

export function showToast(options: ToastOptions): string {
  const id = `toast-${toastId++}`;
  const toast: Toast = {
    id,
    message: options.message,
    type: options.type || 'info',
    duration: options.duration ?? 3000,
    action: options.action,
  };
  
  toasts.update((current) => [...current, toast]);
  return id;
}

export function dismissToast(id: string): void {
  toasts.update((current) => current.filter((t) => t.id !== id));
}

export function showSuccess(message: string, duration?: number): string {
  return showToast({ message, type: 'success', duration });
}

export function showError(message: string, duration?: number): string {
  return showToast({ message, type: 'error', duration: duration ?? 5000 });
}

export function showInfo(message: string, duration?: number): string {
  return showToast({ message, type: 'info', duration });
}

export function showWarning(message: string, duration?: number): string {
  return showToast({ message, type: 'warning', duration });
}

