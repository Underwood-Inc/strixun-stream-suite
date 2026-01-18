/**
 * Version Variant Manager Component
 * Manages variants for a specific mod version
 * Replaces the centralized variant management with per-version management
 */

import { useState } from 'react';
import styled from 'styled-components';
import { colors, spacing } from '../../theme';
import type { ModVariant, ModVersion } from '../../types/mod';
import { MarkdownEditor } from '../common/MarkdownEditor';
import { FileUploader } from './FileUploader';
import { getButtonStyles } from '../../utils/buttonStyles';
import { useModSettings } from '../../hooks/useMods';
import { createVariant } from '../../services/mods/modVariantsApi';
import { uploadVariantVersion } from '../../services/mods/modsApi';

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
    const [showAddForm, setShowAddForm] = useState(false);
    const [newVariant, setNewVariant] = useState<VariantWithFile>({
        variantId: `temp-${Date.now()}`,
        name: '',
        description: '',
        isNew: true,
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    const validateVariant = (variant: VariantWithFile): boolean => {
        const newErrors: Record<string, string> = {};
        
        if (!variant.name || variant.name.trim().length === 0) {
            newErrors[`${variant.variantId}-name`] = 'Variant name is required';
        }
        
        // Note: File is NOT required for variant creation
        // Files are uploaded separately as variant versions
        
        setErrors(prev => ({ ...prev, ...newErrors }));
        return Object.keys(newErrors).length === 0;
    };

    const handleAddVariant = async () => {
        if (!validateVariant(newVariant)) {
            return;
        }
        
        setSaving(true);
        try {
            // Create variant via API
            await createVariant(modSlug, {
                name: newVariant.name.trim(),
                description: newVariant.description?.trim() || '',
                parentVersionId: version.versionId,
            });
            
            // Reset form
            setNewVariant({
                variantId: `temp-${Date.now()}`,
                name: '',
                description: '',
                isNew: true,
            });
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

                    <InfoText>
                        Note: Variant files are uploaded separately after creating the variant. Create the variant first, then upload files as variant versions.
                    </InfoText>

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
