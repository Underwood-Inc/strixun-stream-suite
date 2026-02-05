/**
 * CarouselPlugin
 * Lexical plugin for image carousel/slideshow support
 */

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $insertNodeToNearestRoot, mergeRegister } from '@lexical/utils';
import {
  $getNodeByKey,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  createCommand,
  LexicalCommand,
} from 'lexical';
import React, { useEffect, useCallback, useState, useRef } from 'react';
import { createPortal } from 'react-dom';

import {
  $createCarouselNode,
  $isCarouselNode,
  CarouselNode,
  CarouselImage,
  CarouselViewMode,
} from './CarouselNode';
import { CarouselComponent } from './CarouselComponent';

export const INSERT_CAROUSEL_COMMAND: LexicalCommand<void> = createCommand(
  'INSERT_CAROUSEL_COMMAND',
);

export {
  CarouselNode,
  $createCarouselNode,
  $isCarouselNode,
  type CarouselImage,
};

interface CarouselPluginProps {
  /** Maximum total upload size in bytes */
  maxUploadSize: number;
  /** Current total upload size from all content */
  currentUploadSize: number;
  /** Callback when upload size changes */
  onUploadSizeChange?: (size: number) => void;
}

/**
 * Data structure storing carousel info for rendering.
 * We store the actual images data here (not just a node reference)
 * because Lexical node methods like getImages() can only be called
 * inside editor.read() or editor.update() callbacks.
 */
interface CarouselData {
  images: CarouselImage[];
  viewMode: CarouselViewMode;
  element: HTMLElement;
}

export default function CarouselPlugin({
  maxUploadSize,
  currentUploadSize,
  onUploadSizeChange,
}: CarouselPluginProps): React.ReactElement | null {
  const [editor] = useLexicalComposerContext();
  const [carouselNodes, setCarouselNodes] = useState<Map<string, CarouselData>>(new Map());
  const [isEditable, setIsEditable] = useState(() => editor.isEditable());
  
  // Use a ref to track current state so we can access it inside Lexical callbacks
  // without causing stale closure issues with the functional setState updater
  const carouselNodesRef = useRef<Map<string, CarouselData>>(carouselNodes);
  
  // Keep ref in sync with state
  useEffect(() => {
    carouselNodesRef.current = carouselNodes;
  }, [carouselNodes]);
  
  // Track editor editability
  useEffect(() => {
    return editor.registerEditableListener((editable) => {
      setIsEditable(editable);
    });
  }, [editor]);

  useEffect(() => {
    if (!editor.hasNodes([CarouselNode])) {
      throw new Error('CarouselPlugin: CarouselNode not registered on editor');
    }

    return mergeRegister(
      // Register the insert command
      editor.registerCommand(
        INSERT_CAROUSEL_COMMAND,
        () => {
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              const carouselNode = $createCarouselNode([]);
              $insertNodeToNearestRoot(carouselNode);
            }
          });
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),

      // Listen for mutations to track carousel nodes
      editor.registerMutationListener(CarouselNode, (mutations) => {
        editor.getEditorState().read(() => {
          // Build the new Map completely inside the read() callback
          const newCarouselNodes = new Map(carouselNodesRef.current);

          for (const [key, mutation] of mutations) {
            if (mutation === 'destroyed') {
              newCarouselNodes.delete(key);
            } else {
              const node = $getNodeByKey(key);
              if ($isCarouselNode(node)) {
                const element = editor.getElementByKey(key);
                if (element) {
                  // Read data NOW while we're inside the read() callback
                  const images = node.getImages();
                  const viewMode = node.getViewMode();
                  newCarouselNodes.set(key, { images, viewMode, element });
                }
              }
            }
          }

          // Pass the completed Map directly (not a function updater)
          setCarouselNodes(newCarouselNodes);
        });
      }),

      // Listen for editor updates to sync carousel data
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          // Build the new Map completely inside the read() callback
          let hasChanges = false;
          const currentNodes = carouselNodesRef.current;
          const newCarouselNodes = new Map(currentNodes);

          for (const [key, data] of newCarouselNodes) {
            const node = $getNodeByKey(key);
            if ($isCarouselNode(node)) {
              const currentImages = node.getImages();
              const currentViewMode = node.getViewMode();
              // Only update if data has actually changed
              if (JSON.stringify(currentImages) !== JSON.stringify(data.images) || currentViewMode !== data.viewMode) {
                hasChanges = true;
                newCarouselNodes.set(key, { ...data, images: currentImages, viewMode: currentViewMode });
              }
            }
          }

          // Only update state if there were changes, pass completed Map directly
          if (hasChanges) {
            setCarouselNodes(newCarouselNodes);
          }
        });
      }),
    );
  }, [editor]);

  // Handle image changes for a specific carousel
  const handleImagesChange = useCallback(
    (nodeKey: string, images: CarouselImage[]) => {
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isCarouselNode(node)) {
          node.setImages(images);

          // Calculate total uploaded size from all carousels
          if (onUploadSizeChange) {
            const newNodeSize = images
              .filter(img => img.isUploaded)
              .reduce((total, img) => total + img.size, 0);
            
            // Calculate total from all other carousels + this one
            let totalSize = newNodeSize;
            for (const [key, data] of carouselNodes) {
              if (key !== nodeKey) {
                totalSize += data.images
                  .filter(img => img.isUploaded)
                  .reduce((total, img) => total + img.size, 0);
              }
            }
            onUploadSizeChange(totalSize);
          }
        }
      });
    },
    [editor, carouselNodes, onUploadSizeChange],
  );

  // Handle view mode changes for a specific carousel
  const handleViewModeChange = useCallback(
    (nodeKey: string, viewMode: CarouselViewMode) => {
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isCarouselNode(node)) {
          node.setViewMode(viewMode);
        }
      });
    },
    [editor],
  );

  // Render carousel components into their DOM containers
  return (
    <>
      {Array.from(carouselNodes.entries()).map(([key, { images, viewMode, element }]) => {
        return createPortal(
          <CarouselComponent
            key={key}
            images={images}
            viewMode={viewMode}
            onImagesChange={(newImages) => handleImagesChange(key, newImages)}
            onViewModeChange={(newMode) => handleViewModeChange(key, newMode)}
            maxUploadSize={maxUploadSize}
            currentUploadSize={currentUploadSize}
            readOnly={!isEditable}
          />,
          element,
        );
      })}
    </>
  );
}
