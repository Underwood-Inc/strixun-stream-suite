/**
 * Enhanced mod upload form component
 * Features: drag and drop, variants, draft support, improved UI
 */

import { useState, useRef, useCallback } from 'react';
import styled from 'styled-components';
import { colors, spacing } from '../../theme';
import type { ModUploadRequest, ModCategory, ModVisibility, ModVariant, ModStatus } from '../../types/mod';
import { useModSettings } from '../../hooks/useMods';
import { getButtonStyles } from '../../utils/buttonStyles';
import { getCardStyles } from '../../utils/sharedStyles';

// UI-only type that extends ModVariant with file upload fields
type ModVariantWithFile = ModVariant & {
    file?: File;
};

const Form = styled.form`
  ${getCardStyles('default')}
  display: flex;
  flex-direction: column;
  gap: ${spacing.lg};
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.sm};
`;

const Label = styled.label`
  font-weight: 500;
  color: ${colors.text};
  font-size: 0.875rem;
`;

const Input = styled.input`
  padding: ${spacing.sm} ${spacing.md};
  background: ${colors.bg};
  border: 1px solid ${colors.border};
  border-radius: 4px;
  color: ${colors.text};
  font-size: 0.875rem;
  
  &:focus {
    border-color: ${colors.accent};
    outline: none;
  }
`;

const TextArea = styled.textarea`
  padding: ${spacing.sm} ${spacing.md};
  background: ${colors.bg};
  border: 1px solid ${colors.border};
  border-radius: 4px;
  color: ${colors.text};
  font-size: 0.875rem;
  min-height: 100px;
  resize: vertical;
  font-family: inherit;
  
  &:focus {
    border-color: ${colors.accent};
    outline: none;
  }
`;

const Select = styled.select`
  padding: ${spacing.sm} ${spacing.md};
  background: ${colors.bg};
  border: 1px solid ${colors.border};
  border-radius: 4px;
  color: ${colors.text};
  font-size: 0.875rem;
  cursor: pointer;
  
  &:focus {
    border-color: ${colors.accent};
    outline: none;
  }
`;

const DragDropZone = styled.div.withConfig({
  shouldForwardProp: (prop) => !['isDragging', 'hasFile'].includes(prop),
})<{ isDragging: boolean; hasFile: boolean }>`
  padding: ${spacing.xl};
  border: 2px dashed ${({ isDragging, hasFile }) => 
    isDragging ? colors.accent : hasFile ? colors.success : colors.border};
  border-radius: 8px;
  background: ${({ isDragging }) => isDragging ? `${colors.accent}10` : colors.bg};
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  
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
  gap: ${spacing.sm};
`;

const FileName = styled.span`
  color: ${colors.text};
  font-weight: 500;
`;

const FileSize = styled.span`
  color: ${colors.textMuted};
`;

const RemoveButton = styled.button`
  ${getButtonStyles('danger')}
  font-size: 0.75rem;
  padding: ${spacing.xs} ${spacing.sm};
`;

const HiddenInput = styled.input`
  display: none;
`;

const Button = styled.button<{ disabled?: boolean; $variant?: 'primary' | 'secondary' | 'danger' }>`
  ${({ $variant = 'primary' }) => getButtonStyles($variant)}
  
  ${({ disabled }) => disabled && `
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  `}
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: ${spacing.md};
  margin-top: ${spacing.md};
`;

const VariantsSection = styled.div`
  margin-top: ${spacing.lg};
  padding-top: ${spacing.lg};
  border-top: 1px solid ${colors.border};
`;

const VariantItem = styled.div`
  padding: ${spacing.md};
  background: ${colors.bg};
  border: 1px solid ${colors.border};
  border-radius: 4px;
  margin-bottom: ${spacing.md};
`;

const VariantHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${spacing.sm};
`;

const VariantTitle = styled.h4`
  margin: 0;
  color: ${colors.text};
  font-size: 1rem;
`;

const AddVariantButton = styled.button`
  ${getButtonStyles('secondary')}
  font-size: 0.875rem;
`;


interface ModUploadFormProps {
    onSubmit: (data: {
        file: File;
        metadata: ModUploadRequest;
        thumbnail?: File;
    }) => void;
    onSaveDraft?: (data: {
        file?: File;
        metadata: ModUploadRequest;
        thumbnail?: File;
    }) => void;
    isLoading: boolean;
    initialData?: Partial<ModUploadRequest>;
}

export function ModUploadForm({ 
    onSubmit, 
    onSaveDraft, 
    isLoading,
    initialData 
}: ModUploadFormProps) {
    const { data: settings } = useModSettings();
    const [title, setTitle] = useState(initialData?.title || '');
    const [description, setDescription] = useState(initialData?.description || '');
    const [category, setCategory] = useState<ModCategory>(initialData?.category || 'script');
    const [tags, setTags] = useState(initialData?.tags?.join(', ') || '');
    const [version, setVersion] = useState(initialData?.version || '1.0.0');
    const [changelog, setChangelog] = useState(initialData?.changelog || '');
    const [gameVersions, setGameVersions] = useState(initialData?.gameVersions?.join(', ') || '');
    const [visibility, setVisibility] = useState<ModVisibility>(initialData?.visibility || 'public');
    const [file, setFile] = useState<File | null>(null);
    const [thumbnail, setThumbnail] = useState<File | null>(null);
    const [variants, setVariants] = useState<ModVariantWithFile[]>(initialData?.variants || []);
    const [isDragging, setIsDragging] = useState(false);
    const [isThumbnailDragging, setIsThumbnailDragging] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const thumbnailInputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) {
            setFile(droppedFile);
        }
    }, []);

    const handleThumbnailDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsThumbnailDragging(true);
    }, []);

    const handleThumbnailDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsThumbnailDragging(false);
    }, []);

    const handleThumbnailDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsThumbnailDragging(false);
        
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile && droppedFile.type.startsWith('image/')) {
            setThumbnail(droppedFile);
        }
    }, []);

    const handleAddVariant = () => {
        const newVariant: ModVariantWithFile = {
            variantId: `variant-${Date.now()}`,
            modId: '', // Will be set when mod is created
            name: '',
            description: '',
            createdAt: '',
            updatedAt: '',
            currentVersionId: '',
            versionCount: 0,
            totalDownloads: 0,
        };
        setVariants([...variants, newVariant]);
    };

    const handleRemoveVariant = (variantId: string) => {
        setVariants(variants.filter(v => v.variantId !== variantId));
    };

    const handleVariantChange = (variantId: string, field: keyof ModVariantWithFile, value: string | File) => {
        setVariants(variants.map(v => 
            v.variantId === variantId 
                ? { ...v, [field]: value }
                : v
        ));
    };

    const buildMetadata = (status?: ModStatus): ModUploadRequest => {
        return {
            title,
            description,
            category,
            tags: tags.split(',').map(t => t.trim()).filter(Boolean),
            version,
            changelog,
            gameVersions: gameVersions.split(',').map(v => v.trim()).filter(Boolean),
            visibility,
            status,
            variants: variants.map(v => ({
                ...v,
                file: v.file,
            })),
        };
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) return;

        const metadata = buildMetadata('pending'); // Submit for review
        onSubmit({ file, metadata, thumbnail: thumbnail || undefined });
    };

    const handleSaveDraft = () => {
        const metadata = buildMetadata('draft');
        if (onSaveDraft) {
            onSaveDraft({ 
                file: file || undefined, 
                metadata, 
                thumbnail: thumbnail || undefined 
            });
        }
    };

    return (
        <Form onSubmit={handleSubmit}>
            <FormGroup>
                <Label>Mod File *</Label>
                <DragDropZone
                    isDragging={isDragging}
                    hasFile={!!file}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                >
                    {file ? (
                        <FileInfo>
                            <FileName>{file.name}</FileName>
                            <FileSize>({(file.size / 1024 / 1024).toFixed(2)} MB)</FileSize>
                            <RemoveButton 
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setFile(null);
                                }}
                            >
                                Remove
                            </RemoveButton>
                        </FileInfo>
                    ) : (
                        <>
                            <div> ★ Drop mod file here or click to browse</div>
                            <DragDropText>Supports .lua, .js, .java, .zip, and other mod file formats</DragDropText>
                        </>
                    )}
                </DragDropZone>
                <HiddenInput
                    ref={fileInputRef}
                    type="file"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
            </FormGroup>

            <FormGroup>
                <Label>Title *</Label>
                <Input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="My Awesome Mod"
                />
            </FormGroup>

            <FormGroup>
                <Label>Description</Label>
                <TextArea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe your mod..."
                />
            </FormGroup>

            <FormGroup>
                <Label>Category *</Label>
                <Select value={category} onChange={(e) => setCategory(e.target.value as ModCategory)}>
                    <option value="script">Script</option>
                    <option value="overlay">Overlay</option>
                    <option value="theme">Theme</option>
                    <option value="asset">Asset</option>
                    <option value="plugin">Plugin</option>
                    <option value="other">Other</option>
                </Select>
            </FormGroup>

            <FormGroup>
                <Label>Tags (comma-separated)</Label>
                <Input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="tag1, tag2, tag3"
                />
            </FormGroup>

            <FormGroup>
                <Label>Version *</Label>
                <Input
                    type="text"
                    required
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    placeholder="1.0.0"
                />
            </FormGroup>

            <FormGroup>
                <Label>Changelog</Label>
                <TextArea
                    value={changelog}
                    onChange={(e) => setChangelog(e.target.value)}
                    placeholder="What's new in this version?"
                />
            </FormGroup>

            <FormGroup>
                <Label>Game Versions (comma-separated)</Label>
                <Input
                    type="text"
                    value={gameVersions}
                    onChange={(e) => setGameVersions(e.target.value)}
                    placeholder="1.0.0, 1.1.0"
                />
            </FormGroup>

            <FormGroup>
                <Label>Visibility *</Label>
                <Select value={visibility} onChange={(e) => setVisibility(e.target.value as ModVisibility)}>
                    <option value="public">Public</option>
                    <option value="unlisted">Unlisted</option>
                    <option value="private">Private</option>
                </Select>
            </FormGroup>

            <FormGroup>
                <Label>Thumbnail (optional)</Label>
                <DragDropZone
                    isDragging={isThumbnailDragging}
                    hasFile={!!thumbnail}
                    onDragOver={handleThumbnailDragOver}
                    onDragLeave={handleThumbnailDragLeave}
                    onDrop={handleThumbnailDrop}
                    onClick={() => thumbnailInputRef.current?.click()}
                >
                    {thumbnail ? (
                        <FileInfo>
                            <FileName>{thumbnail.name}</FileName>
                            <RemoveButton 
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setThumbnail(null);
                                }}
                            >
                                Remove
                            </RemoveButton>
                        </FileInfo>
                    ) : (
                        <>
                            <div>◇ Drop thumbnail image here or click to browse</div>
                            <DragDropText>Supports .png, .jpg, .webp</DragDropText>
                        </>
                    )}
                </DragDropZone>
                <HiddenInput
                    ref={thumbnailInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => setThumbnail(e.target.files?.[0] || null)}
                />
            </FormGroup>

            <VariantsSection>
                <Label>Variants (optional)</Label>
                <p style={{ color: colors.textSecondary, fontSize: '0.875rem', margin: `${spacing.xs} 0 ${spacing.md} 0` }}>
                    Add variant versions of your mod (e.g., different configurations, themes, or feature sets)
                </p>
                {variants.map((variant) => (
                    <VariantItem key={variant.variantId}>
                        <VariantHeader>
                            <VariantTitle>Variant {variants.indexOf(variant) + 1}</VariantTitle>
                            <RemoveButton 
                                type="button"
                                onClick={() => handleRemoveVariant(variant.variantId)}
                            >
                                Remove
                            </RemoveButton>
                        </VariantHeader>
                        <FormGroup>
                            <Label>Variant Name *</Label>
                            <Input
                                type="text"
                                value={variant.name}
                                onChange={(e) => handleVariantChange(variant.variantId, 'name', e.target.value)}
                                placeholder="e.g., Dark Theme, Performance Mode"
                            />
                        </FormGroup>
                        <FormGroup>
                            <Label>Variant Description</Label>
                            <TextArea
                                value={variant.description || ''}
                                onChange={(e) => handleVariantChange(variant.variantId, 'description', e.target.value)}
                                placeholder="Describe this variant..."
                            />
                        </FormGroup>
                        <FormGroup>
                            <Label>Variant File</Label>
                            <Input
                                type="file"
                                accept={settings?.allowedFileExtensions.join(',') || '.lua,.js,.java,.jar,.zip,.json,.txt,.xml,.yaml,.yml'}
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        handleVariantChange(variant.variantId, 'file', file);
                                    }
                                }}
                            />
                            {variant.file && (
                                <FileInfo>
                                    <FileName>{variant.file.name}</FileName>
                                    <FileSize>({(variant.file.size / 1024 / 1024).toFixed(2)} MB)</FileSize>
                                </FileInfo>
                            )}
                        </FormGroup>
                    </VariantItem>
                ))}
                <AddVariantButton type="button" onClick={handleAddVariant}>
                    + Add Variant
                </AddVariantButton>
            </VariantsSection>

            <ButtonGroup>
                <Button type="submit" disabled={isLoading || !file}>
                    {isLoading ? 'Uploading...' : 'Submit for Review'}
                </Button>
                {onSaveDraft && (
                    <Button 
                        type="button" 
                        $variant="secondary" 
                        onClick={handleSaveDraft}
                        disabled={isLoading}
                    >
                        Save as Draft
                    </Button>
                )}
            </ButtonGroup>
        </Form>
    );
}
