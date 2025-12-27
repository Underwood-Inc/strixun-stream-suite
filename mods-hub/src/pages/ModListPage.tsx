/**
 * Mod list page
 * Displays all available mods with filtering and search
 */

import { useState } from 'react';
import { useModsList } from '../hooks/useMods';
import { ModCard } from '../components/mod/ModCard';
import { ModFilters } from '../components/mod/ModFilters';
import styled from 'styled-components';
import { colors, spacing } from '../theme';

const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.xl};
`;

const Header = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.md};
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
`;

const ModsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: ${spacing.lg};
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
        
        // Network errors
        if (errorMessage.includes('failed to fetch') || errorMessage.includes('network')) {
            return {
                title: 'Network Error',
                message: 'Unable to reach the mods API. Please check your internet connection.',
                details: 'If the problem persists, the API server may be down or unreachable.'
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

export function ModListPage() {
    const [page] = useState(1);
    const [category, setCategory] = useState<string>('');
    const [search, setSearch] = useState('');
    
    const { data, isLoading, error } = useModsList({
        page,
        pageSize: 20,
        category: category || undefined,
        search: search || undefined,
        visibility: 'public',
    });

    const errorInfo = error ? getErrorMessage(error) : null;

    return (
        <PageContainer>
            <Header>
                <Title>Browse Mods</Title>
                <FiltersContainer>
                    <ModFilters
                        category={category}
                        search={search}
                        onCategoryChange={setCategory}
                        onSearchChange={setSearch}
                    />
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
                    <ModsGrid>
                        {data.mods.map((mod) => (
                            <ModCard key={mod.modId} mod={mod} />
                        ))}
                    </ModsGrid>
                    {data.mods.length === 0 && (
                        <Loading>No mods found</Loading>
                    )}
                </>
            )}
        </PageContainer>
    );
}

