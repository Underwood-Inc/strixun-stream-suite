/**
 * Mod upload form component
 * Form for uploading new mods with file and metadata
 */

import { useState, useRef } from 'react';
import styled from 'styled-components';
import { colors, spacing } from '../../theme';
import type { ModUploadRequest, ModCategory, ModVisibility } from '../../types/mod';

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${spacing.lg};
  background: ${colors.bgSecondary};
  border: 1px solid ${colors.border};
  border-radius: 8px;
  padding: ${spacing.xl};
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

const TextArea = styled.textarea`
  padding: ${spacing.sm} ${spacing.md};
  background: ${colors.bg};
  border: 1px solid ${colors.border};
  border-radius: 4px;
  color: ${colors.text};
  font-size: 0.875rem;
  min-height: 100px;
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
  padding: ${spacing.md} ${spacing.lg};
  background: ${({ disabled }) => disabled ? colors.border : colors.accent};
  color: ${colors.bg};
  border-radius: 4px;
  font-weight: 500;
  cursor: ${({ disabled }) => disabled ? 'not-allowed' : 'pointer'};
  transition: background 0.2s ease;
  
  &:hover:not(:disabled) {
    background: ${colors.accentHover};
  }
`;

const FileInfo = styled.div`
  font-size: 0.875rem;
  color: ${colors.textSecondary};
  margin-top: ${spacing.xs};
`;

interface ModUploadFormProps {
    onSubmit: (data: {
        file: File;
        metadata: ModUploadRequest;
        thumbnail?: File;
    }) => void;
    isLoading: boolean;
}

export function ModUploadForm({ onSubmit, isLoading }: ModUploadFormProps) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState<ModCategory>('script');
    const [tags, setTags] = useState('');
    const [version, setVersion] = useState('1.0.0');
    const [changelog, setChangelog] = useState('');
    const [gameVersions, setGameVersions] = useState('');
    const [visibility, setVisibility] = useState<ModVisibility>('public');
    const [file, setFile] = useState<File | null>(null);
    const [thumbnail, setThumbnail] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const thumbnailInputRef = useRef<HTMLInputElement>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) return;

        const metadata: ModUploadRequest = {
            title,
            description,
            category,
            tags: tags.split(',').map(t => t.trim()).filter(Boolean),
            version,
            changelog,
            gameVersions: gameVersions.split(',').map(v => v.trim()).filter(Boolean),
            visibility,
        };

        onSubmit({ file, metadata, thumbnail: thumbnail || undefined });
    };

    return (
        <Form onSubmit={handleSubmit}>
            <FormGroup>
                <Label>Mod File *</Label>
                <FileInput
                    ref={fileInputRef}
                    type="file"
                    required
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                {file && <FileInfo>Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</FileInfo>}
            </FormGroup>

            <FormGroup>
                <Label>Title *</Label>
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
                />
            </FormGroup>

            <FormGroup>
                <Label>Category *</Label>
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
                    placeholder="tag1, tag2, tag3"
                />
            </FormGroup>

            <FormGroup>
                <Label>Version *</Label>
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
                <Label>Visibility *</Label>
                <Select value={visibility} onChange={(e) => setVisibility(e.target.value as ModVisibility)}>
                    <option value="public">Public</option>
                    <option value="unlisted">Unlisted</option>
                    <option value="private">Private</option>
                </Select>
            </FormGroup>

            <FormGroup>
                <Label>Thumbnail (optional)</Label>
                <FileInput
                    ref={thumbnailInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => setThumbnail(e.target.files?.[0] || null)}
                />
                {thumbnail && <FileInfo>Selected: {thumbnail.name}</FileInfo>}
            </FormGroup>

            <Button type="submit" disabled={isLoading || !file}>
                {isLoading ? 'Uploading...' : 'Upload Mod'}
            </Button>
        </Form>
    );
}

