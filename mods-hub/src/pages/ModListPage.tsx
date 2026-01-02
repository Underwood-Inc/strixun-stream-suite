/**
 * Mod list page
 * Displays all available mods with filtering and search
 * Uses virtualized list for efficient rendering
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FixedSizeList as List } from 'react-window';
import { useModsList } from '../hooks/useMods';
import { ModListItem } from '../components/mod/ModListItem';
import { ModCard } from '../components/mod/ModCard';
import { ModFilters } from '../components/mod/ModFilters';
import { ViewToggle, type ViewType } from '../components/mod/ViewToggle';
import { shouldRedirectToLogin } from '../utils/error-messages';
import styled from 'styled-components';
import { colors, spacing } from '../theme';

const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.xl};
  width: 100%;
  height: calc(100vh - 200px);
  min-height: 600px;
`;

const Header = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.md};
  flex-shrink: 0;
`;

const Title = styled.h1`
  font-size: 2rem;
  font-weight: 700;
  color: ${colors.text};
`;

const FiltersContainer = styled.div`
  display: flex;
  gap: ${spacing.md};
  align-items: center;
  flex-wrap: wrap;
  justify-content: space-between;
`;

const HeaderActions = styled.div`
  display: flex;
  gap: ${spacing.md};
  align-items: center;
`;

const ListContainer = styled.div`
  flex: 1;
  min-height: 0;
  background: ${colors.bg};
  border: 1px solid ${colors.border};
  border-radius: 8px;
  overflow: hidden;
`;

const GridContainer = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: ${spacing.md};
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 320px));
  gap: ${spacing.lg};
  background: ${colors.bg};
  border: 1px solid ${colors.border};
  border-radius: 8px;
`;

const Loading = styled.div`
  text-align: center;
  padding: ${spacing.xxl};
  color: ${colors.textSecondary};
`;

const Error = styled.div`
  text-align: center;
  padding: ${spacing.xxl};
  color: ${colors.danger};
  background: ${colors.bgSecondary};
  border: 1px solid ${colors.danger};
  border-radius: 8px;
  margin: ${spacing.lg} 0;
`;

const ErrorTitle = styled.h3`
  margin: 0 0 ${spacing.md} 0;
  font-size: 1.25rem;
  color: ${colors.danger};
`;

const ErrorMessage = styled.p`
  margin: ${spacing.sm} 0;
  color: ${colors.textSecondary};
  font-size: 0.9rem;
`;

const EmptyState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: ${colors.textSecondary};
  font-size: 1rem;
`;

const EndOfListIndicator = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${spacing.xl} ${spacing.lg};
  color: ${colors.textMuted};
  font-size: 0.875rem;
  background: ${colors.bgSecondary};
  border-top: 1px solid ${colors.border};
  font-style: italic;
`;

function getErrorMessage(error: unknown): { title: string; message: string; details?: string } {
    // Safely check if error has a message property
    const errorMessage = (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string')
        ? error.message.toLowerCase()
        : String(error || 'Unknown error').toLowerCase();
    
    if (error && typeof error === 'object') {
        
        // CORS errors
        if (errorMessage.includes('cors') || errorMessage.includes('access-control')) {
            return {
                title: 'Connection Error',
                message: 'Unable to connect to the mods API. This may be a CORS configuration issue.',
                details: 'Please check that the mods API allows requests from this origin.'
            };
        }
        
        // Backend not available errors
        if (errorMessage.includes('backend') && (errorMessage.includes('not available') || errorMessage.includes('not running'))) {
            return {
                title: 'Backend Server Not Running',
                message: 'The mods API server is not available. Please start the backend server.',
                details: 'In development, run: pnpm --filter strixun-mods-api dev (or pnpm dev:api from mods-hub directory)'
            };
        }
        
        // Network errors (including connection refused)
        if (errorMessage.includes('failed to fetch') || errorMessage.includes('network') || 
            errorMessage.includes('unable to connect') || errorMessage.includes('econnrefused')) {
            return {
                title: 'Connection Error',
                message: 'Unable to connect to the mods API server.',
                details: import.meta.env.DEV 
                    ? 'Please ensure the backend server is running: pnpm --filter strixun-mods-api dev'
                    : 'The API server may be down or unreachable. Please try again later.'
            };
        }
        
        // Timeout errors
        if (errorMessage.includes('timeout') || errorMessage.includes('408')) {
            return {
                title: 'Request Timeout',
                message: 'The request took too long to complete.',
                details: import.meta.env.DEV
                    ? 'The backend server may not be running or is unresponsive. Check: pnpm --filter strixun-mods-api dev'
                    : 'The server may be experiencing high load. Please try again in a moment.'
            };
        }
        
        // Rate limit errors
        if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
            return {
                title: 'Rate Limit Exceeded',
                message: 'Too many requests. Please wait a moment and try again.',
                details: 'The API has rate limiting to prevent abuse. Please try again in a few minutes.'
            };
        }
        
        // Generic error
        const message = ('message' in error && typeof error.message === 'string') 
            ? error.message 
            : 'An unexpected error occurred.';
        return {
            title: 'Error Loading Mods',
            message: message,
        };
    }
    
    return {
        title: 'Error Loading Mods',
        message: typeof error === 'string' ? error : 'An unexpected error occurred while loading mods.',
    };
}

const VIEW_STORAGE_KEY = 'mods-browse-view';

export function ModListPage() {
    const [page] = useState(1);
    const navigate = useNavigate();
    const [category, setCategory] = useState<string>('');
    const [search, setSearch] = useState('');
    const [listHeight, setListHeight] = useState(600);
    const containerRef = useRef<HTMLDivElement>(null);
    
    // Load view preference from localStorage, default to 'list'
    const [view, setView] = useState<ViewType>(() => {
        const stored = localStorage.getItem(VIEW_STORAGE_KEY);
        return (stored === 'list' || stored === 'card') ? stored : 'list';
    });
    
    // Persist view preference to localStorage
    const handleViewChange = (newView: ViewType) => {
        setView(newView);
        localStorage.setItem(VIEW_STORAGE_KEY, newView);
    };
    
    const { data, isLoading, error } = useModsList({
        page,
        pageSize: 20,
        category: category || undefined,
        search: search || undefined,
        visibility: 'public',
    });

    // Calculate list height based on available space
    useEffect(() => {
        const updateHeight = () => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const availableHeight = window.innerHeight - rect.top - 100;
                setListHeight(Math.max(400, availableHeight));
            }
        };

        updateHeight();
        window.addEventListener('resize', updateHeight);
        return () => window.removeEventListener('resize', updateHeight);
    }, []);

    const errorInfo = error ? getErrorMessage(error) : null;

    
    // Redirect to login if auth error
    useEffect(() => {
        if (error && shouldRedirectToLogin(error)) {
            setTimeout(() => {
                navigate('/login');
            }, 2000); // Give user time to see the message
        }
    }, [error, navigate]);
    return (
        <PageContainer ref={containerRef}>
            <Header>
                <Title>Browse Mods</Title>
                <FiltersContainer>
                    <ModFilters
                        category={category}
                        search={search}
                        onCategoryChange={setCategory}
                        onSearchChange={setSearch}
                    />
                    <HeaderActions>
                        <ViewToggle view={view} onViewChange={handleViewChange} />
                    </HeaderActions>
                </FiltersContainer>
            </Header>

            {isLoading && <Loading>Loading mods...</Loading>}
            {error && errorInfo && (
                <Error>
                    <ErrorTitle>{errorInfo.title}</ErrorTitle>
                    <ErrorMessage>{errorInfo.message}</ErrorMessage>
                    {errorInfo.details && <ErrorMessage>{errorInfo.details}</ErrorMessage>}
                </Error>
            )}
            
            {data && (
                <>
                    {data.mods.length === 0 ? (
                        <EmptyState>No mods found</EmptyState>
                    ) : view === 'list' ? (
                        <ListContainer>
                            <List
                                height={listHeight}
                                itemCount={data.mods.length + 1}
                                itemSize={110}
                                width="100%"
                            >
                                {({ index, style }) => {
                                    if (index === data.mods.length) {
                                        return (
                                            <div style={{ ...style, paddingTop: spacing.xl, paddingBottom: spacing.xl }}>
                                                <EndOfListIndicator>
                                                    End of mods list — no more mods to display
                                                </EndOfListIndicator>
                                            </div>
                                        );
                                    }
                                    return (
                                        <div style={style}>
                                            <ModListItem mod={data.mods[index]} />
                                        </div>
                                    );
                                }}
                            </List>
                        </ListContainer>
                    ) : (
                        <GridContainer>
                            {data.mods.map((mod) => (
                                <ModCard key={mod.id} mod={mod} />
                            ))}
                            <div style={{ 
                                gridColumn: '1 / -1', 
                                padding: `${spacing.xl} ${spacing.lg}`,
                                textAlign: 'center',
                                color: colors.textMuted,
                                fontSize: '0.875rem',
                                fontStyle: 'italic',
                                background: colors.bgSecondary,
                                borderTop: `1px solid ${colors.border}`,
                                borderRadius: '8px',
                                marginTop: spacing.md
                            }}>
                                End of mods list — no more mods to display
                            </div>
                        </GridContainer>
                    )}
                </>
            )}
        </PageContainer>
    );
}
