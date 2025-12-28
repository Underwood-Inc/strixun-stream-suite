/**
 * Admin Settings Page
 * Manage system-wide settings like allowed file types
 */

import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { colors, spacing } from '../theme';
import { useAdminSettings, useUpdateAdminSettings } from '../hooks/useMods';
import { AdminNavigation } from '../components/admin/AdminNavigation';

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
  background: ${colors.bgSecondary};
  border: 1px solid ${colors.border};
  border-radius: 8px;
  padding: ${spacing.xl};
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
  padding: 2px 4px;
  background: ${colors.danger};
  color: ${colors.bg};
  border: none;
  border-radius: 2px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: background 0.2s ease;
  
  &:hover {
    background: ${colors.danger}dd;
  }
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary'; disabled?: boolean }>`
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
    }
  }}
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

    useEffect(() => {
        if (settings) {
            setExtensions([...settings.allowedFileExtensions]);
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
        updateSettings.mutate({ allowedFileExtensions: extensions });
    };

    const handleReset = () => {
        if (settings) {
            setExtensions([...settings.allowedFileExtensions]);
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
                        <Button variant="secondary" onClick={handleAddExtension}>
                            Add
                        </Button>
                    </div>
                    <InfoText>Enter extension with or without leading dot (e.g., "lua" or ".lua")</InfoText>
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
                        variant="primary"
                        onClick={handleSave}
                        disabled={updateSettings.isPending}
                    >
                        {updateSettings.isPending ? 'Saving...' : 'Save Changes'}
                    </Button>
                    <Button
                        variant="secondary"
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

