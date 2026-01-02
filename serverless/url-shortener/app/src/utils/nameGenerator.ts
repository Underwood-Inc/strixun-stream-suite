/**
 * Client-side random name generator
 * Generates random names for confirmation dialogs
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
 * Generate a random name for confirmation dialogs
 * @param includeNumber - Whether to include a random number (default: false)
 * @returns A randomly generated name
 */
export function generateRandomName(includeNumber: boolean = false): string {
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

  const words: string[] = [];
  
  // Generate words - mix of adjectives and nouns
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
    const pattern5 = Math.floor(Math.random() * 3);
    if (pattern5 === 0) {
      words.push(randomElement(ADJECTIVES), randomElement(ADJECTIVES), randomElement(NOUNS), randomElement(ADJECTIVES), randomElement(NOUNS));
    } else if (pattern5 === 1) {
      words.push(randomElement(ADJECTIVES), randomElement(NOUNS), randomElement(ADJECTIVES), randomElement(NOUNS), randomElement(ADJECTIVES));
    } else {
      words.push(randomElement(ADJECTIVES), randomElement(ADJECTIVES), randomElement(NOUNS), randomElement(NOUNS), randomElement(ADJECTIVES));
    }
  }

  if (includeNumber) {
    words.push(Math.floor(Math.random() * 1000).toString());
  }

  return words.join(' ');
}
