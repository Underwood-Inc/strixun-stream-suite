/**
 * Admin Settings Page
 * Manage system-wide settings like allowed file types
 */

import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { colors, spacing } from '../theme';
import { useAdminSettings, useUpdateAdminSettings } from '../hooks/useMods';
import { AdminNavigation } from '../components/admin/AdminNavigation';
import { getButtonStyles } from '../utils/buttonStyles';
import { getCardStyles } from '../utils/sharedStyles';

const PageContainer = styled.div`
  max-width: 1000px;
  margin: 0 auto;
  padding: ${spacing.xl};
`;

const Title = styled.h1`
  font-size: 2rem;
  font-weight: 700;
  color: ${colors.text};
  margin-bottom: ${spacing.lg};
`;

const Section = styled.div`
  ${getCardStyles('default')}
  margin-bottom: ${spacing.lg};
`;

const SectionTitle = styled.h2`
  font-size: 1.5rem;
  font-weight: 600;
  color: ${colors.text};
  margin-bottom: ${spacing.md};
`;

const SectionDescription = styled.p`
  color: ${colors.textSecondary};
  font-size: 0.875rem;
  margin-bottom: ${spacing.lg};
`;

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

const ExtensionsList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${spacing.sm};
  margin-top: ${spacing.sm};
`;

const ExtensionTag = styled.div`
  padding: ${spacing.xs} ${spacing.sm};
  background: ${colors.bg};
  border: 1px solid ${colors.border};
  border-radius: 4px;
  font-size: 0.875rem;
  color: ${colors.text};
  display: flex;
  align-items: center;
  gap: ${spacing.xs};
`;

const RemoveButton = styled.button`
  ${getButtonStyles('danger')}
  font-size: 0.75rem;
  padding: 2px 4px;
`;

const Button = styled.button<{ $variant?: 'primary' | 'secondary'; disabled?: boolean }>`
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
  margin-top: ${spacing.lg};
`;

const InfoText = styled.p`
  color: ${colors.textSecondary};
  font-size: 0.875rem;
  margin-top: ${spacing.xs};
`;

const ToggleContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing.md};
  margin-bottom: ${spacing.md};
`;

const ToggleLabel = styled.label`
  font-weight: 500;
  color: ${colors.text};
  font-size: 0.875rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: ${spacing.sm};
`;

const ToggleSwitch = styled.input`
  width: 48px;
  height: 24px;
  appearance: none;
  background: ${colors.bgTertiary};
  border: 1px solid ${colors.border};
  border-radius: 12px;
  position: relative;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:checked {
    background: ${colors.accent};
    border-color: ${colors.accent};
  }
  
  &::before {
    content: '';
    position: absolute;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: ${colors.text};
    top: 2px;
    left: 2px;
    transition: all 0.2s ease;
  }
  
  &:checked::before {
    left: calc(100% - 20px);
    background: ${colors.bg};
  }
`;

const Loading = styled.div`
  text-align: center;
  padding: ${spacing.xxl};
  color: ${colors.textSecondary};
`;

export function AdminSettingsPage() {
    const { data: settings, isLoading } = useAdminSettings();
    const updateSettings = useUpdateAdminSettings();
    const [extensions, setExtensions] = useState<string[]>([]);
    const [newExtension, setNewExtension] = useState('');
    const [uploadsEnabled, setUploadsEnabled] = useState(true);

    useEffect(() => {
        if (settings) {
            setExtensions([...settings.allowedFileExtensions]);
            setUploadsEnabled(settings.uploadsEnabled !== false); // Default to true if undefined
        }
    }, [settings]);

    const handleAddExtension = () => {
        const ext = newExtension.trim();
        if (!ext) return;
        
        // Ensure it starts with a dot
        const normalizedExt = ext.startsWith('.') ? ext : `.${ext}`;
        
        // Check if already exists
        if (extensions.includes(normalizedExt.toLowerCase())) {
            return;
        }
        
        setExtensions([...extensions, normalizedExt.toLowerCase()]);
        setNewExtension('');
    };

    const handleRemoveExtension = (ext: string) => {
        setExtensions(extensions.filter(e => e !== ext));
    };

    const handleSave = () => {
        updateSettings.mutate({ 
            allowedFileExtensions: extensions,
            uploadsEnabled: uploadsEnabled 
        });
    };

    const handleReset = () => {
        if (settings) {
            setExtensions([...settings.allowedFileExtensions]);
            setUploadsEnabled(settings.uploadsEnabled !== false);
        }
    };

    if (isLoading) {
        return (
            <PageContainer>
                <AdminNavigation />
                <Loading>Loading settings...</Loading>
            </PageContainer>
        );
    }

    return (
        <PageContainer>
            <AdminNavigation />
            <Title>Admin Settings</Title>

            <Section>
                <SectionTitle>Upload Control</SectionTitle>
                <SectionDescription>
                    Enable or disable mod uploads globally. When disabled, no users (including super admins) will be able to upload new mods or versions.
                </SectionDescription>

                <ToggleContainer>
                    <ToggleSwitch
                        type="checkbox"
                        id="uploadsEnabled"
                        checked={uploadsEnabled}
                        onChange={(e) => setUploadsEnabled(e.target.checked)}
                    />
                    <ToggleLabel htmlFor="uploadsEnabled">
                        {uploadsEnabled ? 'Uploads Enabled' : 'Uploads Disabled'}
                    </ToggleLabel>
                </ToggleContainer>

                <InfoText>
                    {uploadsEnabled 
                        ? 'Users with upload permission can upload mods and versions.'
                        : 'All mod uploads are currently disabled. Users will see an error message when attempting to upload.'}
                </InfoText>

                <ButtonGroup>
                    <Button
                        $variant="primary"
                        onClick={handleSave}
                        disabled={updateSettings.isPending}
                    >
                        {updateSettings.isPending ? 'Saving...' : 'Save Changes'}
                    </Button>
                    <Button
                        $variant="secondary"
                        onClick={handleReset}
                        disabled={updateSettings.isPending || !settings}
                    >
                        Reset
                    </Button>
                </ButtonGroup>
            </Section>

            <Section>
                <SectionTitle>Allowed File Types</SectionTitle>
                <SectionDescription>
                    Configure which file extensions are allowed for mod uploads. Extensions must start with a dot (e.g., .lua, .js).
                </SectionDescription>

                <FormGroup>
                    <Label>Add File Extension</Label>
                    <div style={{ display: 'flex', gap: spacing.sm }}>
                        <Input
                            type="text"
                            value={newExtension}
                            onChange={(e) => setNewExtension(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddExtension();
                                }
                            }}
                            placeholder=".lua, .js, .zip, etc."
                        />
                        <Button $variant="secondary" onClick={handleAddExtension}>
                            Add
                        </Button>
                    </div>
                    <InfoText>Enter extension with or without leading dot (e.g., &quot;lua&quot; or &quot;.lua&quot;)</InfoText>
                </FormGroup>

                <FormGroup>
                    <Label>Allowed Extensions ({extensions.length})</Label>
                    {extensions.length === 0 ? (
                        <InfoText>No extensions configured. Add extensions above.</InfoText>
                    ) : (
                        <ExtensionsList>
                            {extensions.map((ext) => (
                                <ExtensionTag key={ext}>
                                    {ext}
                                    <RemoveButton
                                        type="button"
                                        onClick={() => handleRemoveExtension(ext)}
                                    >
                                        ×
                                    </RemoveButton>
                                </ExtensionTag>
                            ))}
                        </ExtensionsList>
                    )}
                </FormGroup>

                <ButtonGroup>
                    <Button
                        $variant="primary"
                        onClick={handleSave}
                        disabled={updateSettings.isPending}
                    >
                        {updateSettings.isPending ? 'Saving...' : 'Save Changes'}
                    </Button>
                    <Button
                        $variant="secondary"
                        onClick={handleReset}
                        disabled={updateSettings.isPending || !settings}
                    >
                        Reset
                    </Button>
                </ButtonGroup>
            </Section>
        </PageContainer>
    );
}

