/**
 * Virtualized searchable games picker component
 * Efficiently handles large game lists with search and virtualization
 */

import { useState, useMemo, useCallback } from 'react';
import { FixedSizeList as List } from 'react-window';
import styled from 'styled-components';
import { colors, spacing } from '../../theme';
import { allGames, searchGames, type Game } from '../../data/games';

const PickerContainer = styled.div`
  position: relative;
`;

const SearchInput = styled.input`
  width: 100%;
  padding: ${spacing.sm} ${spacing.md};
  background: ${colors.bg};
  border: 1px solid ${colors.border};
  border-radius: 4px;
  color: ${colors.text};
  font-size: 0.875rem;
  margin-bottom: ${spacing.sm};
  
  &:focus {
    border-color: ${colors.accent};
    outline: none;
  }
`;

const Dropdown = styled.div<{ isOpen: boolean }>`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: ${colors.bgSecondary};
  border: 1px solid ${colors.border};
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 1000;
  max-height: 400px;
  overflow: hidden;
  display: ${({ isOpen }) => isOpen ? 'block' : 'none'};
`;

const SelectedGame = styled.div`
  padding: ${spacing.sm} ${spacing.md};
  background: ${colors.bg};
  border: 1px solid ${colors.border};
  border-radius: 4px;
  color: ${colors.text};
  font-size: 0.875rem;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  &:hover {
    border-color: ${colors.accent};
  }
`;

const SelectedGameName = styled.span`
  color: ${colors.text};
`;

const ClearButton = styled.button`
  padding: ${spacing.xs} ${spacing.sm};
  background: ${colors.danger};
  color: ${colors.bg};
  border: none;
  border-radius: 4px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: background 0.2s ease;
  
  &:hover {
    background: ${colors.danger}dd;
  }
`;

const Placeholder = styled.div`
  color: ${colors.textMuted};
  font-style: italic;
`;

const GameItem = styled.div<{ isSelected: boolean; isHighlighted: boolean }>`
  padding: ${spacing.sm} ${spacing.md};
  cursor: pointer;
  background: ${({ isSelected, isHighlighted }) => 
    isSelected ? `${colors.accent}20` : isHighlighted ? colors.bgTertiary : 'transparent'};
  color: ${({ isSelected }) => isSelected ? colors.accent : colors.text};
  border-left: 3px solid ${({ isSelected }) => isSelected ? colors.accent : 'transparent'};
  transition: all 0.15s ease;
  
  &:hover {
    background: ${colors.bgTertiary};
  }
`;

const GameName = styled.div`
  font-weight: 500;
  font-size: 0.875rem;
  margin-bottom: ${spacing.xs};
`;

const GamePlatforms = styled.div`
  font-size: 0.75rem;
  color: ${colors.textSecondary};
`;

const EmptyState = styled.div`
  padding: ${spacing.lg};
  text-align: center;
  color: ${colors.textMuted};
  font-size: 0.875rem;
`;

interface GamesPickerProps {
    value?: string; // gameId
    onChange: (gameId: string | undefined) => void;
    placeholder?: string;
}

interface GameItemProps {
    index: number;
    style: React.CSSProperties;
    data: {
        games: Game[];
        selectedId?: string;
        highlightedIndex: number;
        onSelect: (game: Game) => void;
        onHighlight: (index: number) => void;
    };
}

function GameItemRenderer({ index, style, data }: GameItemProps) {
    const game = data.games[index];
    const isSelected = game.id === data.selectedId;
    const isHighlighted = index === data.highlightedIndex;

    return (
        <div style={style}>
            <GameItem
                isSelected={isSelected}
                isHighlighted={isHighlighted}
                onClick={() => data.onSelect(game)}
                onMouseEnter={() => data.onHighlight(index)}
            >
                <GameName>{game.name}</GameName>
                {game.platforms && game.platforms.length > 0 && (
                    <GamePlatforms>{game.platforms.join(', ')}</GamePlatforms>
                )}
            </GameItem>
        </div>
    );
}

export function GamesPicker({ value, onChange, placeholder = 'Select a game...' }: GamesPickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [highlightedIndex, setHighlightedIndex] = useState(0);

    // Filter games based on search
    const filteredGames = useMemo(() => {
        return searchQuery.trim() ? searchGames(searchQuery, allGames) : allGames;
    }, [searchQuery]);

    // Get selected game
    const selectedGame = useMemo(() => {
        return value ? allGames.find(g => g.id === value) : undefined;
    }, [value]);

    const handleSelect = useCallback((game: Game) => {
        onChange(game.id);
        setIsOpen(false);
        setSearchQuery('');
        setHighlightedIndex(0);
    }, [onChange]);

    const handleClear = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        onChange(undefined);
    }, [onChange]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (!isOpen) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setIsOpen(true);
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setHighlightedIndex(prev => 
                    prev < filteredGames.length - 1 ? prev + 1 : prev
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
                break;
            case 'Enter':
                e.preventDefault();
                if (filteredGames[highlightedIndex]) {
                    handleSelect(filteredGames[highlightedIndex]);
                }
                break;
            case 'Escape':
                e.preventDefault();
                setIsOpen(false);
                setSearchQuery('');
                break;
        }
    }, [isOpen, filteredGames, highlightedIndex, handleSelect]);

    return (
        <PickerContainer>
            <SelectedGame
                onClick={() => setIsOpen(!isOpen)}
                onKeyDown={handleKeyDown}
                tabIndex={0}
                role="combobox"
                aria-expanded={isOpen}
                aria-haspopup="listbox"
            >
                {selectedGame ? (
                    <>
                        <SelectedGameName>{selectedGame.name}</SelectedGameName>
                        <ClearButton type="button" onClick={handleClear}>
                            Clear
                        </ClearButton>
                    </>
                ) : (
                    <Placeholder>{placeholder}</Placeholder>
                )}
            </SelectedGame>

            <Dropdown isOpen={isOpen}>
                <SearchInput
                    type="text"
                    placeholder="Search games..."
                    value={searchQuery}
                    onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setHighlightedIndex(0);
                    }}
                    onKeyDown={handleKeyDown}
                    autoFocus
                />
                {filteredGames.length === 0 ? (
                    <EmptyState>No games found</EmptyState>
                ) : (
                    <List
                        height={Math.min(400, filteredGames.length * 60)}
                        itemCount={filteredGames.length}
                        itemSize={60}
                        width="100%"
                        itemData={{
                            games: filteredGames,
                            selectedId: value,
                            highlightedIndex,
                            onSelect: handleSelect,
                            onHighlight: setHighlightedIndex,
                        }}
                    >
                        {GameItemRenderer}
                    </List>
                )}
            </Dropdown>
        </PickerContainer>
    );
}

