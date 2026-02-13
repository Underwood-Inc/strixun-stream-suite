/**
 * Mod management form component
 * Allows updating mod metadata and deleting mods
 */

import { useState } from 'react';
import styled from 'styled-components';
import { colors, spacing } from '../../theme';
import type { ModMetadata, ModUpdateRequest, ModCategory, ModVisibility, ModStatus } from '../../types/mod';
import { FileUploader } from './FileUploader';
import { GamesPicker } from './GamesPicker';
import { formatFileSize, validateFileSize, DEFAULT_UPLOAD_LIMITS } from '@strixun/api-framework';
import { getButtonStyles } from '../../utils/buttonStyles';
import { getBadgeStyles } from '../../utils/sharedStyles';
import { getStatusBadgeType } from '../../utils/badgeHelpers';
import { RichTextEditor } from '../common/RichTextEditor';

// Variant management has been moved to per-version management in ModVersionManagement component
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

const TwoColumnRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${spacing.lg};
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const FullWidthSection = styled.div`
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
  font-weight: 600;
  color: ${colors.text};
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: ${spacing.xs};
`;

const HelpText = styled.span`
  font-size: 0.625rem;
  color: ${colors.textMuted};
  text-transform: none;
  letter-spacing: normal;
  font-weight: 400;
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
    onUpdate: (updates: ModUpdateRequest, thumbnail?: File) => void;
    onDelete: () => void;
    onStatusChange?: (status: ModStatus) => void;
    isLoading: boolean;
}

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
    const [title, setTitle] = useState(mod.title);
    const [summary, setSummary] = useState(mod.summary || '');
    const [description, setDescription] = useState(mod.description);
    const [category, setCategory] = useState<ModCategory>(mod.category);
    const [tags, setTags] = useState(mod.tags.join(', '));
    const [visibility, setVisibility] = useState<ModVisibility>(mod.visibility);
    const [gameId, setGameId] = useState<string | undefined>(mod.gameId);
    const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
    const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(mod.thumbnailUrl || null);
    const [thumbnailError, setThumbnailError] = useState<string | null>(null);

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

    // Check if there are any changes to the mod
    const hasChanges = (): boolean => {
        // Check basic fields
        if (title !== mod.title) return true;
        if (summary !== mod.summary) return true;
        if (description !== mod.description) return true;
        if (category !== mod.category) return true;
        if (visibility !== mod.visibility) return true;
        if (gameId !== mod.gameId) return true;
        
        // Check tags (compare as arrays)
        const currentTags = tags.split(',').map(t => t.trim()).filter(Boolean).sort();
        const originalTags = [...mod.tags].sort();
        if (currentTags.length !== originalTags.length || 
            currentTags.some((tag, i) => tag !== originalTags[i])) {
            return true;
        }
        
        // Check if thumbnail changed
        if (thumbnailFile) return true;
        
        return false;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const updates: ModUpdateRequest = {
            title,
            summary: summary || undefined,
            description,
            category,
            tags: tags.split(',').map(t => t.trim()).filter(Boolean),
            visibility,
            gameId: gameId || undefined,
        };
        
        // No longer pass variant files or deleted variant IDs - variants are managed per-version now
        onUpdate(updates, thumbnailFile || undefined);
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

            {/* Top Section: Thumbnail (left) | Title, Category, Tags (right) */}
            <Header>
                <ThumbnailSection>
                    <Label>Thumbnail (optional)</Label>
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
                        <Label>Summary <HelpText>(max 150 chars - shown in list views)</HelpText></Label>
                        <Input
                            type="text"
                            value={summary}
                            onChange={(e) => setSummary(e.target.value.slice(0, 150))}
                            placeholder="Brief one-liner about your mod..."
                            maxLength={150}
                        />
                        <CharCount $over={summary.length > 150}>{summary.length}/150</CharCount>
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
                </InfoSection>
            </Header>

            {/* Middle Section: Visibility (left) | Associated Game (right) */}
            <TwoColumnRow>
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
            </TwoColumnRow>

            {/* Description: Full width */}
            <FullWidthSection>
                <RichTextEditor
                    label="Description"
                    value={description}
                    onChange={setDescription}
                    placeholder="Describe your mod..."
                    height={300}
                />
            </FullWidthSection>

            <RecommendationSection>
                <RecommendationTitle>
                    ℹ Variant Management Moved
                </RecommendationTitle>
                <RecommendationText>
                    Variants are now managed under each specific mod version in the &quot;Version Management&quot; section below.
                    This allows you to attach variants to the correct version automatically. Scroll down to find the version you want to add variants to and click &quot;Manage Variants&quot;.
                </RecommendationText>
            </RecommendationSection>

            <ButtonGroup>
                <Button type="submit" disabled={isLoading || !hasChanges()}>
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
        </Form>
    );
}

