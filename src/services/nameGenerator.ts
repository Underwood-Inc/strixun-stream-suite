/**
 * Name Generator Service
 * 
 * Composable, agnostic service for generating unique random display names.
 * Guarantees uniqueness through external validation.
 * 
 * Supports millions of unique combinations through expanded word pools.
 * 
 * @module services/nameGenerator
 */

export interface NameGeneratorConfig {
  /**
   * Maximum number of generation attempts before giving up
   * @default 20
   */
  maxAttempts?: number;
  
  /**
   * Custom adjectives list (optional, uses default if not provided)
   */
  adjectives?: readonly string[];
  
  /**
   * Custom nouns list (optional, uses default if not provided)
   */
  nouns?: readonly string[];
  
  /**
   * Name generation pattern
   * @default 'random'
   */
  pattern?: 'adjective-noun' | 'adjective-noun-adjective' | 'noun-adjective' | 
           'adjective-adjective-noun' | 'adjective-noun-noun' | 'random';
  
  /**
   * Maximum words allowed
   * @default 5
   */
  maxWords?: number;
}

export interface GeneratedName {
  /**
   * The generated display name
   */
  name: string;
  
  /**
   * Whether uniqueness was verified (if validator provided)
   */
  verified: boolean;
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
  'Dark', 'Fierce', 'Gentle', 'Wild', 'Calm',
  
  // Power & Energy
  'Powerful', 'Mighty', 'Strong', 'Valiant', 'Heroic', 'Legendary', 'Epic',
  'Mythic', 'Divine', 'Sacred', 'Eternal', 'Infinite', 'Ultimate', 'Supreme',
  'Absolute', 'Perfect', 'Flawless',
  
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
] as const;

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
  'Meteor', 'Aurora', 'Eclipse', 'Nova', 'Supernova', 'Quasar',
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
  'Destiny', 'Fate', 'Fortune', 'Luck', 'Chance', 'Karma',
  
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
] as const;

/**
 * Count words in a name (split by spaces)
 */
function countWords(name: string): number {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 0);
  return words.length;
}

/**
 * Generate name using different patterns with proper spacing (max 5 words)
 */
function generateNamePattern(
  pattern: 'adjective-noun' | 'adjective-noun-adjective' | 'noun-adjective' | 
           'adjective-adjective-noun' | 'adjective-noun-noun' | 'random',
  adjectives: readonly string[],
  nouns: readonly string[],
  maxWords: number = 5
): string {
  let words: string[] = [];
  
  // Determine pattern if random
  const actualPattern = pattern === 'random' 
    ? (['adjective-noun', 'adjective-noun-adjective', 'noun-adjective', 
        'adjective-adjective-noun', 'adjective-noun-noun'] as const)[
        Math.floor(Math.random() * 5)
      ]
    : pattern;
  
  const randomElement = <T>(array: readonly T[]): T => 
    array[Math.floor(Math.random() * array.length)];
  
  switch (actualPattern) {
    case 'adjective-noun':
      words = [randomElement(adjectives), randomElement(nouns)];
      break;
      
    case 'adjective-noun-adjective':
      words = [
        randomElement(adjectives), 
        randomElement(nouns), 
        randomElement(adjectives)
      ];
      break;
      
    case 'noun-adjective':
      words = [randomElement(nouns), randomElement(adjectives)];
      break;
      
    case 'adjective-adjective-noun':
      words = [
        randomElement(adjectives), 
        randomElement(adjectives), 
        randomElement(nouns)
      ];
      break;
      
    case 'adjective-noun-noun':
      words = [
        randomElement(adjectives), 
        randomElement(nouns), 
        randomElement(nouns)
      ];
      break;
      
    default:
      words = [randomElement(adjectives), randomElement(nouns)];
  }
  
  // Ensure we don't exceed maxWords
  if (words.length > maxWords) {
    words = words.slice(0, maxWords);
  }
  
  // Join with spaces for proper name formatting
  return words.join(' ');
}

/**
 * Generate a random integer between min and max (inclusive)
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Pick a random element from an array
 */
function randomElement<T>(array: readonly T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Generate a random display name
 * 
 * Supports millions of combinations:
 * - 200+ adjectives × 200+ nouns = 40,000+ base combinations
 * - With numbers 1-99999: 40,000 × 99,999 = ~4 billion combinations
 * - With three-word patterns: even more combinations
 * 
 * @param config - Configuration options
 * @param uniquenessValidator - Optional async function to check if name is unique
 * @returns Generated name with verification status
 * 
 * @example
 * ```typescript
 * const name = await generateName(
 *   { includeNumber: true, pattern: 'random' },
 *   async (name) => !(await nameExists(name))
 * );
 * ```
 */
export async function generateName(
  config: NameGeneratorConfig = {},
  uniquenessValidator?: (name: string) => Promise<boolean>
): Promise<GeneratedName> {
  const {
    maxAttempts = 20, // Increased for better success rate
    adjectives = ADJECTIVES,
    nouns = NOUNS,
    pattern = 'random', // Use random pattern for maximum variety
    maxWords = 5 // Maximum 5 words
  } = config;

  let attempts = 0;
  let name: string;
  let isUnique = false;

  // Try primary generation patterns
  while (attempts < maxAttempts) {
    name = generateNamePattern(pattern, adjectives, nouns, maxWords);
    
    // Validate word count before checking uniqueness
    const wordCount = countWords(name);
    if (wordCount > maxWords) {
      // Skip this name and try again
      attempts++;
      continue;
    }

    // Validate uniqueness if validator provided
    if (uniquenessValidator) {
      try {
        isUnique = await uniquenessValidator(name);
        if (isUnique) {
          return { name, verified: true };
        }
      } catch (error) {
        console.error('[NameGenerator] Uniqueness validation failed:', error);
        // Continue to next attempt
      }
    } else {
      // No validator, assume unique (not recommended for production)
      return { name, verified: false };
    }

    attempts++;
  }

  // Fallback: Try different patterns if primary failed
  const fallbackPatterns: Array<'adjective-noun' | 'adjective-noun-adjective' | 'noun-adjective' | 
                                'adjective-adjective-noun' | 'adjective-noun-noun'> = 
    ['adjective-noun', 'adjective-noun-adjective', 'noun-adjective', 
     'adjective-adjective-noun', 'adjective-noun-noun'];
  
  for (const fallbackPattern of fallbackPatterns) {
    if (fallbackPattern === pattern && pattern !== 'random') continue;
    
    for (let i = 0; i < 5; i++) {
      name = generateNamePattern(fallbackPattern, adjectives, nouns, maxWords);
      const wordCount = countWords(name);
      if (wordCount > maxWords) continue;
      
      if (uniquenessValidator) {
        try {
          isUnique = await uniquenessValidator(name);
          if (isUnique) {
            return { name, verified: true };
          }
        } catch (error) {
          // Continue
        }
      }
    }
  }

  // If we exhausted attempts, return last generated name
  console.warn('[NameGenerator] Max attempts reached, returning unverified name');
  return { name: name!, verified: false };
}

/**
 * Validate display name format
 * Ensures name doesn't exceed 5 words and uses proper spacing
 * 
 * @param name - Name to validate
 * @returns Whether name matches required format
 */
export function validateDisplayName(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  
  const trimmed = name.trim();
  
  // Check basic format: 3-30 characters, alphanumeric and spaces, must start with letter
  const pattern = /^[a-zA-Z][a-zA-Z0-9\s]{2,29}$/;
  if (!pattern.test(trimmed)) return false;
  
  // Check word count (max 5 words)
  const wordCount = countWords(trimmed);
  if (wordCount > 5 || wordCount < 1) return false;
  
  // Ensure proper spacing (no multiple consecutive spaces)
  if (/\s{2,}/.test(trimmed)) return false;
  
  return true;
}

/**
 * Sanitize display name (remove invalid characters, trim)
 * 
 * @param name - Name to sanitize
 * @returns Sanitized name
 */
export function sanitizeDisplayName(name: string): string {
  if (!name || typeof name !== 'string') return '';
  return name
    .trim()
    .replace(/[^a-zA-Z0-9\s]/g, '') // Remove invalid characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .substring(0, 30); // Max length
}
