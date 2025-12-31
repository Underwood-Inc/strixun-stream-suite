/**
 * Client-side random name generator
 * Generates random names for confirmation dialogs
 * Uses a simplified version of the server-side name generator
 */

const ADJECTIVES = [
    'Swift', 'Bold', 'Clever', 'Bright', 'Fierce', 'Gentle', 'Mighty', 'Quiet',
    'Rapid', 'Sharp', 'Smooth', 'Tough', 'Wise', 'Brave', 'Calm', 'Eager',
    'Fancy', 'Happy', 'Jolly', 'Lively', 'Proud', 'Silent', 'Vivid', 'Wild',
    'Ancient', 'Cosmic', 'Digital', 'Epic', 'Frozen', 'Golden', 'Hidden', 'Infinite',
    'Lunar', 'Mystic', 'Noble', 'Oceanic', 'Primal', 'Quantum', 'Radiant', 'Solar',
    'Thunder', 'Ultimate', 'Vibrant', 'Wicked', 'Zenith', 'Alpha', 'Beta', 'Gamma'
];

const NOUNS = [
    'Eagle', 'Lion', 'Tiger', 'Wolf', 'Bear', 'Fox', 'Hawk', 'Falcon',
    'Dragon', 'Phoenix', 'Griffin', 'Unicorn', 'Knight', 'Warrior', 'Mage', 'Ranger',
    'Storm', 'Thunder', 'Lightning', 'Flame', 'Frost', 'Shadow', 'Star', 'Moon',
    'Crystal', 'Gem', 'Orb', 'Sword', 'Shield', 'Arrow', 'Bow', 'Blade',
    'Mountain', 'River', 'Ocean', 'Forest', 'Desert', 'Valley', 'Peak', 'Cave',
    'Code', 'Data', 'Byte', 'Bit', 'Node', 'Link', 'Grid', 'Core'
];

/**
 * Get a random element from an array
 */
function randomElement<T>(array: readonly T[]): T {
    return array[Math.floor(Math.random() * array.length)];
}

/**
 * Generate a random name pattern
 */
function generateNamePattern(
    pattern: 'adjective-noun' | 'adjective-noun-number' | 'noun-adjective' | 'random',
    includeNumber: boolean = false
): string {
    const adjective = randomElement(ADJECTIVES);
    const noun = randomElement(NOUNS);
    const number = Math.floor(Math.random() * 999) + 1;

    switch (pattern) {
        case 'adjective-noun':
            return includeNumber ? `${adjective} ${noun} ${number}` : `${adjective} ${noun}`;
        case 'adjective-noun-number':
            // Only include number if explicitly requested (for display names, this should be false)
            return includeNumber ? `${adjective} ${noun} ${number}` : `${adjective} ${noun}`;
        case 'noun-adjective':
            return includeNumber ? `${noun} ${adjective} ${number}` : `${noun} ${adjective}`;
        case 'random':
        default: {
            const patterns: Array<'adjective-noun' | 'noun-adjective'> = ['adjective-noun', 'noun-adjective'];
            const selectedPattern = randomElement(patterns);
            if (selectedPattern === 'adjective-noun') {
                return includeNumber ? `${adjective} ${noun} ${number}` : `${adjective} ${noun}`;
            } else {
                return includeNumber ? `${noun} ${adjective} ${number}` : `${noun} ${adjective}`;
            }
        }
    }
}

/**
 * Generate a random name for confirmation dialogs
 * @param includeNumber - Whether to include a random number (default: false to match display name validation rules)
 * @returns A randomly generated name
 * 
 * Note: Display names cannot contain numbers, so this defaults to false for consistency.
 * Set includeNumber=true only when numbers are explicitly allowed.
 */
export function generateRandomName(includeNumber: boolean = false): string {
    const patterns: Array<'adjective-noun' | 'adjective-noun-number' | 'noun-adjective' | 'random'> = [
        'adjective-noun',
        'adjective-noun-number',
        'noun-adjective',
        'random'
    ];
    const pattern = randomElement(patterns);
    return generateNamePattern(pattern, includeNumber);
}

