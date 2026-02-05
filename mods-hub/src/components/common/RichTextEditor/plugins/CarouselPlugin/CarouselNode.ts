/**
 * CarouselNode
 * A custom Lexical node for image carousels/slideshows
 * Supports both external URLs and base64 uploaded images
 */

import {
  DecoratorNode,
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from 'lexical';
import { ReactNode } from 'react';

export interface CarouselImage {
  /** Unique ID for the image */
  id: string;
  /** Image URL (can be external URL or base64 data URI) */
  src: string;
  /** Alt text for accessibility */
  alt: string;
  /** Whether this is an uploaded image (base64) or external URL */
  isUploaded: boolean;
  /** Size in bytes (only for uploaded images) */
  size: number;
}

export type CarouselViewMode = 'grid' | 'slideshow';

export type SerializedCarouselNode = Spread<
  {
    images: CarouselImage[];
    viewMode: CarouselViewMode;
  },
  SerializedLexicalNode
>;

function $convertCarouselElement(domNode: HTMLElement): DOMConversionOutput | null {
  const imagesAttr = domNode.getAttribute('data-carousel-images');
  if (imagesAttr) {
    try {
      const images = JSON.parse(imagesAttr) as CarouselImage[];
      const node = $createCarouselNode(images);
      return { node };
    } catch {
      return null;
    }
  }
  return null;
}

export class CarouselNode extends DecoratorNode<ReactNode> {
  __images: CarouselImage[];
  __viewMode: CarouselViewMode;

  static getType(): string {
    return 'carousel';
  }

  static clone(node: CarouselNode): CarouselNode {
    return new CarouselNode([...node.__images], node.__viewMode, node.__key);
  }

  constructor(images: CarouselImage[] = [], viewMode: CarouselViewMode = 'grid', key?: NodeKey) {
    super(key);
    this.__images = images;
    this.__viewMode = viewMode;
  }

  createDOM(): HTMLElement {
    const dom = document.createElement('div');
    dom.className = 'carousel-container';
    return dom;
  }

  updateDOM(): boolean {
    return false;
  }

  static importDOM(): DOMConversionMap | null {
    return {
      div: (domNode: HTMLElement) => {
        if (!domNode.hasAttribute('data-lexical-carousel')) {
          return null;
        }
        return {
          conversion: $convertCarouselElement,
          priority: 2,
        };
      },
    };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('div');
    element.className = 'carousel-preview';
    element.setAttribute('data-lexical-carousel', 'true');
    element.style.cssText = 'display: flex; gap: 8px; flex-wrap: wrap; padding: 8px 0;';
    
    // Render actual images for preview
    this.__images.forEach((image) => {
      const img = document.createElement('img');
      img.src = image.src;
      img.alt = image.alt || 'Carousel image';
      img.style.cssText = 'max-width: 200px; max-height: 150px; border-radius: 4px; object-fit: cover;';
      element.appendChild(img);
    });
    
    // Store data for potential re-import
    element.setAttribute('data-carousel-images', JSON.stringify(this.__images));
    return { element };
  }

  static importJSON(serializedNode: SerializedCarouselNode): CarouselNode {
    return $createCarouselNode(serializedNode.images, serializedNode.viewMode || 'grid');
  }

  exportJSON(): SerializedCarouselNode {
    return {
      images: this.__images,
      viewMode: this.__viewMode,
      type: 'carousel',
      version: 1,
    };
  }

  getImages(): CarouselImage[] {
    return this.getLatest().__images;
  }

  setImages(images: CarouselImage[]): void {
    const writable = this.getWritable();
    writable.__images = images;
  }

  getViewMode(): CarouselViewMode {
    return this.getLatest().__viewMode;
  }

  setViewMode(viewMode: CarouselViewMode): void {
    const writable = this.getWritable();
    writable.__viewMode = viewMode;
  }

  addImage(image: CarouselImage): void {
    const writable = this.getWritable();
    writable.__images = [...writable.__images, image];
  }

  removeImage(id: string): void {
    const writable = this.getWritable();
    writable.__images = writable.__images.filter(img => img.id !== id);
  }

  reorderImages(fromIndex: number, toIndex: number): void {
    const writable = this.getWritable();
    const images = [...writable.__images];
    const [removed] = images.splice(fromIndex, 1);
    images.splice(toIndex, 0, removed);
    writable.__images = images;
  }

  /**
   * Get total size of uploaded images only (base64)
   * External URLs don't count toward size limit
   */
  getUploadedSize(): number {
    return this.__images
      .filter(img => img.isUploaded)
      .reduce((total, img) => total + img.size, 0);
  }

  /**
   * Get count of uploaded images
   */
  getUploadedCount(): number {
    return this.__images.filter(img => img.isUploaded).length;
  }

  decorate(): ReactNode {
    // The actual React component is rendered by CarouselPlugin
    return null;
  }

  isInline(): boolean {
    return false;
  }
}

export function $createCarouselNode(images: CarouselImage[] = [], viewMode: CarouselViewMode = 'grid'): CarouselNode {
  return new CarouselNode(images, viewMode);
}

export function $isCarouselNode(node: LexicalNode | null | undefined): node is CarouselNode {
  return node instanceof CarouselNode;
}

/**
 * Generate a unique ID for carousel images
 */
export function generateImageId(): string {
  return `img-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Check if a URL is an external URL (not base64)
 */
export function isExternalUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

/**
 * Calculate size of a base64 data URI
 */
export function calculateBase64Size(dataUri: string): number {
  if (!dataUri.startsWith('data:')) {
    return 0;
  }
  const base64Part = dataUri.split(',')[1];
  if (!base64Part) {
    return 0;
  }
  // Base64 encodes 3 bytes as 4 characters
  return Math.ceil(base64Part.length * 0.75);
}
