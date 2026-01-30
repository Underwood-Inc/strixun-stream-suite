/**
 * Name Generator Service (Server-Side)
 * 
 * Composable, agnostic service for generating unique random display names.
 * Guarantees uniqueness through KV storage checks.
 * 
 * Supports millions of unique combinations through expanded word pools
 * and multiple generation patterns.
 * 
 * @module services/nameGenerator
 */

import { DISPLAY_NAME_MIN_LENGTH, DISPLAY_NAME_MAX_LENGTH, DISPLAY_NAME_MAX_WORDS } from '../../../shared-config/display-name-constants.js';

interface CloudflareEnv {
  OTP_AUTH_KV: KVNamespace;
  [key: string]: any;
}

interface NameGeneratorOptions {
  customerId?: string | null;
  maxAttempts?: number;
  pattern?: 'adjective-noun' | 'adjective-noun-adjective' | 'noun-adjective' | 
           'adjective-adjective-noun' | 'adjective-noun-noun' | 'random';
  maxWords?: number; // Maximum words (default: 5)
}

interface NameReservation {
  userId: string;
  name: string;
  reservedAt: string;
}

/**
 * Expanded adjective pool (200+ words for millions of combinations)
 */
const ADJECTIVES = [
  // Speed & Movement
  'Swift', 'Quick', 'Rapid', 'Fast', 'Fleet', 'Nimble', 'Agile', 'Brisk',
  'Hurried', 'Speedy', 'Hasty', 'Rushing', 'Dashing', 'Zipping', 'Racing',
  
  // Nature & Elements
  'Calm', 'Wild', 'Fierce', 'Gentle', 'Storm', 'Thunder', 'Lightning', 'Wind',
  'Flame', 'Ice', 'Frost', 'Fire', 'Water', 'Earth', 'Solar', 'Lunar',
  'Stellar', 'Cosmic', 'Aether', 'Mystic', 'Ancient', 'Eternal', 'Divine',
  'Sacred', 'Legendary', 'Mythic', 'Epic', 'Grand', 'Vast', 'Infinite',
  
  // Colors
  'Crimson', 'Azure', 'Emerald', 'Golden', 'Silver', 'Shadow', 'Cobalt',
  'Amber', 'Ivory', 'Ebony', 'Scarlet', 'Violet', 'Indigo', 'Turquoise',
  'Magenta', 'Cyan', 'Bronze', 'Copper', 'Pearl', 'Ruby', 'Sapphire',
  'Jade', 'Topaz', 'Amethyst', 'Garnet', 'Onyx', 'Quartz', 'Crystal',
  
  // Size & Scale
  'Tiny', 'Huge', 'Massive', 'Mini', 'Giant', 'Small', 'Large', 'Vast',
  'Titan', 'Colossal', 'Immense', 'Enormous', 'Towering', 'Monumental',
  'Micro', 'Nano', 'Mega', 'Ultra', 'Super', 'Hyper', 'Maxi', 'Mini',
  
  // Personality & Traits
  'Bold', 'Brave', 'Clever', 'Wise', 'Noble', 'Proud', 'Silent', 'Bright',
  'Dark', 'Wise', 'Bold', 'Brave', 'Clever', 'Fierce', 'Gentle', 'Noble',
  'Proud', 'Wild', 'Calm', 'Bold', 'Bright', 'Dark', 'Quick', 'Silent',
  'Wise', 'Brave', 'Clever', 'Fierce', 'Gentle', 'Noble', 'Proud', 'Wild',
  
  // Power & Energy
  'Powerful', 'Mighty', 'Strong', 'Fierce', 'Bold', 'Brave', 'Valiant',
  'Heroic', 'Legendary', 'Epic', 'Mythic', 'Divine', 'Sacred', 'Eternal',
  'Infinite', 'Ultimate', 'Supreme', 'Absolute', 'Perfect', 'Flawless',
  
  // Mystical & Magical
  'Mystic', 'Arcane', 'Ethereal', 'Celestial', 'Astral', 'Primal', 'Primeval',
  'Ancient', 'Eternal', 'Timeless', 'Immortal', 'Transcendent', 'Sublime',
  'Enchanted', 'Magical', 'Mystical', 'Supernatural', 'Otherworldly',
  
  // Weather & Sky
  'Storm', 'Thunder', 'Lightning', 'Wind', 'Gale', 'Tempest', 'Hurricane',
  'Blizzard', 'Aurora', 'Comet', 'Meteor', 'Nebula', 'Galaxy', 'Star',
  'Moon', 'Sun', 'Solar', 'Lunar', 'Stellar', 'Cosmic', 'Celestial',
  
  // Earth & Nature
  'Mountain', 'Forest', 'River', 'Ocean', 'Valley', 'Peak', 'Cliff', 'Cave',
  'Crystal', 'Stone', 'Rock', 'Iron', 'Steel', 'Diamond', 'Emerald',
  'Jade', 'Amber', 'Coral', 'Pearl', 'Opal', 'Quartz',
  
  // Abstract Concepts
  'Spirit', 'Soul', 'Heart', 'Mind', 'Will', 'Power', 'Force', 'Energy',
  'Void', 'Chaos', 'Order', 'Balance', 'Harmony', 'Unity', 'Freedom',
  'Hope', 'Courage', 'Wisdom', 'Strength', 'Honor', 'Glory', 'Victory',
  
  // Additional descriptive
  'Radiant', 'Luminous', 'Brilliant', 'Dazzling', 'Shining', 'Glowing',
  'Gleaming', 'Sparkling', 'Twinkling', 'Blazing', 'Burning', 'Flaming',
  'Frozen', 'Icy', 'Chilling', 'Freezing', 'Biting', 'Frigid', 'Arctic',
  
  // Time & Eternity
  'Eternal', 'Timeless', 'Infinite', 'Endless', 'Everlasting', 'Immortal',
  'Ageless', 'Perpetual', 'Unending', 'Limitless', 'Boundless', 'Ceaseless',
  
  // Battle & War
  'Warrior', 'Fighter', 'Champion', 'Gladiator', 'Knight', 'Paladin',
  'Guardian', 'Protector', 'Defender', 'Sentinel', 'Warden', 'Vigilant',
  
  // Additional unique
  'Phantom', 'Ghost', 'Specter', 'Wraith', 'Shadow', 'Shade', 'Echo',
  'Whisper', 'Silence', 'Void', 'Abyss', 'Chasm', 'Depth', 'Height'
];

/**
 * Expanded noun pool (200+ words for millions of combinations)
 */
const NOUNS = [
  // Animals - Predators
  'Tiger', 'Wolf', 'Eagle', 'Dragon', 'Phoenix', 'Lion', 'Bear', 'Fox',
  'Hawk', 'Raven', 'Falcon', 'Shark', 'Panther', 'Jaguar', 'Leopard',
  'Lynx', 'Cobra', 'Viper', 'Serpent', 'Python', 'Anaconda', 'Crocodile',
  
  // Animals - Other
  'Whale', 'Dolphin', 'Stag', 'Deer', 'Elk', 'Moose', 'Bison', 'Buffalo',
  'Owl', 'Crow', 'Swan', 'Crane', 'Heron', 'Egret', 'Pelican', 'Albatross',
  'Falcon', 'Hawk', 'Eagle', 'Osprey', 'Kestrel', 'Peregrine', 'Condor',
  
  // Mythical Creatures
  'Dragon', 'Phoenix', 'Griffin', 'Unicorn', 'Pegasus', 'Cerberus', 'Hydra',
  'Chimera', 'Basilisk', 'Kraken', 'Leviathan', 'Behemoth', 'Titan',
  'Giant', 'Troll', 'Ogre', 'Demon', 'Angel', 'Seraph', 'Cherub',
  
  // Nature - Land
  'Mountain', 'Forest', 'River', 'Ocean', 'Valley', 'Peak', 'Cliff', 'Cave',
  'Hill', 'Mesa', 'Plateau', 'Canyon', 'Gorge', 'Ravine', 'Gulch', 'Gully',
  'Glacier', 'Iceberg', 'Tundra', 'Desert', 'Dune', 'Oasis', 'Mirage',
  
  // Nature - Water
  'Ocean', 'Sea', 'Lake', 'River', 'Stream', 'Creek', 'Brook', 'Falls',
  'Cascade', 'Rapids', 'Whirlpool', 'Tide', 'Wave', 'Surf', 'Swell',
  'Fjord', 'Bay', 'Harbor', 'Cove', 'Lagoon', 'Atoll', 'Reef',
  
  // Nature - Sky & Space
  'Star', 'Moon', 'Sun', 'Comet', 'Nebula', 'Galaxy', 'Planet', 'Asteroid',
  'Meteor', 'Aurora', 'Aurora', 'Eclipse', 'Nova', 'Supernova', 'Quasar',
  'Constellation', 'Orbit', 'Void', 'Abyss', 'Infinity', 'Horizon',
  
  // Weapons & Tools
  'Blade', 'Shield', 'Arrow', 'Bow', 'Sword', 'Spear', 'Axe', 'Hammer',
  'Dagger', 'Rapier', 'Saber', 'Katana', 'Scimitar', 'Mace', 'Flail',
  'Crossbow', 'Sling', 'Whip', 'Chain', 'Staff', 'Wand', 'Scepter',
  
  // Elements & Forces
  'Storm', 'Thunder', 'Lightning', 'Wind', 'Gale', 'Tempest', 'Hurricane',
  'Flame', 'Fire', 'Blaze', 'Inferno', 'Ember', 'Spark', 'Cinder',
  'Ice', 'Frost', 'Snow', 'Hail', 'Sleet', 'Blizzard', 'Avalanche',
  'Earth', 'Stone', 'Rock', 'Boulder', 'Pebble', 'Crystal', 'Gem',
  
  // Abstract Concepts
  'Spirit', 'Soul', 'Heart', 'Mind', 'Will', 'Power', 'Force', 'Energy',
  'Void', 'Chaos', 'Order', 'Balance', 'Harmony', 'Unity', 'Freedom',
  'Hope', 'Courage', 'Wisdom', 'Strength', 'Honor', 'Glory', 'Victory',
  'Destiny', 'Fate', 'Fortune', 'Luck', 'Chance', 'Fortune', 'Karma',
  
  // Celestial & Cosmic
  'Nebula', 'Galaxy', 'Star', 'Sun', 'Moon', 'Planet', 'Asteroid', 'Comet',
  'Meteor', 'Aurora', 'Eclipse', 'Nova', 'Supernova', 'Quasar', 'Pulsar',
  'Blackhole', 'Wormhole', 'Singularity', 'Infinity', 'Void', 'Abyss',
  
  // Time & Eternity
  'Eternity', 'Infinity', 'Timeless', 'Moment', 'Instant', 'Second', 'Minute',
  'Hour', 'Day', 'Night', 'Dawn', 'Dusk', 'Twilight', 'Midnight', 'Noon',
  
  // Battle & War
  'Warrior', 'Fighter', 'Champion', 'Gladiator', 'Knight', 'Paladin',
  'Guardian', 'Protector', 'Defender', 'Sentinel', 'Warden', 'Vigilant',
  'Soldier', 'Hero', 'Legend', 'Myth', 'Saga', 'Epic', 'Tale',
  
  // Mystical & Magical
  'Mystic', 'Mage', 'Wizard', 'Sorcerer', 'Warlock', 'Witch', 'Shaman',
  'Druid', 'Priest', 'Monk', 'Sage', 'Oracle', 'Prophet', 'Seer',
  'Enchanter', 'Illusionist', 'Necromancer', 'Conjurer', 'Summoner',
  
  // Additional unique
  'Phantom', 'Ghost', 'Specter', 'Wraith', 'Shadow', 'Shade', 'Echo',
  'Whisper', 'Silence', 'Void', 'Abyss', 'Chasm', 'Depth', 'Height',
  'Realm', 'Dimension', 'Plane', 'World', 'Universe', 'Multiverse',
  'Portal', 'Gateway', 'Threshold', 'Boundary', 'Edge', 'Limit', 'End'
];

/**
 * Additional word category for three-word patterns (optional)
 */
const VERBS = [
  'Striking', 'Soaring', 'Diving', 'Rising', 'Falling', 'Flying', 'Running',
  'Leaping', 'Bounding', 'Surging', 'Rushing', 'Crashing', 'Breaking',
  'Shining', 'Glowing', 'Burning', 'Freezing', 'Melting', 'Flowing',
  'Roaring', 'Howling', 'Screaming', 'Whispering', 'Echoing', 'Resonating',
  'Blazing', 'Flaming', 'Sparkling', 'Twinkling', 'Gleaming', 'Dazzling',
  'Thundering', 'Lightning', 'Storming', 'Raging', 'Raging', 'Wailing'
];

/**
 * Generate a random integer between min and max (inclusive)
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Pick a random element from an array
 */
function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Count words in a name (split by spaces)
 */
function countWords(name: string): number {
  // Split by spaces, filter empty
  const words = name
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 0);
  return words.length;
}

/**
 * Generate name using different patterns with proper spacing
 * Generates 3-5 words with rare chances for dash-separated ones (max 8 words total)
 */
function generateNamePattern(
  pattern: 'adjective-noun' | 'adjective-noun-adjective' | 'noun-adjective' | 
           'adjective-adjective-noun' | 'adjective-noun-noun' | 'random',
  maxWords: number = 8 // Increased to 8 to support dash-separated names
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
  
  let words: string[] = [];
  
  // Determine pattern if random
  const actualPattern = pattern === 'random' 
    ? (['adjective-noun', 'adjective-noun-adjective', 'noun-adjective', 
        'adjective-adjective-noun', 'adjective-noun-noun'] as const)[
        randomInt(0, 4)
      ]
    : pattern;
  
  // Generate words based on pattern and word count
  if (actualPattern === 'noun-adjective') {
    // Start with noun, then adjectives
    words.push(randomElement(NOUNS));
    for (let i = 1; i < wordCount; i++) {
      words.push(randomElement(ADJECTIVES));
    }
  } else if (actualPattern === 'adjective-noun') {
    // Simple adjective-noun pattern - expand to 3-5 words
    words.push(randomElement(ADJECTIVES), randomElement(NOUNS));
    // Add more words to reach target count
    for (let i = 2; i < wordCount; i++) {
      if (i % 2 === 0) {
        words.push(randomElement(ADJECTIVES));
      } else {
        words.push(randomElement(NOUNS));
      }
    }
  } else if (actualPattern === 'adjective-noun-adjective') {
    words.push(randomElement(ADJECTIVES), randomElement(NOUNS), randomElement(ADJECTIVES));
    // Add more words to reach target count
    for (let i = 3; i < wordCount; i++) {
      if (i % 2 === 1) {
        words.push(randomElement(NOUNS));
      } else {
        words.push(randomElement(ADJECTIVES));
      }
    }
  } else if (actualPattern === 'adjective-adjective-noun') {
    words.push(randomElement(ADJECTIVES), randomElement(ADJECTIVES), randomElement(NOUNS));
    // Add more words to reach target count
    for (let i = 3; i < wordCount; i++) {
      if (i % 2 === 1) {
        words.push(randomElement(ADJECTIVES));
      } else {
        words.push(randomElement(NOUNS));
      }
    }
  } else if (actualPattern === 'adjective-noun-noun') {
    words.push(randomElement(ADJECTIVES), randomElement(NOUNS), randomElement(NOUNS));
    // Add more words to reach target count
    for (let i = 3; i < wordCount; i++) {
      if (i % 2 === 1) {
        words.push(randomElement(ADJECTIVES));
      } else {
        words.push(randomElement(NOUNS));
      }
    }
  } else {
    // Fallback: generate based on word count
    for (let i = 0; i < wordCount; i++) {
      if (i % 2 === 0) {
        words.push(randomElement(ADJECTIVES));
      } else {
        words.push(randomElement(NOUNS));
      }
    }
  }
  
  // Ensure we don't exceed maxWords
  if (words.length > maxWords) {
    words = words.slice(0, maxWords);
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
    
    // Ensure we don't exceed max words total (after dash grouping)
    if (result.length > DISPLAY_NAME_MAX_WORDS) {
      return result.slice(0, DISPLAY_NAME_MAX_WORDS).join(' ');
    }
    
    return result.join(' ');
  }
  
  // No dashes - join with spaces
  return words.join(' ');
}

/**
 * Check if display name is unique in KV storage
 * 
 * CRITICAL: Display names must be globally unique (not per-customer)
 * customerId parameter is kept for backward compatibility but is ignored
 */
export async function isNameUnique(
  name: string,
  customerId: string | null, // Kept for backward compat, but ignored (always global)
  env: CloudflareEnv
): Promise<boolean> {
  // Always use global scope - display names must be globally unique
  // Uses unified key pattern: customer:displayname:{name}
  const nameKey = `customer:displayname:${name.toLowerCase()}`;
  
  const existing = await env.OTP_AUTH_KV.get(nameKey);
  return !existing;
}

/**
 * Reserve a display name in KV storage
 * 
 * CRITICAL: Display names must be globally unique (not per-customer)
 * customerId parameter is kept for backward compatibility but is ignored
 */
export async function reserveDisplayName(
  name: string,
  userId: string,
  customerId: string | null, // Kept for backward compat, but ignored (always global)
  env: CloudflareEnv
): Promise<void> {
  // Always use global scope - display names must be globally unique
  // Uses unified key pattern: customer:displayname:{name}
  const nameKey = `customer:displayname:${name.toLowerCase()}`;
  
  const reservation: NameReservation = {
    userId,
    name,
    reservedAt: new Date().toISOString()
  };
  
  await env.OTP_AUTH_KV.put(nameKey, JSON.stringify(reservation), { expirationTtl: 31536000 });
}

/**
 * Release a display name reservation
 * 
 * CRITICAL: Display names are globally unique, so we always use global scope.
 * customerId parameter is kept for backward compatibility but is ignored.
 */
export async function releaseDisplayName(
  name: string,
  customerId: string | null, // Kept for backward compat, but ignored (always global)
  env: CloudflareEnv
): Promise<void> {
  // Always use global scope - display names are globally unique
  // Uses unified key pattern: customer:displayname:{name}
  const nameKey = `customer:displayname:${name.toLowerCase()}`;
  await env.OTP_AUTH_KV.delete(nameKey);
}

/**
 * Generate a unique random display name
 * 
 * Supports millions of combinations:
 * - 200+ adjectives × 200+ nouns = 40,000+ base combinations
 * - With numbers 1-99999: 40,000 × 99,999 = ~4 billion combinations
 * - With three-word patterns: even more combinations
 */
/**
 * Generate a unique random display name
 * 
 * Supports millions of combinations:
 * - 200+ adjectives × 200+ nouns = 40,000+ base combinations
 * - With three-word patterns: even more combinations
 * 
 * CRITICAL: Maximum 50 total retries - returns empty string if all fail
 * CRITICAL: Display names must be globally unique (customerId ignored)
 */
export async function generateUniqueDisplayName(
  options: NameGeneratorOptions = {},
  env: CloudflareEnv
): Promise<string> {
  const {
    customerId = null, // Kept for backward compat, but ignored (always global)
    maxAttempts = 20, // Primary attempts
    pattern = 'random', // Use random pattern for maximum variety
    maxWords = DISPLAY_NAME_MAX_WORDS // Maximum words (to support dash-separated names)
  } = options;

  const MAX_TOTAL_RETRIES = 50; // Maximum total attempts before returning empty string
  let totalAttempts = 0;
  let name: string;

  // Try primary generation patterns
  while (totalAttempts < MAX_TOTAL_RETRIES && totalAttempts < maxAttempts) {
    name = generateNamePattern(pattern, maxWords);
    totalAttempts++;
    
    // Validate word count before checking uniqueness
    const wordCount = countWords(name);
    if (wordCount > maxWords) {
      // Skip this name and try again
      continue;
    }

    // Always use global uniqueness (customerId ignored)
    const isUnique = await isNameUnique(name, null, env);
    if (isUnique) {
      return name;
    }
  }

  // Fallback: Try different patterns if primary failed
  const fallbackPatterns: Array<'adjective-noun' | 'adjective-noun-adjective' | 'noun-adjective' | 
                                'adjective-adjective-noun' | 'adjective-noun-noun'> = 
    ['adjective-noun', 'adjective-noun-adjective', 'noun-adjective', 
     'adjective-adjective-noun', 'adjective-noun-noun'];
  
  for (const fallbackPattern of fallbackPatterns) {
    // Skip if this fallback pattern matches the current pattern (already tried)
    if (fallbackPattern === pattern) continue;
    if (totalAttempts >= MAX_TOTAL_RETRIES) break;
    
    for (let i = 0; i < 5 && totalAttempts < MAX_TOTAL_RETRIES; i++) {
      name = generateNamePattern(fallbackPattern, maxWords);
      totalAttempts++;
      
      const wordCount = countWords(name);
      if (wordCount > maxWords) continue;
      
      // Always use global uniqueness (customerId ignored)
      const isUnique = await isNameUnique(name, null, env);
      if (isUnique) {
        return name;
      }
    }
  }

  // Last resort: Use additional adjectives/nouns to ensure uniqueness (no numbers allowed)
  // Try multiple adjective-noun combinations
  for (let i = 0; i < 10 && totalAttempts < MAX_TOTAL_RETRIES; i++) {
    const adj1 = randomElement(ADJECTIVES);
    const adj2 = randomElement(ADJECTIVES);
    const noun1 = randomElement(NOUNS);
    const noun2 = randomElement(NOUNS);
    
    // Try different patterns to ensure uniqueness
    const patterns = [
      `${adj1} ${noun1} ${adj2}`,
      `${adj1} ${adj2} ${noun1}`,
      `${noun1} ${adj1} ${adj2}`,
      `${adj1} ${noun1} ${noun2}`,
    ];
    
    for (const pattern of patterns) {
      if (totalAttempts >= MAX_TOTAL_RETRIES) break;
      
      const words = pattern.split(/\s+/).slice(0, maxWords);
      name = words.join(' ');
      totalAttempts++;
      
      const wordCount = countWords(name);
      if (wordCount > maxWords) continue;
      
      // Always use global uniqueness (customerId ignored)
      const isUnique = await isNameUnique(name, null, env);
      if (isUnique) {
        return name;
      }
    }
  }

  // After 50 attempts, return empty string
  // Caller must handle empty string case
  return '';
}

/**
 * Validate display name format
 * Ensures name doesn't exceed 8 words and uses proper spacing
 * 
 * Rules:
 * - 3-50 characters
 * - Letters, spaces, and dashes only (no numbers, no other special characters)
 * - Dashes allowed within words (e.g., "Swift-Bold")
 * - Must start with a letter
 * - Maximum 8 words (to support dash-separated names)
 * - No consecutive spaces
 */
export function validateDisplayName(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  
  const trimmed = name.trim();
  
  // Check basic format: min-max characters (from constants), letters, spaces, and dashes only, must start with letter
  // NO NUMBERS, NO OTHER SPECIAL CHARACTERS
  // Dashes are allowed within words (e.g., "Swift-Bold Eagle")
  // Pattern: first char is letter, then (maxLength - 1) more chars of letters/spaces/dashes
  const pattern = new RegExp(`^[a-zA-Z][a-zA-Z\\s-]{${DISPLAY_NAME_MIN_LENGTH - 1},${DISPLAY_NAME_MAX_LENGTH - 1}}$`);
  if (!pattern.test(trimmed)) return false;
  
  // Ensure dashes are only within words (not at start/end or between spaces)
  if (trimmed.startsWith('-') || trimmed.endsWith('-') || /\s-\s/.test(trimmed) || /-\s-/.test(trimmed)) {
    return false;
  }
  
  // Check word count (max DISPLAY_NAME_MAX_WORDS, min 1 word)
  // Dash-separated words like "Swift-Bold" count as one word
  const wordCount = countWords(trimmed);
  if (wordCount > DISPLAY_NAME_MAX_WORDS || wordCount < 1) return false;
  
  // Ensure proper spacing (no multiple consecutive spaces)
  if (/\s{2,}/.test(trimmed)) return false;
  
  return true;
}

/**
 * Sanitize display name (remove invalid characters, trim)
 * Removes numbers and special characters, keeps only letters, spaces, and dashes
 * Dashes are preserved for dash-separated names
 */
export function sanitizeDisplayName(name: string): string {
  if (!name || typeof name !== 'string') return '';
  return name
    .trim()
    .replace(/[^a-zA-Z\s-]/g, '') // Remove numbers and special characters, keep only letters, spaces, and dashes
    .replace(/\s+/g, ' ') // Collapse multiple spaces to single space
    .replace(/^-+|-+$/g, '') // Remove dashes at start/end
    .replace(/\s-+\s/g, ' ') // Remove dashes between spaces
    .substring(0, DISPLAY_NAME_MAX_LENGTH);
}
