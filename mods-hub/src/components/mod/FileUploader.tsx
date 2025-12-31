/**
 * Reusable drag-and-drop file uploader component
 * Extracted from ModUploadWizard for reuse across the application
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import styled from 'styled-components';
import { colors, spacing } from '../../theme';
import { formatFileSize } from '@strixun/api-framework';
import React from 'react';

const DragDropZone = styled.div.withConfig({
  shouldForwardProp: (prop) => !['isDragging', 'hasFile', 'showImagePreview'].includes(prop),
})<{ isDragging: boolean; hasFile: boolean; showImagePreview?: boolean }>`
  padding: ${({ showImagePreview }) => showImagePreview ? spacing.md : spacing.xl};
  border: 2px dashed ${({ isDragging, hasFile }) => 
    isDragging ? colors.accent : hasFile ? colors.success : colors.border};
  border-radius: 12px;
  background: ${({ isDragging, hasFile, showImagePreview }) => {
    if (isDragging) return `linear-gradient(135deg, ${colors.accent}15, ${colors.accent}05)`;
    if (hasFile && showImagePreview) return colors.bg;
    return `linear-gradient(135deg, ${colors.bg}, ${colors.bgTertiary})`;
  }};
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  min-height: ${({ showImagePreview }) => showImagePreview ? 'auto' : 'auto'};
  box-shadow: ${({ hasFile, showImagePreview }) => 
    hasFile && showImagePreview ? '0 4px 12px rgba(0, 0, 0, 0.1)' : '0 2px 8px rgba(0, 0, 0, 0.05)'};
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
    transition: left 0.5s ease;
  }
  
  &:hover {
    border-color: ${colors.accent};
    background: ${({ hasFile, showImagePreview }) => {
      if (hasFile && showImagePreview) return colors.bg;
      return `linear-gradient(135deg, ${colors.bgTertiary}, ${colors.bg})`;
    }};
    box-shadow: ${({ hasFile, showImagePreview }) => 
      hasFile && showImagePreview ? '0 6px 16px rgba(0, 0, 0, 0.15)' : '0 4px 12px rgba(0, 0, 0, 0.1)'};
    transform: translateY(-2px);
    
    &::before {
      left: 100%;
    }
  }
`;

const DragDropText = styled.div`
  color: ${colors.textSecondary};
  font-size: 0.875rem;
  margin-top: ${spacing.sm};
`;

const FileInfo = styled.div`
  font-size: 0.875rem;
  color: ${colors.textSecondary};
  margin-top: ${spacing.xs};
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${spacing.sm};
  flex-wrap: wrap;
`;

const FileName = styled.span`
  color: ${colors.text};
  font-weight: 500;
`;

const FileSize = styled.span`
  color: ${colors.textMuted};
`;

const ErrorText = styled.div`
  color: ${colors.danger};
  font-size: 0.875rem;
  margin-top: ${spacing.xs};
`;

const FileInput = styled.input`
  display: none;
`;

const UploadIcon = styled.svg`
  width: 48px;
  height: 48px;
  margin: 0 auto ${spacing.sm};
  opacity: 0.6;
  color: ${colors.textSecondary};
`;

const ImagePreview = styled.img`
  max-width: 100%;
  width: 100%;
  max-height: 300px;
  aspect-ratio: 1;
  border-radius: 8px;
  border: 2px solid ${colors.border};
  margin: ${spacing.sm} auto 0;
  display: block;
  object-fit: cover;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  
  &:hover {
    transform: scale(1.02);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
  }
`;

interface FileUploaderProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  maxSize?: number; // in bytes
  accept?: string; // file types to accept
  label?: string;
  error?: string | null;
  disabled?: boolean;
  showImagePreview?: boolean; // If true, show image preview for image files
  imagePreviewUrl?: string | null; // Optional preview URL (for existing images)
}

export function FileUploader({
  file,
  onFileChange,
  maxSize = 35 * 1024 * 1024, // Default 35 MB
  accept,
  label = 'Drag and drop a file here, or click to browse',
  error,
  disabled = false,
  showImagePreview = false,
  imagePreviewUrl,
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(imagePreviewUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate preview URL when file changes (for images)
  useEffect(() => {
    if (showImagePreview && file && file.type.startsWith('image/')) {
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
      return () => {
        URL.revokeObjectURL(objectUrl);
      };
    } else if (!file) {
      setPreviewUrl(imagePreviewUrl || null);
    }
  }, [file, showImagePreview, imagePreviewUrl]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, [disabled]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      // Always call onFileChange - parent component will handle validation and error display
      onFileChange(droppedFile);
    }
  }, [disabled, onFileChange]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Always call onFileChange - parent component will handle validation and error display
      onFileChange(selectedFile);
    }
  }, [disabled, onFileChange]);

  const handleClick = useCallback(() => {
    if (disabled) return;
    fileInputRef.current?.click();
  }, [disabled]);

  return (
    <div>
      <DragDropZone
        isDragging={isDragging}
        hasFile={!!file}
        showImagePreview={showImagePreview}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        style={{ cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1 }}
      >
        {file ? (
          <>
            {showImagePreview && previewUrl ? (
              <ImagePreview src={previewUrl} alt="Preview" />
            ) : (
              <>
                <UploadIcon viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </UploadIcon>
                <FileInfo>
                  <FileName>{file.name}</FileName>
                  <FileSize>({formatFileSize(file.size)})</FileSize>
                </FileInfo>
              </>
            )}
          </>
        ) : showImagePreview && previewUrl ? (
          <ImagePreview src={previewUrl} alt="Current thumbnail" />
        ) : (
          <>
            <UploadIcon viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </UploadIcon>
            <DragDropText>{label}</DragDropText>
          </>
        )}
      </DragDropZone>
      <FileInput
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        disabled={disabled}
      />
      {error && <ErrorText>{error}</ErrorText>}
      {!error && maxSize && (
        <DragDropText style={{ marginTop: spacing.xs }}>
          Maximum file size: {formatFileSize(maxSize)}
        </DragDropText>
      )}
    </div>
  );
}
