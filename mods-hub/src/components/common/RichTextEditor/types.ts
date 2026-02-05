/**
 * RichTextEditor Types
 * TypeScript interfaces and types for the rich text editor
 */

import type { validateRichTextPayload, EmbeddedMediaInfo } from '@strixun/api-framework';

/** Props for the main RichTextEditor component */
export interface RichTextEditorProps {
  /** Current value (Lexical JSON state) */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Optional label */
  label?: string;
  /** Optional placeholder */
  placeholder?: string;
  /** Editor height in pixels */
  height?: number;
  /** Hide toolbar */
  hideToolbar?: boolean;
  /** Additional class name */
  className?: string;
  /** Show payload size indicator */
  showPayloadSize?: boolean;
  /** Auto focus on mount */
  autoFocus?: boolean;
  /** Character limit */
  maxLength?: number;
}

/** Props for the toolbar plugin */
export interface ToolbarPluginProps {
  totalUploadedSize: number;
  maxUploadSize: number;
  showPayloadSize?: boolean;
  validation?: ReturnType<typeof validateRichTextPayload> | null;
  payloadPercentage: number;
  uploadedImageCount: number;
}

/** Props for the value/state management plugin */
export interface ValuePluginProps {
  value: string;
  onChange: (value: string) => void;
  onMediaChange: (media: EmbeddedMediaInfo[]) => void;
}

/** Props for modal components */
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface LinkModalProps extends ModalProps {
  onInsert: (url: string) => void;
}

export interface TableModalProps extends ModalProps {
  onInsert: (rows: number, cols: number) => void;
}

export interface VideoModalProps extends ModalProps {
  onInsert: (url: string) => void;
}

export type { EmbeddedMediaInfo };
