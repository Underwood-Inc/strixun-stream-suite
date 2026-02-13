/**
 * UI state store using Zustand
 * Manages global UI state (modals, notifications, etc.)
 */

import { create, type StateCreator } from 'zustand';

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

const uiStoreCreator: StateCreator<UIState> = (set) => ({
    uploadModalOpen: false,
    setUploadModalOpen: (open: boolean) => set({ uploadModalOpen: open }),
    
    notifications: [],
    addNotification: (notification: Omit<Notification, 'id'>) => {
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
    removeNotification: (id: string) => {
        set((state) => ({
            notifications: state.notifications.filter((n) => n.id !== id),
        }));
    },
});

export const useUIStore = create<UIState>(uiStoreCreator);

