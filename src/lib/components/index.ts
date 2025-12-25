/**
 * Component Library - Main Index
 * 
 * Central export point for all components in the library.
 * This provides a clean API for importing components throughout the application.
 */

// Core UI Components
export { default as Header } from './Header.svelte';
export { default as Navigation } from './Navigation.svelte';
export { default as InfoBar } from './InfoBar.svelte';
export { default as Tooltip } from './Tooltip.svelte';
export { default as TruncatedText } from './TruncatedText.svelte';
export { default as ProgressRing } from './ProgressRing.svelte';
export { default as LoadingSkeleton } from './LoadingSkeleton.svelte';
export { default as SearchBox } from './SearchBox.svelte';
export { default as SourceSelect } from './SourceSelect.svelte';
export { default as EncryptionSettings } from './EncryptionSettings.svelte';

// Activity Log Components
export { default as ActivityLog } from './ActivityLog.svelte';
export { default as ActivityLogFilterAside } from './ActivityLogFilterAside.svelte';
export { default as LogEntry } from './LogEntry.svelte';
export { default as VirtualList } from './VirtualList.svelte';

// UI Components
export * from './ui';

// Primitives
export * from './primitives/ResizableZone';
export { default as Card } from './primitives/Card';
export { default as Carousel } from './primitives/Carousel';
export { default as FloatingPanel } from './primitives/FloatingPanel';
export { default as AdCarousel } from './primitives/AdCarousel';

// Auth Components
export { default as LoginModal } from './auth/LoginModal.svelte';
export { default as AuthScreen } from './AuthScreen.svelte';

// Simple Text Editor
export { default as SimpleTextEditor } from './SimpleTextEditor.svelte';

// Chat Components
export { default as ChatClient } from './chat/ChatClient.svelte';
export { default as ChatMessage } from './chat/ChatMessage.svelte';
export { default as ChatInput } from './chat/ChatInput.svelte';
export { default as RoomList } from './chat/RoomList.svelte';
export { default as RoomCreator } from './chat/RoomCreator.svelte';
export { default as EmotePicker } from './chat/EmotePicker.svelte';

// Toast components are exported from './ui' (see line 27)

// Documentation Components
export { default as StorybookViewer } from './StorybookViewer.svelte';
export { default as ComponentDocsButton } from './ComponentDocsButton.svelte';

// Modrinth Products
export { default as ModrinthProducts } from './ModrinthProducts.svelte';
export { default as ModrinthProductCarousel } from './ModrinthProductCarousel.svelte';
export type { ModrinthProduct, ModrinthAPIProject } from './ModrinthProductCarousel.svelte';
export { default as Sidebar } from './Sidebar.svelte';

// Product Carousel (reusable)
export { default as ProductCarousel } from './ProductCarousel.svelte';
export type { Product, ProductStats } from './ProductCarousel.svelte';

// Ad Carousels (reusable)
export { default as TwitchAdCarousel } from '@shared-components/ad-carousel/TwitchAdCarousel.svelte';

// Support Cards
export { default as TwitchSupportCard } from '@shared-components/ad-carousel/TwitchSupportCard.svelte';

