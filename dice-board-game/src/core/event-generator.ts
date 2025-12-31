/**
 * Procedural Event Generator
 * Generates 3000+ unique game events with smart templates to avoid garbage output
 */

import type {
  GameEvent,
  EventType,
  Rarity,
  EventOutcome,
  Item,
  Buff,
  Debuff,
  Enemy,
} from '../types/index.js';

/**
 * Seeded random for deterministic generation
 */
class SeededRandom {
  private seed: number;

  constructor(seed: string | number) {
    this.seed = typeof seed === 'string' ? this.hashString(seed) : seed;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  pick<T>(array: T[]): T {
    return array[this.nextInt(0, array.length - 1)];
  }
}

/**
 * Event templates for structured generation
 */
const EVENT_TEMPLATES = {
  treasure: {
    names: [
      'Ancient Chest', 'Hidden Cache', 'Forgotten Vault', 'Treasure Trove',
      'Mysterious Box', 'Golden Coffer', 'Secret Stash', 'Buried Wealth',
      'Cursed Hoard', 'Dragon\'s Hoard', 'Pirate\'s Booty', 'Royal Treasury',
    ],
    descriptions: [
      'You discover a {adjective} {container} filled with {content}.',
      'A {material} {container} catches your eye, containing {content}.',
      'Hidden beneath {location}, you find {content} in a {container}.',
    ],
    adjectives: ['ornate', 'ancient', 'weathered', 'gleaming', 'mysterious', 'cursed', 'blessed'],
    containers: ['chest', 'box', 'coffer', 'vault', 'cache', 'stash'],
    materials: ['golden', 'silver', 'bronze', 'iron', 'wooden', 'crystal'],
    locations: ['rubble', 'a tree', 'a cave', 'ruins', 'sand', 'snow'],
  },
  combat: {
    names: [
      'Goblin Ambush', 'Bandit Attack', 'Wild Beast', 'Undead Horde',
      'Dragon Encounter', 'Troll Blockade', 'Orc Raid', 'Demon Invasion',
      'Shadow Creature', 'Cursed Guardian', 'Ancient Golem', 'Feral Pack',
    ],
    descriptions: [
      'A {enemy_type} {action} you! Prepare for battle!',
      'You are {surprised} by a {enemy_type}!',
      'A {enemy_type} {blocks} your path, {threatening} you!',
    ],
    enemy_types: ['goblin', 'bandit', 'beast', 'undead', 'dragon', 'troll', 'orc', 'demon'],
    actions: ['ambushes', 'attacks', 'confronts', 'challenges'],
    surprised: ['surprised', 'ambushed', 'confronted', 'challenged'],
    blocks: ['blocks', 'guards', 'defends'],
    threatening: ['threatening', 'menacing', 'growling at'],
  },
  npc: {
    names: [
      'Wandering Merchant', 'Mysterious Stranger', 'Wise Hermit', 'Traveling Bard',
      'Ancient Sage', 'Friendly Trader', 'Quest Giver', 'Healing Priest',
      'Weapon Master', 'Magic Teacher', 'Storyteller', 'Fortune Teller',
    ],
    types: ['merchant', 'quest_giver', 'healer', 'trainer', 'storyteller', 'random'],
    personalities: [
      ['friendly', 'helpful'],
      ['mysterious', 'cryptic'],
      ['wise', 'knowledgeable'],
      ['cheerful', 'optimistic'],
      ['serious', 'focused'],
      ['eccentric', 'unpredictable'],
    ],
  },
  trap: {
    names: [
      'Spike Trap', 'Poison Dart', 'Pitfall', 'Magic Barrier',
      'Flame Jet', 'Ice Shard', 'Lightning Bolt', 'Crushing Wall',
    ],
    descriptions: [
      'You trigger a {trap_type}! {consequence}',
      'A {trap_type} {activates}! {consequence}',
    ],
    trap_types: ['spike trap', 'poison dart', 'pitfall', 'magic barrier'],
    activates: ['activates', 'triggers', 'springs', 'erupts'],
  },
  shrine: {
    names: [
      'Healing Shrine', 'Power Shrine', 'Luck Shrine', 'Wisdom Shrine',
      'Ancient Altar', 'Blessed Fountain', 'Sacred Grove', 'Divine Statue',
    ],
    descriptions: [
      'You find a {shrine_type} that {effect}.',
      'An ancient {shrine_type} {blesses} you.',
    ],
    shrine_types: ['healing shrine', 'power shrine', 'luck shrine', 'wisdom shrine'],
    blesses: ['blesses', 'empowers', 'heals', 'protects'],
  },
};

/**
 * Item name generators
 */
const ITEM_GENERATORS = {
  weapon: {
    prefixes: ['Sharp', 'Mighty', 'Ancient', 'Cursed', 'Blessed', 'Fiery', 'Frost', 'Thunder'],
    bases: ['Sword', 'Axe', 'Mace', 'Dagger', 'Bow', 'Staff', 'Wand', 'Spear'],
    suffixes: ['of Power', 'of Slaying', 'of the Ancients', 'of Doom', 'of Light'],
  },
  armor: {
    prefixes: ['Sturdy', 'Enchanted', 'Ancient', 'Cursed', 'Blessed', 'Dragon', 'Mythril'],
    bases: ['Armor', 'Plate', 'Mail', 'Robe', 'Cloak', 'Shield', 'Helmet', 'Boots'],
    suffixes: ['of Protection', 'of Defense', 'of the Guardian', 'of Resilience'],
  },
  consumable: {
    names: [
      'Health Potion', 'Mana Potion', 'Strength Elixir', 'Speed Potion',
      'Luck Charm', 'Protection Scroll', 'Healing Herb', 'Energy Crystal',
    ],
  },
  accessory: {
    prefixes: ['Lucky', 'Powerful', 'Mystical', 'Ancient', 'Cursed', 'Blessed'],
    bases: ['Ring', 'Amulet', 'Bracelet', 'Talisman', 'Charm', 'Medallion'],
    suffixes: ['of Fortune', 'of Power', 'of Wisdom', 'of Protection'],
  },
};

/**
 * Buff/Debuff generators
 */
const EFFECT_GENERATORS = {
  buff: {
    names: [
      'Strength Boost', 'Speed Boost', 'Luck Boost', 'Protection',
      'Regeneration', 'Mana Surge', 'Critical Strike', 'Shield',
    ],
    descriptions: [
      'Increases {stat} by {value} for {duration} turns.',
      'Grants {effect} for {duration} turns.',
    ],
  },
  debuff: {
    names: [
      'Weakness', 'Slow', 'Curse', 'Poison', 'Weakness', 'Bleeding',
    ],
    descriptions: [
      'Reduces {stat} by {value} for {duration} turns.',
      'Inflicts {effect} for {duration} turns.',
    ],
  },
};

/**
 * Generate a unique game event
 */
export function generateEvent(
  type: EventType,
  rarity: Rarity,
  seed?: string | number
): GameEvent {
  const rng = new SeededRandom(seed ?? Date.now().toString() + type + rarity);
  const eventId = `event_${Date.now()}_${rng.nextInt(1000, 9999)}`;

  switch (type) {
    case 'treasure':
      return generateTreasureEvent(eventId, rarity, rng);
    case 'combat':
      return generateCombatEvent(eventId, rarity, rng);
    case 'npc':
      return generateNPCEvent(eventId, rarity, rng);
    case 'trap':
      return generateTrapEvent(eventId, rarity, rng);
    case 'shrine':
      return generateShrineEvent(eventId, rarity, rng);
    case 'quest':
      return generateQuestEvent(eventId, rarity, rng);
    default:
      return generateRandomEvent(eventId, rarity, rng);
  }
}

/**
 * Generate treasure event
 */
function generateTreasureEvent(eventId: string, rarity: Rarity, rng: SeededRandom): GameEvent {
  const template = EVENT_TEMPLATES.treasure;
  const name = rng.pick(template.names);
  const adjective = rng.pick(template.adjectives);
  const container = rng.pick(template.containers);
  const description = rng.pick(template.descriptions)
    .replace('{adjective}', adjective)
    .replace('{container}', container)
    .replace('{content}', generateTreasureContent(rarity, rng));

  const outcomes: EventOutcome[] = [
    {
      probability: 0.4,
      type: 'item',
      value: generateItem(rarity, rng),
      description: 'You find a valuable item!',
    },
    {
      probability: 0.3,
      type: 'gold',
      value: generateGoldAmount(rarity, rng),
      description: 'You discover gold!',
    },
    {
      probability: 0.2,
      type: 'buff',
      value: generateBuff(rarity, rng),
      description: 'You gain a powerful buff!',
    },
    {
      probability: 0.1,
      type: 'experience',
      value: generateExperienceAmount(rarity, rng),
      description: 'You gain experience!',
    },
  ];

  return {
    id: eventId,
    type: 'treasure',
    name,
    description,
    rarity,
    outcomes,
  };
}

/**
 * Generate combat event
 */
function generateCombatEvent(id: string, rarity: Rarity, rng: SeededRandom): GameEvent {
  const template = EVENT_TEMPLATES.combat;
  const name = rng.pick(template.names);
  const enemyType = rng.pick(template.enemy_types);
  const action = rng.pick(template.actions);
  const description = rng.pick(template.descriptions)
    .replace('{enemy_type}', enemyType)
    .replace('{action}', action);

  const difficulty = getRarityDifficulty(rarity, rng);
  generateEnemy(rarity, difficulty, rng); // Generate enemy for combat system

  const outcomes: EventOutcome[] = [
    {
      probability: 0.6,
      type: 'item',
      value: generateItem(rarity, rng),
      description: 'You defeat the enemy and claim their loot!',
    },
    {
      probability: 0.3,
      type: 'experience',
      value: generateExperienceAmount(rarity, rng),
      description: 'You gain experience from the battle!',
    },
    {
      probability: 0.1,
      type: 'gold',
      value: generateGoldAmount(rarity, rng),
      description: 'You find gold on the enemy!',
    },
  ];

  return {
    id,
    type: 'combat',
    name,
    description,
    rarity,
    outcomes,
    requiresCombat: true,
    combatDifficulty: difficulty,
  };
}

/**
 * Generate NPC event
 */
function generateNPCEvent(eventId: string, rarity: Rarity, rng: SeededRandom): GameEvent {
  const template = EVENT_TEMPLATES.npc;
  const name = rng.pick(template.names);
  const npcType = rng.pick(template.types);
  const personality = rng.pick(template.personalities);

  const outcomes: EventOutcome[] = [
    {
      probability: 0.4,
      type: 'dialogue',
      value: generateDialogue(npcType, rng),
      description: 'The NPC has something to say...',
    },
    {
      probability: 0.3,
      type: 'item',
      value: generateItem(rarity, rng),
      description: 'The NPC gives you an item!',
    },
    {
      probability: 0.2,
      type: 'buff',
      value: generateBuff(rarity, rng),
      description: 'The NPC blesses you!',
    },
    {
      probability: 0.1,
      type: 'quest',
      value: generateQuest(rarity, rng),
      description: 'The NPC offers you a quest!',
    },
  ];

  return {
    id: eventId,
    type: 'npc',
    name,
    description: `You encounter ${name}, a ${personality.join(' and ')} ${npcType}.`,
    rarity,
    outcomes,
  };
}

/**
 * Generate trap event
 */
function generateTrapEvent(eventId: string, rarity: Rarity, rng: SeededRandom): GameEvent {
  const template = EVENT_TEMPLATES.trap;
  const name = rng.pick(template.names);
  const trapType = rng.pick(template.trap_types);
  const description = rng.pick(template.descriptions)
    .replace('{trap_type}', trapType)
    .replace('{consequence}', generateTrapConsequence(rarity, rng));

  const outcomes: EventOutcome[] = [
    {
      probability: 0.7,
      type: 'damage',
      value: generateDamageAmount(rarity, rng),
      description: 'You take damage from the trap!',
    },
    {
      probability: 0.2,
      type: 'debuff',
      value: generateDebuff(rarity, rng),
      description: 'The trap inflicts a debuff!',
    },
    {
      probability: 0.1,
      type: 'item',
      value: generateItem(rarity, rng),
      description: 'You find an item while disarming the trap!',
    },
  ];

  return {
    id: eventId,
    type: 'trap',
    name,
    description,
    rarity,
    outcomes,
  };
}

/**
 * Generate shrine event
 */
function generateShrineEvent(eventId: string, rarity: Rarity, rng: SeededRandom): GameEvent {
  const template = EVENT_TEMPLATES.shrine;
  const name = rng.pick(template.names);
  const shrineType = rng.pick(template.shrine_types);
  const description = rng.pick(template.descriptions)
    .replace('{shrine_type}', shrineType)
    .replace('{effect}', generateShrineEffect(rarity, rng))
    .replace('{blesses}', rng.pick(template.blesses));

  const outcomes: EventOutcome[] = [
    {
      probability: 0.5,
      type: 'heal',
      value: generateHealAmount(rarity, rng),
      description: 'The shrine heals you!',
    },
    {
      probability: 0.3,
      type: 'buff',
      value: generateBuff(rarity, rng),
      description: 'The shrine blesses you!',
    },
    {
      probability: 0.2,
      type: 'experience',
      value: generateExperienceAmount(rarity, rng),
      description: 'The shrine grants you wisdom!',
    },
  ];

  return {
    id: eventId,
    type: 'shrine',
    name,
    description,
    rarity,
    outcomes,
  };
}

/**
 * Generate quest event
 */
function generateQuestEvent(eventId: string, rarity: Rarity, rng: SeededRandom): GameEvent {
  const questTypes = ['fetch', 'kill', 'explore', 'deliver', 'discover'];
  const questType = rng.pick(questTypes);
  const name = `Quest: ${questType.charAt(0).toUpperCase() + questType.slice(1)} Mission`;

  const outcomes: EventOutcome[] = [
    {
      probability: 0.6,
      type: 'experience',
      value: generateExperienceAmount(rarity, rng) * 2,
      description: 'You complete the quest and gain experience!',
    },
    {
      probability: 0.3,
      type: 'item',
      value: generateItem(rarity, rng),
      description: 'You receive a quest reward!',
    },
    {
      probability: 0.1,
      type: 'gold',
      value: generateGoldAmount(rarity, rng) * 2,
      description: 'You receive a quest reward in gold!',
    },
  ];

  return {
    id: eventId,
    type: 'quest',
    name,
    description: `A quest giver offers you a ${questType} quest.`,
    rarity,
    outcomes,
  };
}

/**
 * Generate random event (combination of types)
 */
function generateRandomEvent(_id: string, _rarity: Rarity, rng: SeededRandom): GameEvent {
  const types: EventType[] = ['treasure', 'combat', 'npc', 'trap', 'shrine'];
  const selectedType = rng.pick(types);
  return generateEvent(selectedType, _rarity, rng.next().toString());
}

// Helper functions for generating content

function generateTreasureContent(_rarity: Rarity, rng: SeededRandom): string {
  const contents = [
    'gold coins',
    'precious gems',
    'ancient artifacts',
    'magical items',
    'rare materials',
  ];
  return rng.pick(contents);
}

function generateItem(itemRarity: Rarity, rng: SeededRandom): Item {
  const itemTypes: Array<Item['type']> = ['weapon', 'armor', 'consumable', 'accessory', 'special'];
  const type = rng.pick(itemTypes);
  const id = `item_${Date.now()}_${rng.nextInt(1000, 9999)}`;

  let name: string;
  if (type === 'weapon') {
    const gen = ITEM_GENERATORS.weapon;
    name = `${rng.pick(gen.prefixes)} ${rng.pick(gen.bases)} ${rng.next() < 0.3 ? rng.pick(gen.suffixes) : ''}`.trim();
  } else if (type === 'armor') {
    const gen = ITEM_GENERATORS.armor;
    name = `${rng.pick(gen.prefixes)} ${rng.pick(gen.bases)} ${rng.next() < 0.3 ? rng.pick(gen.suffixes) : ''}`.trim();
  } else if (type === 'consumable') {
    name = rng.pick(ITEM_GENERATORS.consumable.names);
  } else {
    const gen = ITEM_GENERATORS.accessory;
    name = `${rng.pick(gen.prefixes)} ${rng.pick(gen.bases)} ${rng.next() < 0.3 ? rng.pick(gen.suffixes) : ''}`.trim();
  }

  return {
    id,
    name,
    type,
    rarity: itemRarity,
    description: `A ${itemRarity} ${type} item.`,
    stats: type === 'weapon' || type === 'armor' ? {
      strength: rng.nextInt(1, getRarityValue(itemRarity)),
      agility: rng.nextInt(1, getRarityValue(itemRarity)),
    } : undefined,
  };
}

function generateBuff(buffRarity: Rarity, rng: SeededRandom): Buff {
  const template = EFFECT_GENERATORS.buff;
  const name = rng.pick(template.names);
  return {
    id: `buff_${Date.now()}_${rng.nextInt(1000, 9999)}`,
    name,
    description: `Grants ${name.toLowerCase()} for ${getRarityDuration(buffRarity)} turns.`,
    duration: getRarityDuration(buffRarity),
    effects: [{
      type: 'stat_boost',
      value: getRarityValue(buffRarity),
    }],
  };
}

function generateDebuff(debuffRarity: Rarity, rng: SeededRandom): Debuff {
  const template = EFFECT_GENERATORS.debuff;
  const name = rng.pick(template.names);
  return {
    id: `debuff_${Date.now()}_${rng.nextInt(1000, 9999)}`,
    name,
    description: `Inflicts ${name.toLowerCase()} for ${getRarityDuration(debuffRarity)} turns.`,
    duration: getRarityDuration(debuffRarity),
    effects: [{
      type: 'stat_reduction',
      value: getRarityValue(debuffRarity),
    }],
  };
}

function generateEnemy(_rarity: Rarity, difficulty: number, rng: SeededRandom): Enemy {
  const enemyNames = ['Goblin', 'Bandit', 'Beast', 'Undead', 'Dragon', 'Troll'];
  const name = rng.pick(enemyNames);
  const baseHealth = difficulty * 10;
  const baseAttack = difficulty * 2;

  return {
    id: `enemy_${Date.now()}_${rng.nextInt(1000, 9999)}`,
    name,
    health: baseHealth,
    maxHealth: baseHealth,
    attack: baseAttack,
    defense: difficulty,
    abilities: [],
  };
}

function generateDialogue(npcType: string, rng: SeededRandom): unknown {
  const dialogues = {
    merchant: ['Welcome! I have fine wares for sale.', 'Looking for something specific?'],
    quest_giver: ['I have a task for you, adventurer.', 'Can you help me with something?'],
    healer: ['You look injured. Let me help.', 'Rest here, traveler.'],
    trainer: ['I can teach you new skills.', 'Want to learn something?'],
    storyteller: ['Let me tell you a tale...', 'Have you heard the legend?'],
    random: ['Hello there!', 'What brings you here?'],
  };
  return rng.pick(dialogues[npcType as keyof typeof dialogues] || dialogues.random);
}

function generateQuest(questRarity: Rarity, rng: SeededRandom): { type: string; reward: Item } {
  return {
    type: rng.pick(['fetch', 'kill', 'explore']),
    reward: generateItem(questRarity, rng),
  };
}

function generateGoldAmount(rarity: Rarity, rng: SeededRandom): number {
  const base = getRarityValue(rarity) * 10;
  return base + rng.nextInt(0, base);
}

function generateExperienceAmount(expRarity: Rarity, rng: SeededRandom): number {
  const base = getRarityValue(expRarity) * 5;
  return base + rng.nextInt(0, base);
}

function generateDamageAmount(rarity: Rarity, rng: SeededRandom): number {
  return getRarityValue(rarity) * 2 + rng.nextInt(0, getRarityValue(rarity));
}

function generateHealAmount(healRarity: Rarity, rng: SeededRandom): number {
  return getRarityValue(healRarity) * 3 + rng.nextInt(0, getRarityValue(healRarity) * 2);
}

function generateTrapConsequence(_rarity: Rarity, rng: SeededRandom): string {
  const consequences = [
    'You take damage!',
    'You are slowed!',
    'You are poisoned!',
    'You are stunned!',
  ];
  return rng.pick(consequences);
}

function generateShrineEffect(_rarity: Rarity, rng: SeededRandom): string {
  const effects = [
    'restores your health',
    'increases your power',
    'blesses you with luck',
    'grants you wisdom',
  ];
  return rng.pick(effects);
}

function getRarityValue(rarity: Rarity): number {
  const values = { common: 1, uncommon: 2, rare: 3, epic: 5, legendary: 10 };
  return values[rarity];
}

function getRarityDuration(rarity: Rarity): number {
  const durations = { common: 2, uncommon: 3, rare: 5, epic: 7, legendary: 10 };
  return durations[rarity];
}

function getRarityDifficulty(rarity: Rarity, rng: SeededRandom): number {
  const base = getRarityValue(rarity);
  return base + rng.nextInt(0, base);
}

/**
 * Generate multiple unique events (for board population)
 * Uses smart seeding to ensure variety
 */
export function generateEventPool(count: number, seed?: string): GameEvent[] {
  const events: GameEvent[] = [];
  const rarities: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
  const types: EventType[] = ['treasure', 'combat', 'npc', 'trap', 'shrine', 'quest', 'random'];

  for (let i = 0; i < count; i++) {
    const eventSeed = seed ? `${seed}_${i}` : `${Date.now()}_${i}`;
    const type = types[i % types.length];
    const rarity = rarities[Math.floor(i / types.length) % rarities.length];
    events.push(generateEvent(type, rarity, eventSeed));
  }

  return events;
}
