/**
 * Chat Store
 * 
 * Svelte store for chat state management
 */

import { writable, derived, get } from 'svelte/store';
import type { Writable, Readable } from 'svelte/store';
import type { ChatMessage, RoomMetadata, ChatConnectionState } from '../types/chat';
import { user } from './auth';

export interface UserPresence {
  userId: string;
  userName: string;
  status: 'online' | 'offline' | 'away';
  lastSeen?: string;
}

export interface ChatState {
  messages: ChatMessage[];
  room: RoomMetadata | null;
  connectionState: ChatConnectionState;
  participants: string[];
  isTyping: Set<string>;
  presence: Map<string, UserPresence>; // userId -> presence data
}

// Main chat store
export const chatState: Writable<ChatState> = writable({
  messages: [],
  room: null,
  connectionState: {
    status: 'disconnected',
    roomId: null,
    peerId: null,
  },
  participants: [],
  isTyping: new Set(),
  presence: new Map(),
});

// Derived stores
export const currentRoom: Readable<RoomMetadata | null> = derived(
  chatState,
  ($chatState) => $chatState.room
);

export const messages: Readable<ChatMessage[]> = derived(
  chatState,
  ($chatState) => $chatState.messages
);

export const connectionStatus: Readable<ChatConnectionState['status']> = derived(
  chatState,
  ($chatState) => $chatState.connectionState.status
);

export const isConnected: Readable<boolean> = derived(
  connectionStatus,
  ($status) => $status === 'connected'
);

// Actions
export function addMessage(message: ChatMessage): void {
  chatState.update((state) => {
    // Check if message already exists (prevent duplicates)
    if (state.messages.some((m) => m.id === message.id)) {
      return state;
    }

    return {
      ...state,
      messages: [...state.messages, message].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      ),
    };
  });
}

export function setRoom(room: RoomMetadata | null): void {
  chatState.update((state) => ({
    ...state,
    room,
    connectionState: {
      ...state.connectionState,
      roomId: room?.roomId || null,
    },
  }));
}

export function setConnectionState(state: ChatConnectionState): void {
  chatState.update((current) => ({
    ...current,
    connectionState: state,
  }));
}

export function addParticipant(userId: string): void {
  chatState.update((state) => {
    if (state.participants.includes(userId)) {
      return state;
    }

    return {
      ...state,
      participants: [...state.participants, userId],
    };
  });
}

export function removeParticipant(userId: string): void {
  chatState.update((state) => ({
    ...state,
    participants: state.participants.filter((id) => id !== userId),
  }));
}

export function setTyping(userId: string, userName: string): void {
  chatState.update((state) => {
    const isTyping = new Set(state.isTyping);
    isTyping.add(userId);

    return {
      ...state,
      isTyping,
    };
  });
}

export function removeTyping(userId: string): void {
  chatState.update((state) => {
    const isTyping = new Set(state.isTyping);
    isTyping.delete(userId);

    return {
      ...state,
      isTyping,
    };
  });
}

export function clearMessages(): void {
  chatState.update((state) => ({
    ...state,
    messages: [],
  }));
}

export function setPresence(userId: string, userName: string, status: 'online' | 'offline' | 'away'): void {
  chatState.update((state) => {
    const presence = new Map(state.presence);
    presence.set(userId, {
      userId,
      userName,
      status,
      lastSeen: status === 'offline' ? new Date().toISOString() : undefined,
    });

    return {
      ...state,
      presence,
    };
  });
}

export function getPresence(userId: string): UserPresence | undefined {
  const state = get(chatState);
  return state.presence.get(userId);
}

export function getAllPresence(): UserPresence[] {
  const state = get(chatState);
  return Array.from(state.presence.values());
}

export function resetChat(): void {
  chatState.set({
    messages: [],
    room: null,
    connectionState: {
      status: 'disconnected',
      roomId: null,
      peerId: null,
    },
    participants: [],
    isTyping: new Set(),
    presence: new Map(),
  });
}

// Get current user ID from auth store
export function getCurrentUserId(): string | null {
  const currentUser = get(user);
  return currentUser?.userId || null;
}

// Get current user name from auth store
export function getCurrentUserName(): string | null {
  const currentUser = get(user);
  // Prefer displayName, fallback to email for backward compatibility
  return currentUser?.displayName || currentUser?.email || null;
}

