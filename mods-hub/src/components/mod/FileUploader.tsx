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
  shouldForwardProp: (prop) => !['isDragging', 'hasFile', 'hasExistingFile', 'showImagePreview'].includes(prop),
})<{ isDragging: boolean; hasFile: boolean; hasExistingFile?: boolean; showImagePreview?: boolean }>`
  padding: ${({ showImagePreview }) => showImagePreview ? spacing.md : spacing.xl};
  border: ${({ isDragging, hasFile, hasExistingFile }) => {
    if (hasExistingFile) return `3px solid ${colors.success}`;
    if (isDragging) return `2px dashed ${colors.accent}`;
    if (hasFile) return `2px dashed ${colors.success}`;
    return `2px dashed ${colors.border}`;
  }};
  border-radius: 12px;
  background: ${({ isDragging, hasFile, hasExistingFile, showImagePreview }) => {
    if (hasExistingFile) return `linear-gradient(135deg, ${colors.success}15, ${colors.success}08, ${colors.bg})`;
    if (isDragging) return `linear-gradient(135deg, ${colors.accent}15, ${colors.accent}05)`;
    if ((hasFile || hasExistingFile) && showImagePreview) return colors.bg;
    return `linear-gradient(135deg, ${colors.bg}, ${colors.bgTertiary})`;
  }};
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  min-height: ${({ showImagePreview }) => showImagePreview ? 'auto' : 'auto'};
  box-shadow: ${({ hasFile, hasExistingFile, showImagePreview }) => {
    if (hasExistingFile) return `0 0 0 2px ${colors.success}40, 0 4px 16px rgba(76, 175, 80, 0.2)`;
    if ((hasFile || hasExistingFile) && showImagePreview) return '0 4px 12px rgba(0, 0, 0, 0.1)';
    return '0 2px 8px rgba(0, 0, 0, 0.05)';
  }};
  position: relative;
  overflow: hidden;
  
  ${({ hasExistingFile }) => hasExistingFile && `
    animation: pulseGlow 2s ease-in-out infinite;
    
    @keyframes pulseGlow {
      0%, 100% {
        box-shadow: 0 0 0 2px ${colors.success}40, 0 4px 16px rgba(76, 175, 80, 0.2);
      }
      50% {
        box-shadow: 0 0 0 4px ${colors.success}60, 0 6px 20px rgba(76, 175, 80, 0.3);
      }
    }
  `}
  
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
    border-color: ${({ hasExistingFile }) => hasExistingFile ? colors.success : colors.accent};
    background: ${({ hasFile, hasExistingFile, showImagePreview }) => {
      if (hasExistingFile) return `linear-gradient(135deg, ${colors.success}20, ${colors.success}12, ${colors.bg})`;
      if ((hasFile || hasExistingFile) && showImagePreview) return colors.bg;
      return `linear-gradient(135deg, ${colors.bgTertiary}, ${colors.bg})`;
    }};
    box-shadow: ${({ hasFile, hasExistingFile, showImagePreview }) => {
      if (hasExistingFile) return `0 0 0 4px ${colors.success}50, 0 6px 20px rgba(76, 175, 80, 0.35)`;
      if ((hasFile || hasExistingFile) && showImagePreview) return '0 6px 16px rgba(0, 0, 0, 0.15)';
      return '0 4px 12px rgba(0, 0, 0, 0.1)';
    }};
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

const ExistingFileBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: ${spacing.xs};
  padding: ${spacing.xs} ${spacing.sm};
  background: ${colors.success};
  color: ${colors.bg};
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: ${spacing.md};
  box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3);
  animation: slideDown 0.3s ease-out;
  
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

const CheckIcon = styled.svg`
  width: 16px;
  height: 16px;
  flex-shrink: 0;
`;

const ExistingFileInfo = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${spacing.xs};
  padding: ${spacing.md};
  background: ${colors.bgSecondary};
  border-radius: 8px;
  border: 1px solid ${colors.success}40;
  margin-top: ${spacing.sm};
`;

const ExistingFileName = styled.span`
  color: ${colors.text};
  font-weight: 600;
  font-size: 0.9375rem;
`;

const ExistingFileSize = styled.span`
  color: ${colors.success};
  font-weight: 500;
  font-size: 0.875rem;
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
  // For existing files (when editing)
  existingFileName?: string;
  existingFileSize?: number;
  existingFileUrl?: string;
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
  existingFileName,
  existingFileSize,
  existingFileUrl,
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(imagePreviewUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Determine if we have an existing file (metadata but no File object)
  const hasExistingFile = !file && existingFileName;

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
        hasExistingFile={hasExistingFile}
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
                <DragDropText style={{ marginTop: spacing.xs, fontSize: '0.75rem', opacity: 0.8 }}>
                  Click to replace file
                </DragDropText>
              </>
            )}
          </>
        ) : hasExistingFile ? (
          <>
            <ExistingFileBadge>
              <CheckIcon viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </CheckIcon>
              Existing File
            </ExistingFileBadge>
            <ExistingFileInfo>
              <ExistingFileName>{existingFileName}</ExistingFileName>
              {existingFileSize !== undefined && !isNaN(existingFileSize) && (
                <ExistingFileSize>{formatFileSize(existingFileSize)}</ExistingFileSize>
              )}
            </ExistingFileInfo>
            <DragDropText style={{ marginTop: spacing.md, fontSize: '0.875rem', fontWeight: 500, color: colors.textSecondary }}>
              Click to replace this file
            </DragDropText>
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
