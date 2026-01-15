/**
 * Display Name Editor Component
 * 
 * A reusable, agnostic component for editing display names with:
 * - Integration with random name generator
 * - Client-side validation (no numbers, dashes allowed, max words and chars from constants)
 * - Proper error handling and user feedback
 * - API integration for updating display names
 * 
 * This component is designed to be used across different projects in the codebase.
 * 
 * @example
 * ```tsx
 * <DisplayNameEditor
 *   currentDisplayName="Order Fierce"
 *   onUpdate={(newName) => console.log('Updated to:', newName)}
 *   apiEndpoint="/customer/display-name"
 * />
 * ```
 * 
 * Authentication is handled automatically via HttpOnly cookies
 */

import { useState, useCallback } from 'react';
import styled from 'styled-components';
import { colors, spacing } from '../../theme';
import { getButtonStyles } from '../../utils/buttonStyles';
import { generateRandomName } from '../../utils/nameGenerator';
import { DISPLAY_NAME_MIN_LENGTH, DISPLAY_NAME_MAX_LENGTH, DISPLAY_NAME_MAX_WORDS } from '../../../../shared-config/display-name-constants';

const EditorContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.sm};
`;

const EditorRow = styled.div`
  display: flex;
  gap: ${spacing.sm};
  align-items: flex-start;
`;

const Input = styled.input<{ $hasError?: boolean; $isReadOnly?: boolean }>`
  flex: 1;
  padding: ${spacing.sm} ${spacing.md};
  border: 1px solid ${({ $hasError }) => $hasError ? colors.danger : colors.border};
  border-radius: 4px;
  background: ${colors.bgSecondary};
  color: ${colors.text};
  font-size: 1rem;
  font-family: inherit;
  
  &:focus {
    outline: none;
    border-color: ${({ $hasError }) => $hasError ? colors.danger : colors.accent};
    box-shadow: 0 0 0 2px ${({ $hasError }) => $hasError ? `${colors.danger}40` : `${colors.accent}40`};
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  /* Make read-only inputs clickable to enter edit mode */
  &[readonly] {
    cursor: ${({ $isReadOnly }) => $isReadOnly ? 'pointer' : 'text'};
    
    &:hover:not(:disabled) {
      border-color: ${colors.accent};
    }
  }
`;

const Button = styled.button`
  ${getButtonStyles('secondary')}
  white-space: nowrap;
  font-size: 0.875rem;
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const PrimaryButton = styled.button`
  ${getButtonStyles('primary')}
  white-space: nowrap;
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const ErrorMessage = styled.div`
  color: ${colors.danger};
  font-size: 0.875rem;
  margin-top: ${spacing.xs};
`;

const SuccessMessage = styled.div`
  color: ${colors.success || colors.accent};
  font-size: 0.875rem;
  margin-top: ${spacing.xs};
`;

const HelpText = styled.div`
  color: ${colors.textMuted};
  font-size: 0.75rem;
  margin-top: ${spacing.xs};
`;

/**
 * Client-side validation for display names
 * Matches server-side validation rules:
 * - Min-max characters (configurable via constants)
 * - Letters, spaces, and dashes only (no numbers, no other special characters)
 * - Dashes allowed within words (e.g., "Swift-Bold")
 * - Must start with a letter
 * - Maximum words (to support dash-separated names, configurable via constants)
 * - No consecutive spaces
 */
function validateDisplayName(name: string): { valid: boolean; error?: string } {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Display name is required' };
  }
  
  const trimmed = name.trim();
  
  if (trimmed.length < DISPLAY_NAME_MIN_LENGTH) {
    return { valid: false, error: `Display name must be at least ${DISPLAY_NAME_MIN_LENGTH} characters` };
  }
  
  if (trimmed.length > DISPLAY_NAME_MAX_LENGTH) {
    return { valid: false, error: `Display name must be ${DISPLAY_NAME_MAX_LENGTH} characters or less` };
  }
  
  // Check for numbers
  if (/\d/.test(trimmed)) {
    return { valid: false, error: 'Display name cannot contain numbers' };
  }
  
  // Check for special characters (only letters, spaces, and dashes allowed)
  if (!/^[a-zA-Z\s-]+$/.test(trimmed)) {
    return { valid: false, error: 'Display name can only contain letters, spaces, and dashes' };
  }
  
  // Must start with a letter
  if (!/^[a-zA-Z]/.test(trimmed)) {
    return { valid: false, error: 'Display name must start with a letter' };
  }
  
  // Ensure dashes are only within words (not at start/end or between spaces)
  if (trimmed.startsWith('-') || trimmed.endsWith('-') || /\s-\s/.test(trimmed) || /-\s-/.test(trimmed)) {
    return { valid: false, error: 'Dashes can only be used within words (e.g., "Swift-Bold")' };
  }
  
  // Check word count (max 8 words) - dash-separated words like "Swift-Bold" count as one word
  const words = trimmed.split(/\s+/).filter(w => w.length > 0);
  if (words.length > 8) {
    return { valid: false, error: 'Display name can have a maximum of 8 words' };
  }
  
  if (words.length === 0) {
    return { valid: false, error: 'Display name must contain at least one word' };
  }
  
  // Check for consecutive spaces
  if (/\s{2,}/.test(trimmed)) {
    return { valid: false, error: 'Display name cannot have consecutive spaces' };
  }
  
  return { valid: true };
}

/**
 * Sanitize display name input (remove invalid characters)
 * Keeps letters, spaces, and dashes (for dash-separated names)
 */
function sanitizeInput(value: string): string {
  // Remove numbers and special characters, keep only letters, spaces, and dashes
  return value
    .replace(/[^a-zA-Z\s-]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^-+|-+$/g, '') // Remove dashes at start/end
    .replace(/\s-+\s/g, ' ') // Remove dashes between spaces
    .substring(0, DISPLAY_NAME_MAX_LENGTH);
}

interface DisplayNameEditorProps {
  /** Current display name value */
  currentDisplayName: string | null | undefined;
  /** Callback when display name is successfully updated */
  onUpdate: (newDisplayName: string) => void | Promise<void>;
  /** API endpoint for updating display name (e.g., '/customer/display-name') */
  apiEndpoint: string;
  /** Optional: Custom API base URL (defaults to AUTH_API_URL) */
  apiBaseUrl?: string;
  /** Optional: Custom error handler */
  onError?: (error: string) => void;
  /** Optional: Show help text */
  showHelpText?: boolean;
  /** Optional: Disable the editor */
  disabled?: boolean;
}

export function DisplayNameEditor({
  currentDisplayName,
  onUpdate,
  apiEndpoint,
  apiBaseUrl,
  onError,
  showHelpText = true,
  disabled = false,
}: DisplayNameEditorProps) {
  const [displayName, setDisplayName] = useState(currentDisplayName || '');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Get API base URL
  const getApiBaseUrl = useCallback(() => {
    if (apiBaseUrl) return apiBaseUrl;
    
    // Default to AUTH_API_URL pattern
    // CRITICAL: In local development, ALWAYS use Vite proxy, never external URLs
    // Use proxy in development (via Vite), direct URL in production
    // E2E tests can override with VITE_AUTH_API_URL to use direct local worker URLs
    const AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL 
      ? import.meta.env.VITE_AUTH_API_URL  // Explicit URL override (for E2E tests)
      : (import.meta.env.DEV 
        ? '/auth-api'  // Vite proxy in development
        : 'https://auth.idling.app');  // Production default
    
    return AUTH_API_URL;
  }, [apiBaseUrl]);

  // Handle input change with sanitization
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const sanitized = sanitizeInput(value);
    setDisplayName(sanitized);
    setValidationError(null);
    setError(null);
    setSuccess(null);
    
    // Real-time validation
    if (sanitized && sanitized !== currentDisplayName) {
      const validation = validateDisplayName(sanitized);
      if (!validation.valid) {
        setValidationError(validation.error || 'Invalid display name');
      }
    }
  }, [currentDisplayName]);

  // Generate random name
  const handleGenerateRandom = useCallback(() => {
    // Generate name without numbers (to match validation rules)
    const randomName = generateRandomName(false);
    setDisplayName(randomName);
    setValidationError(null);
    setError(null);
    setSuccess(null);
    
    // Validate the generated name
    const validation = validateDisplayName(randomName);
    if (!validation.valid) {
      setValidationError(validation.error || 'Generated name is invalid');
    }
  }, []);

  // Save display name
  const handleSave = useCallback(async () => {
    const trimmed = displayName.trim();
    
    // Validate before sending
    const validation = validateDisplayName(trimmed);
    if (!validation.valid) {
      setValidationError(validation.error || 'Invalid display name');
      return;
    }

    // Don't save if unchanged
    if (trimmed === currentDisplayName) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);
    setValidationError(null);

    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}${apiEndpoint}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          // HttpOnly cookie is sent automatically with credentials: 'include'
        },
        credentials: 'include', // Send HttpOnly auth_token cookie
        body: JSON.stringify({ displayName: trimmed }),
      });

      const data = await response.json() as unknown;

      if (!response.ok) {
        const errorData = data as { detail?: string; error?: string };
        const errorMsg = errorData.detail || errorData.error || 'Failed to update display name';
        setError(errorMsg);
        onError?.(errorMsg);
        setIsSaving(false);
        return;
      }

      // Success!
      setSuccess('Display name updated successfully');
      setIsEditing(false);
      await onUpdate(trimmed);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update display name';
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsSaving(false);
    }
  }, [displayName, currentDisplayName, apiEndpoint, getApiBaseUrl, onUpdate, onError]);

  // Cancel editing
  const handleCancel = useCallback(() => {
    setDisplayName(currentDisplayName || '');
    setIsEditing(false);
    setError(null);
    setSuccess(null);
    setValidationError(null);
  }, [currentDisplayName]);

  // Start editing
  const handleEdit = useCallback(() => {
    setIsEditing(true);
    setDisplayName(currentDisplayName || '');
    setError(null);
    setSuccess(null);
    setValidationError(null);
  }, [currentDisplayName]);

  if (!isEditing) {
    return (
      <EditorContainer>
        <EditorRow>
          <Input
            value={currentDisplayName || 'Not set'}
            readOnly
            disabled={disabled}
            $isReadOnly={true}
            onClick={disabled ? undefined : handleEdit}
            title={disabled ? 'Display name editing is disabled' : 'Click to edit display name'}
          />
          <Button onClick={handleEdit} disabled={disabled}>
            Edit
          </Button>
        </EditorRow>
        {showHelpText && (
          <HelpText>
            Display names can be up to {DISPLAY_NAME_MAX_LENGTH} characters, contain letters, spaces, and dashes (e.g., &quot;Swift-Bold&quot;), and have a maximum of {DISPLAY_NAME_MAX_WORDS} words.
          </HelpText>
        )}
      </EditorContainer>
    );
  }

  return (
    <EditorContainer>
      <EditorRow>
        <Input
          value={displayName}
          onChange={handleInputChange}
          placeholder="Enter display name"
          $hasError={!!validationError || !!error}
          disabled={isSaving || disabled}
          maxLength={DISPLAY_NAME_MAX_LENGTH}
        />
        <Button
          onClick={handleGenerateRandom}
          disabled={isSaving || disabled}
          title="Generate a random display name"
        >
          Random
        </Button>
        <PrimaryButton
          onClick={handleSave}
          disabled={isSaving || !!validationError || disabled || displayName.trim() === currentDisplayName}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </PrimaryButton>
        <Button
          onClick={handleCancel}
          disabled={isSaving || disabled}
        >
          Cancel
        </Button>
      </EditorRow>
      
      {validationError && <ErrorMessage>{validationError}</ErrorMessage>}
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {success && <SuccessMessage>{success}</SuccessMessage>}
      
      {showHelpText && !validationError && !error && (
        <HelpText>
          Display names can be up to {DISPLAY_NAME_MAX_LENGTH} characters, contain letters, spaces, and dashes (e.g., &quot;Swift-Bold&quot;), and have a maximum of {DISPLAY_NAME_MAX_WORDS} words.
        </HelpText>
      )}
    </EditorContainer>
  );
}
