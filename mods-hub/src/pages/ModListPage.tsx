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
`;

export function ModListPage() {
    const [page, setPage] = useState(1);
    const [category, setCategory] = useState<string>('');
    const [search, setSearch] = useState('');
    
    const { data, isLoading, error } = useModsList({
        page,
        pageSize: 20,
        category: category || undefined,
        search: search || undefined,
        visibility: 'public',
    });

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
            {error && <Error>Failed to load mods: {(error as Error).message}</Error>}
            
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

