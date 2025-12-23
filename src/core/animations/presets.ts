/**
 * Animation System - Presets
 * 
 * Predefined animation presets using Web Animations API
 */

import type { AnimationConfig, AnimationPreset, AnimationPropertyConfig } from './types';

/**
 * Animation preset definitions
 * Matches Lua source animations and text cycler transitions
 */
export const ANIMATION_PRESETS: Record<AnimationPreset, (config?: Partial<AnimationConfig>) => Partial<AnimationPropertyConfig>> = {
  // Basic fade (Lua compatible)
  fade: (config) => ({
    opacity: config?.trigger === 'unmount' ? [1, 0] : [0, 1],
    duration: config?.duration ?? 300,
    easing: (config?.easing ?? 'easeOutCubic') as any,
    delay: config?.delay ?? 0,
  }),
  
  fadeIn: (config) => ({
    opacity: [0, 1],
    duration: config?.duration ?? 300,
    easing: (config?.easing ?? 'easeOutCubic') as any,
    delay: config?.delay ?? 0,
  }),
  
  fadeOut: (config) => ({
    opacity: [1, 0],
    duration: config?.duration ?? 300,
    easing: (config?.easing ?? 'easeInCubic') as any,
    delay: config?.delay ?? 0,
  }),
  
  // Slide animations (Lua compatible - supports direction)
  slide: (config) => {
    const direction = (config?.custom as any)?.direction || 'left';
    const offset = (config?.custom as any)?.offset || 100;
    
    let translateX = 0;
    let translateY = 0;
    
    if (direction === 'left') translateX = offset;
    else if (direction === 'right') translateX = -offset;
    else if (direction === 'up') translateY = offset;
    else if (direction === 'down') translateY = -offset;
    
    const isOut = config?.trigger === 'unmount';
    
    return {
      translateX: isOut ? [0, translateX] : [translateX, 0],
      translateY: isOut ? [0, translateY] : [translateY, 0],
      opacity: isOut ? [1, 0] : [0, 1],
      duration: config?.duration ?? 400,
      easing: (config?.easing ?? 'easeOutCubic') as any,
      delay: config?.delay ?? 0,
    };
  },
  
  slideUp: (config) => ({
    translateY: [20, 0],
    opacity: [0, 1],
    duration: config?.duration ?? 300,
    easing: (config?.easing ?? 'easeOutCubic') as any,
    delay: config?.delay ?? 0,
  }),
  
  slideDown: (config) => ({
    translateY: [-20, 0],
    opacity: [0, 1],
    duration: config?.duration ?? 300,
    easing: (config?.easing ?? 'easeOutCubic') as any,
    delay: config?.delay ?? 0,
  }),
  
  slideLeft: (config) => ({
    translateX: [20, 0],
    opacity: [0, 1],
    duration: config?.duration ?? 300,
    easing: (config?.easing ?? 'easeOutCubic') as any,
    delay: config?.delay ?? 0,
  }),
  
  slideRight: (config) => ({
    translateX: [-20, 0],
    opacity: [0, 1],
    duration: config?.duration ?? 300,
    easing: (config?.easing ?? 'easeOutCubic') as any,
    delay: config?.delay ?? 0,
  }),
  
  scaleIn: (config) => ({
    scale: [0.8, 1],
    opacity: [0, 1],
    duration: config?.duration ?? 300,
    easing: (config?.easing ?? 'easeOutBack') as any,
    delay: config?.delay ?? 0,
  }),
  
  scaleOut: (config) => ({
    scale: [1, 0.8],
    opacity: [1, 0],
    duration: config?.duration ?? 300,
    easing: (config?.easing ?? 'easeInBack') as any,
    delay: config?.delay ?? 0,
  }),
  
  bounceIn: (config) => ({
    scale: [0.3, 1.1, 0.9, 1],
    opacity: [0, 1],
    duration: config?.duration ?? 500,
    easing: (config?.easing ?? 'easeOutBack') as any,
    delay: config?.delay ?? 0,
  }),
  
  bounceOut: (config) => ({
    scale: [1, 1.1, 0.3],
    opacity: [1, 0],
    duration: config?.duration ?? 400,
    easing: (config?.easing ?? 'easeInBack') as any,
    delay: config?.delay ?? 0,
  }),
  
  rotateIn: (config) => ({
    rotate: [-180, 0],
    opacity: [0, 1],
    duration: config?.duration ?? 400,
    easing: (config?.easing ?? 'easeOutCubic') as any,
    delay: config?.delay ?? 0,
  }),
  
  rotateOut: (config) => ({
    rotate: [0, 180],
    opacity: [1, 0],
    duration: config?.duration ?? 400,
    easing: (config?.easing ?? 'easeInCubic') as any,
    delay: config?.delay ?? 0,
  }),
  
  flipX: (config) => ({
    rotateX: [90, 0],
    opacity: [0, 1],
    duration: config?.duration ?? 400,
    easing: (config?.easing ?? 'easeOutCubic') as any,
    delay: config?.delay ?? 0,
    perspective: 1000,
  }),
  
  flipY: (config) => ({
    rotateY: [90, 0],
    opacity: [0, 1],
    duration: config?.duration ?? 400,
    easing: (config?.easing ?? 'easeOutCubic') as any,
    delay: config?.delay ?? 0,
    perspective: 1000,
  }),
  
  // Zoom (Lua compatible)
  zoom: (config) => {
    const isOut = config?.trigger === 'unmount';
    return {
      scale: isOut ? [1, 0.01] : [0.01, 1],
      opacity: isOut ? [1, 0] : [0, 1],
      duration: config?.duration ?? 500,
      easing: (config?.easing ?? 'easeInOutCubic') as any,
      delay: config?.delay ?? 0,
    };
  },
  
  zoomIn: (config) => ({
    scale: [0, 1],
    opacity: [0, 1],
    duration: config?.duration ?? 400,
    easing: (config?.easing ?? 'easeOutBack') as any,
    delay: config?.delay ?? 0,
  }),
  
  zoomOut: (config) => ({
    scale: [1, 0],
    opacity: [1, 0],
    duration: config?.duration ?? 400,
    easing: (config?.easing ?? 'easeInBack') as any,
    delay: config?.delay ?? 0,
  }),
  
  // Pop (Lua compatible - bouncy zoom)
  pop: (config) => {
    const isOut = config?.trigger === 'unmount';
    return {
      scale: isOut ? [1, 0.01] : [0.01, 1],
      opacity: isOut ? [1, 0] : [0, 1],
      duration: config?.duration ?? 400,
      easing: (config?.easing ?? 'easeOutBack') as any,
      delay: config?.delay ?? 0,
    };
  },
  
  shake: (config) => ({
    translateX: [0, -10, 10, -10, 10, -5, 5, 0],
    duration: config?.duration ?? 500,
    easing: (config?.easing ?? 'easeInOutQuad') as any,
    delay: config?.delay ?? 0,
  }),
  
  pulse: (config) => ({
    scale: [1, 1.05, 1],
    duration: config?.duration ?? 600,
    easing: (config?.easing ?? 'easeInOutQuad') as any,
    delay: config?.delay ?? 0,
    loop: true,
  }),
  
  float: (config) => ({
    translateY: [0, -10, 0],
    duration: config?.duration ?? 2000,
    easing: (config?.easing ?? 'easeInOutSine') as any,
    delay: config?.delay ?? 0,
    loop: true,
  }),
  
  glow: (config) => ({
    boxShadow: [
      '0 0 0px rgba(255, 215, 0, 0)',
      '0 0 20px rgba(255, 215, 0, 0.8)',
      '0 0 0px rgba(255, 215, 0, 0)'
    ],
    duration: config?.duration ?? 1500,
    easing: (config?.easing ?? 'easeInOutSine') as any,
    delay: config?.delay ?? 0,
    loop: true,
  }),
  
  stagger: (config) => ({
    // Stagger is handled by the action, not the preset
    opacity: [0, 1],
    translateY: [20, 0],
    duration: config?.duration ?? 300,
    easing: (config?.easing ?? 'easeOutCubic') as any,
    delay: config?.delay ?? 0,
  }),
  
  // Text cycler transitions (these are handled specially in text components)
  obfuscate: (config) => ({
    // Obfuscate uses text scrambling - handled by text cycler module
    opacity: [0, 1],
    duration: config?.duration ?? 500,
    easing: (config?.easing ?? 'easeOutCubic') as any,
    delay: config?.delay ?? 0,
  }),
  
  typewriter: (config) => ({
    // Typewriter uses character-by-character reveal - handled by text cycler module
    opacity: [0, 1],
    duration: config?.duration ?? 500,
    easing: (config?.easing ?? 'linear') as any,
    delay: config?.delay ?? 0,
  }),
  
  glitch: (config) => ({
    // Glitch uses random character replacement - handled by text cycler module
    opacity: [0, 1],
    duration: config?.duration ?? 500,
    easing: (config?.easing ?? 'easeOutCubic') as any,
    delay: config?.delay ?? 0,
  }),
  
  scramble: (config) => ({
    // Scramble uses full random then snap - handled by text cycler module
    opacity: [0, 1],
    duration: config?.duration ?? 500,
    easing: (config?.easing ?? 'easeOutCubic') as any,
    delay: config?.delay ?? 0,
  }),
  
  wave: (config) => ({
    // Wave uses wave pattern reveal - handled by text cycler module
    opacity: [0, 1],
    duration: config?.duration ?? 500,
    easing: (config?.easing ?? 'easeOutCubic') as any,
    delay: config?.delay ?? 0,
  }),
  
  none: () => ({}),
};

/**
 * Get animation config from preset
 */
export function getPresetConfig(
  preset: AnimationPreset,
  config?: Partial<AnimationConfig>
): Partial<AnimationPropertyConfig> {
  const presetFn = ANIMATION_PRESETS[preset];
  if (!presetFn) {
    console.warn(`[Animations] Unknown preset: ${preset}`);
    return {};
  }
  
  return presetFn(config);
}

