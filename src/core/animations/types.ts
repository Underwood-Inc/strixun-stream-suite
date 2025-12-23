/**
 * Animation System - Type Definitions
 * 
 * Core types for the decoupled, unopinionated animation architecture
 */

/**
 * Animation property config for presets
 * Used internally by the animation system
 */
export type AnimationPropertyConfig = {
  translateX?: number | number[] | ((el: HTMLElement, i: number) => number);
  translateY?: number | number[] | ((el: HTMLElement, i: number) => number);
  scale?: number | number[] | ((el: HTMLElement, i: number) => number);
  rotate?: number | number[] | ((el: HTMLElement, i: number) => number);
  rotateX?: number | number[] | ((el: HTMLElement, i: number) => number);
  rotateY?: number | number[] | ((el: HTMLElement, i: number) => number);
  opacity?: number | number[] | ((el: HTMLElement, i: number) => number);
  boxShadow?: string | string[] | ((el: HTMLElement, i: number) => string);
  duration?: number;
  delay?: number | ((el: HTMLElement, i: number) => number);
  easing?: string;
  loop?: boolean | number;
  perspective?: number;
  [key: string]: any;
};

/**
 * Animation preset identifier
 * Includes all Lua source animations and text cycler transitions
 */
export type AnimationPreset =
  // Basic animations (Lua source animations)
  | 'fade'
  | 'fadeIn'
  | 'fadeOut'
  | 'slide'
  | 'slideUp'
  | 'slideDown'
  | 'slideLeft'
  | 'slideRight'
  | 'zoom'
  | 'zoomIn'
  | 'zoomOut'
  | 'pop'
  | 'scaleIn'
  | 'scaleOut'
  // Text cycler transitions
  | 'obfuscate' // Minecraft enchant scramble
  | 'typewriter'
  | 'glitch'
  | 'scramble'
  | 'wave'
  // Advanced animations
  | 'bounceIn'
  | 'bounceOut'
  | 'rotateIn'
  | 'rotateOut'
  | 'flipX'
  | 'flipY'
  | 'shake'
  | 'pulse'
  | 'float'
  | 'glow'
  | 'stagger'
  | 'none';

/**
 * Easing function names (CSS compatible)
 */
export type EasingFunction =
  | 'linear'
  | 'easeInQuad'
  | 'easeOutQuad'
  | 'easeInOutQuad'
  | 'easeInCubic'
  | 'easeOutCubic'
  | 'easeInOutCubic'
  | 'easeInQuart'
  | 'easeOutQuart'
  | 'easeInOutQuart'
  | 'easeInQuint'
  | 'easeOutQuint'
  | 'easeInOutQuint'
  | 'easeInSine'
  | 'easeOutSine'
  | 'easeInOutSine'
  | 'easeInExpo'
  | 'easeOutExpo'
  | 'easeInOutExpo'
  | 'easeInCirc'
  | 'easeOutCirc'
  | 'easeInOutCirc'
  | 'easeInBack'
  | 'easeOutBack'
  | 'easeInOutBack'
  | 'easeInElastic'
  | 'easeOutElastic'
  | 'easeInOutElastic'
  | 'easeInBounce'
  | 'easeOutBounce'
  | 'easeInOutBounce';

/**
 * Animation trigger - when to animate
 */
export type AnimationTrigger =
  | 'mount' // When element is mounted
  | 'unmount' // When element is unmounted
  | 'enter' // When entering viewport
  | 'leave' // When leaving viewport
  | 'hover' // On hover
  | 'click' // On click
  | 'focus' // On focus
  | 'blur' // On blur
  | 'change' // When a reactive value changes
  | 'custom'; // Custom trigger via API

/**
 * Animation configuration
 */
export interface AnimationConfig {
  /**
   * Preset to use (or 'none' to disable)
   */
  preset?: AnimationPreset;
  
  /**
   * Custom animation properties (overrides preset)
   */
  custom?: Partial<AnimationPropertyConfig>;
  
  /**
   * Duration in milliseconds
   */
  duration?: number;
  
  /**
   * Easing function
   */
  easing?: EasingFunction;
  
  /**
   * Delay before animation starts
   */
  delay?: number;
  
  /**
   * When to trigger the animation
   */
  trigger?: AnimationTrigger;
  
  /**
   * Stagger delay for multiple elements (in milliseconds)
   */
  stagger?: number;
  
  /**
   * Whether animation is enabled (can be overridden by user settings)
   */
  enabled?: boolean;
  
  /**
   * Animation ID for user customization
   */
  id?: string;
  
  /**
   * Callback when animation starts
   */
  onStart?: () => void;
  
  /**
   * Callback when animation completes
   */
  onComplete?: () => void;
  
  /**
   * Callback when animation updates
   */
  onUpdate?: (progress: number) => void;
}

/**
 * User animation preferences
 */
export interface AnimationPreferences {
  /**
   * Global animation enabled/disabled
   */
  enabled: boolean;
  
  /**
   * Global animation speed multiplier (0.5 = half speed, 2 = double speed)
   */
  speed: number;
  
  /**
   * Reduce motion preference (respects prefers-reduced-motion)
   */
  reduceMotion: boolean;
  
  /**
   * Per-animation overrides
   */
  overrides: Record<string, Partial<AnimationConfig>>;
  
  /**
   * Disabled animation IDs
   */
  disabled: string[];
}

/**
 * Animation context for component-level configuration
 */
export interface AnimationContext {
  /**
   * Default preset for this context
   */
  defaultPreset?: AnimationPreset;
  
  /**
   * Default duration
   */
  defaultDuration?: number;
  
  /**
   * Default easing
   */
  defaultEasing?: EasingFunction;
  
  /**
   * Whether animations are enabled in this context
   */
  enabled?: boolean;
}

/**
 * Animation result from action
 */
export interface AnimationResult {
  /**
   * Play the animation
   */
  play: () => Promise<void>;
  
  /**
   * Pause the animation
   */
  pause: () => void;
  
  /**
   * Resume the animation
   */
  resume: () => void;
  
  /**
   * Stop the animation
   */
  stop: () => void;
  
  /**
   * Restart the animation
   */
  restart: () => Promise<void>;
  
  /**
   * Check if animation is playing
   */
  isPlaying: () => boolean;
  
  /**
   * Get animation progress (0-1)
   */
  getProgress: () => number;
}

