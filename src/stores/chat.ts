/**
 * Chat Store
 * 
 * Svelte store for chat state management
 */

import { writable, derived, get } from 'svelte/store';
import type { Writable, Readable } from 'svelte/store';
import type { ChatMessage, RoomMetadata, ChatConnectionState } from '../types/chat';
import { customer } from './auth';

export interface CustomerPresence {
  customerId: string;
  customerName: string;
  status: 'online' | 'offline' | 'away';
  lastSeen?: string;
}

export interface ChatState {
  messages: ChatMessage[];
  room: RoomMetadata | null;
  connectionState: ChatConnectionState;
  participants: string[];
  isTyping: Set<string>;
  presence: Map<string, CustomerPresence>; // customerId -> presence data
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

export function addParticipant(customerId: string): void {
  chatState.update((state) => {
    if (state.participants.includes(customerId)) {
      return state;
    }

    return {
      ...state,
      participants: [...state.participants, customerId],
    };
  });
}

export function removeParticipant(customerId: string): void {
  chatState.update((state) => ({
    ...state,
    participants: state.participants.filter((id) => id !== customerId),
  }));
}

export function setTyping(customerId: string, customerName: string): void {
  chatState.update((state) => {
    const isTyping = new Set(state.isTyping);
    isTyping.add(customerId);

    return {
      ...state,
      isTyping,
    };
  });
}

export function removeTyping(customerId: string): void {
  chatState.update((state) => {
    const isTyping = new Set(state.isTyping);
    isTyping.delete(customerId);

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

export function setPresence(customerId: string, customerName: string, status: 'online' | 'offline' | 'away'): void {
  chatState.update((state) => {
    const presence = new Map(state.presence);
    presence.set(customerId, {
      customerId,
      customerName,
      status,
      lastSeen: status === 'offline' ? new Date().toISOString() : undefined,
    });

    return {
      ...state,
      presence,
    };
  });
}

export function getPresence(customerId: string): CustomerPresence | undefined {
  const state = get(chatState);
  return state.presence.get(customerId);
}

export function getAllPresence(): CustomerPresence[] {
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

// Get current customer ID from auth store
export function getCurrentCustomerId(): string | null {
  const currentCustomer = get(customer);
  return currentCustomer?.customerId || null;
}

// Get current customer name from auth store
export function getCurrentCustomerName(): string | null {
  const currentCustomer = get(customer);
  // NEVER return email - only displayName
  return currentCustomer?.displayName || null;
}

