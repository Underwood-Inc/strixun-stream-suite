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
 * Generates 3-5 words with rare chances for dash-separated ones (max 8 words total)
 */
function generateNamePattern(
    pattern: 'adjective-noun' | 'adjective-noun-number' | 'noun-adjective' | 'random',
    _includeNumber: boolean = false
): string {
    // Determine word count (3-5 words, weighted towards 3-4)
    const wordCountRoll = Math.random();
    let wordCount: number;
    if (wordCountRoll < 0.4) {
        wordCount = 3; // 40% chance for 3 words
    } else if (wordCountRoll < 0.75) {
        wordCount = 4; // 35% chance for 4 words
    } else {
        wordCount = 5; // 25% chance for 5 words
    }

    // Rare chance (12%) for dash-separated words
    const useDashes = Math.random() < 0.12;
    
    const words: string[] = [];
    
    // Generate words based on pattern
    if (pattern === 'noun-adjective') {
        // Start with noun
        words.push(randomElement(NOUNS));
        // Add adjectives
        for (let i = 1; i < wordCount; i++) {
            words.push(randomElement(ADJECTIVES));
        }
    } else {
        // Default: start with adjective(s), then noun(s)
        // For 3 words: adj-noun-adj or adj-adj-noun
        // For 4 words: adj-adj-noun-adj or adj-noun-adj-noun
        // For 5 words: adj-adj-noun-adj-noun or similar
        
        if (wordCount === 3) {
            if (Math.random() < 0.5) {
                words.push(randomElement(ADJECTIVES), randomElement(NOUNS), randomElement(ADJECTIVES));
            } else {
                words.push(randomElement(ADJECTIVES), randomElement(ADJECTIVES), randomElement(NOUNS));
            }
        } else if (wordCount === 4) {
            if (Math.random() < 0.5) {
                words.push(randomElement(ADJECTIVES), randomElement(ADJECTIVES), randomElement(NOUNS), randomElement(ADJECTIVES));
            } else {
                words.push(randomElement(ADJECTIVES), randomElement(NOUNS), randomElement(ADJECTIVES), randomElement(NOUNS));
            }
        } else { // 5 words
            // Mix of adjectives and nouns
            const pattern5 = Math.floor(Math.random() * 3);
            if (pattern5 === 0) {
                words.push(randomElement(ADJECTIVES), randomElement(ADJECTIVES), randomElement(NOUNS), randomElement(ADJECTIVES), randomElement(NOUNS));
            } else if (pattern5 === 1) {
                words.push(randomElement(ADJECTIVES), randomElement(NOUNS), randomElement(ADJECTIVES), randomElement(NOUNS), randomElement(ADJECTIVES));
            } else {
                words.push(randomElement(ADJECTIVES), randomElement(ADJECTIVES), randomElement(NOUNS), randomElement(NOUNS), randomElement(ADJECTIVES));
            }
        }
    }

    // Apply dash separation if selected (rare)
    if (useDashes && words.length >= 3) {
        // Group some words with dashes (typically 2-3 words per dash group)
        // Example: "Swift-Bold Eagle" or "Ancient Dragon-Warrior"
        const result: string[] = [];
        let i = 0;
        
        while (i < words.length) {
            // Decide if this group should be dash-separated (30% chance per group)
            const useDashGroup = Math.random() < 0.3 && i < words.length - 1;
            
            if (useDashGroup && i < words.length - 1) {
                // Create a dash-separated group of 2 words
                result.push(`${words[i]}-${words[i + 1]}`);
                i += 2;
            } else {
                // Single word
                result.push(words[i]);
                i += 1;
            }
        }
        
        // Ensure we don't exceed 8 words total (after dash grouping)
        if (result.length > 8) {
            return result.slice(0, 8).join(' ');
        }
        
        return result.join(' ');
    }

    // No dashes - join with spaces
    return words.join(' ');
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

