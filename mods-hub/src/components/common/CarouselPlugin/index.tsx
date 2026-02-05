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
import React, { useEffect, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  $createCarouselNode,
  $isCarouselNode,
  CarouselNode,
  CarouselImage,
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

export default function CarouselPlugin({
  maxUploadSize,
  currentUploadSize,
  onUploadSizeChange,
}: CarouselPluginProps): React.ReactElement | null {
  const [editor] = useLexicalComposerContext();
  const [carouselNodes, setCarouselNodes] = useState<Map<string, { node: CarouselNode; element: HTMLElement }>>(new Map());

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
          const newCarouselNodes = new Map(carouselNodes);

          for (const [key, mutation] of mutations) {
            if (mutation === 'destroyed') {
              newCarouselNodes.delete(key);
            } else {
              const node = $getNodeByKey(key);
              if ($isCarouselNode(node)) {
                const element = editor.getElementByKey(key);
                if (element) {
                  newCarouselNodes.set(key, { node, element });
                }
              }
            }
          }

          setCarouselNodes(newCarouselNodes);
        });
      }),
    );
  }, [editor, carouselNodes]);

  // Handle image changes for a specific carousel
  const handleImagesChange = useCallback(
    (nodeKey: string, images: CarouselImage[]) => {
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isCarouselNode(node)) {
          node.setImages(images);

          // Calculate total uploaded size from all carousels
          if (onUploadSizeChange) {
            let totalSize = 0;
            editor.getEditorState().read(() => {
              // This is a simplified approach - in production you'd want to
              // traverse all nodes to find all carousels
              for (const [, { node: carouselNode }] of carouselNodes) {
                totalSize += carouselNode.getUploadedSize();
              }
            });
            // Add the new size from this update
            const newNodeSize = images
              .filter(img => img.isUploaded)
              .reduce((total, img) => total + img.size, 0);
            onUploadSizeChange(totalSize + newNodeSize);
          }
        }
      });
    },
    [editor, carouselNodes, onUploadSizeChange],
  );

  // Render carousel components into their DOM containers
  return (
    <>
      {Array.from(carouselNodes.entries()).map(([key, { node, element }]) => {
        const images = node.getImages();
        return createPortal(
          <CarouselComponent
            key={key}
            images={images}
            onImagesChange={(newImages) => handleImagesChange(key, newImages)}
            maxUploadSize={maxUploadSize}
            currentUploadSize={currentUploadSize}
          />,
          element,
        );
      })}
    </>
  );
}
