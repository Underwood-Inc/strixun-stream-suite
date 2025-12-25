/**
 * Mod management form component
 * Allows updating mod metadata and deleting mods
 */

import { useState } from 'react';
import styled from 'styled-components';
import { colors, spacing } from '../../theme';
import type { ModMetadata, ModUpdateRequest, ModCategory, ModVisibility } from '../../types/mod';

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

const ButtonGroup = styled.div`
  display: flex;
  gap: ${spacing.md};
  margin-top: ${spacing.md};
`;

const Button = styled.button<{ variant?: 'primary' | 'danger' | 'secondary'; disabled?: boolean }>`
  padding: ${spacing.md} ${spacing.lg};
  border-radius: 4px;
  font-weight: 500;
  cursor: ${({ disabled }) => disabled ? 'not-allowed' : 'pointer'};
  transition: all 0.2s ease;
  
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
      case 'danger':
        return `
          background: ${colors.danger};
          color: white;
          
          &:hover {
            background: #d32f2f;
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

interface ModManageFormProps {
    mod: ModMetadata;
    onUpdate: (updates: ModUpdateRequest) => void;
    onDelete: () => void;
    isLoading: boolean;
}

export function ModManageForm({ mod, onUpdate, onDelete, isLoading }: ModManageFormProps) {
    const [title, setTitle] = useState(mod.title);
    const [description, setDescription] = useState(mod.description);
    const [category, setCategory] = useState<ModCategory>(mod.category);
    const [tags, setTags] = useState(mod.tags.join(', '));
    const [visibility, setVisibility] = useState<ModVisibility>(mod.visibility);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onUpdate({
            title,
            description,
            category,
            tags: tags.split(',').map(t => t.trim()).filter(Boolean),
            visibility,
        });
    };

    return (
        <Form onSubmit={handleSubmit}>
            <FormGroup>
                <Label>Title</Label>
                <Input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                />
            </FormGroup>

            <FormGroup>
                <Label>Description</Label>
                <TextArea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />
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

            <FormGroup>
                <Label>Visibility</Label>
                <Select value={visibility} onChange={(e) => setVisibility(e.target.value as ModVisibility)}>
                    <option value="public">Public</option>
                    <option value="unlisted">Unlisted</option>
                    <option value="private">Private</option>
                </Select>
            </FormGroup>

            <ButtonGroup>
                <Button type="submit" disabled={isLoading}>
                    {isLoading ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button type="button" variant="danger" onClick={onDelete} disabled={isLoading}>
                    Delete Mod
                </Button>
            </ButtonGroup>
        </Form>
    );
}

