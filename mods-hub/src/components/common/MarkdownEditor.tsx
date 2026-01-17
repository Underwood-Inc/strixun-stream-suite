/**
 * MarkdownEditor component
 * Rich markdown editor using Lexical from Meta
 * Supports images and video embeds with size validation
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $convertToMarkdownString, $convertFromMarkdownString, TRANSFORMERS } from '@lexical/markdown';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { CodeNode } from '@lexical/code';
import { LinkNode } from '@lexical/link';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import type { EditorState } from 'lexical';
import styled from 'styled-components';
import { colors, spacing } from '../../theme';
import { 
  DEFAULT_UPLOAD_LIMITS, 
  formatFileSize,
  validateRichTextPayload,
  type EmbeddedMediaInfo,
} from '@strixun/api-framework';

// Limits from shared framework
const MAX_INLINE_IMAGE_SIZE = DEFAULT_UPLOAD_LIMITS.maxInlineImageSize;
const MAX_RICH_TEXT_PAYLOAD = DEFAULT_UPLOAD_LIMITS.maxRichTextPayloadSize;
const MAX_INLINE_IMAGE_COUNT = DEFAULT_UPLOAD_LIMITS.maxInlineImageCount;

const EditorContainer = styled.div`
  position: relative;
`;

const EditorWrapper = styled.div<{ $height: number; $hasError?: boolean }>`
  background: ${colors.bgSecondary};
  border: 1px solid ${props => props.$hasError ? colors.danger : colors.border};
  border-radius: 4px;
  min-height: ${props => props.$height}px;
  position: relative;
  
  &:focus-within {
    border-color: ${props => props.$hasError ? colors.danger : colors.accent};
    box-shadow: 0 0 0 2px ${props => props.$hasError ? colors.danger + '20' : colors.accent + '20'};
  }
`;

const StyledContentEditable = styled(ContentEditable)`
  min-height: 150px;
  padding: ${spacing.md};
  outline: none;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.875rem;
  line-height: 1.6;
  color: ${colors.text};
  position: relative;
  z-index: 1; /* Ensure content area is above placeholder */
  
  /* Headings */
  h1, h2, h3, h4, h5, h6 {
    color: ${colors.text};
    margin: ${spacing.md} 0 ${spacing.sm} 0;
    font-weight: 600;
  }
  
  h1 { font-size: 1.25rem; }
  h2 { font-size: 1.125rem; }
  h3 { font-size: 1rem; }
  
  /* Paragraphs */
  p {
    margin: ${spacing.sm} 0;
  }
  
  /* Lists */
  ul, ol {
    padding-left: ${spacing.lg};
    margin: ${spacing.sm} 0;
  }
  
  li {
    margin: ${spacing.xs} 0;
  }
  
  /* Code */
  code {
    background: ${colors.bgTertiary};
    padding: 0.125rem 0.25rem;
    border-radius: 3px;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 0.8125rem;
    color: ${colors.accent};
  }
  
  /* Blockquotes */
  blockquote {
    border-left: 3px solid ${colors.accent};
    padding-left: ${spacing.md};
    margin: ${spacing.md} 0;
    color: ${colors.textMuted};
    font-style: italic;
  }
  
  /* Links */
  a {
    color: ${colors.accent};
    text-decoration: none;
    
    &:hover {
      text-decoration: underline;
    }
  }
  
  /* Strong/Bold */
  strong {
    color: ${colors.text};
    font-weight: 600;
  }
  
  /* Emphasis */
  em {
    font-style: italic;
  }
  
  /* Inline images */
  img {
    max-width: 100%;
    max-height: 300px;
    border-radius: 4px;
    margin: ${spacing.sm} 0;
  }
`;

const Placeholder = styled.div`
  position: absolute;
  top: ${spacing.md};
  left: ${spacing.md};
  color: ${colors.textMuted};
  font-size: 0.875rem;
  pointer-events: none;
  user-select: none;
  z-index: 0; /* Ensure placeholder stays behind content */
`;

const Label = styled.label`
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: ${colors.text};
  margin-bottom: ${spacing.xs};
`;

const HelpText = styled.span`
  font-size: 0.75rem;
  color: ${colors.textMuted};
  margin-left: ${spacing.sm};
  font-weight: 400;
`;

// Toolbar styles
const Toolbar = styled.div`
  display: flex;
  gap: ${spacing.xs};
  padding: ${spacing.xs} ${spacing.sm};
  background: ${colors.bgTertiary};
  border-bottom: 1px solid ${colors.border};
  border-radius: 4px 4px 0 0;
  flex-wrap: wrap;
  align-items: center;
  position: relative;
  z-index: 2; /* Ensure toolbar is above placeholder and content */
`;

const ToolbarButton = styled.button<{ $active?: boolean }>`
  background: ${props => props.$active ? colors.accent + '20' : 'transparent'};
  border: none;
  color: ${props => props.$active ? colors.accent : colors.textSecondary};
  padding: ${spacing.xs} ${spacing.sm};
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.15s ease;
  
  &:hover {
    background: ${colors.bgSecondary};
    color: ${colors.accent};
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ToolbarDivider = styled.div`
  width: 1px;
  background: ${colors.border};
  margin: 0 ${spacing.xs};
  height: 20px;
`;

const PayloadIndicator = styled.div<{ $warning?: boolean; $error?: boolean }>`
  margin-left: auto;
  font-size: 0.75rem;
  color: ${props => props.$error ? colors.danger : props.$warning ? colors.warning : colors.textMuted};
  display: flex;
  align-items: center;
  gap: ${spacing.xs};
`;

const ErrorBanner = styled.div`
  background: ${colors.danger}20;
  color: ${colors.danger};
  padding: ${spacing.xs} ${spacing.sm};
  font-size: 0.75rem;
  border-bottom: 1px solid ${colors.danger}40;
`;

const HiddenInput = styled.input`
  display: none;
`;

// Plugin to sync with external value and track embedded media
function ValuePlugin({ 
  value, 
  onChange,
  onMediaChange,
}: { 
  value: string; 
  onChange: (value: string) => void;
  onMediaChange: (media: EmbeddedMediaInfo[]) => void;
}) {
  const [editor] = useLexicalComposerContext();
  
  // Initialize with value
  useEffect(() => {
    if (value) {
      editor.update(() => {
        $convertFromMarkdownString(value, TRANSFORMERS);
      });
    }
  }, []); // Only on mount
  
  const handleChange = useCallback((editorState: EditorState) => {
    editorState.read(() => {
      const markdown = $convertToMarkdownString(TRANSFORMERS);
      onChange(markdown);
      
      // Extract embedded media from markdown
      const mediaMatches: EmbeddedMediaInfo[] = [];
      
      // Match markdown images: ![alt](url)
      const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
      let match;
      while ((match = imageRegex.exec(markdown)) !== null) {
        const url = match[2];
        // Calculate size for data URIs
        let size = 0;
        if (url.startsWith('data:')) {
          // Base64 data URI - calculate actual size
          const base64Part = url.split(',')[1];
          if (base64Part) {
            size = Math.ceil(base64Part.length * 0.75); // Base64 to bytes
          }
        }
        mediaMatches.push({ type: 'image', url, size });
      }
      
      // Match video embeds (YouTube, Vimeo links)
      const videoRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|vimeo\.com\/)([^\s)]+)/g;
      while ((match = videoRegex.exec(markdown)) !== null) {
        mediaMatches.push({ type: 'video', url: match[0], size: 0 });
      }
      
      onMediaChange(mediaMatches);
    });
  }, [onChange, onMediaChange]);
  
  return <OnChangePlugin onChange={handleChange} />;
}

// Image insert plugin
function ImagePlugin({ 
  imageCount, 
  onInsert,
}: { 
  imageCount: number;
  onInsert: () => void;
}) {
  const [editor] = useLexicalComposerContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  
  const handleImageSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    
    // Validate file size
    if (file.size > MAX_INLINE_IMAGE_SIZE) {
      setError(`Image too large. Max: ${formatFileSize(MAX_INLINE_IMAGE_SIZE)}`);
      return;
    }
    
    // Convert to base64
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      
      // Insert markdown image via direct text insertion
      editor.update(() => {
        document.execCommand('insertText', false, `![${file.name}](${dataUrl})`);
      });
      
      setError(null);
      onInsert();
    };
    reader.readAsDataURL(file);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [editor, onInsert]);
  
  const openFilePicker = () => {
    fileInputRef.current?.click();
  };
  
  const canAddMore = imageCount < MAX_INLINE_IMAGE_COUNT;
  
  return (
    <>
      <HiddenInput
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageSelect}
      />
      <ToolbarButton 
        onClick={openFilePicker}
        disabled={!canAddMore}
        title={canAddMore ? `Add image (${imageCount}/${MAX_INLINE_IMAGE_COUNT})` : `Max ${MAX_INLINE_IMAGE_COUNT} images`}
      >
        IMG
      </ToolbarButton>
      {error && <span style={{ color: colors.danger, fontSize: '0.75rem', marginLeft: spacing.xs }}>{error}</span>}
    </>
  );
}

// Video URL plugin
function VideoPlugin() {
  const [editor] = useLexicalComposerContext();
  
  const insertVideoLink = useCallback(() => {
    const url = prompt('Enter YouTube or Vimeo URL:');
    if (!url) return;
    
    // Validate URL
    const isYouTube = /(?:youtube\.com\/watch\?v=|youtu\.be\/)/.test(url);
    const isVimeo = /vimeo\.com\//.test(url);
    
    if (!isYouTube && !isVimeo) {
      alert('Please enter a valid YouTube or Vimeo URL');
      return;
    }
    
    // Insert as link
    editor.update(() => {
      document.execCommand('insertText', false, `[Video](${url})`);
    });
  }, [editor]);
  
  return (
    <ToolbarButton onClick={insertVideoLink} title="Embed video (YouTube/Vimeo)">
      VID
    </ToolbarButton>
  );
}


interface MarkdownEditorProps {
  /** Current value */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Optional label */
  label?: string;
  /** Optional placeholder */
  placeholder?: string;
  /** Editor height in pixels */
  height?: number;
  /** Show preview by default - ignored, Lexical shows rich text inline */
  preview?: 'edit' | 'live' | 'preview';
  /** Hide toolbar */
  hideToolbar?: boolean;
  /** Additional class name */
  className?: string;
  /** Show payload size indicator */
  showPayloadSize?: boolean;
}

const theme = {
  paragraph: 'editor-paragraph',
  heading: {
    h1: 'editor-h1',
    h2: 'editor-h2',
    h3: 'editor-h3',
  },
  list: {
    ul: 'editor-ul',
    ol: 'editor-ol',
    listitem: 'editor-li',
  },
  quote: 'editor-quote',
  code: 'editor-code',
  link: 'editor-link',
  text: {
    bold: 'editor-bold',
    italic: 'editor-italic',
    strikethrough: 'editor-strikethrough',
    code: 'editor-inline-code',
  },
};

function onError(error: Error) {
  console.error('[MarkdownEditor] Error:', error);
}

export function MarkdownEditor({
  value,
  onChange,
  label,
  placeholder = 'Write your content in markdown...',
  height = 300,
  hideToolbar = false,
  className,
  showPayloadSize = true,
}: MarkdownEditorProps) {
  const [embeddedMedia, setEmbeddedMedia] = useState<EmbeddedMediaInfo[]>([]);
  const [validation, setValidation] = useState<ReturnType<typeof validateRichTextPayload> | null>(null);
  
  // Validate payload when content or media changes
  useEffect(() => {
    const result = validateRichTextPayload(value, embeddedMedia);
    setValidation(result);
  }, [value, embeddedMedia]);
  
  const imageCount = embeddedMedia.filter(m => m.type === 'image').length;
  const payloadPercentage = validation ? (validation.totalSize / MAX_RICH_TEXT_PAYLOAD) * 100 : 0;
  
  const initialConfig = {
    namespace: 'MarkdownEditor',
    theme,
    onError,
    nodes: [
      HeadingNode,
      QuoteNode,
      ListNode,
      ListItemNode,
      CodeNode,
      LinkNode,
    ],
  };

  return (
    <EditorContainer className={className}>
      {label && (
        <Label>
          {label}
          <HelpText>Supports markdown, images ({formatFileSize(MAX_INLINE_IMAGE_SIZE)} max each), and video embeds</HelpText>
        </Label>
      )}
      <LexicalComposer initialConfig={initialConfig}>
        <EditorWrapper $height={height} $hasError={validation?.valid === false}>
          {!hideToolbar && (
            <>
              <Toolbar>
                <ToolbarButton onClick={() => document.execCommand('bold')} title="Bold (Ctrl+B)">
                  B
                </ToolbarButton>
                <ToolbarButton onClick={() => document.execCommand('italic')} title="Italic (Ctrl+I)">
                  <em>I</em>
                </ToolbarButton>
                <ToolbarDivider />
                <ToolbarButton title="Heading: Use # at start of line">
                  H
                </ToolbarButton>
                <ToolbarButton title="List: Use - at start of line">
                  •
                </ToolbarButton>
                <ToolbarButton title="Quote: Use > at start of line">
                  "
                </ToolbarButton>
                <ToolbarButton title="Code: Use ` around text">
                  {'</>'}
                </ToolbarButton>
                <ToolbarDivider />
                <ImagePlugin imageCount={imageCount} onInsert={() => {}} />
                <VideoPlugin />
                
                {showPayloadSize && validation && (
                  <PayloadIndicator 
                    $warning={payloadPercentage > 70} 
                    $error={!validation.valid}
                  >
                    {formatFileSize(validation.totalSize)} / {formatFileSize(MAX_RICH_TEXT_PAYLOAD)}
                    {imageCount > 0 && ` (${imageCount} img)`}
                  </PayloadIndicator>
                )}
              </Toolbar>
              {validation && !validation.valid && (
                <ErrorBanner>
                  {validation.errors.join(' | ')}
                </ErrorBanner>
              )}
            </>
          )}
          <RichTextPlugin
            contentEditable={<StyledContentEditable />}
            placeholder={<Placeholder>{placeholder}</Placeholder>}
            ErrorBoundary={LexicalErrorBoundary}
          />
          <HistoryPlugin />
          <ListPlugin />
          <LinkPlugin />
          <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
          <ValuePlugin 
            value={value} 
            onChange={onChange} 
            onMediaChange={setEmbeddedMedia}
          />
        </EditorWrapper>
      </LexicalComposer>
    </EditorContainer>
  );
}
