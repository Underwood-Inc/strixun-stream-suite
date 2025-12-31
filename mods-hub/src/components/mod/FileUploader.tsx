/**
 * Reusable drag-and-drop file uploader component
 * Extracted from ModUploadWizard for reuse across the application
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import styled from 'styled-components';
import { colors, spacing } from '../../theme';
import { formatFileSize } from '@strixun/api-framework';
import React from 'react';

const DragDropZone = styled.div<{ isDragging: boolean; hasFile: boolean }>`
  padding: ${spacing.xl};
  border: 2px dashed ${({ isDragging, hasFile }) => 
    isDragging ? colors.accent : hasFile ? colors.success : colors.border};
  border-radius: 8px;
  background: ${({ isDragging }) => isDragging ? `${colors.accent}10` : colors.bg};
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: ${colors.accent};
    background: ${colors.bgTertiary};
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
  max-width: 200px;
  max-height: 200px;
  border-radius: 4px;
  border: 1px solid ${colors.border};
  margin: ${spacing.sm} auto 0;
  display: block;
  object-fit: contain;
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
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        style={{ cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1 }}
      >
        <UploadIcon viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </UploadIcon>
        {file ? (
          <>
            {showImagePreview && previewUrl ? (
              <ImagePreview src={previewUrl} alt="Preview" />
            ) : (
              <FileInfo>
                <FileName>{file.name}</FileName>
                <FileSize>({formatFileSize(file.size)})</FileSize>
              </FileInfo>
            )}
          </>
        ) : showImagePreview && previewUrl ? (
          <ImagePreview src={previewUrl} alt="Current thumbnail" />
        ) : (
          <DragDropText>{label}</DragDropText>
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
