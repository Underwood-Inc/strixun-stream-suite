/**
 * Multi-step wizard for mod upload
 * Improves UX by breaking the form into logical steps
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import styled from 'styled-components';
import { colors, spacing } from '../../theme';
import { ModUploadRequest, ModCategory, ModVisibility, ModVariant, ModStatus } from '../../types/mod';
import { GamesPicker } from './GamesPicker';
import { useModSettings } from '../../hooks/useMods';
import { formatFileSize, validateFileSize, DEFAULT_UPLOAD_LIMITS } from '@strixun/api-framework';
import { getButtonStyles } from '../../utils/buttonStyles';
import { getCardStyles } from '../../utils/sharedStyles';
import { MarkdownEditor } from '../common/MarkdownEditor';
import { MarkdownContent } from '../common/MarkdownContent';

// UI-only type that extends ModVariant with file upload fields
type ModVariantWithFile = ModVariant & {
    file?: File;
};

// File size limits (must match server-side limits in serverless/mods-api/utils/upload-limits.ts)
const MAX_MOD_FILE_SIZE = 35 * 1024 * 1024; // 35 MB
const MAX_THUMBNAIL_SIZE = DEFAULT_UPLOAD_LIMITS.maxThumbnailSize; // 1 MB (from shared framework)

// Wizard Container
const WizardContainer = styled.div`
  ${getCardStyles('default')}
  max-width: 800px;
  margin: 0 auto;
`;

// Progress Stepper
const Stepper = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${spacing.xl};
  position: relative;
  
  &::before {
    content: '';
    position: absolute;
    top: 20px;
    left: 0;
    right: 0;
    height: 2px;
    background: ${colors.border};
    z-index: 0;
  }
`;

const StepIndicator = styled.div.withConfig({
  shouldForwardProp: (prop) => !['active', 'completed'].includes(prop),
})<{ active: boolean; completed: boolean }>`
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${spacing.xs};
  flex: 1;
`;

const StepCircle = styled.div.withConfig({
  shouldForwardProp: (prop) => !['active', 'completed'].includes(prop),
})<{ active: boolean; completed: boolean }>`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.875rem;
  transition: all 0.3s ease;
  background: ${({ active, completed }) => 
    completed ? colors.accent : active ? colors.accent : colors.bg};
  color: ${({ active, completed }) => 
    completed || active ? colors.bg : colors.textMuted};
  border: 2px solid ${({ active, completed }) => 
    completed || active ? colors.accent : colors.border};
  
  ${({ completed }) => completed && `
    &::after {
      content: '✓';
      font-size: 1.2rem;
    }
  `}
`;

const StepLabel = styled.span.withConfig({
  shouldForwardProp: (prop) => prop !== 'active',
})<{ active: boolean }>`
  font-size: 0.75rem;
  color: ${({ active }) => active ? colors.text : colors.textMuted};
  font-weight: ${({ active }) => active ? 600 : 400};
  text-align: center;
`;


// Step Content
const StepContent = styled.div.withConfig({
  shouldForwardProp: (prop) => prop !== 'active',
})<{ active: boolean }>`
  display: ${({ active }) => active ? 'block' : 'none'};
  animation: ${({ active }) => active ? 'fadeIn 0.3s ease' : 'none'};
  
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

const StepTitle = styled.h2`
  font-size: 1.5rem;
  font-weight: 600;
  color: ${colors.text};
  margin-bottom: ${spacing.md};
`;

const StepDescription = styled.p`
  color: ${colors.textSecondary};
  font-size: 0.875rem;
  margin-bottom: ${spacing.lg};
`;

// Form Elements (reused from original form)
const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.sm};
  margin-bottom: ${spacing.md};
`;

const Label = styled.label`
  font-weight: 500;
  color: ${colors.text};
  font-size: 0.875rem;
`;

const Required = styled.span`
  color: ${colors.danger};
  margin-left: 2px;
`;

const HelpText = styled.span`
  font-size: 0.75rem;
  color: ${colors.textMuted};
  display: block;
  margin-top: 2px;
`;

const CharCount = styled.span<{ $over?: boolean }>`
  font-size: 0.75rem;
  color: ${props => props.$over ? colors.danger : colors.textMuted};
  text-align: right;
  display: block;
  margin-top: 4px;
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

const RemoveButton = styled.button`
  ${getButtonStyles('danger')}
  font-size: 0.75rem;
  padding: ${spacing.xs} ${spacing.sm};
`;

const HiddenInput = styled.input`
  display: none;
`;

// Navigation Buttons
const NavigationButtons = styled.div`
  display: flex;
  justify-content: space-between;
  gap: ${spacing.md};
  margin-top: ${spacing.xl};
  padding-top: ${spacing.lg};
  border-top: 1px solid ${colors.border};
`;

const Button = styled.button<{ $variant?: 'primary' | 'secondary' | 'danger'; disabled?: boolean }>`
  ${({ $variant = 'primary' }) => getButtonStyles($variant)}
  
  ${({ disabled }) => disabled && `
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  `}
`;

// Review Step
const ReviewSection = styled.div`
  background: ${colors.bg};
  border: 1px solid ${colors.border};
  border-radius: 4px;
  padding: ${spacing.md};
  margin-bottom: ${spacing.md};
`;

const ReviewLabel = styled.div`
  font-weight: 600;
  color: ${colors.text};
  font-size: 0.875rem;
  margin-bottom: ${spacing.xs};
`;

const ReviewValue = styled.div`
  color: ${colors.textSecondary};
  font-size: 0.875rem;
  word-break: break-word;
`;

const ReviewEmpty = styled.div`
  color: ${colors.textMuted};
  font-style: italic;
  font-size: 0.875rem;
`;

const ThumbnailPreview = styled.div`
  position: relative;
  width: 100%;
  max-width: 200px;
  margin: ${spacing.sm} auto;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid ${colors.border};
`;

const ThumbnailImage = styled.img`
  width: 100%;
  height: auto;
  display: block;
  object-fit: contain;
  background: ${colors.bg};
`;

const ThumbnailLabel = styled.div`
  background: ${colors.warning}dd;
  color: ${colors.bg};
  padding: 4px ${spacing.sm};
  border-radius: 3px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  text-align: center;
  width: 100%;
  max-width: 200px;
  margin-bottom: ${spacing.xs};
`;

const ThumbnailPreviewContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${spacing.xs};
`;

// Variants Section
const VariantsSection = styled.div`
  margin-top: ${spacing.lg};
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

interface ModUploadWizardProps {
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

const STEPS = [
    { id: 1, label: 'Basic Info', key: 'basic' },
    { id: 2, label: 'Version & Details', key: 'details' },
    { id: 3, label: 'Review & Submit', key: 'review' },
];

export function ModUploadWizard({ 
    onSubmit, 
    onSaveDraft, 
    isLoading,
    initialData 
}: ModUploadWizardProps) {
    const [currentStep, setCurrentStep] = useState(1);
    const { data: settings } = useModSettings();
    
    // Form state
    const [file, setFile] = useState<File | null>(null);
    const [thumbnail, setThumbnail] = useState<File | null>(null);
    const [title, setTitle] = useState(initialData?.title || '');
    const [summary, setSummary] = useState(initialData?.summary || '');
    const [description, setDescription] = useState(initialData?.description || '');
    const [category, setCategory] = useState<ModCategory>(initialData?.category || 'script');
    const [tags, setTags] = useState(initialData?.tags?.join(', ') || '');
    const [version, setVersion] = useState(initialData?.version || '1.0.0');
    const [changelog, setChangelog] = useState(initialData?.changelog || '');
    const [gameVersions, setGameVersions] = useState(initialData?.gameVersions?.join(', ') || '');
    const [visibility, setVisibility] = useState<ModVisibility>(initialData?.visibility || 'public');
    const [variants, setVariants] = useState<ModVariantWithFile[]>(initialData?.variants || []);
    const [gameId, setGameId] = useState<string | undefined>(initialData?.gameId);
    const [isDragging, setIsDragging] = useState(false);
    const [isThumbnailDragging, setIsThumbnailDragging] = useState(false);
    const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
    const [fileSizeError, setFileSizeError] = useState<string | null>(null);
    const [thumbnailSizeError, setThumbnailSizeError] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const thumbnailInputRef = useRef<HTMLInputElement>(null);

    // Generate thumbnail preview URL when thumbnail changes
    useEffect(() => {
        if (thumbnail) {
            const objectUrl = URL.createObjectURL(thumbnail);
            setThumbnailPreview(objectUrl);
            
            // Cleanup function to revoke the object URL
            return () => {
                URL.revokeObjectURL(objectUrl);
            };
        } else {
            setThumbnailPreview(null);
        }
    }, [thumbnail]);

    // Validation
    const validateStep = (step: number): boolean => {
        switch (step) {
            case 1:
                return !!(file && !fileSizeError && title.trim() && category && !thumbnailSizeError);
            case 2:
                return !!(version.trim());
            case 3:
                return true; // Review step is always valid
            default:
                return false;
        }
    };

    const canProceed = validateStep(currentStep);

    const handleNext = () => {
        if (canProceed && currentStep < STEPS.length) {
            setCurrentStep(currentStep + 1);
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleStepClick = (step: number) => {
        // Allow clicking on completed steps or current step
        if (step <= currentStep || validateStep(step - 1)) {
            setCurrentStep(step);
        }
    };

    // Drag and drop handlers
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
            const validation = validateFileSize(droppedFile.size, MAX_MOD_FILE_SIZE);
            if (validation.valid) {
                setFile(droppedFile);
                setFileSizeError(null);
            } else {
                setFileSizeError(validation.error || `File size exceeds maximum allowed size of ${formatFileSize(MAX_MOD_FILE_SIZE)}`);
                setFile(null);
            }
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
        if (droppedFile) {
            if (!droppedFile.type.startsWith('image/')) {
                setThumbnailSizeError('File must be an image');
                setThumbnail(null);
                return;
            }
            const validation = validateFileSize(droppedFile.size, MAX_THUMBNAIL_SIZE);
            if (validation.valid) {
                setThumbnail(droppedFile);
                setThumbnailSizeError(null);
            } else {
                setThumbnailSizeError(validation.error || `Thumbnail size exceeds maximum allowed size of ${formatFileSize(MAX_THUMBNAIL_SIZE)}`);
                setThumbnail(null);
            }
        }
    }, []);

    // Variant management
    const handleAddVariant = () => {
        const newVariant: ModVariantWithFile = {
            variantId: `variant-${Date.now()}`,
            modId: '', // Will be set when mod is created
            parentVersionId: '', // Will be set to initial version when mod is created
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

    // Build metadata
    const buildMetadata = (status?: ModStatus): ModUploadRequest => {
        return {
            title,
            summary: summary || undefined,
            description,
            category,
            tags: tags.split(',').map(t => t.trim()).filter(Boolean),
            version,
            changelog,
            gameVersions: gameVersions.split(',').map(v => v.trim()).filter(Boolean),
            visibility,
            status,
            gameId,
            variants: variants.map(v => ({
                ...v,
                file: v.file,
            })),
        };
    };

    const handleSubmit = () => {
        if (!file) return;
        const metadata = buildMetadata('pending');
        onSubmit({ file, metadata, thumbnail: thumbnail || undefined });
    };

    const handleSaveDraft = () => {
        if (!file) return;
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
        <WizardContainer>
            {/* Progress Stepper */}
            <Stepper>
                {STEPS.map((step) => {
                    const isActive = currentStep === step.id;
                    const isCompleted = currentStep > step.id;
                    const canClick = step.id <= currentStep || validateStep(step.id - 1);
                    
                    return (
                        <StepIndicator 
                            key={step.id}
                            active={isActive}
                            completed={isCompleted}
                        >
                            <StepCircle
                                active={isActive}
                                completed={isCompleted}
                                onClick={() => canClick && handleStepClick(step.id)}
                                style={{ cursor: canClick ? 'pointer' : 'default' }}
                            >
                                {!isCompleted && step.id}
                            </StepCircle>
                            <StepLabel active={isActive || isCompleted}>
                                {step.label}
                            </StepLabel>
                        </StepIndicator>
                    );
                })}
            </Stepper>

            {/* Step 1: Basic Info & File */}
            <StepContent active={currentStep === 1}>
                <StepTitle>Basic Information</StepTitle>
                <StepDescription>
                    Start by uploading your mod file and providing the essential details.
                </StepDescription>

                <FormGroup>
                    <Label>Mod File & Thumbnail</Label>
                    <div style={{ display: 'flex', gap: spacing.md }}>
                        <div style={{ flex: '2', minWidth: 0 }}>
                            <Label style={{ marginBottom: spacing.xs }}>Mod File <Required>*</Required></Label>
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
                                        <FileSize>({formatFileSize(file.size)})</FileSize>
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
                                        <DragDropText>
                                            Allowed: {settings?.allowedFileExtensions.join(', ') || '.lua, .js, .java, .jar, .zip, .json, .txt, .xml, .yaml, .yml'}
                                        </DragDropText>
                                    </>
                                )}
                            </DragDropZone>
                            <HiddenInput
                                ref={fileInputRef}
                                type="file"
                                accept={settings?.allowedFileExtensions.join(',') || '.lua,.js,.java,.jar,.zip,.json,.txt,.xml,.yaml,.yml'}
                                onChange={(e) => {
                                    const selectedFile = e.target.files?.[0] || null;
                                    if (selectedFile) {
                                        const validation = validateFileSize(selectedFile.size, MAX_MOD_FILE_SIZE);
                                        if (validation.valid) {
                                            setFile(selectedFile);
                                            setFileSizeError(null);
                                        } else {
                                            setFileSizeError(validation.error || `File size exceeds maximum allowed size of ${formatFileSize(MAX_MOD_FILE_SIZE)}`);
                                            setFile(null);
                                            // Reset input so user can try again
                                            e.target.value = '';
                                        }
                                    } else {
                                        setFile(null);
                                        setFileSizeError(null);
                                    }
                                }}
                            />
                            {fileSizeError && (
                                <div style={{ 
                                    marginTop: spacing.xs, 
                                    padding: spacing.xs, 
                                    background: `${colors.danger}20`, 
                                    color: colors.danger, 
                                    borderRadius: 4,
                                    fontSize: '0.875rem'
                                }}>
                                    {fileSizeError}
                                </div>
                            )}
                            <div style={{ 
                                marginTop: spacing.xs, 
                                fontSize: '0.75rem', 
                                color: colors.textMuted 
                            }}>
                                Maximum file size: {formatFileSize(MAX_MOD_FILE_SIZE)}
                            </div>
                        </div>
                        <div style={{ flex: '1', minWidth: 0 }}>
                            <Label style={{ marginBottom: spacing.xs }}>Thumbnail (optional)</Label>
                            <DragDropZone
                                isDragging={isThumbnailDragging}
                                hasFile={!!thumbnail}
                                onDragOver={handleThumbnailDragOver}
                                onDragLeave={handleThumbnailDragLeave}
                                onDrop={handleThumbnailDrop}
                                onClick={() => thumbnailInputRef.current?.click()}
                            >
                                {thumbnail && thumbnailPreview ? (
                                    <ThumbnailPreviewContainer>
                                        <ThumbnailLabel>Preview</ThumbnailLabel>
                                        <ThumbnailPreview>
                                            <ThumbnailImage src={thumbnailPreview} alt="Thumbnail preview" />
                                        </ThumbnailPreview>
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
                                    </ThumbnailPreviewContainer>
                                ) : (
                                    <>
                                        <div>◇ Drop thumbnail here</div>
                                        <DragDropText>.png, .jpg, .webp</DragDropText>
                                    </>
                                )}
                            </DragDropZone>
                            <HiddenInput
                                ref={thumbnailInputRef}
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                    const selectedFile = e.target.files?.[0] || null;
                                    if (selectedFile) {
                                        if (!selectedFile.type.startsWith('image/')) {
                                            setThumbnailSizeError('File must be an image');
                                            setThumbnail(null);
                                            e.target.value = '';
                                            return;
                                        }
                                        const validation = validateFileSize(selectedFile.size, MAX_THUMBNAIL_SIZE);
                                        if (validation.valid) {
                                            setThumbnail(selectedFile);
                                            setThumbnailSizeError(null);
                                        } else {
                                            setThumbnailSizeError(validation.error || `Thumbnail size exceeds maximum allowed size of ${formatFileSize(MAX_THUMBNAIL_SIZE)}`);
                                            setThumbnail(null);
                                            e.target.value = '';
                                        }
                                    } else {
                                        setThumbnail(null);
                                        setThumbnailSizeError(null);
                                    }
                                }}
                            />
                            {thumbnailSizeError && (
                                <div style={{ 
                                    marginTop: spacing.xs, 
                                    padding: spacing.xs, 
                                    background: `${colors.danger}20`, 
                                    color: colors.danger, 
                                    borderRadius: 4,
                                    fontSize: '0.875rem'
                                }}>
                                    {thumbnailSizeError}
                                </div>
                            )}
                            <div style={{ 
                                marginTop: spacing.xs, 
                                fontSize: '0.75rem', 
                                color: colors.textMuted 
                            }}>
                                Maximum thumbnail size: {formatFileSize(MAX_THUMBNAIL_SIZE)}
                            </div>
                        </div>
                    </div>
                </FormGroup>

                <FormGroup>
                    <Label>Title <Required>*</Required></Label>
                    <Input
                        type="text"
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="My Awesome Mod"
                    />
                </FormGroup>

                <FormGroup>
                    <Label>Summary</Label>
                    <HelpText>Brief one-liner for list views (max 150 chars)</HelpText>
                    <Input
                        type="text"
                        value={summary}
                        onChange={(e) => setSummary(e.target.value.slice(0, 150))}
                        placeholder="A quick summary of what your mod does..."
                        maxLength={150}
                    />
                    <CharCount $over={summary.length > 150}>{summary.length}/150</CharCount>
                </FormGroup>

                <FormGroup>
                    <MarkdownEditor
                        label="Description"
                        value={description}
                        onChange={setDescription}
                        placeholder="Describe your mod... Supports **bold**, *italic*, `code`, lists, and more..."
                        height={200}
                        preview="live"
                    />
                </FormGroup>

                <FormGroup>
                    <Label>Category <Required>*</Required></Label>
                    <Select value={category} onChange={(e) => setCategory(e.target.value as ModCategory)}>
                        <option value="script">Script</option>
                        <option value="overlay">Overlay</option>
                        <option value="theme">Theme</option>
                        <option value="asset">Asset</option>
                        <option value="plugin">Plugin</option>
                        <option value="other">Other</option>
                    </Select>
                </FormGroup>


                <NavigationButtons>
                    <div></div>
                    <Button 
                        $variant="primary"
                        onClick={handleNext}
                        disabled={!canProceed}
                    >
                        Next: Version & Details
                    </Button>
                </NavigationButtons>
            </StepContent>

            {/* Step 2: Version & Details */}
            <StepContent active={currentStep === 2}>
                <StepTitle>Version & Details</StepTitle>
                <StepDescription>
                    Provide version information and additional metadata for your mod.
                </StepDescription>

                <FormGroup>
                    <Label>Version <Required>*</Required></Label>
                    <Input
                        type="text"
                        required
                        value={version}
                        onChange={(e) => setVersion(e.target.value)}
                        placeholder="1.0.0"
                    />
                </FormGroup>

                <FormGroup>
                    <MarkdownEditor
                        label="Changelog"
                        value={changelog}
                        onChange={setChangelog}
                        placeholder="What's new in this version? Supports **bold**, *italic*, `code`, lists, and more..."
                        height={200}
                        preview="live"
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
                    <Label>Tags (comma-separated)</Label>
                    <Input
                        type="text"
                        value={tags}
                        onChange={(e) => setTags(e.target.value)}
                        placeholder="tag1, tag2, tag3"
                    />
                </FormGroup>

                <FormGroup>
                    <Label>Visibility <Required>*</Required></Label>
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

                <NavigationButtons>
                    <Button $variant="secondary" onClick={handleBack}>
                        Back
                    </Button>
                    <Button 
                        $variant="primary"
                        onClick={handleNext}
                        disabled={!canProceed}
                    >
                        Next: Review & Submit
                    </Button>
                </NavigationButtons>
            </StepContent>

            {/* Step 3: Variants & Review */}
            <StepContent active={currentStep === 3}>
                <StepTitle>Review & Submit</StepTitle>
                <StepDescription>
                    Review your mod details, add variants if needed, and submit for review.
                </StepDescription>

                {/* Review Summary */}
                <ReviewSection>
                    <ReviewLabel>Mod File</ReviewLabel>
                    <ReviewValue>{file ? file.name : <ReviewEmpty>Not selected</ReviewEmpty>}</ReviewValue>
                </ReviewSection>

                <ReviewSection>
                    <ReviewLabel>Title</ReviewLabel>
                    <ReviewValue>{title || <ReviewEmpty>Not set</ReviewEmpty>}</ReviewValue>
                </ReviewSection>

                <ReviewSection>
                    <ReviewLabel>Description</ReviewLabel>
                    <ReviewValue>
                        {description ? <MarkdownContent content={description} /> : <ReviewEmpty>No description</ReviewEmpty>}
                    </ReviewValue>
                </ReviewSection>

                <ReviewSection>
                    <ReviewLabel>Category</ReviewLabel>
                    <ReviewValue>{category}</ReviewValue>
                </ReviewSection>

                <ReviewSection>
                    <ReviewLabel>Version</ReviewLabel>
                    <ReviewValue>{version}</ReviewValue>
                </ReviewSection>

                {changelog && (
                    <ReviewSection>
                        <ReviewLabel>Changelog</ReviewLabel>
                        <ReviewValue>
                            <MarkdownContent content={changelog} />
                        </ReviewValue>
                    </ReviewSection>
                )}

                {gameVersions && (
                    <ReviewSection>
                        <ReviewLabel>Game Versions</ReviewLabel>
                        <ReviewValue>{gameVersions}</ReviewValue>
                    </ReviewSection>
                )}

                {tags && (
                    <ReviewSection>
                        <ReviewLabel>Tags</ReviewLabel>
                        <ReviewValue>{tags}</ReviewValue>
                    </ReviewSection>
                )}

                <ReviewSection>
                    <ReviewLabel>Visibility</ReviewLabel>
                    <ReviewValue>{visibility}</ReviewValue>
                </ReviewSection>

                {thumbnail && thumbnailPreview && (
                    <ReviewSection>
                        <ReviewLabel>Thumbnail</ReviewLabel>
                        <ThumbnailPreviewContainer>
                            <ThumbnailLabel>Preview (Not Uploaded)</ThumbnailLabel>
                            <ThumbnailPreview>
                                <ThumbnailImage src={thumbnailPreview} alt="Thumbnail preview" />
                            </ThumbnailPreview>
                            <ReviewValue style={{ fontSize: '0.75rem', color: colors.textMuted }}>
                                {thumbnail.name}
                            </ReviewValue>
                        </ThumbnailPreviewContainer>
                    </ReviewSection>
                )}

                {/* Variants Section */}
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
                                <MarkdownEditor
                                    label="Variant Description"
                                    value={variant.description || ''}
                                    onChange={(value) => handleVariantChange(variant.variantId, 'description', value)}
                                    placeholder="Describe this variant..."
                                    height={150}
                                    preview="edit"
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

                <NavigationButtons>
                    <Button $variant="secondary" onClick={handleBack}>
                        Back
                    </Button>
                    <div style={{ display: 'flex', gap: spacing.md }}>
                        {onSaveDraft && (
                            <Button 
                                $variant="secondary"
                                onClick={handleSaveDraft}
                                disabled={isLoading || !file}
                            >
                                Save as Draft
                            </Button>
                        )}
                        <Button 
                            $variant="primary"
                            onClick={handleSubmit}
                            disabled={isLoading || !file}
                        >
                            {isLoading ? 'Uploading...' : 'Submit for Review'}
                        </Button>
                    </div>
                </NavigationButtons>
            </StepContent>
        </WizardContainer>
    );
}

