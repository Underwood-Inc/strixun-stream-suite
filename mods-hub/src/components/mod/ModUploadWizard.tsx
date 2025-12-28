/**
 * Multi-step wizard for mod upload
 * Improves UX by breaking the form into logical steps
 */

import { useState, useRef, useCallback } from 'react';
import styled from 'styled-components';
import { colors, spacing } from '../../theme';
import type { ModUploadRequest, ModCategory, ModVisibility, ModVariant, ModStatus } from '../../types/mod';
import { GamesPicker } from './GamesPicker';
import { useAdminSettings } from '../../hooks/useMods';

// Wizard Container
const WizardContainer = styled.div`
  background: ${colors.bgSecondary};
  border: 1px solid ${colors.border};
  border-radius: 8px;
  padding: ${spacing.xl};
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

const StepIndicator = styled.div<{ active: boolean; completed: boolean }>`
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${spacing.xs};
  flex: 1;
`;

const StepCircle = styled.div<{ active: boolean; completed: boolean }>`
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
      content: '[EMOJI]';
      font-size: 1.2rem;
    }
  `}
`;

const StepLabel = styled.span<{ active: boolean }>`
  font-size: 0.75rem;
  color: ${({ active }) => active ? colors.text : colors.textMuted};
  font-weight: ${({ active }) => active ? 600 : 400};
  text-align: center;
`;


// Step Content
const StepContent = styled.div<{ active: boolean }>`
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
  min-height: 80px;
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

const RemoveButton = styled.button`
  padding: ${spacing.xs} ${spacing.sm};
  background: ${colors.danger};
  color: ${colors.bg};
  border: none;
  border-radius: 4px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: background 0.2s ease;
  
  &:hover {
    background: ${colors.danger}dd;
  }
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

const Button = styled.button<{ variant?: 'primary' | 'secondary' | 'danger'; disabled?: boolean }>`
  padding: ${spacing.md} ${spacing.lg};
  border-radius: 4px;
  font-weight: 500;
  cursor: ${({ disabled }) => disabled ? 'not-allowed' : 'pointer'};
  transition: all 0.2s ease;
  border: none;
  
  ${({ variant = 'primary', disabled }) => {
    if (disabled) {
      return `
        background: ${colors.border};
        color: ${colors.textMuted};
      `;
    }
    switch (variant) {
      case 'primary':
        return `
          background: ${colors.accent};
          color: ${colors.bg};
          
          &:hover {
            background: ${colors.accentHover};
          }
        `;
      case 'secondary':
        return `
          background: transparent;
          color: ${colors.text};
          border: 1px solid ${colors.border};
          
          &:hover {
            border-color: ${colors.borderLight};
          }
        `;
      default:
        return '';
    }
  }}
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
  padding: ${spacing.sm} ${spacing.md};
  background: ${colors.bgTertiary};
  color: ${colors.text};
  border: 1px solid ${colors.border};
  border-radius: 4px;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${colors.bgSecondary};
    border-color: ${colors.accent};
  }
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
    const { data: settings } = useAdminSettings();
    
    // Form state
    const [file, setFile] = useState<File | null>(null);
    const [thumbnail, setThumbnail] = useState<File | null>(null);
    const [title, setTitle] = useState(initialData?.title || '');
    const [description, setDescription] = useState(initialData?.description || '');
    const [category, setCategory] = useState<ModCategory>(initialData?.category || 'script');
    const [tags, setTags] = useState(initialData?.tags?.join(', ') || '');
    const [version, setVersion] = useState(initialData?.version || '1.0.0');
    const [changelog, setChangelog] = useState(initialData?.changelog || '');
    const [gameVersions, setGameVersions] = useState(initialData?.gameVersions?.join(', ') || '');
    const [visibility, setVisibility] = useState<ModVisibility>(initialData?.visibility || 'public');
    const [variants, setVariants] = useState<ModVariant[]>(initialData?.variants || []);
    const [gameId, setGameId] = useState<string | undefined>(initialData?.gameId);
    const [isDragging, setIsDragging] = useState(false);
    const [isThumbnailDragging, setIsThumbnailDragging] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const thumbnailInputRef = useRef<HTMLInputElement>(null);

    // Validation
    const validateStep = (step: number): boolean => {
        switch (step) {
            case 1:
                return !!(file && title.trim() && category);
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

    // Variant management
    const handleAddVariant = () => {
        const newVariant: ModVariant = {
            variantId: `variant-${Date.now()}`,
            name: '',
            description: '',
        };
        setVariants([...variants, newVariant]);
    };

    const handleRemoveVariant = (variantId: string) => {
        setVariants(variants.filter(v => v.variantId !== variantId));
    };

    const handleVariantChange = (variantId: string, field: keyof ModVariant, value: string | File) => {
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
                                        <div>[FOLDER] Drop mod file here or click to browse</div>
                                        <DragDropText>
                                            Allowed: {settings?.allowedFileExtensions.join(', ') || '.lua, .js, .zip, .json, .txt, .xml, .yaml, .yml'}
                                        </DragDropText>
                                    </>
                                )}
                            </DragDropZone>
                            <HiddenInput
                                ref={fileInputRef}
                                type="file"
                                accept={settings?.allowedFileExtensions.join(',') || '.lua,.js,.zip,.json,.txt,.xml,.yaml,.yml'}
                                onChange={(e) => setFile(e.target.files?.[0] || null)}
                            />
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
                                        <div>[EMOJI][EMOJI] Drop thumbnail here</div>
                                        <DragDropText>.png, .jpg, .webp</DragDropText>
                                    </>
                                )}
                            </DragDropZone>
                            <HiddenInput
                                ref={thumbnailInputRef}
                                type="file"
                                accept="image/*"
                                onChange={(e) => setThumbnail(e.target.files?.[0] || null)}
                            />
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
                    <Label>Description</Label>
                    <TextArea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Describe your mod..."
                        rows={4}
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
                        variant="primary"
                        onClick={handleNext}
                        disabled={!canProceed}
                    >
                        Next: Version & Details [EMOJI]
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
                    <Label>Changelog</Label>
                    <TextArea
                        value={changelog}
                        onChange={(e) => setChangelog(e.target.value)}
                        placeholder="What's new in this version?"
                        rows={4}
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
                    <Button variant="secondary" onClick={handleBack}>
                        [EMOJI] Back
                    </Button>
                    <Button 
                        variant="primary"
                        onClick={handleNext}
                        disabled={!canProceed}
                    >
                        Next: Review & Submit [EMOJI]
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
                    <ReviewValue>{description || <ReviewEmpty>No description</ReviewEmpty>}</ReviewValue>
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
                        <ReviewValue>{changelog}</ReviewValue>
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

                {thumbnail && (
                    <ReviewSection>
                        <ReviewLabel>Thumbnail</ReviewLabel>
                        <ReviewValue>{thumbnail.name}</ReviewValue>
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
                                <Label>Variant Description</Label>
                                <TextArea
                                    value={variant.description || ''}
                                    onChange={(e) => handleVariantChange(variant.variantId, 'description', e.target.value)}
                                    placeholder="Describe this variant..."
                                    rows={3}
                                />
                            </FormGroup>
                            <FormGroup>
                                <Label>Variant File</Label>
                                <Input
                                    type="file"
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
                    <Button variant="secondary" onClick={handleBack}>
                        [EMOJI] Back
                    </Button>
                    <div style={{ display: 'flex', gap: spacing.md }}>
                        {onSaveDraft && (
                            <Button 
                                variant="secondary"
                                onClick={handleSaveDraft}
                                disabled={isLoading || !file}
                            >
                                Save as Draft
                            </Button>
                        )}
                        <Button 
                            variant="primary"
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

