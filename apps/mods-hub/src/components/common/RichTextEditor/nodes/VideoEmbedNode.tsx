/**
 * VideoEmbedNode
 * Custom Lexical node for embedding YouTube and Vimeo videos
 */

import type {
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  EditorConfig,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from 'lexical';
import { $applyNodeReplacement, $getNodeByKey, DecoratorNode } from 'lexical';
import React, { useCallback } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import styled from 'styled-components';
import { colors, spacing } from '../../../../theme';

const VideoWrapper = styled.div`
  position: relative;
  width: 100%;
  max-width: 560px;
  margin: ${spacing.sm} 0;
  border-radius: 8px;
  overflow: hidden;
  background: ${colors.bgTertiary};
  
  &::before {
    content: '';
    display: block;
    padding-top: 56.25%; /* 16:9 aspect ratio */
  }
  
  iframe {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border: none;
  }
  
  &:hover .remove-button {
    opacity: 1;
  }
`;

const RemoveButton = styled.button`
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  background: ${colors.danger};
  border: none;
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s ease, transform 0.1s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  
  &:hover {
    background: ${colors.danger};
    transform: scale(1.1);
  }
  
  &:active {
    transform: scale(0.95);
  }
`;

export interface VideoEmbedPayload {
  videoId: string;
  platform: 'youtube' | 'vimeo';
  key?: NodeKey;
}

export type SerializedVideoEmbedNode = Spread<
  {
    videoId: string;
    platform: 'youtube' | 'vimeo';
  },
  SerializedLexicalNode
>;

/**
 * Extract video ID and platform from various URL formats
 */
export function parseVideoUrl(url: string): { videoId: string; platform: 'youtube' | 'vimeo' } | null {
  // YouTube patterns
  const youtubePatterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /img\.youtube\.com\/vi\/([a-zA-Z0-9_-]{11})/,
  ];
  
  for (const pattern of youtubePatterns) {
    const match = url.match(pattern);
    if (match) {
      return { videoId: match[1], platform: 'youtube' };
    }
  }
  
  // Vimeo patterns
  const vimeoPatterns = [
    /vimeo\.com\/(\d+)/,
    /player\.vimeo\.com\/video\/(\d+)/,
  ];
  
  for (const pattern of vimeoPatterns) {
    const match = url.match(pattern);
    if (match) {
      return { videoId: match[1], platform: 'vimeo' };
    }
  }
  
  return null;
}

/**
 * Check if a URL is a video URL
 */
export function isVideoUrl(url: string): boolean {
  return parseVideoUrl(url) !== null;
}

function VideoComponent({
  videoId,
  platform,
  nodeKey,
}: {
  videoId: string;
  platform: 'youtube' | 'vimeo';
  nodeKey: NodeKey;
}): React.ReactElement {
  const [editor] = useLexicalComposerContext();
  const isEditable = editor.isEditable();
  
  const handleRemove = useCallback(() => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (node) {
        node.remove();
      }
    });
  }, [editor, nodeKey]);
  
  const embedUrl = platform === 'youtube'
    ? `https://www.youtube.com/embed/${videoId}`
    : `https://player.vimeo.com/video/${videoId}`;
  
  return (
    <VideoWrapper>
      {isEditable && (
        <RemoveButton
          className="remove-button"
          onClick={handleRemove}
          title="Remove video"
          type="button"
        >
          ✕
        </RemoveButton>
      )}
      <iframe
        src={embedUrl}
        title={`${platform} video`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </VideoWrapper>
  );
}

function convertIframeElement(domNode: Node): DOMConversionOutput | null {
  if (domNode instanceof HTMLIFrameElement) {
    const src = domNode.src;
    const parsed = parseVideoUrl(src);
    if (parsed) {
      const node = $createVideoEmbedNode(parsed);
      return { node };
    }
  }
  return null;
}

export class VideoEmbedNode extends DecoratorNode<React.ReactElement> {
  __videoId: string;
  __platform: 'youtube' | 'vimeo';

  static getType(): string {
    return 'video-embed';
  }

  static clone(node: VideoEmbedNode): VideoEmbedNode {
    return new VideoEmbedNode(node.__videoId, node.__platform, node.__key);
  }

  static importJSON(serializedNode: SerializedVideoEmbedNode): VideoEmbedNode {
    const { videoId, platform } = serializedNode;
    return $createVideoEmbedNode({ videoId, platform });
  }

  static importDOM(): DOMConversionMap | null {
    return {
      iframe: () => ({
        conversion: convertIframeElement,
        priority: 1,
      }),
    };
  }

  constructor(
    videoId: string,
    platform: 'youtube' | 'vimeo',
    key?: NodeKey
  ) {
    super(key);
    this.__videoId = videoId;
    this.__platform = platform;
  }

  exportJSON(): SerializedVideoEmbedNode {
    return {
      type: 'video-embed',
      version: 1,
      videoId: this.__videoId,
      platform: this.__platform,
    };
  }

  exportDOM(): DOMExportOutput {
    const iframe = document.createElement('iframe');
    iframe.src = this.__platform === 'youtube'
      ? `https://www.youtube.com/embed/${this.__videoId}`
      : `https://player.vimeo.com/video/${this.__videoId}`;
    iframe.width = '560';
    iframe.height = '315';
    iframe.setAttribute('allowfullscreen', 'true');
    iframe.setAttribute('frameborder', '0');
    
    const div = document.createElement('div');
    div.style.cssText = 'position:relative;width:100%;max-width:560px;margin:8px 0;';
    div.appendChild(iframe);
    
    return { element: div };
  }

  createDOM(config: EditorConfig): HTMLElement {
    const div = document.createElement('div');
    const theme = config.theme;
    const className = theme.videoEmbed;
    if (className) {
      div.className = className;
    }
    return div;
  }

  updateDOM(): false {
    return false;
  }

  getVideoId(): string {
    return this.__videoId;
  }

  getPlatform(): 'youtube' | 'vimeo' {
    return this.__platform;
  }

  decorate(): React.ReactElement {
    return (
      <VideoComponent
        videoId={this.__videoId}
        platform={this.__platform}
        nodeKey={this.__key}
      />
    );
  }
}

export function $createVideoEmbedNode({
  videoId,
  platform,
  key,
}: VideoEmbedPayload): VideoEmbedNode {
  return $applyNodeReplacement(new VideoEmbedNode(videoId, platform, key));
}

export function $isVideoEmbedNode(
  node: LexicalNode | null | undefined
): node is VideoEmbedNode {
  return node instanceof VideoEmbedNode;
}
