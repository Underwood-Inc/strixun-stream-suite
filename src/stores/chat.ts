/**
 * Chat Store
 * 
 * Svelte store for chat state management
 */

import { writable, derived, get } from 'svelte/store';
import type { Writable, Readable } from 'svelte/store';
import type { ChatMessage, RoomMetadata, ChatConnectionState } from '../types/chat';
import { user } from './auth';

export interface ChatState {
  messages: ChatMessage[];
  room: RoomMetadata | null;
  connectionState: ChatConnectionState;
  participants: string[];
  isTyping: Set<string>;
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

export function setTyping(userId: string, typing: boolean): void {
  chatState.update((state) => {
    const isTyping = new Set(state.isTyping);
    if (typing) {
      isTyping.add(userId);
    } else {
      isTyping.delete(userId);
    }

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
  return currentUser?.email || null; // Using email as display name for now
}

