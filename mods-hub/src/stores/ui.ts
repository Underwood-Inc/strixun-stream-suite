/**
 * UI state store using Zustand
 * Manages global UI state (modals, notifications, etc.)
 */

import { create } from 'zustand';

interface Notification {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    duration?: number;
}

interface UIState {
    // Modals
    uploadModalOpen: boolean;
    setUploadModalOpen: (open: boolean) => void;
    
    // Notifications
    notifications: Notification[];
    addNotification: (notification: Omit<Notification, 'id'>) => void;
    removeNotification: (id: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
    uploadModalOpen: false,
    setUploadModalOpen: (open) => set({ uploadModalOpen: open }),
    
    notifications: [],
    addNotification: (notification) => {
        const id = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        set((state) => ({
            notifications: [...state.notifications, { ...notification, id }],
        }));
        
        // Auto-remove after duration
        const duration = notification.duration ?? 5000;
        setTimeout(() => {
            set((state) => ({
                notifications: state.notifications.filter((n) => n.id !== id),
            }));
        }, duration);
    },
    removeNotification: (id) => {
        set((state) => ({
            notifications: state.notifications.filter((n) => n.id !== id),
        }));
    },
}));

