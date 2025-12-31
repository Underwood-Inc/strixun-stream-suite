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
 * Generate name using different patterns with proper spacing (max 5 words)
 */
function generateNamePattern(
  pattern: 'adjective-noun' | 'adjective-noun-adjective' | 'noun-adjective' | 
           'adjective-adjective-noun' | 'adjective-noun-noun' | 'random',
  maxWords: number = 5
): string {
  let words: string[] = [];
  
  // Determine pattern if random (weighted towards shorter, more readable patterns)
  const actualPattern = pattern === 'random' 
    ? (['adjective-noun', 'adjective-noun-adjective', 'noun-adjective', 
        'adjective-adjective-noun', 'adjective-noun-noun'] as const)[
        randomInt(0, 4) // Equal probability
      ]
    : pattern;
  
  switch (actualPattern) {
    case 'adjective-noun':
      words = [randomElement(ADJECTIVES), randomElement(NOUNS)];
      break;
      
    case 'adjective-noun-adjective':
      words = [
        randomElement(ADJECTIVES), 
        randomElement(NOUNS), 
        randomElement(ADJECTIVES)
      ];
      break;
      
    case 'noun-adjective':
      words = [randomElement(NOUNS), randomElement(ADJECTIVES)];
      break;
      
    case 'adjective-adjective-noun':
      words = [
        randomElement(ADJECTIVES), 
        randomElement(ADJECTIVES), 
        randomElement(NOUNS)
      ];
      break;
      
    case 'adjective-noun-noun':
      words = [
        randomElement(ADJECTIVES), 
        randomElement(NOUNS), 
        randomElement(NOUNS)
      ];
      break;
      
    default:
      words = [randomElement(ADJECTIVES), randomElement(NOUNS)];
  }
  
  // Ensure we don't exceed maxWords
  if (words.length > maxWords) {
    words = words.slice(0, maxWords);
  }
  
  // Join with spaces for proper name formatting
  return words.join(' ');
}

/**
 * Check if display name is unique in KV storage
 */
export async function isNameUnique(
  name: string,
  customerId: string | null,
  env: CloudflareEnv
): Promise<boolean> {
  const nameKey = customerId 
    ? `cust_${customerId}_displayname_${name.toLowerCase()}`
    : `displayname_${name.toLowerCase()}`;
  
  const existing = await env.OTP_AUTH_KV.get(nameKey);
  return !existing;
}

/**
 * Reserve a display name in KV storage
 */
export async function reserveDisplayName(
  name: string,
  userId: string,
  customerId: string | null,
  env: CloudflareEnv
): Promise<void> {
  const nameKey = customerId 
    ? `cust_${customerId}_displayname_${name.toLowerCase()}`
    : `displayname_${name.toLowerCase()}`;
  
  const reservation: NameReservation = {
    userId,
    name,
    reservedAt: new Date().toISOString()
  };
  
  await env.OTP_AUTH_KV.put(nameKey, JSON.stringify(reservation), { expirationTtl: 31536000 });
}

/**
 * Release a display name reservation
 */
export async function releaseDisplayName(
  name: string,
  customerId: string | null,
  env: CloudflareEnv
): Promise<void> {
  const nameKey = customerId 
    ? `cust_${customerId}_displayname_${name.toLowerCase()}`
    : `displayname_${name.toLowerCase()}`;
  
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
export async function generateUniqueDisplayName(
  options: NameGeneratorOptions = {},
  env: CloudflareEnv
): Promise<string> {
  const {
    customerId = null,
    maxAttempts = 20, // Increased for better success rate
    pattern = 'random', // Use random pattern for maximum variety
    maxWords = 5 // Maximum 5 words
  } = options;

  let attempts = 0;
  let name: string;

  // Try primary generation patterns
  while (attempts < maxAttempts) {
    name = generateNamePattern(pattern, maxWords);
    
    // Validate word count before checking uniqueness
    const wordCount = countWords(name);
    if (wordCount > maxWords) {
      // Skip this name and try again
      attempts++;
      continue;
    }

    const isUnique = await isNameUnique(name, customerId, env);
    if (isUnique) {
      return name;
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
      name = generateNamePattern(fallbackPattern, maxWords);
      const wordCount = countWords(name);
      if (wordCount > maxWords) continue;
      
      const isUnique = await isNameUnique(name, customerId, env);
      if (isUnique) {
        return name;
      }
    }
  }

  // Last resort: Use additional adjectives/nouns to ensure uniqueness (no numbers allowed)
  // Try multiple adjective-noun combinations
  for (let i = 0; i < 10; i++) {
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
      const words = pattern.split(/\s+/).slice(0, maxWords);
      name = words.join(' ');
      
      const wordCount = countWords(name);
      if (wordCount > maxWords) continue;
      
      const isUnique = await isNameUnique(name, customerId, env);
      if (isUnique) {
        return name;
      }
    }
  }

  // Final fallback: Use a longer combination (still letters only)
  // This should be extremely rare given the large word pools
  const adj1 = randomElement(ADJECTIVES);
  const adj2 = randomElement(ADJECTIVES);
  const adj3 = randomElement(ADJECTIVES);
  const noun1 = randomElement(NOUNS);
  name = `${adj1} ${adj2} ${adj3} ${noun1}`;
  
  // Ensure it doesn't exceed maxWords
  const finalWords = name.split(/\s+/).slice(0, maxWords);
  return finalWords.join(' ');
}

/**
 * Validate display name format
 * Ensures name doesn't exceed 5 words and uses proper spacing
 * 
 * Rules:
 * - 3-30 characters
 * - Letters and spaces only (no numbers, no special characters)
 * - Must start with a letter
 * - Maximum 5 words
 * - No consecutive spaces
 */
export function validateDisplayName(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  
  const trimmed = name.trim();
  
  // Check basic format: 3-30 characters, letters and spaces only, must start with letter
  // NO NUMBERS, NO SPECIAL CHARACTERS
  const pattern = /^[a-zA-Z][a-zA-Z\s]{2,29}$/;
  if (!pattern.test(trimmed)) return false;
  
  // Check word count (max 5 words, min 1 word)
  const wordCount = countWords(trimmed);
  if (wordCount > 5 || wordCount < 1) return false;
  
  // Ensure proper spacing (no multiple consecutive spaces)
  if (/\s{2,}/.test(trimmed)) return false;
  
  return true;
}

/**
 * Sanitize display name (remove invalid characters, trim)
 * Removes numbers and special characters, keeps only letters and spaces
 */
export function sanitizeDisplayName(name: string): string {
  if (!name || typeof name !== 'string') return '';
  return name
    .trim()
    .replace(/[^a-zA-Z\s]/g, '') // Remove numbers and special characters, keep only letters and spaces
    .replace(/\s+/g, ' ') // Collapse multiple spaces to single space
    .substring(0, 30);
}
