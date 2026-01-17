/**
 * @strixun/chat/react - React Chat Components
 * 
 * Drop-in React components for P2P chat with blockchain-style persistence
 */

// Core Chat Components
export { ChatClient, type ChatClientProps } from './ChatClient.js';
export { ChatMessage, type ChatMessageProps } from './ChatMessage.js';
export { ChatInput, type ChatInputProps } from './ChatInput.js';
export { RoomList, type RoomListProps } from './RoomList.js';
export { RoomCreator, type RoomCreatorProps } from './RoomCreator.js';

// Integrity & Status Components
export { 
  IntegrityBadge, 
  PeerCount, 
  GapWarning,
  type IntegrityBadgeProps,
  type PeerCountProps,
  type GapWarningProps,
  type IntegrityInfo,
  type IntegrityStatus,
  type GapRange,
  type GapReason,
} from './IntegrityBadge.js';

// Storage Components
export { StoragePicker, type StoragePickerProps } from './StoragePicker.js';
