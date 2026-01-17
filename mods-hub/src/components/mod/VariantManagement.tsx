/**
 * Variant management component
 * Lists all variants for a mod with actions to manage versions
 */

import { useState } from 'react';
import styled from 'styled-components';
import { colors, spacing } from '../../theme';
import type { ModVariant, VariantVersion } from '../../types/mod';
import { getButtonStyles } from '../../utils/buttonStyles';
import { getCardStyles } from '../../utils/sharedStyles';
import { VariantVersionList } from './VariantVersionList';
import { VariantVersionUpload } from './VariantVersionUpload';
import { MarkdownContent } from '../common/MarkdownContent';
import { useVariantVersions, useDeleteModVersion, useUpdateMod } from '../../hooks/useMods';
import type { VariantVersionUploadRequest } from '../../types/mod';

const Container = styled.div`
  ${getCardStyles('default')}
  display: flex;
  flex-direction: column;
  gap: ${spacing.lg};
`;

const Title = styled.h2`
  font-size: 1.5rem;
  font-weight: 600;
  color: ${colors.text};
  margin: 0;
`;

const VariantsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.md};
`;

const VariantCard = styled.div`
  ${getCardStyles('default')}
  display: flex;
  flex-direction: column;
  gap: ${spacing.md};
`;

const VariantHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: ${spacing.md};
`;

const VariantInfo = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: ${spacing.xs};
`;

const VariantName = styled.h3`
  font-size: 1.125rem;
  font-weight: 600;
  color: ${colors.text};
  margin: 0;
`;

const VariantDescription = styled.div`
  font-size: 0.875rem;
  color: ${colors.textSecondary};
  margin: 0;
  line-height: 1.5;
  max-height: 300px;
  overflow: hidden;
`;

const VariantMeta = styled.div`
  display: flex;
  gap: ${spacing.sm};
  font-size: 0.75rem;
  color: ${colors.textMuted};
  flex-wrap: wrap;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: ${spacing.sm};
  align-items: center;
`;

const Button = styled.button<{ $variant?: 'primary' | 'secondary' }>`
  ${props => getButtonStyles(props.$variant || 'primary')}
  font-size: 0.875rem;
  padding: ${spacing.xs} ${spacing.md};
`;

const ExpandButton = styled.button`
  background: none;
  border: none;
  color: ${colors.textSecondary};
  font-size: 1rem;
  cursor: pointer;
  padding: ${spacing.xs};
  display: flex;
  align-items: center;
  transition: transform 0.2s ease, color 0.2s ease;
  
  &:hover {
    color: ${colors.text};
  }
`;

const ExpandedContent = styled.div<{ $isExpanded: boolean }>`
  max-height: ${props => props.$isExpanded ? '5000px' : '0'};
  overflow: hidden;
  transition: max-height 0.3s ease;
  border-top: ${props => props.$isExpanded ? `1px solid ${colors.border}` : 'none'};
  padding-top: ${props => props.$isExpanded ? spacing.md : '0'};
`;

const EmptyState = styled.div`
  padding: ${spacing.xl};
  text-align: center;
  color: ${colors.textMuted};
  font-size: 0.875rem;
  background: ${colors.bgTertiary};
  border-radius: 4px;
`;

const LoadingState = styled.div`
  padding: ${spacing.md};
  text-align: center;
  color: ${colors.textSecondary};
  font-size: 0.875rem;
`;

interface VariantManagementProps {
    modSlug: string;
    modId: string;
    variants: ModVariant[];
}

export function VariantManagement({ modSlug, modId, variants }: VariantManagementProps) {
    const [expandedVariants, setExpandedVariants] = useState<Set<string>>(new Set());
    const [uploadingVariant, setUploadingVariant] = useState<string | null>(null);
    
    const deleteVersion = useDeleteModVersion();
    const updateMod = useUpdateMod();

    const toggleVariant = (variantId: string) => {
        setExpandedVariants(prev => {
            const next = new Set(prev);
            if (next.has(variantId)) {
                next.delete(variantId);
            } else {
                next.add(variantId);
            }
            return next;
        });
    };

    const handleUploadVersion = async (
        variantId: string, 
        data: { file: File; metadata: VariantVersionUploadRequest }
    ) => {
        try {
            // Find the variant to preserve its metadata
            const variant = variants.find(v => v.variantId === variantId);
            if (!variant) {
                console.error('[VariantManagement] Variant not found:', variantId);
                setUploadingVariant(null);
                return;
            }
            
            // Use updateMod to upload the variant file
            // Pass the variant file in variantFiles object
            await updateMod.mutateAsync({
                slug: modSlug,
                updates: {
                    // No metadata changes, just uploading a new variant version
                    variants: [variant], // Include existing variant metadata
                },
                variantFiles: {
                    [variantId]: data.file, // New version file
                },
            });
            
            setUploadingVariant(null);
        } catch (error) {
            console.error('[VariantManagement] Upload failed:', error);
            setUploadingVariant(null);
        }
    };

    const handleDeleteVersion = async (_variantId: string, version: VariantVersion) => {
        try {
            // UNIFIED SYSTEM: Use deleteModVersion for variant versions (they're stored as ModVersion with variantId)
            await deleteVersion.mutateAsync({
                modId,
                versionId: version.variantVersionId,
            });
        } catch {
            // Error handled by mutation
        }
    };

    if (variants.length === 0) {
        return (
            <Container>
                <Title>Variant Management</Title>
                <EmptyState>
                    No variants available for this mod yet.
                </EmptyState>
            </Container>
        );
    }

    return (
        <Container>
            <Title>Variant Management ({variants.length})</Title>
            <VariantsList>
                {variants.map((variant) => {
                    const isExpanded = expandedVariants.has(variant.variantId);
                    const isUploading = uploadingVariant === variant.variantId;
                    
                    return (
                        <VariantCard key={variant.variantId}>
                            <VariantHeader>
                                <VariantInfo>
                                    <VariantName>{variant.name}</VariantName>
                                    {variant.description && (
                                        <VariantDescription>
                                            <MarkdownContent content={variant.description} />
                                        </VariantDescription>
                                    )}
                                    <VariantMeta>
                                        <span>{variant.versionCount} version{variant.versionCount !== 1 ? 's' : ''}</span>
                                        <span>•</span>
                                        <span>{variant.totalDownloads} total downloads</span>
                                        <span>•</span>
                                        <span>Created: {new Date(variant.createdAt).toLocaleDateString()}</span>
                                    </VariantMeta>
                                </VariantInfo>
                                <ButtonGroup>
                                    <Button
                                        onClick={() => setUploadingVariant(isUploading ? null : variant.variantId)}
                                    >
                                        {isUploading ? 'Cancel Upload' : 'Upload Version'}
                                    </Button>
                                    <ExpandButton
                                        onClick={() => toggleVariant(variant.variantId)}
                                        style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                                        aria-label={isExpanded ? 'Collapse' : 'Expand'}
                                    >
                                        ▼
                                    </ExpandButton>
                                </ButtonGroup>
                            </VariantHeader>
                            
                            {isUploading && (
                                <VariantVersionUpload
                                    variantName={variant.name}
                                    onSubmit={(data) => handleUploadVersion(variant.variantId, data)}
                                    onCancel={() => setUploadingVariant(null)}
                                    isLoading={false}
                                />
                            )}
                            
                            <ExpandedContent $isExpanded={isExpanded}>
                                <VariantVersionsLoader
                                    modSlug={modSlug}
                                    variantId={variant.variantId}
                                    variantName={variant.name}
                                    onDeleteVersion={(version) => handleDeleteVersion(variant.variantId, version)}
                                />
                            </ExpandedContent>
                        </VariantCard>
                    );
                })}
            </VariantsList>
        </Container>
    );
}

/**
 * Loader component for variant versions (only loads when expanded)
 */
function VariantVersionsLoader({ 
    modSlug, 
    variantId, 
    variantName,
    onDeleteVersion
}: { 
    modSlug: string;
    variantId: string; 
    variantName: string;
    onDeleteVersion: (version: VariantVersion) => void;
}) {
    const { data, isLoading, error } = useVariantVersions(modSlug, variantId);

    if (isLoading) {
        return <LoadingState>Loading versions...</LoadingState>;
    }

    if (error) {
        return (
            <div style={{ 
                padding: spacing.md, 
                background: `${colors.danger}20`, 
                color: colors.danger, 
                borderRadius: 4 
            }}>
                Failed to load versions: {(error as Error).message}
            </div>
        );
    }

    return (
        <VariantVersionList
            modSlug={modSlug}
            variantId={variantId}
            variantName={variantName}
            versions={data?.versions || []}
            canManage={true}
            onDelete={onDeleteVersion}
        />
    );
}
