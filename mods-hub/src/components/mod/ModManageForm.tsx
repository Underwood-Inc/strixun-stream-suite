/**
 * Mod management form component
 * Allows updating mod metadata and deleting mods
 */

import { useState } from 'react';
import styled from 'styled-components';
import { colors, spacing } from '../../theme';
import type { ModMetadata, ModUpdateRequest, ModCategory, ModVisibility, ModStatus, ModVariant } from '../../types/mod';
import { FileUploader } from './FileUploader';
import { GamesPicker } from './GamesPicker';
import { useAdminSettings } from '../../hooks/useMods';
import { formatFileSize, validateFileSize, DEFAULT_UPLOAD_LIMITS } from '@strixun/api-framework';
import { getButtonStyles } from '../../utils/buttonStyles';
import { getBadgeStyles } from '../../utils/sharedStyles';
import { getStatusBadgeType } from '../../utils/badgeHelpers';
import { ConfirmationModal } from '../common/ConfirmationModal';

// UI-only type that extends ModVariant with file upload fields
// These fields are used for creating new versions, not for persisted data
type ModVariantWithFile = ModVariant & {
    file?: File;
    fileName?: string;
    fileSize?: number;
    fileUrl?: string;
};

const MAX_MOD_FILE_SIZE = 35 * 1024 * 1024; // 35 MB
const MAX_THUMBNAIL_SIZE = DEFAULT_UPLOAD_LIMITS.maxThumbnailSize; // 1 MB (from shared framework)

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${spacing.xl};
  background: linear-gradient(135deg, ${colors.bgSecondary}, ${colors.bg});
  border: 1px solid ${colors.border};
  border-radius: 12px;
  padding: ${spacing.xl};
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, ${colors.accent}, ${colors.accentHover || colors.accent});
    opacity: 0.8;
  }
`;

const Header = styled.div`
  display: flex;
  gap: ${spacing.xl};
  align-items: flex-start;
  
  @media (max-width: 768px) {
    flex-direction: column;
    gap: ${spacing.lg};
  }
`;

const ThumbnailSection = styled.div`
  min-width: 200px;
  max-width: 300px;
  width: 100%;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: ${spacing.sm};
  
  @media (max-width: 768px) {
    max-width: 100%;
    width: 100%;
  }
`;

const InfoSection = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: ${spacing.lg};
  min-width: 0; /* Allows flex item to shrink below content size */
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.sm};
`;

const Label = styled.label`
  font-weight: 600;
  color: ${colors.text};
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: ${spacing.xs};
`;

const Input = styled.input`
  padding: ${spacing.sm} ${spacing.md};
  background: ${colors.bg};
  border: 1px solid ${colors.border};
  border-radius: 6px;
  color: ${colors.text};
  font-size: 0.875rem;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  
  &:focus {
    border-color: ${colors.accent};
    outline: none;
    box-shadow: 0 0 0 3px ${colors.accent}20, 0 2px 6px rgba(0, 0, 0, 0.1);
    transform: translateY(-1px);
  }
  
  &:hover:not(:focus) {
    border-color: ${colors.borderLight || colors.border};
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
  }
`;

const TextArea = styled.textarea`
  padding: ${spacing.sm} ${spacing.md};
  background: ${colors.bg};
  border: 1px solid ${colors.border};
  border-radius: 6px;
  color: ${colors.text};
  font-size: 0.875rem;
  min-height: 100px;
  resize: vertical;
  font-family: inherit;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  
  &:focus {
    border-color: ${colors.accent};
    outline: none;
    box-shadow: 0 0 0 3px ${colors.accent}20, 0 2px 6px rgba(0, 0, 0, 0.1);
    transform: translateY(-1px);
  }
  
  &:hover:not(:focus) {
    border-color: ${colors.borderLight || colors.border};
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
  }
`;

const Select = styled.select`
  padding: ${spacing.sm} ${spacing.md};
  background: ${colors.bg};
  border: 1px solid ${colors.border};
  border-radius: 6px;
  color: ${colors.text};
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  
  &:focus {
    border-color: ${colors.accent};
    outline: none;
    box-shadow: 0 0 0 3px ${colors.accent}20, 0 2px 6px rgba(0, 0, 0, 0.1);
    transform: translateY(-1px);
  }
  
  &:hover:not(:focus) {
    border-color: ${colors.borderLight || colors.border};
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: ${spacing.md};
  margin-top: ${spacing.md};
  flex-wrap: wrap;
`;

const StatusBadge = styled.span<{ status: ModStatus }>`
  ${({ status }) => getBadgeStyles(getStatusBadgeType(status))}
`;

const StatusInfo = styled.div`
  padding: ${spacing.md};
  background: linear-gradient(135deg, ${colors.bg}, ${colors.bgTertiary});
  border: 1px solid ${colors.border};
  border-left: 4px solid ${colors.accent};
  border-radius: 8px;
  margin-bottom: ${spacing.md};
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
`;

const StatusInfoText = styled.p`
  margin: 0;
  font-size: 0.875rem;
  color: ${colors.textSecondary};
`;

const Button = styled.button<{ $variant?: 'primary' | 'danger' | 'secondary'; disabled?: boolean }>`
  ${({ $variant = 'primary' }) => getButtonStyles($variant)}
  
  ${({ disabled }) => disabled && `
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  `}
`;

interface ModManageFormProps {
    mod: ModMetadata;
    onUpdate: (updates: ModUpdateRequest, thumbnail?: File, variantFiles?: Record<string, File>) => void;
    onDelete: () => void;
    onStatusChange?: (status: ModStatus) => void;
    isLoading: boolean;
}

const VariantSection = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${spacing.md};
    padding: ${spacing.lg};
    background: linear-gradient(135deg, ${colors.bg}, ${colors.bgTertiary});
    border: 1px solid ${colors.border};
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
`;

const VariantItem = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${spacing.sm};
    padding: ${spacing.lg};
    background: ${colors.bgSecondary};
    border: 1px solid ${colors.border};
    border-radius: 8px;
    transition: all 0.2s ease;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
    
    &:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        transform: translateY(-2px);
        border-color: ${colors.accent}40;
    }
`;

const ModalMessageContainer = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${spacing.md};
`;

const ModalParagraph = styled.p`
    margin: 0;
    color: ${colors.textSecondary};
    line-height: 1.6;
`;

const WarningSection = styled.div`
    padding: ${spacing.md};
    background: ${colors.bgTertiary};
    border-left: 4px solid ${colors.danger || '#ff6b6b'};
    border-radius: 4px;
    margin: ${spacing.sm} 0;
`;

const WarningTitle = styled.div`
    font-weight: 700;
    color: ${colors.danger || '#ff6b6b'};
    margin-bottom: ${spacing.xs};
    display: flex;
    align-items: center;
    gap: ${spacing.xs};
    font-size: 0.9375rem;
`;

const WarningText = styled.p`
    margin: 0;
    color: ${colors.textSecondary};
    line-height: 1.6;
    font-size: 0.875rem;
`;

const RecommendationSection = styled.div`
    padding: ${spacing.md};
    background: ${colors.bgTertiary};
    border-left: 4px solid ${colors.accent};
    border-radius: 4px;
    margin: ${spacing.sm} 0;
`;

const RecommendationTitle = styled.div`
    font-weight: 700;
    color: ${colors.accent};
    margin-bottom: ${spacing.xs};
    display: flex;
    align-items: center;
    gap: ${spacing.xs};
    font-size: 0.9375rem;
`;

const RecommendationText = styled.p`
    margin: 0;
    color: ${colors.textSecondary};
    line-height: 1.6;
    font-size: 0.875rem;
`;

export function ModManageForm({ mod, onUpdate, onDelete, onStatusChange, isLoading }: ModManageFormProps) {
    const { data: settings } = useAdminSettings();
    const [title, setTitle] = useState(mod.title);
    const [description, setDescription] = useState(mod.description);
    const [category, setCategory] = useState<ModCategory>(mod.category);
    const [tags, setTags] = useState(mod.tags.join(', '));
    const [visibility, setVisibility] = useState<ModVisibility>(mod.visibility);
    const [gameId, setGameId] = useState<string | undefined>(mod.gameId);
    const [variants, setVariants] = useState<ModVariantWithFile[]>(mod.variants || []);
    const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
    const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(mod.thumbnailUrl || null);
    const [variantFileErrors, setVariantFileErrors] = useState<Record<string, string | null>>({});
    const [thumbnailError, setThumbnailError] = useState<string | null>(null);
    const [variantReplaceModal, setVariantReplaceModal] = useState<{ variantId: string; variantName: string; file: File } | null>(null);
    const [pendingVariantFiles, setPendingVariantFiles] = useState<Record<string, File>>({});

    const handleThumbnailFileChange = (file: File | null) => {
        if (file) {
            // Validate image type
            if (!file.type.startsWith('image/')) {
                setThumbnailError('File must be an image');
                setThumbnailFile(null);
                return;
            }
            // Validate file size
            const validation = validateFileSize(file.size, MAX_THUMBNAIL_SIZE);
            if (validation.valid) {
                setThumbnailFile(file);
                setThumbnailError(null);
                // Generate preview URL
                const reader = new FileReader();
                reader.onloadend = () => {
                    setThumbnailPreview(reader.result as string);
                };
                reader.readAsDataURL(file);
            } else {
                setThumbnailError(validation.error || `Thumbnail size exceeds maximum allowed size of ${formatFileSize(MAX_THUMBNAIL_SIZE)}`);
                setThumbnailFile(null);
            }
        } else {
            setThumbnailFile(null);
            setThumbnailError(null);
            // Keep existing preview if no new file selected
        }
    };

    // Check if a variant is pre-existing (loaded from the mod, not a new draft)
    const isPreExistingVariant = (variant: ModVariantWithFile): boolean => {
        // Pre-existing variants have persisted data (createdAt indicates it's saved)
        return !!variant.createdAt;
    };

    // Check if a variant is empty (no dirty changes from default state)
    const isEmptyVariant = (variant: ModVariantWithFile): boolean => {
        const hasName = variant.name && variant.name.trim().length > 0;
        const hasDescription = variant.description && variant.description.trim().length > 0;
        const hasFile = !!variant.file;
        const hasFileUrl = !!variant.fileUrl;
        
        // Variant is empty if it has no name, no description, no file, and no fileUrl
        return !hasName && !hasDescription && !hasFile && !hasFileUrl;
    };

    // Check if there's an empty draft variant (empty and not pre-existing)
    const hasEmptyDraftVariant = (): boolean => {
        return variants.some(variant => 
            isEmptyVariant(variant) && !isPreExistingVariant(variant)
        );
    };

    const handleAddVariant = () => {
        const newVariant: ModVariantWithFile = {
            variantId: `variant-${Date.now()}`,
            modId: mod.modId,
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

    const handleVariantChange = (variantId: string, field: keyof ModVariantWithFile, value: string | File | null) => {
        setVariants(variants.map(v => 
            v.variantId === variantId 
                ? { ...v, [field]: value }
                : v
        ));
        // Clear error when file is successfully set
        if (field === 'file' && value) {
            setVariantFileErrors(prev => ({ ...prev, [variantId]: null }));
        }
    };

    const handleVariantFileChange = (variantId: string, file: File | null) => {
        if (file) {
            const validation = validateFileSize(file.size, MAX_MOD_FILE_SIZE);
            if (validation.valid) {
                // Check if this variant already has a file (existing variant being replaced)
                const variant = variants.find(v => v.variantId === variantId);
                const isReplacingExistingFile = variant && (variant.fileUrl || (variant.fileName && variant.fileSize !== undefined));
                
                if (isReplacingExistingFile) {
                    // Show warning modal before replacing
                    setVariantReplaceModal({
                        variantId,
                        variantName: variant.name || 'Unnamed Variant',
                        file
                    });
                } else {
                    // New variant or variant without existing file - no warning needed
                    handleVariantChange(variantId, 'file', file);
                    setVariantFileErrors(prev => ({ ...prev, [variantId]: null }));
                }
            } else {
                setVariantFileErrors(prev => ({ 
                    ...prev, 
                    [variantId]: validation.error || `File size exceeds maximum allowed size of ${formatFileSize(MAX_MOD_FILE_SIZE)}` 
                }));
                handleVariantChange(variantId, 'file', null);
            }
        } else {
            handleVariantChange(variantId, 'file', null);
            setVariantFileErrors(prev => ({ ...prev, [variantId]: null }));
            // Remove from pending files if it was there
            setPendingVariantFiles(prev => {
                const next = { ...prev };
                delete next[variantId];
                return next;
            });
        }
    };

    const handleVariantReplaceConfirm = () => {
        if (variantReplaceModal) {
            const { variantId, file } = variantReplaceModal;
            handleVariantChange(variantId, 'file', file);
            setPendingVariantFiles(prev => ({ ...prev, [variantId]: file }));
            setVariantFileErrors(prev => ({ ...prev, [variantId]: null }));
            setVariantReplaceModal(null);
        }
    };

    const handleVariantReplaceCancel = () => {
        if (variantReplaceModal) {
            const { variantId } = variantReplaceModal;
            // Clear the file selection
            handleVariantChange(variantId, 'file', null);
            setVariantReplaceModal(null);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Extract variant files before serializing variants
        // Include both files from variant.file and pendingVariantFiles
        const variantFiles: Record<string, File> = {};
        const variantsWithoutFiles = variants.map(variant => {
            // Check pending files first (confirmed replacements), then regular file selection
            const file = pendingVariantFiles[variant.variantId] || variant.file;
            if (file) {
                variantFiles[variant.variantId] = file;
                // Return variant without File object (can't be serialized)
                const { file: _, ...variantWithoutFile } = variant;
                return variantWithoutFile;
            }
            return variant;
        });
        
        const updates: ModUpdateRequest = {
            title,
            description,
            category,
            tags: tags.split(',').map(t => t.trim()).filter(Boolean),
            visibility,
            gameId: gameId || undefined,
            variants: variantsWithoutFiles.length > 0 ? variantsWithoutFiles : undefined,
        };
        onUpdate(updates, thumbnailFile || undefined, Object.keys(variantFiles).length > 0 ? variantFiles : undefined);
    };

    return (
        <Form onSubmit={handleSubmit}>
            <StatusInfo>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
                    <Label style={{ margin: 0 }}>Current Status:</Label>
                    <StatusBadge status={mod.status}>{mod.status}</StatusBadge>
                </div>
                {mod.status === 'draft' && (
                    <StatusInfoText>
                        This mod is saved as a draft. You can continue editing it or submit it for review when ready.
                    </StatusInfoText>
                )}
                {mod.status === 'pending' && (
                    <StatusInfoText>
                        This mod is pending review. An administrator will review it soon.
                    </StatusInfoText>
                )}
            </StatusInfo>

            <Header>
                <ThumbnailSection>
                    <Label>Thumbnail</Label>
                    <FileUploader
                        file={thumbnailFile}
                        onFileChange={handleThumbnailFileChange}
                        maxSize={MAX_THUMBNAIL_SIZE}
                        accept="image/*"
                        label="Drag and drop thumbnail image here, or click to browse"
                        error={thumbnailError}
                        disabled={isLoading}
                        showImagePreview={true}
                        imagePreviewUrl={thumbnailPreview}
                    />
                </ThumbnailSection>
                <InfoSection>
                    <FormGroup>
                        <Label>Title</Label>
                        <Input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            style={{ 
                                fontSize: '1.75rem', 
                                fontWeight: 700, 
                                padding: spacing.md,
                                background: `linear-gradient(135deg, ${colors.bg}, ${colors.bgTertiary})`,
                                border: `2px solid ${colors.border}`,
                            }}
                        />
                    </FormGroup>

                    <FormGroup>
                        <Label>Description</Label>
                        <TextArea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            style={{ minHeight: '120px' }}
                        />
                    </FormGroup>

                    <FormGroup>
                        <Label>Category</Label>
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
                        />
                    </FormGroup>

                    <FormGroup>
                        <Label>Visibility</Label>
                        <Select value={visibility} onChange={(e) => setVisibility(e.target.value as ModVisibility)}>
                            <option value="public">Public</option>
                            <option value="unlisted">Unlisted</option>
                            <option value="private">Private</option>
                        </Select>
                    </FormGroup>

                    <FormGroup>
                        <Label>Associated Game (optional)</Label>
                        <GamesPicker
                            value={gameId}
                            onChange={setGameId}
                            placeholder="Select a game this mod is for..."
                        />
                    </FormGroup>
                </InfoSection>
            </Header>

            <FormGroup>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Label>Variants (optional)</Label>
                    <Button 
                        type="button" 
                        $variant="secondary" 
                        onClick={handleAddVariant}
                        disabled={hasEmptyDraftVariant()}
                    >
                        Add Variant
                    </Button>
                </div>
                {variants.length > 0 && (
                    <VariantSection>
                        {variants.map((variant) => (
                            <VariantItem key={variant.variantId}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Label style={{ margin: 0 }}>Variant: {variant.name || 'Unnamed'}</Label>
                                    <Button 
                                        type="button" 
                                        $variant="danger" 
                                        onClick={() => handleRemoveVariant(variant.variantId)}
                                        style={{ padding: spacing.xs, fontSize: '0.75rem' }}
                                    >
                                        Remove
                                    </Button>
                                </div>
                                <Input
                                    type="text"
                                    placeholder="Variant name"
                                    value={variant.name || ''}
                                    onChange={(e) => handleVariantChange(variant.variantId, 'name', e.target.value)}
                                />
                                <TextArea
                                    placeholder="Variant description (optional)"
                                    value={variant.description || ''}
                                    onChange={(e) => handleVariantChange(variant.variantId, 'description', e.target.value)}
                                    style={{ minHeight: '60px' }}
                                />
                                <FormGroup>
                                    <Label>Variant File (optional)</Label>
                                    <FileUploader
                                        file={variant.file || null}
                                        onFileChange={(file) => handleVariantFileChange(variant.variantId, file)}
                                        maxSize={MAX_MOD_FILE_SIZE}
                                        accept={settings?.allowedFileExtensions.join(',') || '.lua,.js,.java,.jar,.zip,.json,.txt,.xml,.yaml,.yml'}
                                        label="Drag and drop variant file here, or click to browse"
                                        error={variantFileErrors[variant.variantId] || null}
                                        disabled={isLoading}
                                        existingFileName={!variant.file && variant.fileName ? variant.fileName : undefined}
                                        existingFileSize={!variant.file && variant.fileSize !== undefined && !isNaN(variant.fileSize) ? variant.fileSize : undefined}
                                        existingFileUrl={!variant.file && variant.fileUrl ? variant.fileUrl : undefined}
                                    />
                                </FormGroup>
                            </VariantItem>
                        ))}
                    </VariantSection>
                )}
            </FormGroup>

            <ButtonGroup>
                <Button type="submit" disabled={isLoading}>
                    {isLoading ? 'Saving...' : 'Save Changes'}
                </Button>
                {mod.status === 'draft' && onStatusChange && (
                    <Button 
                        type="button" 
                        $variant="primary"
                        onClick={() => onStatusChange('pending')}
                        disabled={isLoading}
                    >
                        Submit for Review
                    </Button>
                )}
                <Button type="button" $variant="danger" onClick={onDelete} disabled={isLoading}>
                    Delete Mod
                </Button>
            </ButtonGroup>

            <ConfirmationModal
                isOpen={!!variantReplaceModal}
                onClose={handleVariantReplaceCancel}
                onConfirm={handleVariantReplaceConfirm}
                title="Replace Variant File?"
                message={
                    variantReplaceModal ? (
                        <ModalMessageContainer>
                            <ModalParagraph>
                                You are about to replace the file for variant <strong>"{variantReplaceModal.variantName}"</strong>.
                            </ModalParagraph>
                            
                            <WarningSection>
                                <WarningTitle>
                                    <span>⚠</span>
                                    <span>WARNING</span>
                                </WarningTitle>
                                <WarningText>
                                    Replacing the variant file will reset the download counter for this variant to 0. All previous download statistics for this variant will be lost.
                                </WarningText>
                            </WarningSection>
                            
                            <RecommendationSection>
                                <RecommendationTitle>
                                    <span>▸</span>
                                    <span>RECOMMENDATION</span>
                                </RecommendationTitle>
                                <RecommendationText>
                                    Instead of replacing the file, consider uploading it as a new variant to preserve download statistics.
                                </RecommendationText>
                            </RecommendationSection>
                            
                            <ModalParagraph>
                                Are you sure you want to proceed with replacing the file?
                            </ModalParagraph>
                        </ModalMessageContainer>
                    ) : ''
                }
                confirmText="Yes, Replace File (Reset Counter)"
                cancelText="Cancel"
                isLoading={isLoading}
            />
        </Form>
    );
}

