/**
 * Data Explorer Page
 * Admin interface for browsing KV storage and viewing mod entity hierarchies
 * 
 * Features:
 * - Entity View: Mod hierarchy with versions and variants
 * - KV Browser: Raw key-value pair inspection
 * - Cross-reference links between KV keys and R2 files
 */

import { useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import styled from 'styled-components';
import { colors, spacing } from '../theme';
import { AdminNavigation } from '../components/admin/AdminNavigation';
import { getButtonStyles } from '../utils/buttonStyles';
import { getBadgeStyles } from '../utils/sharedStyles';
import { formatDate, formatTime } from '@strixun/shared-config/date-utils';
import {
    listKVKeys,
    getKVValue,
    getKVPrefixes,
    listModEntities,
    getModEntityDetail,
    type KVKeyInfo,
    type ModEntitySummary,
    type ModEntityDetailResponse,
    type KVKeyValueResponse,
} from '../services/mods';

const PageContainer = styled.div`
    max-width: 1800px;
    margin: 0 auto;
    padding: ${spacing.xl};
    display: flex;
    flex-direction: column;
    gap: ${spacing.lg};
    height: calc(100vh - 80px);
    overflow: hidden;
`;

const PageHeader = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
`;

const Title = styled.h1`
    font-size: 2rem;
    font-weight: 700;
    color: ${colors.text};
    margin: 0;
`;

const Tabs = styled.div`
    display: flex;
    gap: ${spacing.sm};
    border-bottom: 2px solid ${colors.border};
    flex-shrink: 0;
`;

const Tab = styled.button.withConfig({
    shouldForwardProp: (prop) => prop !== 'active',
})<{ active: boolean }>`
    padding: ${spacing.sm} ${spacing.lg};
    background: none;
    border: none;
    border-bottom: 3px solid ${props => props.active ? colors.accent : 'transparent'};
    color: ${props => props.active ? colors.accent : colors.textSecondary};
    font-size: 0.875rem;
    font-weight: ${props => props.active ? 600 : 400};
    cursor: pointer;
    transition: all 0.2s ease;
    margin-bottom: -2px;

    &:hover {
        color: ${colors.accent};
    }
`;

const ContentArea = styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0;
`;

const SplitView = styled.div`
    display: grid;
    grid-template-columns: 350px 1fr;
    gap: ${spacing.lg};
    height: 100%;
    overflow: hidden;
`;

const Panel = styled.div`
    display: flex;
    flex-direction: column;
    background: ${colors.bgSecondary};
    border: 1px solid ${colors.border};
    border-radius: 8px;
    overflow: hidden;
`;

const PanelHeader = styled.div`
    padding: ${spacing.md};
    border-bottom: 1px solid ${colors.border};
    background: ${colors.bgTertiary};
    flex-shrink: 0;
`;

const PanelTitle = styled.h3`
    font-size: 0.875rem;
    font-weight: 600;
    color: ${colors.text};
    margin: 0;
`;

const PanelContent = styled.div`
    flex: 1;
    overflow-y: auto;
    padding: ${spacing.md};
`;

const SearchInput = styled.input`
    width: 100%;
    padding: ${spacing.sm} ${spacing.md};
    border: 1px solid ${colors.border};
    border-radius: 4px;
    background: ${colors.bg};
    color: ${colors.text};
    font-size: 0.875rem;
    margin-top: ${spacing.sm};

    &:focus {
        outline: none;
        border-color: ${colors.accent};
    }
`;

const Select = styled.select`
    width: 100%;
    padding: ${spacing.sm} ${spacing.md};
    border: 1px solid ${colors.border};
    border-radius: 4px;
    background: ${colors.bg};
    color: ${colors.text};
    font-size: 0.875rem;
    cursor: pointer;
    margin-top: ${spacing.sm};

    &:focus {
        outline: none;
        border-color: ${colors.accent};
    }
`;

const Button = styled.button<{ $variant?: 'primary' | 'secondary' | 'danger' }>`
    ${({ $variant = 'primary' }) => getButtonStyles($variant)}
    font-size: 0.75rem;
    padding: ${spacing.xs} ${spacing.sm};
`;

const ListItem = styled.div<{ $selected?: boolean }>`
    padding: ${spacing.sm} ${spacing.md};
    border-bottom: 1px solid ${colors.border};
    cursor: pointer;
    background: ${props => props.$selected ? colors.bgTertiary : 'transparent'};
    transition: background 0.15s ease;

    &:hover {
        background: ${colors.bgTertiary};
    }

    &:last-child {
        border-bottom: none;
    }
`;

const ListItemTitle = styled.div`
    font-size: 0.875rem;
    font-weight: 500;
    color: ${colors.text};
    margin-bottom: ${spacing.xs};
    display: flex;
    align-items: center;
    gap: ${spacing.sm};
`;

const ListItemMeta = styled.div`
    font-size: 0.75rem;
    color: ${colors.textSecondary};
    display: flex;
    gap: ${spacing.md};
`;

const Badge = styled.span<{ $variant?: 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'default' }>`
    ${({ $variant = 'default' }) => getBadgeStyles($variant)}
    font-size: 0.65rem;
`;

const DetailSection = styled.div`
    margin-bottom: ${spacing.lg};
`;

const DetailSectionTitle = styled.h4`
    font-size: 0.875rem;
    font-weight: 600;
    color: ${colors.text};
    margin: 0 0 ${spacing.sm} 0;
    display: flex;
    align-items: center;
    gap: ${spacing.sm};
`;

const DetailCard = styled.div`
    background: ${colors.bgTertiary};
    border: 1px solid ${colors.border};
    border-radius: 6px;
    padding: ${spacing.md};
    margin-bottom: ${spacing.sm};
`;

const DetailRow = styled.div`
    display: flex;
    gap: ${spacing.md};
    margin-bottom: ${spacing.xs};
    font-size: 0.8rem;

    &:last-child {
        margin-bottom: 0;
    }
`;

const DetailLabel = styled.span`
    font-weight: 600;
    color: ${colors.text};
    min-width: 100px;
`;

const DetailValue = styled.span`
    color: ${colors.textSecondary};
    word-break: break-all;
`;

const CodeBlock = styled.pre`
    background: ${colors.bg};
    border: 1px solid ${colors.border};
    border-radius: 4px;
    padding: ${spacing.md};
    font-family: 'Fira Code', 'Monaco', monospace;
    font-size: 0.75rem;
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 400px;
    overflow-y: auto;
    color: ${colors.text};
`;

const KeyLink = styled.button`
    background: none;
    border: none;
    color: ${colors.accent};
    cursor: pointer;
    font-family: monospace;
    font-size: 0.75rem;
    padding: 0;
    text-decoration: underline;

    &:hover {
        color: ${colors.accentHover};
    }
`;

const VersionCard = styled(DetailCard)`
    border-left: 3px solid ${colors.accent};
`;

const VariantCard = styled(DetailCard)`
    margin-left: ${spacing.lg};
    border-left: 3px solid ${colors.warning};
`;

const EmptyState = styled.div`
    text-align: center;
    padding: ${spacing.xl};
    color: ${colors.textSecondary};
`;

const Loading = styled.div`
    text-align: center;
    padding: ${spacing.xl};
    color: ${colors.textSecondary};
`;

const StyledLink = styled(Link)`
    color: ${colors.accent};
    text-decoration: none;

    &:hover {
        text-decoration: underline;
    }
`;

const R2StatusBadge = styled(Badge)<{ $exists: boolean }>`
    ${({ $exists }) => getBadgeStyles($exists ? 'success' : 'danger')}
`;

type TabType = 'entities' | 'kv';

export function DataExplorerPage() {
    const [activeTab, setActiveTab] = useState<TabType>('entities');
    const [selectedModId, setSelectedModId] = useState<string | null>(null);
    const [selectedKVKey, setSelectedKVKey] = useState<string | null>(null);
    const [kvPrefix, setKvPrefix] = useState<string>('');
    const [entitySearch, setEntitySearch] = useState('');
    const [kvSearch, setKvSearch] = useState('');

    // ===== Entity View Queries =====

    const { data: modsData, isLoading: modsLoading } = useQuery({
        queryKey: ['admin-mod-entities', entitySearch],
        queryFn: () => listModEntities({ page: 1, pageSize: 100, search: entitySearch || undefined }),
        enabled: activeTab === 'entities',
    });

    const { data: modDetail, isLoading: modDetailLoading } = useQuery({
        queryKey: ['admin-mod-entity-detail', selectedModId],
        queryFn: () => getModEntityDetail(selectedModId!),
        enabled: !!selectedModId && activeTab === 'entities',
    });

    // ===== KV Browser Queries =====

    const { data: prefixesData } = useQuery({
        queryKey: ['admin-kv-prefixes'],
        queryFn: () => getKVPrefixes(),
        enabled: activeTab === 'kv',
    });

    const { data: kvKeysData, isLoading: kvKeysLoading } = useQuery({
        queryKey: ['admin-kv-keys', kvPrefix, kvSearch],
        queryFn: () => listKVKeys({
            prefix: kvPrefix || undefined,
            limit: 200,
            includePreview: true,
        }),
        enabled: activeTab === 'kv',
    });

    const { data: kvValueData, isLoading: kvValueLoading } = useQuery({
        queryKey: ['admin-kv-value', selectedKVKey],
        queryFn: () => getKVValue(selectedKVKey!),
        enabled: !!selectedKVKey && activeTab === 'kv',
    });

    // ===== Filtered KV Keys =====

    const filteredKvKeys = useMemo(() => {
        if (!kvKeysData?.keys) return [];
        if (!kvSearch) return kvKeysData.keys;
        const search = kvSearch.toLowerCase();
        return kvKeysData.keys.filter(k => 
            k.key.toLowerCase().includes(search) ||
            k.valuePreview?.toLowerCase().includes(search)
        );
    }, [kvKeysData, kvSearch]);

    // ===== Handlers =====

    const handleSelectMod = useCallback((modId: string) => {
        setSelectedModId(modId);
    }, []);

    const handleSelectKVKey = useCallback((key: string) => {
        setSelectedKVKey(key);
    }, []);

    const handleNavigateToKVKey = useCallback((key: string) => {
        setActiveTab('kv');
        setKvPrefix('');
        setSelectedKVKey(key);
    }, []);

    const formatBytes = (bytes: number): string => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    };

    // ===== Entity View Render =====

    const renderEntityView = () => (
        <SplitView>
            <Panel>
                <PanelHeader>
                    <PanelTitle>Mods ({modsData?.total || 0})</PanelTitle>
                    <SearchInput
                        type="text"
                        placeholder="Search mods..."
                        value={entitySearch}
                        onChange={(e) => setEntitySearch(e.target.value)}
                    />
                </PanelHeader>
                <PanelContent>
                    {modsLoading ? (
                        <Loading>Loading mods...</Loading>
                    ) : !modsData?.mods.length ? (
                        <EmptyState>No mods found</EmptyState>
                    ) : (
                        modsData.mods.map((mod: ModEntitySummary) => (
                            <ListItem
                                key={mod.modId}
                                $selected={selectedModId === mod.modId}
                                onClick={() => handleSelectMod(mod.modId)}
                            >
                                <ListItemTitle>
                                    {mod.title}
                                    <Badge $variant={mod.hasR2Thumbnail ? 'success' : 'danger'}>
                                        {mod.hasR2Thumbnail ? 'IMG' : 'NO IMG'}
                                    </Badge>
                                </ListItemTitle>
                                <ListItemMeta>
                                    <span>{mod.versionCount} versions</span>
                                    <span>{mod.variantCount} variants</span>
                                    <span>{mod.status}</span>
                                </ListItemMeta>
                            </ListItem>
                        ))
                    )}
                </PanelContent>
            </Panel>

            <Panel>
                <PanelHeader>
                    <PanelTitle>
                        {selectedModId ? 'Mod Details' : 'Select a mod'}
                    </PanelTitle>
                </PanelHeader>
                <PanelContent>
                    {!selectedModId ? (
                        <EmptyState>Select a mod from the list to view details</EmptyState>
                    ) : modDetailLoading ? (
                        <Loading>Loading mod details...</Loading>
                    ) : !modDetail ? (
                        <EmptyState>Mod not found</EmptyState>
                    ) : (
                        renderModDetail(modDetail)
                    )}
                </PanelContent>
            </Panel>
        </SplitView>
    );

    const renderModDetail = (detail: ModEntityDetailResponse) => (
        <>
            <DetailSection>
                <DetailSectionTitle>
                    Mod Metadata
                    <StyledLink to={`/${detail.mod.slug}`} target="_blank">
                        View Page
                    </StyledLink>
                </DetailSectionTitle>
                <DetailCard>
                    <DetailRow>
                        <DetailLabel>Title:</DetailLabel>
                        <DetailValue>{detail.mod.title}</DetailValue>
                    </DetailRow>
                    <DetailRow>
                        <DetailLabel>Slug:</DetailLabel>
                        <DetailValue>{detail.mod.slug}</DetailValue>
                    </DetailRow>
                    <DetailRow>
                        <DetailLabel>Mod ID:</DetailLabel>
                        <DetailValue style={{ fontFamily: 'monospace' }}>{detail.mod.modId}</DetailValue>
                    </DetailRow>
                    <DetailRow>
                        <DetailLabel>Author:</DetailLabel>
                        <DetailValue>{detail.mod.authorDisplayName || detail.mod.authorId}</DetailValue>
                    </DetailRow>
                    <DetailRow>
                        <DetailLabel>Status:</DetailLabel>
                        <DetailValue>
                            <Badge $variant={detail.mod.status === 'published' ? 'success' : 'warning'}>
                                {detail.mod.status}
                            </Badge>
                        </DetailValue>
                    </DetailRow>
                    <DetailRow>
                        <DetailLabel>Downloads:</DetailLabel>
                        <DetailValue>{detail.mod.downloadCount.toLocaleString()}</DetailValue>
                    </DetailRow>
                    <DetailRow>
                        <DetailLabel>R2 Thumbnail:</DetailLabel>
                        <DetailValue>
                            <R2StatusBadge $exists={!!detail.mod.r2ThumbnailExists}>
                                {detail.mod.r2ThumbnailExists ? 'EXISTS' : 'MISSING'}
                            </R2StatusBadge>
                            {detail.mod.r2ThumbnailKey && (
                                <span style={{ marginLeft: spacing.sm, fontFamily: 'monospace', fontSize: '0.7rem' }}>
                                    {detail.mod.r2ThumbnailKey}
                                </span>
                            )}
                        </DetailValue>
                    </DetailRow>
                </DetailCard>
            </DetailSection>

            <DetailSection>
                <DetailSectionTitle>Versions ({detail.versions.length})</DetailSectionTitle>
                {detail.versions.map((version) => (
                    <div key={version.versionId}>
                        <VersionCard>
                            <DetailRow>
                                <DetailLabel>Version:</DetailLabel>
                                <DetailValue>{version.version}</DetailValue>
                            </DetailRow>
                            <DetailRow>
                                <DetailLabel>Version ID:</DetailLabel>
                                <DetailValue style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
                                    {version.versionId}
                                </DetailValue>
                            </DetailRow>
                            <DetailRow>
                                <DetailLabel>File:</DetailLabel>
                                <DetailValue>
                                    {version.fileName || 'N/A'}
                                    {version.fileSize && ` (${formatBytes(version.fileSize)})`}
                                </DetailValue>
                            </DetailRow>
                            <DetailRow>
                                <DetailLabel>R2 File:</DetailLabel>
                                <DetailValue>
                                    <R2StatusBadge $exists={!!version.r2FileExists}>
                                        {version.r2FileExists ? 'EXISTS' : 'MISSING'}
                                    </R2StatusBadge>
                                </DetailValue>
                            </DetailRow>
                            <DetailRow>
                                <DetailLabel>Downloads:</DetailLabel>
                                <DetailValue>{version.downloadCount.toLocaleString()}</DetailValue>
                            </DetailRow>
                            <DetailRow>
                                <DetailLabel>Created:</DetailLabel>
                                <DetailValue>{formatDate(version.createdAt)}</DetailValue>
                            </DetailRow>
                        </VersionCard>

                        {version.variants.length > 0 && (
                            <div style={{ marginTop: spacing.sm }}>
                                {version.variants.map((variant) => (
                                    <VariantCard key={variant.variantId}>
                                        <DetailRow>
                                            <DetailLabel>Variant:</DetailLabel>
                                            <DetailValue>{variant.name}</DetailValue>
                                        </DetailRow>
                                        <DetailRow>
                                            <DetailLabel>Variant ID:</DetailLabel>
                                            <DetailValue style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
                                                {variant.variantId}
                                            </DetailValue>
                                        </DetailRow>
                                        <DetailRow>
                                            <DetailLabel>File:</DetailLabel>
                                            <DetailValue>
                                                {variant.fileName || 'N/A'}
                                                {variant.fileSize && ` (${formatBytes(variant.fileSize)})`}
                                            </DetailValue>
                                        </DetailRow>
                                        <DetailRow>
                                            <DetailLabel>R2 File:</DetailLabel>
                                            <DetailValue>
                                                <R2StatusBadge $exists={!!variant.r2FileExists}>
                                                    {variant.r2FileExists ? 'EXISTS' : 'MISSING'}
                                                </R2StatusBadge>
                                            </DetailValue>
                                        </DetailRow>
                                    </VariantCard>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </DetailSection>

            <DetailSection>
                <DetailSectionTitle>Related KV Keys ({detail.kvKeys.length})</DetailSectionTitle>
                {detail.kvKeys.map((kv) => (
                    <DetailCard key={kv.key} style={{ padding: spacing.sm }}>
                        <DetailRow>
                            <KeyLink onClick={() => handleNavigateToKVKey(kv.key)}>
                                {kv.key}
                            </KeyLink>
                        </DetailRow>
                        <DetailRow>
                            <DetailValue style={{ fontSize: '0.7rem' }}>
                                <Badge $variant="info">{kv.type}</Badge>
                                <span style={{ marginLeft: spacing.sm }}>{kv.description}</span>
                            </DetailValue>
                        </DetailRow>
                    </DetailCard>
                ))}
            </DetailSection>
        </>
    );

    // ===== KV Browser Render =====

    const renderKVBrowser = () => (
        <SplitView>
            <Panel>
                <PanelHeader>
                    <PanelTitle>KV Keys</PanelTitle>
                    <Select
                        value={kvPrefix}
                        onChange={(e) => {
                            setKvPrefix(e.target.value);
                            setSelectedKVKey(null);
                        }}
                    >
                        <option value="">All Keys</option>
                        {prefixesData?.prefixes.map((p) => (
                            <option key={p.prefix} value={p.prefix}>
                                {p.label} ({p.count}{p.hasMore ? '+' : ''})
                            </option>
                        ))}
                    </Select>
                    <SearchInput
                        type="text"
                        placeholder="Filter keys..."
                        value={kvSearch}
                        onChange={(e) => setKvSearch(e.target.value)}
                    />
                </PanelHeader>
                <PanelContent>
                    {kvKeysLoading ? (
                        <Loading>Loading keys...</Loading>
                    ) : !filteredKvKeys.length ? (
                        <EmptyState>No keys found</EmptyState>
                    ) : (
                        filteredKvKeys.map((key: KVKeyInfo) => (
                            <ListItem
                                key={key.key}
                                $selected={selectedKVKey === key.key}
                                onClick={() => handleSelectKVKey(key.key)}
                            >
                                <ListItemTitle>
                                    {key.entityType && (
                                        <Badge $variant="info">{key.entityType}</Badge>
                                    )}
                                    <span style={{ 
                                        fontFamily: 'monospace', 
                                        fontSize: '0.75rem',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }}>
                                        {key.key}
                                    </span>
                                </ListItemTitle>
                                <ListItemMeta>
                                    {key.valueSize && <span>{formatBytes(key.valueSize)}</span>}
                                    {key.valuePreview && (
                                        <span style={{ 
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            maxWidth: '200px',
                                        }}>
                                            {key.valuePreview}
                                        </span>
                                    )}
                                </ListItemMeta>
                            </ListItem>
                        ))
                    )}
                    {kvKeysData?.hasMore && (
                        <EmptyState>
                            Showing first {filteredKvKeys.length} keys. Use prefix filter to narrow down.
                        </EmptyState>
                    )}
                </PanelContent>
            </Panel>

            <Panel>
                <PanelHeader>
                    <PanelTitle>
                        {selectedKVKey ? 'Key Value' : 'Select a key'}
                    </PanelTitle>
                </PanelHeader>
                <PanelContent>
                    {!selectedKVKey ? (
                        <EmptyState>Select a key from the list to view its value</EmptyState>
                    ) : kvValueLoading ? (
                        <Loading>Loading value...</Loading>
                    ) : !kvValueData ? (
                        <EmptyState>Key not found</EmptyState>
                    ) : (
                        renderKVValue(kvValueData)
                    )}
                </PanelContent>
            </Panel>
        </SplitView>
    );

    const renderKVValue = (data: KVKeyValueResponse) => (
        <>
            <DetailSection>
                <DetailSectionTitle>Key Information</DetailSectionTitle>
                <DetailCard>
                    <DetailRow>
                        <DetailLabel>Key:</DetailLabel>
                        <DetailValue style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                            {data.key}
                        </DetailValue>
                    </DetailRow>
                    <DetailRow>
                        <DetailLabel>Type:</DetailLabel>
                        <DetailValue>
                            <Badge $variant="info">{data.valueType}</Badge>
                            {data.entityType && (
                                <Badge $variant="accent" style={{ marginLeft: spacing.xs }}>
                                    {data.entityType}
                                </Badge>
                            )}
                        </DetailValue>
                    </DetailRow>
                    <DetailRow>
                        <DetailLabel>Size:</DetailLabel>
                        <DetailValue>{formatBytes(data.valueSize)}</DetailValue>
                    </DetailRow>
                    {data.expiration && (
                        <DetailRow>
                            <DetailLabel>Expires:</DetailLabel>
                            <DetailValue>
                                {formatDate(new Date(data.expiration * 1000).toISOString())} {formatTime(new Date(data.expiration * 1000).toISOString())}
                            </DetailValue>
                        </DetailRow>
                    )}
                </DetailCard>
            </DetailSection>

            {data.relatedEntities && data.relatedEntities.length > 0 && (
                <DetailSection>
                    <DetailSectionTitle>Related Entities</DetailSectionTitle>
                    {data.relatedEntities.map((entity, i) => (
                        <DetailCard key={i} style={{ padding: spacing.sm }}>
                            <DetailRow>
                                <Badge $variant="accent">{entity.type}</Badge>
                                <KeyLink 
                                    onClick={() => handleSelectKVKey(entity.key)}
                                    style={{ marginLeft: spacing.sm }}
                                >
                                    {entity.key}
                                </KeyLink>
                            </DetailRow>
                        </DetailCard>
                    ))}
                </DetailSection>
            )}

            <DetailSection>
                <DetailSectionTitle>
                    Value
                    <Button
                        $variant="secondary"
                        onClick={() => {
                            navigator.clipboard.writeText(
                                typeof data.value === 'string' 
                                    ? data.value 
                                    : JSON.stringify(data.value, null, 2)
                            );
                        }}
                    >
                        Copy
                    </Button>
                </DetailSectionTitle>
                <CodeBlock>
                    {typeof data.value === 'string'
                        ? data.value
                        : JSON.stringify(data.value, null, 2)}
                </CodeBlock>
            </DetailSection>
        </>
    );

    return (
        <PageContainer>
            <AdminNavigation />
            <PageHeader>
                <Title>Data Explorer</Title>
            </PageHeader>

            <Tabs>
                <Tab
                    active={activeTab === 'entities'}
                    onClick={() => setActiveTab('entities')}
                >
                    Entity View
                </Tab>
                <Tab
                    active={activeTab === 'kv'}
                    onClick={() => setActiveTab('kv')}
                >
                    KV Browser
                </Tab>
            </Tabs>

            <ContentArea>
                {activeTab === 'entities' && renderEntityView()}
                {activeTab === 'kv' && renderKVBrowser()}
            </ContentArea>
        </PageContainer>
    );
}
