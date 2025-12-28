/**
 * Popular/Well-Known Games
 * Top games across all platforms
 */

export interface Game {
    id: string;
    name: string;
    platforms?: string[];
}

export const popularGames: Game[] = [
    { id: 'minecraft', name: 'Minecraft', platforms: ['PC', 'Console', 'Mobile'] },
    { id: 'fortnite', name: 'Fortnite', platforms: ['PC', 'Console', 'Mobile'] },
    { id: 'gta5', name: 'Grand Theft Auto V', platforms: ['PC', 'Console'] },
    { id: 'cs2', name: 'Counter-Strike 2', platforms: ['PC'] },
    { id: 'valorant', name: 'Valorant', platforms: ['PC'] },
    { id: 'league-of-legends', name: 'League of Legends', platforms: ['PC'] },
    { id: 'apex-legends', name: 'Apex Legends', platforms: ['PC', 'Console'] },
    { id: 'overwatch-2', name: 'Overwatch 2', platforms: ['PC', 'Console'] },
    { id: 'rocket-league', name: 'Rocket League', platforms: ['PC', 'Console'] },
    { id: 'among-us', name: 'Among Us', platforms: ['PC', 'Mobile', 'Console'] },
    { id: 'fall-guys', name: 'Fall Guys', platforms: ['PC', 'Console'] },
    { id: 'genshin-impact', name: 'Genshin Impact', platforms: ['PC', 'Mobile', 'Console'] },
    { id: 'honkai-star-rail', name: 'Honkai: Star Rail', platforms: ['PC', 'Mobile', 'Console'] },
    { id: 'roblox', name: 'Roblox', platforms: ['PC', 'Mobile', 'Console'] },
    { id: 'terraria', name: 'Terraria', platforms: ['PC', 'Console', 'Mobile'] },
    { id: 'stardew-valley', name: 'Stardew Valley', platforms: ['PC', 'Console', 'Mobile'] },
    { id: 'elden-ring', name: 'Elden Ring', platforms: ['PC', 'Console'] },
    { id: 'baldurs-gate-3', name: "Baldur's Gate 3", platforms: ['PC', 'Console'] },
    { id: 'cyberpunk-2077', name: 'Cyberpunk 2077', platforms: ['PC', 'Console'] },
    { id: 'the-witcher-3', name: 'The Witcher 3: Wild Hunt', platforms: ['PC', 'Console'] },
    { id: 'skyrim', name: 'The Elder Scrolls V: Skyrim', platforms: ['PC', 'Console'] },
    { id: 'red-dead-redemption-2', name: 'Red Dead Redemption 2', platforms: ['PC', 'Console'] },
    { id: 'god-of-war', name: 'God of War', platforms: ['PC', 'Console'] },
    { id: 'spider-man', name: "Marvel's Spider-Man", platforms: ['PC', 'Console'] },
    { id: 'horizon-zero-dawn', name: 'Horizon Zero Dawn', platforms: ['PC', 'Console'] },
];

