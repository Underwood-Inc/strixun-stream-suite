/**
 * Games Data Index
 * Centralized export of all game lists
 */

import { popularGames, type Game } from './popular';
import { steamTopGames } from './steam-top';
import { indieGames } from './indie';
import { rpgGames } from './rpgs';
import { multiplayerGames } from './multiplayer';

// Export all games as a single array (deduplicated by name)
export const allGames: Game[] = (() => {
    const gamesMap = new Map<string, Game>();
    
    // Add all games, using name as key to deduplicate
    [...popularGames, ...steamTopGames, ...indieGames, ...rpgGames, ...multiplayerGames].forEach(game => {
        // Use the first occurrence of each game name
        if (!gamesMap.has(game.name.toLowerCase())) {
            gamesMap.set(game.name.toLowerCase(), game);
        }
    });
    
    // Sort alphabetically by name
    return Array.from(gamesMap.values()).sort((a, b) => a.name.localeCompare(b.name));
})();

// Export individual categories for filtering
export { popularGames, steamTopGames, indieGames, rpgGames, multiplayerGames };
export type { Game };

// Helper function to search games
export function searchGames(query: string, games: Game[] = allGames): Game[] {
    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) return games;
    
    return games.filter(game => 
        game.name.toLowerCase().includes(lowerQuery) ||
        game.id.toLowerCase().includes(lowerQuery) ||
        game.platforms?.some(p => p.toLowerCase().includes(lowerQuery))
    );
}

// Helper function to get game by ID
export function getGameById(id: string, games: Game[] = allGames): Game | undefined {
    return games.find(game => game.id === id);
}

