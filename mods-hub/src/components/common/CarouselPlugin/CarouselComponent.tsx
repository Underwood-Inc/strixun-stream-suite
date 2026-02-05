/**
 * CarouselComponent
 * React component for rendering and managing image carousels in the editor
 */

import { useState, useCallback, useRef } from 'react';
import styled from 'styled-components';
import { colors, spacing } from '../../../theme';
import { 
  CarouselImage, 
  generateImageId, 
  isExternalUrl,
} from './CarouselNode';
import { formatFileSize } from '@strixun/api-framework';

// ============ STYLED COMPONENTS ============

const CarouselContainer = styled.div`
  position: relative;
  background: ${colors.bgTertiary};
  border: 1px solid ${colors.border};
  border-radius: 8px;
  padding: ${spacing.md};
  margin: ${spacing.md} 0;
`;

const CarouselHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${spacing.sm};
`;

const CarouselTitle = styled.span`
  font-size: 0.75rem;
  font-weight: 600;
  color: ${colors.textSecondary};
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const CarouselActions = styled.div`
  display: flex;
  gap: ${spacing.xs};
`;

const ActionButton = styled.button<{ $danger?: boolean }>`
  background: transparent;
  border: 1px solid ${props => props.$danger ? colors.danger : colors.border};
  color: ${props => props.$danger ? colors.danger : colors.textSecondary};
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.15s ease;
  
  &:hover {
    background: ${props => props.$danger ? colors.danger + '20' : colors.bgSecondary};
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ImageGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: ${spacing.sm};
  margin-bottom: ${spacing.sm};
`;

const ImageSlot = styled.div<{ $isDragging?: boolean }>`
  position: relative;
  aspect-ratio: 16 / 9;
  background: ${colors.bgSecondary};
  border: 2px dashed ${colors.border};
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.15s ease;
  opacity: ${props => props.$isDragging ? 0.5 : 1};
  
  &:hover {
    border-color: ${colors.accent};
  }
`;

const ImagePreview = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const ImageOverlay = styled.div`
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${spacing.xs};
  opacity: 0;
  transition: opacity 0.15s ease;
  
  ${ImageSlot}:hover & {
    opacity: 1;
  }
`;

const ImageBadge = styled.span<{ $type: 'external' | 'uploaded' }>`
  position: absolute;
  top: 4px;
  left: 4px;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  background: ${props => props.$type === 'external' ? colors.accent : colors.warning};
  color: ${colors.bg};
`;

const ImageSize = styled.span`
  position: absolute;
  bottom: 4px;
  right: 4px;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 0.625rem;
  background: rgba(0, 0, 0, 0.7);
  color: white;
`;

const AddImageSlot = styled.div`
  aspect-ratio: 16 / 9;
  background: ${colors.bgSecondary};
  border: 2px dashed ${colors.border};
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${spacing.xs};
  cursor: pointer;
  transition: all 0.15s ease;
  color: ${colors.textMuted};
  
  &:hover {
    border-color: ${colors.accent};
    color: ${colors.accent};
  }
`;

const AddIcon = styled.span`
  font-size: 1.5rem;
`;

const AddText = styled.span`
  font-size: 0.75rem;
`;

const SizeIndicator = styled.div<{ $warning?: boolean; $error?: boolean }>`
  font-size: 0.75rem;
  color: ${props => props.$error ? colors.danger : props.$warning ? colors.warning : colors.textMuted};
  text-align: right;
`;

const SlideViewer = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: ${colors.bgSecondary};
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: ${spacing.sm};
`;

const SlideImageContainer = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
`;

const SlideImage = styled.img<{ $isActive: boolean; $direction: 'next' | 'prev' | null }>`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  opacity: ${props => props.$isActive ? 1 : 0};
  transition: opacity 0.3s ease-in-out;
`;

const SlideNav = styled.button<{ $direction: 'prev' | 'next' }>`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  ${props => props.$direction === 'prev' ? 'left: 8px;' : 'right: 8px;'}
  background: rgba(0, 0, 0, 0.6);
  border: none;
  color: white;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  transition: background 0.15s ease;
  
  &:hover {
    background: rgba(0, 0, 0, 0.8);
  }
  
  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
`;

const SlideIndicators = styled.div`
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 6px;
`;

const SlideIndicator = styled.button<{ $active: boolean }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: none;
  background: ${props => props.$active ? colors.accent : 'rgba(255, 255, 255, 0.5)'};
  cursor: pointer;
  padding: 0;
  transition: background 0.15s ease;
  
  &:hover {
    background: ${props => props.$active ? colors.accent : 'rgba(255, 255, 255, 0.8)'};
  }
`;

const UrlInputContainer = styled.div`
  display: flex;
  gap: ${spacing.xs};
  margin-top: ${spacing.sm};
`;

const UrlInput = styled.input`
  flex: 1;
  padding: ${spacing.xs} ${spacing.sm};
  background: ${colors.bg};
  border: 1px solid ${colors.border};
  border-radius: 4px;
  color: ${colors.text};
  font-size: 0.8125rem;
  
  &:focus {
    outline: none;
    border-color: ${colors.accent};
  }
  
  &::placeholder {
    color: ${colors.textMuted};
  }
`;

const HiddenInput = styled.input`
  display: none;
`;

const ErrorMessage = styled.div`
  color: ${colors.danger};
  font-size: 0.75rem;
  margin-top: ${spacing.xs};
`;

const ModeToggle = styled.div`
  display: flex;
  gap: 2px;
  background: ${colors.bgSecondary};
  border-radius: 4px;
  padding: 2px;
`;

const ModeButton = styled.button<{ $active: boolean }>`
  padding: 4px 8px;
  border: none;
  border-radius: 3px;
  font-size: 0.75rem;
  cursor: pointer;
  background: ${props => props.$active ? colors.accent : 'transparent'};
  color: ${props => props.$active ? colors.bg : colors.textSecondary};
  transition: all 0.15s ease;
  
  &:hover {
    background: ${props => props.$active ? colors.accent : colors.bgTertiary};
  }
`;

// ============ COMPONENT ============

interface CarouselComponentProps {
  images: CarouselImage[];
  onImagesChange: (images: CarouselImage[]) => void;
  maxUploadSize: number;
  currentUploadSize: number;
  readOnly?: boolean;
}

export function CarouselComponent({
  images,
  onImagesChange,
  maxUploadSize,
  currentUploadSize,
  readOnly = false,
}: CarouselComponentProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'slideshow'>('grid');
  const [urlInput, setUrlInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calculate uploaded size from this carousel
  const carouselUploadedSize = images
    .filter(img => img.isUploaded)
    .reduce((total, img) => total + img.size, 0);
  
  const remainingSpace = maxUploadSize - currentUploadSize;
  const sizePercentage = (currentUploadSize / maxUploadSize) * 100;

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setError(null);
    const newImages: CarouselImage[] = [];
    let totalNewSize = 0;
    
    for (const file of Array.from(files)) {
      // Validate file type - ONLY images, no videos
      if (!file.type.startsWith('image/')) {
        setError('Only image files are allowed. Video uploads are not supported - use external video embeds instead.');
        continue;
      }
      
      // Check if adding this file would exceed the limit
      if (currentUploadSize + totalNewSize + file.size > maxUploadSize) {
        setError(`Cannot add image: would exceed size limit (${formatFileSize(remainingSpace - totalNewSize)} remaining)`);
        break;
      }
      
      // Convert to base64
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      
      newImages.push({
        id: generateImageId(),
        src: dataUrl,
        alt: file.name,
        isUploaded: true,
        size: file.size,
      });
      
      totalNewSize += file.size;
    }
    
    if (newImages.length > 0) {
      onImagesChange([...images, ...newImages]);
    }
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [images, onImagesChange, currentUploadSize, maxUploadSize, remainingSpace]);

  const handleAddUrl = useCallback(() => {
    if (!urlInput.trim()) return;
    
    // Validate URL
    if (!isExternalUrl(urlInput)) {
      setError('Please enter a valid URL starting with http:// or https://');
      return;
    }
    
    // Check if it's an image URL (basic check)
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
    const urlLower = urlInput.toLowerCase();
    const hasImageExtension = imageExtensions.some(ext => urlLower.includes(ext));
    
    if (!hasImageExtension) {
      // Still allow it, but warn
      console.warn('URL may not be an image:', urlInput);
    }
    
    const newImage: CarouselImage = {
      id: generateImageId(),
      src: urlInput.trim(),
      alt: 'External image',
      isUploaded: false,
      size: 0, // External URLs don't count toward size
    };
    
    onImagesChange([...images, newImage]);
    setUrlInput('');
    setError(null);
  }, [urlInput, images, onImagesChange]);

  const handleRemoveImage = useCallback((id: string) => {
    onImagesChange(images.filter(img => img.id !== id));
    if (currentSlide >= images.length - 1) {
      setCurrentSlide(Math.max(0, images.length - 2));
    }
  }, [images, onImagesChange, currentSlide]);

  const handleDragStart = useCallback((index: number) => {
    setDraggedIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    const newImages = [...images];
    const [removed] = newImages.splice(draggedIndex, 1);
    newImages.splice(index, 0, removed);
    onImagesChange(newImages);
    setDraggedIndex(index);
  }, [draggedIndex, images, onImagesChange]);

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
  }, []);

  const goToSlide = useCallback((index: number) => {
    setCurrentSlide(Math.max(0, Math.min(index, images.length - 1)));
  }, [images.length]);

  const prevSlide = useCallback(() => {
    goToSlide(currentSlide - 1);
  }, [currentSlide, goToSlide]);

  const nextSlide = useCallback(() => {
    goToSlide(currentSlide + 1);
  }, [currentSlide, goToSlide]);

  return (
    <CarouselContainer>
      <CarouselHeader>
        <CarouselTitle>Image Carousel ({images.length} images)</CarouselTitle>
        <CarouselActions>
          <ModeToggle>
            <ModeButton $active={viewMode === 'grid'} onClick={() => setViewMode('grid')}>
              Grid
            </ModeButton>
            <ModeButton $active={viewMode === 'slideshow'} onClick={() => setViewMode('slideshow')}>
              Slideshow
            </ModeButton>
          </ModeToggle>
        </CarouselActions>
      </CarouselHeader>

      {viewMode === 'slideshow' && images.length > 0 ? (
        <SlideViewer>
          <SlideImageContainer>
            {images.map((image, idx) => (
              <SlideImage
                key={image.id}
                src={image.src}
                alt={image.alt}
                $isActive={idx === currentSlide}
                $direction={null}
              />
            ))}
          </SlideImageContainer>
          <SlideNav $direction="prev" onClick={prevSlide} disabled={currentSlide === 0}>
            ‹
          </SlideNav>
          <SlideNav $direction="next" onClick={nextSlide} disabled={currentSlide >= images.length - 1}>
            ›
          </SlideNav>
          <SlideIndicators>
            {images.map((_, idx) => (
              <SlideIndicator 
                key={idx} 
                $active={idx === currentSlide} 
                onClick={() => goToSlide(idx)}
              />
            ))}
          </SlideIndicators>
        </SlideViewer>
      ) : (
        <ImageGrid>
          {images.map((image, index) => (
            <ImageSlot
              key={image.id}
              $isDragging={draggedIndex === index}
              draggable={!readOnly}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
            >
              <ImagePreview src={image.src} alt={image.alt} />
              <ImageBadge $type={image.isUploaded ? 'uploaded' : 'external'}>
                {image.isUploaded ? 'Local File' : 'URL'}
              </ImageBadge>
              {image.isUploaded && image.size > 0 && (
                <ImageSize>{formatFileSize(image.size)}</ImageSize>
              )}
              {!readOnly && (
                <ImageOverlay>
                  <ActionButton onClick={() => handleRemoveImage(image.id)} $danger>
                    Remove
                  </ActionButton>
                </ImageOverlay>
              )}
            </ImageSlot>
          ))}
          {!readOnly && (
            <AddImageSlot onClick={() => fileInputRef.current?.click()}>
              <AddIcon>+</AddIcon>
              <AddText>Add Image</AddText>
            </AddImageSlot>
          )}
        </ImageGrid>
      )}

      {!readOnly && (
        <>
          <HiddenInput
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
          />
          
          <UrlInputContainer>
            <UrlInput
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Or paste external image URL..."
              onKeyDown={(e) => e.key === 'Enter' && handleAddUrl()}
              onPaste={(e) => {
                // Stop propagation so Lexical's paste handler doesn't intercept
                e.stopPropagation();
              }}
            />
            <ActionButton onClick={handleAddUrl}>Add URL</ActionButton>
          </UrlInputContainer>
          
          {error && <ErrorMessage>{error}</ErrorMessage>}
          
          <SizeIndicator 
            $warning={sizePercentage > 70} 
            $error={sizePercentage >= 100}
          >
            Uploaded: {formatFileSize(currentUploadSize)} / {formatFileSize(maxUploadSize)}
            {carouselUploadedSize > 0 && ` (this carousel: ${formatFileSize(carouselUploadedSize)})`}
          </SizeIndicator>
        </>
      )}
    </CarouselContainer>
  );
}
