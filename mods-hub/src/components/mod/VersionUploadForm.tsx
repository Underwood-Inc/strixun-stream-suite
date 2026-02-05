/**
 * Version upload form component
 * Form for uploading new versions to existing mods
 */

import { useState, useRef } from 'react';
import styled from 'styled-components';
import { colors, spacing } from '../../theme';
import type { VersionUploadRequest } from '../../types/mod';
import { useModSettings } from '../../hooks/useMods';
import { getButtonStyles } from '../../utils/buttonStyles';
import { getCardStyles } from '../../utils/sharedStyles';
import { RichTextEditor } from '../common/RichTextEditor';

const Form = styled.form`
  ${getCardStyles('default')}
  display: flex;
  flex-direction: column;
  gap: ${spacing.lg};
`;

const Title = styled.h2`
  font-size: 1.5rem;
  font-weight: 600;
  color: ${colors.text};
  margin-bottom: ${spacing.md};
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.sm};
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

const FileInput = styled.input`
  padding: ${spacing.sm};
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

const Button = styled.button<{ disabled?: boolean }>`
  ${getButtonStyles('primary')}
  
  ${({ disabled }) => disabled && `
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  `}
`;

const FileInfo = styled.div`
  font-size: 0.875rem;
  color: ${colors.textSecondary};
  margin-top: ${spacing.xs};
`;

interface VersionUploadFormProps {
    modId: string;
    onSubmit: (data: {
        file: File;
        metadata: VersionUploadRequest;
    }) => void;
    isLoading: boolean;
}

export function VersionUploadForm({ modId: _modId, onSubmit, isLoading }: VersionUploadFormProps) {
    const { data: settings } = useModSettings();
    const [version, setVersion] = useState('');
    const [changelog, setChangelog] = useState('');
    const [gameVersions, setGameVersions] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) return;

        const metadata: VersionUploadRequest = {
            version,
            changelog,
            gameVersions: gameVersions.split(',').map(v => v.trim()).filter(Boolean),
        };

        onSubmit({ file, metadata });
        
        // Reset form
        setVersion('');
        setChangelog('');
        setGameVersions('');
        setFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <Form onSubmit={handleSubmit}>
            <Title>Upload New Version</Title>
            
            <FormGroup>
                <Label>Version File *</Label>
                <FileInput
                    ref={fileInputRef}
                    type="file"
                    required
                    accept={settings?.allowedFileExtensions.join(',') || '.lua,.js,.java,.jar,.zip,.json,.txt,.xml,.yaml,.yml'}
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                {file && <FileInfo>Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</FileInfo>}
                {!file && (
                    <FileInfo style={{ fontSize: '0.75rem', color: colors.textMuted }}>
                        Allowed: {settings?.allowedFileExtensions.join(', ') || '.lua, .js, .java, .jar, .zip, .json, .txt, .xml, .yaml, .yml'}
                    </FileInfo>
                )}
            </FormGroup>

            <FormGroup>
                <Label>Version Number *</Label>
                <Input
                    type="text"
                    required
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    placeholder="1.0.1"
                />
            </FormGroup>

            <FormGroup>
                <RichTextEditor
                    label="Changelog"
                    value={changelog}
                    onChange={setChangelog}
                    placeholder="What's new in this version? Supports **bold**, *italic*, `code`, lists, and more..."
                    height={200}
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

            <Button type="submit" disabled={isLoading || !file}>
                {isLoading ? 'Uploading...' : 'Upload Version'}
            </Button>
        </Form>
    );
}

