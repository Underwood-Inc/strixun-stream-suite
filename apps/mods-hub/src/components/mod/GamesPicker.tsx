/**
 * Games picker component using PortalSelect
 * Provides searchable game selection with platform information
 */

import { useMemo } from 'react';
import styled from 'styled-components';
import { colors, spacing } from '../../theme';
import { allGames, searchGames } from '../../data/games';
import { PortalSelect, type PortalSelectOption, type PortalSelectTheme } from '@strixun/shared-components/react';

const GameName = styled.div`
  font-weight: 500;
  font-size: 0.875rem;
  margin-bottom: ${spacing.xs};
`;

const GamePlatforms = styled.div`
  font-size: 0.75rem;
  color: ${colors.textSecondary};
`;

interface GamesPickerProps {
    value?: string; // gameId
    onChange: (gameId: string | undefined) => void;
    placeholder?: string;
}

export function GamesPicker({ value, onChange, placeholder = 'Select a game...' }: GamesPickerProps) {
    // Theme configuration for PortalSelect
    const theme = useMemo<PortalSelectTheme>(() => ({
        colors: {
            bg: colors.bg,
            bgSecondary: colors.bgSecondary,
            bgTertiary: colors.bgTertiary,
            text: colors.text,
            textSecondary: colors.textSecondary,
            textMuted: colors.textMuted,
            border: colors.border,
            accent: colors.accent,
        },
        spacing: {
            xs: spacing.xs,
            sm: spacing.sm,
            md: spacing.md,
            lg: spacing.lg,
        },
    }), []);

    // Convert games to PortalSelectOption format
    const options = useMemo<PortalSelectOption[]>(() => {
        return allGames.map(game => ({
            value: game.id,
            label: game.name,
        }));
    }, []);

    // Custom filter function for games
    const filterGames = useMemo(() => {
        return (query: string, opts: PortalSelectOption[]) => {
            const filtered = searchGames(query, allGames);
            return opts.filter(opt => filtered.some(g => g.id === opt.value));
        };
    }, []);

    // Custom render function to show game name and platforms
    const renderGameOption = useMemo(() => {
        const GameOption = (option: PortalSelectOption) => {
            const game = allGames.find(g => g.id === option.value);
            if (!game) return option.label;

            return (
                <>
                    <GameName>{game.name}</GameName>
                    {game.platforms && game.platforms.length > 0 && (
                        <GamePlatforms>{game.platforms.join(', ')}</GamePlatforms>
                    )}
                </>
            );
        };
        GameOption.displayName = 'GameOption';
        return GameOption;
    }, []);

    return (
        <PortalSelect
            value={value}
            onChange={onChange}
            options={options}
            placeholder={placeholder}
            searchable={true}
            searchPlaceholder="Search games..."
            clearable={true}
            filterOptions={filterGames}
            renderOption={renderGameOption}
            theme={theme}
        />
    );
}

