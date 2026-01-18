/**
 * Version Variant Manager Component
 * Manages variants for a specific mod version
 * Replaces the centralized variant management with per-version management
 */

import { useState, useRef } from 'react';
import styled from 'styled-components';
import { colors, spacing } from '../../theme';
import type { ModVariant, ModVersion } from '../../types/mod';
import { MarkdownEditor } from '../common/MarkdownEditor';
import { getButtonStyles } from '../../utils/buttonStyles';
import { useModSettings, useUpdateMod, useDeleteVariant } from '../../hooks/useMods';
import { createVariant } from '../../services/mods/modVariantsApi';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.md};
  padding: ${spacing.md};
  background: ${colors.bgTertiary};
  border-radius: 4px;
  border: 1px solid ${colors.border};
  margin-top: ${spacing.md};
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${spacing.md};
`;

const Title = styled.h3`
  font-size: 1rem;
  font-weight: 600;
  color: ${colors.text};
  margin: 0;
`;

const VariantsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.md};
`;

const VariantCard = styled.div<{ $isIncomplete?: boolean }>`
  padding: ${spacing.md};
  background: ${props => props.$isIncomplete ? `${colors.warning}10` : colors.bg};
  border: 1px solid ${props => props.$isIncomplete ? colors.warning : colors.border};
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  gap: ${spacing.md};
`;

const VariantHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${spacing.md};
`;

const VariantName = styled.span`
  font-weight: 600;
  color: ${colors.accent};
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.xs};
`;

const Label = styled.label`
  font-weight: 500;
  color: ${colors.text};
  font-size: 0.875rem;
`;

const Input = styled.input<{ $hasError?: boolean }>`
  padding: ${spacing.sm} ${spacing.md};
  background: ${colors.bgSecondary};
  border: 1px solid ${props => props.$hasError ? colors.warning : colors.border};
  border-radius: 4px;
  color: ${colors.text};
  font-size: 0.875rem;
  
  &:focus {
    border-color: ${colors.accent};
    outline: none;
  }
`;

const Button = styled.button<{ $variant?: 'primary' | 'secondary' | 'danger' }>`
  ${props => getButtonStyles(props.$variant || 'primary')}
  font-size: 0.875rem;
  padding: ${spacing.xs} ${spacing.md};
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: ${spacing.sm};
  align-items: center;
`;

const AddVariantSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.md};
  padding: ${spacing.md};
  background: ${colors.bg};
  border: 1px dashed ${colors.border};
  border-radius: 4px;
`;

const InfoText = styled.div`
  font-size: 0.75rem;
  color: ${colors.textMuted};
  font-style: italic;
`;

const EmptyState = styled.div`
  padding: ${spacing.md};
  text-align: center;
  color: ${colors.textMuted};
  font-size: 0.875rem;
`;

const ErrorText = styled.div`
  font-size: 0.75rem;
  color: ${colors.danger};
  margin-top: 2px;
`;

interface VersionVariantManagerProps {
    version: ModVersion;
    modSlug: string;
    existingVariants: ModVariant[];
    onVariantCreated?: () => void;
    isLoading?: boolean;
}

interface VariantWithFile extends Partial<ModVariant> {
    variantId: string;
    name: string;
    description?: string;
    file?: File;
    isNew?: boolean;
}

export function VersionVariantManager({ 
    version,
    modSlug,
    existingVariants,
    onVariantCreated,
    isLoading = false 
}: VersionVariantManagerProps) {
    const { data: settings } = useModSettings();
    const updateMod = useUpdateMod();
    const deleteVariantMutation = useDeleteVariant();
    
    const [showAddForm, setShowAddForm] = useState(false);
    const [newVariant, setNewVariant] = useState<VariantWithFile>({
        variantId: `temp-${Date.now()}`,
        name: '',
        description: '',
        isNew: true,
    });
    const [variantFile, setVariantFile] = useState<File | null>(null);
    const [uploadingFor, setUploadingFor] = useState<string | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const uploadFileRefs = useRef<Record<string, HTMLInputElement>>({});

    const validateVariant = (variant: VariantWithFile, file: File | null): boolean => {
        const newErrors: Record<string, string> = {};
        
        if (!variant.name || variant.name.trim().length === 0) {
            newErrors[`${variant.variantId}-name`] = 'Variant name is required';
        }
        
        // File is REQUIRED for variant creation
        if (!file) {
            newErrors[`${variant.variantId}-file`] = 'Variant file is required';
        }
        
        setErrors(prev => ({ ...prev, ...newErrors }));
        return Object.keys(newErrors).length === 0;
    };

    const handleAddVariant = async () => {
        if (!validateVariant(newVariant, variantFile)) {
            return;
        }
        
        setSaving(true);
        try {
            // Step 1: Create variant metadata
            const result = await createVariant(modSlug, {
                name: newVariant.name.trim(),
                description: newVariant.description?.trim() || '',
                parentVersionId: version.versionId,
            });
            
            // Step 2: Upload variant file using updateMod with variantFiles
            if (variantFile && result.variant) {
                await updateMod.mutateAsync({
                    slug: modSlug,
                    updates: {
                        variants: existingVariants.concat([result.variant]), // Include all variants
                    },
                    variantFiles: {
                        [result.variant.variantId]: variantFile,
                    },
                });
            }
            
            // Reset form
            setNewVariant({
                variantId: `temp-${Date.now()}`,
                name: '',
                description: '',
                isNew: true,
            });
            setVariantFile(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            setShowAddForm(false);
            setErrors({});
            
            // Notify parent to refetch data
            onVariantCreated?.();
        } catch (error) {
            console.error('[VersionVariantManager] Failed to create variant:', error);
            setErrors({
                'general': error instanceof Error ? error.message : 'Failed to create variant'
            });
        } finally {
            setSaving(false);
        }
    };
    
    const handleDeleteVariant = async (variantId: string, variantName: string) => {
        if (!confirm(`Are you sure you want to delete the variant "${variantName}"? This will delete all versions of this variant.`)) {
            return;
        }
        
        try {
            await deleteVariantMutation.mutateAsync({
                modId: modSlug, // Actually uses slug, not modId
                variantId,
            });
            onVariantCreated?.(); // Refetch
        } catch (error) {
            console.error('[VersionVariantManager] Failed to delete variant:', error);
        }
    };
    
    const handleUploadNewVersion = async (variantId: string, file: File | null) => {
        if (!file) {
            setErrors({ [`${variantId}-upload`]: 'Please select a file' });
            return;
        }
        
        setUploadingFor(variantId);
        try {
            await updateMod.mutateAsync({
                slug: modSlug,
                updates: {
                    variants: existingVariants, // Keep existing variants
                },
                variantFiles: {
                    [variantId]: file,
                },
            });
            
            // Clear file input
            if (uploadFileRefs.current[variantId]) {
                uploadFileRefs.current[variantId].value = '';
            }
            
            onVariantCreated?.(); // Refetch
        } catch (error) {
            console.error('[VersionVariantManager] Failed to upload variant version:', error);
            setErrors({
                [`${variantId}-upload`]: error instanceof Error ? error.message : 'Failed to upload'
            });
        } finally {
            setUploadingFor(null);
        }
    };

    const versionVariants = existingVariants.filter(v => v.parentVersionId === version.versionId);

    return (
        <Container>
            <Header>
                <Title>Variants for v{version.version}</Title>
                <ButtonGroup>
                    {!showAddForm && (
                        <Button 
                            $variant="primary" 
                            onClick={() => setShowAddForm(true)}
                            disabled={isLoading || saving}
                        >
                            ✚ Add Variant
                        </Button>
                    )}
                </ButtonGroup>
            </Header>

            <InfoText>
                Variants are tied to this specific version. Use variants for different mod loaders (Forge, Fabric, etc.) or platform-specific builds.
            </InfoText>

            {errors['general'] && (
                <ErrorText style={{ padding: spacing.sm, background: `${colors.danger}20`, borderRadius: '4px' }}>
                    {errors['general']}
                </ErrorText>
            )}

            {versionVariants.length === 0 && !showAddForm && (
                <EmptyState>
                    No variants for this version yet. Click &lsquo;Add Variant&rsquo; to create one.
                </EmptyState>
            )}

            {/* Existing variants */}
            {versionVariants.length > 0 && (
                <VariantsList>
                    {versionVariants.map(variant => (
                        <VariantCard key={variant.variantId}>
                            <VariantHeader>
                                <VariantName>{variant.name}</VariantName>
                                <ButtonGroup>
                                    <Button
                                        $variant="danger"
                                        onClick={() => handleDeleteVariant(variant.variantId, variant.name)}
                                        disabled={deleteVariantMutation.isPending}
                                    >
                                        Delete
                                    </Button>
                                </ButtonGroup>
                            </VariantHeader>
                            <InfoText>
                                {variant.versionCount || 0} version(s) • {variant.totalDownloads || 0} downloads
                            </InfoText>
                            {variant.description && (
                                <InfoText>{variant.description}</InfoText>
                            )}
                            
                            {/* Upload new variant version */}
                            <FormGroup style={{ marginTop: spacing.md }}>
                                <Label>Upload New Version for this Variant</Label>
                                <Input
                                    type="file"
                                    ref={(el) => {
                                        if (el) uploadFileRefs.current[variant.variantId] = el;
                                    }}
                                    accept={settings?.allowedFileExtensions.join(',') || '.lua,.js,.java,.jar,.zip,.json,.txt,.xml,.yaml,.yml'}
                                    onChange={(e) => {
                                        const file = e.target.files?.[0] || null;
                                        if (file) {
                                            handleUploadNewVersion(variant.variantId, file);
                                        }
                                    }}
                                    disabled={uploadingFor === variant.variantId}
                                />
                                {uploadingFor === variant.variantId && (
                                    <InfoText>Uploading...</InfoText>
                                )}
                                {errors[`${variant.variantId}-upload`] && (
                                    <ErrorText>{errors[`${variant.variantId}-upload`]}</ErrorText>
                                )}
                            </FormGroup>
                        </VariantCard>
                    ))}
                </VariantsList>
            )}

            {/* Add new variant form */}
            {showAddForm && (
                <AddVariantSection>
                    <Label>Add New Variant</Label>
                    
                    <FormGroup>
                        <Label>Variant Name *</Label>
                        <Input
                            type="text"
                            value={newVariant.name}
                            onChange={(e) => setNewVariant({ ...newVariant, name: e.target.value })}
                            placeholder="e.g., Forge, Fabric, Quilt"
                            $hasError={!!errors[`${newVariant.variantId}-name`]}
                            disabled={saving}
                        />
                        {errors[`${newVariant.variantId}-name`] && (
                            <ErrorText>{errors[`${newVariant.variantId}-name`]}</ErrorText>
                        )}
                    </FormGroup>

                    <FormGroup>
                        <MarkdownEditor
                            label="Description (optional)"
                            value={newVariant.description || ''}
                            onChange={(value: string) => setNewVariant({ ...newVariant, description: value })}
                            placeholder="Describe this variant..."
                            height={120}
                            preview="edit"
                        />
                    </FormGroup>
                    
                    <FormGroup>
                        <Label>Variant File * (REQUIRED)</Label>
                        <Input
                            ref={fileInputRef}
                            type="file"
                            required
                            accept={settings?.allowedFileExtensions.join(',') || '.lua,.js,.java,.jar,.zip,.json,.txt,.xml,.yaml,.yml'}
                            onChange={(e) => setVariantFile(e.target.files?.[0] || null)}
                            $hasError={!!errors[`${newVariant.variantId}-file`]}
                            disabled={saving}
                        />
                        {variantFile && (
                            <InfoText>Selected: {variantFile.name} ({(variantFile.size / 1024 / 1024).toFixed(2)} MB)</InfoText>
                        )}
                        {errors[`${newVariant.variantId}-file`] && (
                            <ErrorText>{errors[`${newVariant.variantId}-file`]}</ErrorText>
                        )}
                        {!variantFile && (
                            <InfoText style={{ fontSize: '0.75rem', color: colors.textMuted }}>
                                Allowed: {settings?.allowedFileExtensions.join(', ') || '.lua, .js, .java, .jar, .zip, .json, .txt, .xml, .yaml, .yml'}
                            </InfoText>
                        )}
                    </FormGroup>

                    <ButtonGroup>
                        <Button
                            $variant="secondary"
                            onClick={() => {
                                setShowAddForm(false);
                                setNewVariant({
                                    variantId: `temp-${Date.now()}`,
                                    name: '',
                                    description: '',
                                    isNew: true,
                                });
                                setVariantFile(null);
                                if (fileInputRef.current) {
                                    fileInputRef.current.value = '';
                                }
                                setErrors({});
                            }}
                            disabled={saving}
                        >
                            Cancel
                        </Button>
                        <Button
                            $variant="primary"
                            onClick={handleAddVariant}
                            disabled={saving}
                        >
                            {saving ? 'Creating...' : 'Create Variant'}
                        </Button>
                    </ButtonGroup>
                </AddVariantSection>
            )}
        </Container>
    );
}
