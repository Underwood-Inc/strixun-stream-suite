/**
 * API Key SSO Configuration Modal
 * Allows customers to configure inter-tenant SSO settings for their API keys
 */

import { useState, useEffect } from 'react';
import styled from 'styled-components';
import type {
    APIKeyData,
    SSOConfig,
    SSOIsolationMode
} from '../../services/apiKeysApi';
import {
    getAPIKeySSOConfig,
    updateAPIKeySSOConfig,
    listAPIKeys
} from '../../services/apiKeysApi';

interface Props {
    apiKey: APIKeyData;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function APIKeySSOConfigModal({ apiKey, isOpen, onClose, onSuccess }: Props) {
    const [isolationMode, setIsolationMode] = useState<SSOIsolationMode>('none');
    const [globalSsoEnabled, setGlobalSsoEnabled] = useState(true);
    const [allowedKeyIds, setAllowedKeyIds] = useState<string[]>([]);
    const [availableKeys, setAvailableKeys] = useState<APIKeyData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load current SSO config and available keys
    useEffect(() => {
        if (!isOpen) return;
        
        const loadData = async () => {
            setIsLoading(true);
            setError(null);
            
            try {
                // Load SSO config for this key
                const configData = await getAPIKeySSOConfig(apiKey.keyId);
                
                if (configData.ssoConfig) {
                    setIsolationMode(configData.ssoConfig.isolationMode);
                    setGlobalSsoEnabled(configData.ssoConfig.globalSsoEnabled);
                    setAllowedKeyIds(configData.ssoConfig.allowedKeyIds);
                }
                
                // Load all available keys for selection
                const keysData = await listAPIKeys();
                // Filter out the current key from available keys
                setAvailableKeys(keysData.keys.filter(k => k.keyId !== apiKey.keyId));
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load SSO configuration');
            } finally {
                setIsLoading(false);
            }
        };
        
        loadData();
    }, [isOpen, apiKey.keyId]);

    const handleSave = async () => {
        setIsSaving(true);
        setError(null);
        
        try {
            const updatedConfig: Partial<SSOConfig> = {
                isolationMode,
                globalSsoEnabled,
                allowedKeyIds: isolationMode === 'selective' ? allowedKeyIds : []
            };
            
            await updateAPIKeySSOConfig(apiKey.keyId, updatedConfig);
            onSuccess();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save SSO configuration');
        } finally {
            setIsSaving(false);
        }
    };

    const handleKeyToggle = (keyId: string) => {
        if (allowedKeyIds.includes(keyId)) {
            setAllowedKeyIds(allowedKeyIds.filter(id => id !== keyId));
        } else {
            setAllowedKeyIds([...allowedKeyIds, keyId]);
        }
    };

    if (!isOpen) return null;

    return (
        <Overlay onClick={onClose}>
            <Modal onClick={(e) => e.stopPropagation()}>
                <ModalHeader>
                    <ModalTitle>SSO Communication Settings</ModalTitle>
                    <ModalSubtitle>{apiKey.name}</ModalSubtitle>
                    <CloseButton onClick={onClose}>✗</CloseButton>
                </ModalHeader>

                <ModalBody>
                    {isLoading ? (
                        <LoadingMessage>Loading configuration...</LoadingMessage>
                    ) : (
                        <>
                            <Section>
                                <SectionTitle>Isolation Mode</SectionTitle>
                                <SectionDescription>
                                    Control how authentication sessions created with this API key can be shared
                                    with other API keys you own.
                                </SectionDescription>

                                <RadioGroup>
                                    <RadioOption>
                                        <RadioInput
                                            type="radio"
                                            id="mode-none"
                                            name="isolationMode"
                                            value="none"
                                            checked={isolationMode === 'none'}
                                            onChange={(e) => setIsolationMode(e.target.value as SSOIsolationMode)}
                                        />
                                        <RadioLabel htmlFor="mode-none">
                                            <RadioTitle>Global SSO (No Isolation)</RadioTitle>
                                            <RadioDescription>
                                                Sessions can be used across ALL your active API keys. This enables
                                                full SSO across all your services.
                                            </RadioDescription>
                                        </RadioLabel>
                                    </RadioOption>

                                    <RadioOption>
                                        <RadioInput
                                            type="radio"
                                            id="mode-selective"
                                            name="isolationMode"
                                            value="selective"
                                            checked={isolationMode === 'selective'}
                                            onChange={(e) => setIsolationMode(e.target.value as SSOIsolationMode)}
                                        />
                                        <RadioLabel htmlFor="mode-selective">
                                            <RadioTitle>Selective SSO</RadioTitle>
                                            <RadioDescription>
                                                Choose specific API keys that can share sessions with this key.
                                                Perfect for creating isolated SSO groups.
                                            </RadioDescription>
                                        </RadioLabel>
                                    </RadioOption>

                                    <RadioOption>
                                        <RadioInput
                                            type="radio"
                                            id="mode-complete"
                                            name="isolationMode"
                                            value="complete"
                                            checked={isolationMode === 'complete'}
                                            onChange={(e) => setIsolationMode(e.target.value as SSOIsolationMode)}
                                        />
                                        <RadioLabel htmlFor="mode-complete">
                                            <RadioTitle>Complete Isolation</RadioTitle>
                                            <RadioDescription>
                                                Sessions ONLY work with this specific API key. No SSO with any other keys.
                                            </RadioDescription>
                                        </RadioLabel>
                                    </RadioOption>
                                </RadioGroup>
                            </Section>

                            {isolationMode === 'selective' && (
                                <Section>
                                    <SectionTitle>Allowed API Keys</SectionTitle>
                                    <SectionDescription>
                                        Select which API keys can share authentication sessions with this key.
                                    </SectionDescription>

                                    {availableKeys.length === 0 ? (
                                        <EmptyState>
                                            No other API keys available. Create more API keys to enable selective SSO.
                                        </EmptyState>
                                    ) : (
                                        <KeysList>
                                            {availableKeys.map((key) => (
                                                <KeyItem key={key.keyId}>
                                                    <Checkbox
                                                        type="checkbox"
                                                        id={`key-${key.keyId}`}
                                                        checked={allowedKeyIds.includes(key.keyId)}
                                                        onChange={() => handleKeyToggle(key.keyId)}
                                                    />
                                                    <KeyLabel htmlFor={`key-${key.keyId}`}>
                                                        <KeyName>{key.name}</KeyName>
                                                        <KeyMeta>
                                                            {key.status === 'active' ? '✓ Active' : '✗ Inactive'} • 
                                                            Created {new Date(key.createdAt).toLocaleDateString()}
                                                        </KeyMeta>
                                                    </KeyLabel>
                                                </KeyItem>
                                            ))}
                                        </KeysList>
                                    )}
                                </Section>
                            )}

                            {error && <ErrorMessage>{error}</ErrorMessage>}
                        </>
                    )}
                </ModalBody>

                <ModalFooter>
                    <CancelButton onClick={onClose} disabled={isSaving}>
                        Cancel
                    </CancelButton>
                    <SaveButton onClick={handleSave} disabled={isLoading || isSaving}>
                        {isSaving ? 'Saving...' : 'Save Configuration'}
                    </SaveButton>
                </ModalFooter>
            </Modal>
        </Overlay>
    );
}

// Styled Components
const Overlay = styled.div`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 99999;
    padding: 20px;
`;

const Modal = styled.div`
    background: var(--card);
    border-radius: 12px;
    max-width: 700px;
    width: 100%;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
`;

const ModalHeader = styled.div`
    padding: 24px;
    border-bottom: 1px solid var(--border);
    position: relative;
`;

const ModalTitle = styled.h2`
    margin: 0;
    font-size: 24px;
    font-weight: 600;
    color: var(--text);
`;

const ModalSubtitle = styled.div`
    margin-top: 4px;
    font-size: 14px;
    color: var(--text-muted);
`;

const CloseButton = styled.button`
    position: absolute;
    top: 20px;
    right: 20px;
    background: none;
    border: none;
    font-size: 24px;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px 8px;
    transition: color 0.2s;

    &:hover {
        color: var(--text);
    }
`;

const ModalBody = styled.div`
    padding: 24px;
    overflow-y: auto;
    flex: 1;
`;

const Section = styled.div`
    margin-bottom: 32px;

    &:last-child {
        margin-bottom: 0;
    }
`;

const SectionTitle = styled.h3`
    margin: 0 0 8px 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text);
`;

const SectionDescription = styled.p`
    margin: 0 0 16px 0;
    font-size: 14px;
    color: var(--text-muted);
    line-height: 1.5;
`;

const RadioGroup = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
`;

const RadioOption = styled.div`
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px;
    border: 2px solid var(--border);
    border-radius: 8px;
    transition: all 0.2s;
    cursor: pointer;

    &:hover {
        border-color: var(--primary);
        background: var(--card-hover);
    }

    &:has(input:checked) {
        border-color: var(--primary);
        background: var(--primary-bg);
    }
`;

const RadioInput = styled.input`
    margin-top: 2px;
    cursor: pointer;
`;

const RadioLabel = styled.label`
    flex: 1;
    cursor: pointer;
`;

const RadioTitle = styled.div`
    font-weight: 600;
    color: var(--text);
    margin-bottom: 4px;
`;

const RadioDescription = styled.div`
    font-size: 13px;
    color: var(--text-muted);
    line-height: 1.4;
`;

const KeysList = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
`;

const KeyItem = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: 6px;
    transition: all 0.2s;

    &:hover {
        background: var(--card-hover);
    }
`;

const Checkbox = styled.input`
    cursor: pointer;
`;

const KeyLabel = styled.label`
    flex: 1;
    cursor: pointer;
`;

const KeyName = styled.div`
    font-weight: 500;
    color: var(--text);
    margin-bottom: 2px;
`;

const KeyMeta = styled.div`
    font-size: 12px;
    color: var(--text-muted);
`;

const EmptyState = styled.div`
    padding: 32px;
    text-align: center;
    color: var(--text-muted);
    font-size: 14px;
    border: 1px dashed var(--border);
    border-radius: 8px;
`;

const LoadingMessage = styled.div`
    padding: 48px;
    text-align: center;
    color: var(--text-muted);
    font-size: 14px;
`;

const ErrorMessage = styled.div`
    margin-top: 16px;
    padding: 12px;
    background: var(--danger-bg);
    color: var(--danger);
    border: 1px solid var(--danger);
    border-radius: 6px;
    font-size: 14px;
`;

const ModalFooter = styled.div`
    padding: 16px 24px;
    border-top: 1px solid var(--border);
    display: flex;
    justify-content: flex-end;
    gap: 12px;
`;

const Button = styled.button`
    padding: 10px 20px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
`;

const CancelButton = styled(Button)`
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text);

    &:hover:not(:disabled) {
        background: var(--card-hover);
    }
`;

const SaveButton = styled(Button)`
    background: var(--primary);
    border: none;
    color: white;

    &:hover:not(:disabled) {
        opacity: 0.9;
    }
`;
