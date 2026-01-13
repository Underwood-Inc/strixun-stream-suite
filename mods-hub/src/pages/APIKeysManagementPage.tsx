/**
 * API Keys Management Page
 * Allows customers to manage their API keys and configure SSO settings
 */

import { useState, useEffect } from 'react';
import styled from 'styled-components';
import APIKeySSOConfigModal from '../components/admin/APIKeySSOConfigModal';
import type { APIKeyData } from '../services/apiKeysApi';
import { listAPIKeys } from '../services/apiKeysApi';

export default function APIKeysManagementPage() {
    const [apiKeys, setApiKeys] = useState<APIKeyData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedKey, setSelectedKey] = useState<APIKeyData | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const loadApiKeys = async () => {
        setIsLoading(true);
        setError(null);
        
        try {
            const data = await listAPIKeys();
            setApiKeys(data.keys);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load API keys');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadApiKeys();
    }, []);

    const handleConfigureSSO = (key: APIKeyData) => {
        setSelectedKey(key);
        setIsModalOpen(true);
    };

    const handleModalClose = () => {
        setIsModalOpen(false);
        setSelectedKey(null);
    };

    const handleModalSuccess = () => {
        loadApiKeys(); // Reload keys to show updated SSO config
    };

    const getSSOStatusLabel = (key: APIKeyData): string => {
        if (!key.ssoConfig) return 'Not Configured';
        
        switch (key.ssoConfig.isolationMode) {
            case 'none':
                return key.ssoConfig.globalSsoEnabled ? 'Global SSO' : 'No Isolation';
            case 'selective':
                return `Selective (${key.ssoConfig.allowedKeyIds.length} keys)`;
            case 'complete':
                return 'Isolated';
            default:
                return 'Unknown';
        }
    };

    const getSSOStatusColor = (key: APIKeyData): string => {
        if (!key.ssoConfig) return 'var(--text-muted)';
        
        switch (key.ssoConfig.isolationMode) {
            case 'none':
                return 'var(--success)';
            case 'selective':
                return 'var(--warning)';
            case 'complete':
                return 'var(--danger)';
            default:
                return 'var(--text-muted)';
        }
    };

    return (
        <Container>
            <Header>
                <HeaderContent>
                    <Title>API Keys Management</Title>
                    <Subtitle>
                        Manage your API keys and configure inter-tenant SSO communication settings.
                    </Subtitle>
                </HeaderContent>
            </Header>

            <Content>
                {isLoading ? (
                    <LoadingState>Loading API keys...</LoadingState>
                ) : error ? (
                    <ErrorState>
                        <ErrorTitle>Failed to load API keys</ErrorTitle>
                        <ErrorMessage>{error}</ErrorMessage>
                        <RetryButton onClick={loadApiKeys}>Retry</RetryButton>
                    </ErrorState>
                ) : apiKeys.length === 0 ? (
                    <EmptyState>
                        <EmptyIcon>🔑</EmptyIcon>
                        <EmptyTitle>No API Keys Found</EmptyTitle>
                        <EmptyMessage>
                            You haven't created any API keys yet. API keys are used for multi-tenant
                            identification and enable you to build your own SSO ecosystems.
                        </EmptyMessage>
                    </EmptyState>
                ) : (
                    <KeysGrid>
                        {apiKeys.map((key) => (
                            <KeyCard key={key.keyId}>
                                <KeyCardHeader>
                                    <KeyName>{key.name}</KeyName>
                                    <KeyStatus status={key.status}>
                                        {key.status === 'active' ? '✓ Active' : '✗ Inactive'}
                                    </KeyStatus>
                                </KeyCardHeader>

                                <KeyCardBody>
                                    <KeyInfo>
                                        <KeyInfoLabel>Key ID:</KeyInfoLabel>
                                        <KeyInfoValue>{key.keyId}</KeyInfoValue>
                                    </KeyInfo>

                                    <KeyInfo>
                                        <KeyInfoLabel>Created:</KeyInfoLabel>
                                        <KeyInfoValue>
                                            {new Date(key.createdAt).toLocaleDateString()}
                                        </KeyInfoValue>
                                    </KeyInfo>

                                    {key.lastUsed && (
                                        <KeyInfo>
                                            <KeyInfoLabel>Last Used:</KeyInfoLabel>
                                            <KeyInfoValue>
                                                {new Date(key.lastUsed).toLocaleDateString()}
                                            </KeyInfoValue>
                                        </KeyInfo>
                                    )}

                                    <KeyInfo>
                                        <KeyInfoLabel>SSO Mode:</KeyInfoLabel>
                                        <SSOStatus color={getSSOStatusColor(key)}>
                                            {getSSOStatusLabel(key)}
                                        </SSOStatus>
                                    </KeyInfo>
                                </KeyCardBody>

                                <KeyCardFooter>
                                    <ConfigureButton onClick={() => handleConfigureSSO(key)}>
                                        Configure SSO
                                    </ConfigureButton>
                                </KeyCardFooter>
                            </KeyCard>
                        ))}
                    </KeysGrid>
                )}
            </Content>

            {selectedKey && (
                <APIKeySSOConfigModal
                    apiKey={selectedKey}
                    isOpen={isModalOpen}
                    onClose={handleModalClose}
                    onSuccess={handleModalSuccess}
                />
            )}
        </Container>
    );
}

// Styled Components
const Container = styled.div`
    min-height: 100vh;
    background: var(--background);
`;

const Header = styled.header`
    background: var(--card);
    border-bottom: 1px solid var(--border);
    padding: 32px 24px;
`;

const HeaderContent = styled.div`
    max-width: 1200px;
    margin: 0 auto;
`;

const Title = styled.h1`
    margin: 0 0 8px 0;
    font-size: 32px;
    font-weight: 700;
    color: var(--text);
`;

const Subtitle = styled.p`
    margin: 0;
    font-size: 16px;
    color: var(--text-muted);
    line-height: 1.5;
`;

const Content = styled.main`
    max-width: 1200px;
    margin: 0 auto;
    padding: 32px 24px;
`;

const KeysGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 24px;
`;

const KeyCard = styled.div`
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
    transition: all 0.2s;

    &:hover {
        border-color: var(--primary);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
`;

const KeyCardHeader = styled.div`
    padding: 20px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
`;

const KeyName = styled.h3`
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text);
`;

const KeyStatus = styled.span<{ status: string }>`
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 500;
    background: ${props => props.status === 'active' ? 'var(--success-bg)' : 'var(--danger-bg)'};
    color: ${props => props.status === 'active' ? 'var(--success)' : 'var(--danger)'};
`;

const KeyCardBody = styled.div`
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
`;

const KeyInfo = styled.div`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
`;

const KeyInfoLabel = styled.span`
    font-size: 14px;
    color: var(--text-muted);
    font-weight: 500;
`;

const KeyInfoValue = styled.span`
    font-size: 14px;
    color: var(--text);
    font-family: monospace;
    text-align: right;
`;

const SSOStatus = styled.span<{ color: string }>`
    font-size: 14px;
    color: ${props => props.color};
    font-weight: 600;
`;

const KeyCardFooter = styled.div`
    padding: 16px 20px;
    border-top: 1px solid var(--border);
    background: var(--background);
`;

const ConfigureButton = styled.button`
    width: 100%;
    padding: 10px 16px;
    background: var(--primary);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
        opacity: 0.9;
    }
`;

const LoadingState = styled.div`
    padding: 80px 24px;
    text-align: center;
    color: var(--text-muted);
    font-size: 16px;
`;

const ErrorState = styled.div`
    padding: 80px 24px;
    text-align: center;
`;

const ErrorTitle = styled.h2`
    margin: 0 0 8px 0;
    font-size: 20px;
    color: var(--danger);
`;

const ErrorMessage = styled.p`
    margin: 0 0 24px 0;
    font-size: 14px;
    color: var(--text-muted);
`;

const RetryButton = styled.button`
    padding: 10px 20px;
    background: var(--primary);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
        opacity: 0.9;
    }
`;

const EmptyState = styled.div`
    padding: 80px 24px;
    text-align: center;
`;

const EmptyIcon = styled.div`
    font-size: 64px;
    margin-bottom: 16px;
`;

const EmptyTitle = styled.h2`
    margin: 0 0 8px 0;
    font-size: 24px;
    font-weight: 600;
    color: var(--text);
`;

const EmptyMessage = styled.p`
    margin: 0;
    font-size: 16px;
    color: var(--text-muted);
    line-height: 1.5;
    max-width: 500px;
    margin: 0 auto;
`;
