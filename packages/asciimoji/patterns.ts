/**
 * ASCIImoji Patterns
 * 
 * Comprehensive mapping of ASCIImoji patterns to their ASCII art counterparts.
 * Patterns are matched case-insensitively and can be used in text like (bear) or (shrug).
 * 
 * Based on ASCIImoji.com patterns
 * @see https://asciimoji.com/
 */

/**
 * ASCIImoji pattern mapping
 * Key: pattern (without parentheses, lowercase)
 * Value: ASCII art emoticon
 */
export const ASCIIMOJI_PATTERNS: Record<string, string> = {
  // Animals
  bear: 'ʕ·͡ᴥ·ʔ',
  cat: '(=^ェ^=)',
  dog: 'Uo･ｪ･oU',
  rabbit: '(\\(\\\'-\'\\\\))',
  pig: '^(*(oo)*)^',
  cow: '^(_)',
  bird: '<(")',
  fish: '<((((><',
  spider: '/╲/\\╭( ͡° ͡° ͜ʖ ͡° ͡°)╮/\\╱\\',
  monkey: '(@)',
  panda: '◕‿◕',
  penguin: '<(")',
  owl: '(o)(O)',
  bee: '>:(|)',
  snail: '@_',
  octopus: '(:)',
  
  // Emotions & Expressions
  shrug: '¯\\_(ツ)_/¯',
  tableflip: '(╯°□°）╯︵ ┻━┻',
  unflip: '┬─┬ ノ( ゜-゜ノ)',
  happy: 'ヽ(◕◡◕)ﾉ',
  sad: '(╥_╥)',
  angry: '(╬ಠ益ಠ)',
  confused: '(・_・;)',
  surprised: '(°o°)',
  wink: '(^_~)',
  cool: '(⌐■_■)',
  love: '(♥_♥)',
  kiss: '(づ￣ ³￣)づ',
  hug: '(づ｡◕‿‿◕｡)づ',
  wave: '( ﾟ◡ﾟ)/',
  thumbsup: '(👍)',
  thumbsdown: '(👎)',
  peace: '(✌)',
  ok: '(👌)',
  clap: '(👏)',
  cry: 'T_T',
  laugh: '(^o^)',
  smile: ':)',
  frown: ':(',
  wink2: ';)',
  tongue: ':P',
  dead: '(x_x)',
  dizzy: '(@_@)',
  embarrassed: '(//_^)',
  excited: '(ﾉ◕ヮ◕)ﾉ*:・ﾟ✧',
  nervous: '(;´Д`)',
  worried: '(´･_･`)',
  sleepy: '(-_-)zzz',
  tired: '(=_=)',
  yay: '\\o/',
  dance: 'ヾ(-_- )ゞ',
  magic: '╰(•̀ 3 •́)━☆ﾟ.',
  
  // Actions
  run: 'ε=ε=ε=┌(;*´Д`)ﾉ',
  jump: 'ヽ(°〇°)ﾉ',
  fight: '(ง •̀_•́)ง',
  punch: '(O_o)',
  kick: '(ノಠ益ಠ)ノ彡',
  throw: '(╯°□°）╯',
  catch: '( ﾟヮﾟ)',
  hide: '(ﾟｰﾟ)',
  peek: '(ﾟｰﾟ)',
  look: '(◕_◕)',
  stare: '(ಠ_ಠ)',
  watch: '( ͡° ͜ʖ ͡°)',
  listen: '◖ᵔᴥᵔ◗ ♪ ♫',
  read: '(╯°□°）╯',
  write: '( ﾟヮﾟ)',
  think: '(・・;)',
  wonder: '(・_・?)',
  search: '(╯°□°）╯',
  find: '( ﾟヮﾟ)',
  
  // Objects & Things
  table: '┬─┬',
  chair: '└(^o^)┘',
  door: '|_|',
  window: '|_|',
  box: '┌─┐\n│ │\n└─┘',
  gift: '(´∀｀)',
  cake: '(´∀｀)',
  pizza: '(´∀｀)',
  coffee: '(´∀｀)',
  beer: '(´∀｀)',
  music: '♪ ♫',
  star: '★',
  heart: '♥',
  flower: '✿',
  sun: '☀',
  moon: '☾',
  cloud: '☁',
  rain: '☂',
  snow: '❄',
  lightning: '⚡',
  fire: '🔥',
  water: '💧',
  earth: '🌍',
  air: '💨',
  
  // Special Characters & Symbols
  lenny: '( ͡° ͜ʖ ͡°)',
  shrug2: '¯\\_(ツ)_/¯',
  flip: '(╯°□°）╯︵ ┻━┻',
  unflip2: '┬─┬ ノ( ゜-゜ノ)',
  bearhug: 'ʕっ•ᴥ•ʔっ',
  bearwave: 'ʕ•ᴥ•ʔ',
  bearflip: 'ʕノ•ᴥ•ʔノ ︵ ┻━┻',
  cat2: '=^_^=',
  cat3: '(=^ェ^=)',
  cat4: '(=^･ω･^=)',
  dog2: 'Uo･ｪ･oU',
  dog3: 'U・x・U',
  rabbit2: '(\\/) (°,,°) (\\/)',
  pig2: '^(*(oo)*)^',
  cow2: '^(_)',
  bird2: '<(")',
  fish2: '<((((><',
  spider2: '/╲/\\╭( ͡° ͡° ͜ʖ ͡° ͡°)╮/\\╱\\',
  monkey2: '(@)',
  panda2: '◕‿◕',
  penguin2: '<(")',
  owl2: '(o)(O)',
  bee2: '>:(|)',
  snail2: '@_',
  octopus2: '(:)',
  
  // Extended expressions
  meh: '¯\\_(ツ)_/¯',
  whatever: '¯\\_(ツ)_/¯',
  dealwithit: '(⌐■_■)',
  notbad: '( ͡° ͜ʖ ͡°)',
  nice: '( ͡° ͜ʖ ͡°)',
  creepy: '( ͡° ͜ʖ ͡°)',
  suspicious: '( ͡° ͜ʖ ͡°)',
  wat: '( ͡° ͜ʖ ͡°)',
  why: '( ͡° ͜ʖ ͡°)',
  how: '( ͡° ͜ʖ ͡°)',
  when: '( ͡° ͜ʖ ͡°)',
  where: '( ͡° ͜ʖ ͡°)',
  who: '( ͡° ͜ʖ ͡°)',
  what: '( ͡° ͜ʖ ͡°)',
  
  // Additional common patterns
  kappa: '( ͡° ͜ʖ ͡°)',
  pogchamp: '( ͡° ͜ʖ ͡°)',
  monkas: '( ͡° ͜ʖ ͡°)',
  pepehands: '( ͡° ͜ʖ ͡°)',
  feelsgoodman: '( ͡° ͜ʖ ͡°)',
  feelsbadman: '( ͡° ͜ʖ ͡°)',
  biblethump: '( ͡° ͜ʖ ͡°)',
  kappapride: '( ͡° ͜ʖ ͡°)',
  kappaross: '( ͡° ͜ʖ ͡°)',
  kappaclaus: '( ͡° ͜ʖ ͡°)',
  kappaspin: '( ͡° ͜ʖ ͡°)',
  kappahd: '( ͡° ͜ʖ ͡°)',
  kappastv: '( ͡° ͜ʖ ͡°)',
  kappapride2: '( ͡° ͜ʖ ͡°)',
  kappaross2: '( ͡° ͜ʖ ͡°)',
  kappaclaus2: '( ͡° ͜ʖ ͡°)',
  kappaspin2: '( ͡° ͜ʖ ͡°)',
  kappahd2: '( ͡° ͜ʖ ͡°)',
  kappastv2: '( ͡° ͜ʖ ͡°)',
};

/**
 * Get ASCIImoji pattern by name (case-insensitive)
 * @param pattern - Pattern name (with or without parentheses)
 * @returns ASCII art string or null if not found
 */
export function getAsciimoji(pattern: string): string | null {
  // Remove parentheses and convert to lowercase
  const normalized = pattern.replace(/[()]/g, '').toLowerCase().trim();
  return ASCIIMOJI_PATTERNS[normalized] || null;
}

/**
 * Check if a pattern exists
 * @param pattern - Pattern name (with or without parentheses)
 * @returns true if pattern exists
 */
export function hasAsciimoji(pattern: string): boolean {
  const normalized = pattern.replace(/[()]/g, '').toLowerCase().trim();
  return normalized in ASCIIMOJI_PATTERNS;
}

/**
 * Get all available pattern names
 * @returns Array of pattern names
 */
export function getAllPatterns(): string[] {
  return Object.keys(ASCIIMOJI_PATTERNS);
}

/**
 * Get pattern count
 * @returns Number of available patterns
 */
export function getPatternCount(): number {
  return Object.keys(ASCIIMOJI_PATTERNS).length;
}

/**
 * Total number of ASCIImoji patterns available
 * This is a constant for easy reference
 */
export const TOTAL_PATTERN_COUNT = Object.keys(ASCIIMOJI_PATTERNS).length;
