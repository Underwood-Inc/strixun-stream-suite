/**
 * Version Variant Manager Component
 * Manages variants for a specific mod version
 * Replaces the centralized variant management with per-version management
 */

import { useState } from 'react';
import styled from 'styled-components';
import { colors, spacing } from '../../theme';
import type { ModVariant, ModVersion } from '../../types/mod';
import { FileUploader } from './FileUploader';
import { MarkdownEditor } from '../common/MarkdownEditor';
import { useModSettings } from '../../hooks/useMods';
import { getButtonStyles } from '../../utils/buttonStyles';

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

const MAX_MOD_FILE_SIZE = 35 * 1024 * 1024; // 35 MB

interface VersionVariantManagerProps {
    version: ModVersion;
    existingVariants: ModVariant[];
    onSave: (variants: Array<{ variant: Partial<ModVariant>; file?: File }>) => Promise<void>;
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
    existingVariants,
    onSave,
    isLoading = false 
}: VersionVariantManagerProps) {
    const { data: settings } = useModSettings();
    const [showAddForm, setShowAddForm] = useState(false);
    const [variants, setVariants] = useState<VariantWithFile[]>(
        existingVariants
            .filter(v => v.parentVersionId === version.versionId)
            .map(v => ({ ...v, isNew: false }))
    );
    const [newVariant, setNewVariant] = useState<VariantWithFile>({
        variantId: `temp-${Date.now()}`,
        name: '',
        description: '',
        isNew: true,
    });
    const [errors, setErrors] = useState<Record<string, string>>({});

    const validateVariant = (variant: VariantWithFile): boolean => {
        const newErrors: Record<string, string> = {};
        
        if (!variant.name || variant.name.trim().length === 0) {
            newErrors[`${variant.variantId}-name`] = 'Variant name is required';
        }
        
        if (variant.isNew && !variant.file) {
            newErrors[`${variant.variantId}-file`] = 'File is required for new variants';
        }
        
        setErrors(prev => ({ ...prev, ...newErrors }));
        return Object.keys(newErrors).length === 0;
    };

    const handleAddVariant = () => {
        if (!validateVariant(newVariant)) {
            return;
        }
        
        setVariants(prev => [...prev, { ...newVariant, variantId: `variant-${Date.now()}` }]);
        setNewVariant({
            variantId: `temp-${Date.now()}`,
            name: '',
            description: '',
            isNew: true,
        });
        setShowAddForm(false);
        setErrors({});
    };

    const handleRemoveVariant = (variantId: string) => {
        setVariants(prev => prev.filter(v => v.variantId !== variantId));
    };

    const handleVariantChange = (variantId: string, field: keyof VariantWithFile, value: any) => {
        setVariants(prev => prev.map(v => 
            v.variantId === variantId ? { ...v, [field]: value } : v
        ));
        // Clear error for this field
        setErrors(prev => {
            const next = { ...prev };
            delete next[`${variantId}-${field}`];
            return next;
        });
    };

    const handleFileChange = (variantId: string, file: File | null) => {
        handleVariantChange(variantId, 'file', file || undefined);
    };

    const handleSave = async () => {
        // Validate all variants
        const allValid = variants.every(v => validateVariant(v));
        if (!allValid) {
            return;
        }

        // Prepare data for save
        const variantsToSave = variants.map(v => ({
            variant: {
                variantId: v.variantId,
                modId: version.modId,
                parentVersionId: version.versionId, // AUTO-SET to this version!
                name: v.name,
                description: v.description,
                createdAt: v.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                currentVersionId: v.currentVersionId || null,
                versionCount: v.versionCount || 0,
                totalDownloads: v.totalDownloads || 0,
            },
            file: v.file,
        }));

        await onSave(variantsToSave);
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
                            disabled={isLoading}
                        >
                            ✚ Add Variant
                        </Button>
                    )}
                </ButtonGroup>
            </Header>

            <InfoText>
                Variants are tied to this specific version. Use variants for different mod loaders (Forge, Fabric, etc.) or platform-specific builds.
            </InfoText>

            {versionVariants.length === 0 && variants.length === 0 && !showAddForm && (
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
                                <InfoText>
                                    {variant.versionCount || 0} version(s) • {variant.totalDownloads || 0} downloads
                                </InfoText>
                            </VariantHeader>
                            {variant.description && (
                                <InfoText>{variant.description}</InfoText>
                            )}
                        </VariantCard>
                    ))}
                </VariantsList>
            )}

            {/* New variants being added */}
            {variants.length > 0 && (
                <VariantsList>
                    {variants.map(variant => {
                        const hasNameError = !!errors[`${variant.variantId}-name`];
                        const hasFileError = !!errors[`${variant.variantId}-file`];
                        const isIncomplete = hasNameError || hasFileError;

                        return (
                            <VariantCard key={variant.variantId} $isIncomplete={isIncomplete}>
                                <VariantHeader>
                                    <VariantName>{variant.name || 'New Variant'}</VariantName>
                                    <Button
                                        $variant="danger"
                                        onClick={() => handleRemoveVariant(variant.variantId)}
                                    >
                                        Remove
                                    </Button>
                                </VariantHeader>

                                <FormGroup>
                                    <Label>Variant Name *</Label>
                                    <Input
                                        type="text"
                                        value={variant.name}
                                        onChange={(e) => handleVariantChange(variant.variantId, 'name', e.target.value)}
                                        placeholder="e.g., Forge, Fabric, Quilt"
                                        $hasError={hasNameError}
                                    />
                                    {hasNameError && <ErrorText>{errors[`${variant.variantId}-name`]}</ErrorText>}
                                </FormGroup>

                                <FormGroup>
                                    <MarkdownEditor
                                        label="Description (optional)"
                                        value={variant.description || ''}
                                        onChange={(value: string) => handleVariantChange(variant.variantId, 'description', value)}
                                        placeholder="Describe this variant..."
                                        height={120}
                                        preview="edit"
                                    />
                                </FormGroup>

                                <FormGroup>
                                    <Label>Variant File {variant.isNew && '*'}</Label>
                                    <FileUploader
                                        file={variant.file || null}
                                        onFileChange={(file) => handleFileChange(variant.variantId, file)}
                                        maxSize={MAX_MOD_FILE_SIZE}
                                        accept={settings?.allowedFileExtensions.join(',') || '.lua,.js,.java,.jar,.zip,.json,.txt,.xml,.yaml,.yml'}
                                        label={variant.isNew ? 
                                            "Drag and drop variant file here *REQUIRED*" : 
                                            "Drag and drop variant file here (optional)"
                                        }
                                        error={hasFileError ? errors[`${variant.variantId}-file`] : null}
                                    />
                                </FormGroup>
                            </VariantCard>
                        );
                    })}
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
                        <Label>Variant File *</Label>
                        <FileUploader
                            file={newVariant.file || null}
                            onFileChange={(file) => setNewVariant({ ...newVariant, file: file || undefined })}
                            maxSize={MAX_MOD_FILE_SIZE}
                            accept={settings?.allowedFileExtensions.join(',') || '.lua,.js,.java,.jar,.zip,.json,.txt,.xml,.yaml,.yml'}
                            label="Drag and drop variant file here *REQUIRED*"
                            error={errors[`${newVariant.variantId}-file`] || null}
                        />
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
                                setErrors({});
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            $variant="primary"
                            onClick={handleAddVariant}
                        >
                            Add Variant
                        </Button>
                    </ButtonGroup>
                </AddVariantSection>
            )}

            {variants.length > 0 && (
                <ButtonGroup style={{ justifyContent: 'flex-end', marginTop: spacing.md }}>
                    <Button
                        $variant="primary"
                        onClick={handleSave}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Saving...' : 'Save Variants'}
                    </Button>
                </ButtonGroup>
            )}
        </Container>
    );
}
