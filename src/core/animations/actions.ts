/**
 * Animation System - Svelte Actions
 * 
 * Reusable Svelte actions for applying animations to elements
 * Completely decoupled from business logic
 */

import type { Action } from 'svelte/action';
import { get } from 'svelte/store';
import { getPresetConfig } from './presets';
import { animationsEnabled, getEffectiveConfig } from './store';
import type { AnimationConfig, AnimationPreset, AnimationResult } from './types';

/**
 * Convert easing name to CSS easing function
 */
function convertEasing(easingName: string | undefined): string {
  if (!easingName || typeof easingName !== 'string') {
    return 'cubic-bezier(0.33, 1, 0.68, 1)'; // easeOutCubic
  }
  
  const lower = easingName.toLowerCase();
  
  // Map to CSS cubic-bezier or timing functions
  const easingMap: Record<string, string> = {
    'linear': 'linear',
    'easeinquad': 'cubic-bezier(0.55, 0.085, 0.68, 0.53)',
    'easeoutquad': 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    'easeinoutquad': 'cubic-bezier(0.455, 0.03, 0.515, 0.955)',
    'easeincubic': 'cubic-bezier(0.55, 0.055, 0.675, 0.19)',
    'easeoutcubic': 'cubic-bezier(0.33, 1, 0.68, 1)',
    'easeinoutcubic': 'cubic-bezier(0.645, 0.045, 0.355, 1)',
    'easeinquart': 'cubic-bezier(0.895, 0.03, 0.685, 0.22)',
    'easeoutquart': 'cubic-bezier(0.165, 0.84, 0.44, 1)',
    'easeinoutquart': 'cubic-bezier(0.77, 0, 0.175, 1)',
    'easeinquint': 'cubic-bezier(0.755, 0.05, 0.855, 0.06)',
    'easeoutquint': 'cubic-bezier(0.23, 1, 0.32, 1)',
    'easeinoutquint': 'cubic-bezier(0.86, 0, 0.07, 1)',
    'easeinsine': 'cubic-bezier(0.47, 0, 0.745, 0.715)',
    'easeoutsine': 'cubic-bezier(0.39, 0.575, 0.565, 1)',
    'easeinoutsine': 'cubic-bezier(0.445, 0.05, 0.55, 0.95)',
    'easeinexpo': 'cubic-bezier(0.95, 0.05, 0.795, 0.035)',
    'easeoutexpo': 'cubic-bezier(0.19, 1, 0.22, 1)',
    'easeinoutexpo': 'cubic-bezier(1, 0, 0, 1)',
    'easeincirc': 'cubic-bezier(0.6, 0.04, 0.98, 0.335)',
    'easeoutcirc': 'cubic-bezier(0.075, 0.82, 0.165, 1)',
    'easeinoutcirc': 'cubic-bezier(0.785, 0.135, 0.15, 0.86)',
    'easeinback': 'cubic-bezier(0.6, -0.28, 0.735, 0.045)',
    'easeoutback': 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    'easeinoutback': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    'easeinelastic': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    'easeoutelastic': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    'easeinoutelastic': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    'easeinbounce': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    'easeoutbounce': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    'easeinoutbounce': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  };
  
  // Try direct match first
  if (easingMap[lower]) {
    return easingMap[lower];
  }
  
  // Try without 'ease' prefix
  const withoutEase = lower.replace(/^ease/, '');
  if (easingMap[withoutEase]) {
    return easingMap[withoutEase];
  }
  
  // Fallback to easeOutCubic
  return 'cubic-bezier(0.33, 1, 0.68, 1)';
}

/**
 * Animation keyframes and options for Web Animations API
 */
interface AnimationKeyframes {
  opacity?: number | number[];
  transform?: string | string[];
  boxShadow?: string | string[];
}

interface AnimationOptions {
  duration: number;
  delay: number;
  easing: string;
  iterations?: number;
  fill?: 'forwards' | 'backwards' | 'both' | 'none';
}

/**
 * Build Web Animations API keyframes and options from preset config
 */
function buildAnimationConfig(
  node: HTMLElement,
  presetConfig: any,
  effectiveConfig: AnimationConfig,
  easingName: string
): { keyframes: AnimationKeyframes[]; options: AnimationOptions } {
  // Validate node is a valid HTMLElement
  if (!node || !(node instanceof HTMLElement)) {
    console.error('[Animations] Invalid node passed to buildAnimationConfig:', node);
    throw new Error('Invalid HTMLElement node for animation');
  }
  
  const { easing, boxShadow, duration, delay, ...validPresetProps } = presetConfig;
  
  const finalDuration = effectiveConfig.duration ?? duration ?? 300;
  const finalDelay = effectiveConfig.delay ?? delay ?? 0;
  const finalEasing = convertEasing(easingName);
  
  // Helper to get value from array or number
  const getValue = (val: any, index: number): number => {
    if (Array.isArray(val)) {
      return val[index] ?? val[val.length - 1] ?? 0;
    }
    if (typeof val === 'function') {
      return val(node, 0);
    }
    return typeof val === 'number' ? val : 0;
  };
  
  // Helper to get max array length across all properties
  const getMaxKeyframeCount = (): number => {
    let maxCount = 2; // Default to 2 keyframes
    const props = ['opacity', 'translateX', 'translateY', 'scale', 'rotate', 'rotateX', 'rotateY'];
    for (const prop of props) {
      const val = validPresetProps[prop];
      if (Array.isArray(val) && val.length > maxCount) {
        maxCount = val.length;
      }
    }
    // Check custom config too
    if (effectiveConfig.custom) {
      for (const prop of props) {
        const val = effectiveConfig.custom[prop];
        if (Array.isArray(val) && val.length > maxCount) {
          maxCount = val.length;
        }
      }
    }
    return maxCount;
  };
  
  const keyframeCount = getMaxKeyframeCount();
  const keyframes: AnimationKeyframes[] = Array.from({ length: keyframeCount }, () => ({}));
  
  // Helper to build transform string for a given keyframe index
  const buildTransform = (index: number, useCustom = false): string => {
    const source = useCustom && effectiveConfig.custom ? effectiveConfig.custom : validPresetProps;
    const tx = source.translateX !== undefined ? getValue(source.translateX, index) : 0;
    const ty = source.translateY !== undefined ? getValue(source.translateY, index) : 0;
    const s = source.scale !== undefined ? getValue(source.scale, index) : 1;
    const r = source.rotate !== undefined ? getValue(source.rotate, index) : 0;
    const rx = source.rotateX !== undefined ? getValue(source.rotateX, index) : 0;
    const ry = source.rotateY !== undefined ? getValue(source.rotateY, index) : 0;
    return `translate(${tx}px, ${ty}px) scale(${s}) rotate(${r}deg) rotateX(${rx}deg) rotateY(${ry}deg)`;
  };
  
  // Handle opacity
  if (validPresetProps.opacity !== undefined) {
    for (let i = 0; i < keyframeCount; i++) {
      keyframes[i].opacity = getValue(validPresetProps.opacity, i);
    }
  }
  
  // Handle transforms
  if (validPresetProps.translateX !== undefined || validPresetProps.translateY !== undefined || 
      validPresetProps.scale !== undefined || validPresetProps.rotate !== undefined ||
      validPresetProps.rotateX !== undefined || validPresetProps.rotateY !== undefined) {
    for (let i = 0; i < keyframeCount; i++) {
      keyframes[i].transform = buildTransform(i);
    }
  }
  
  // Handle custom properties (override preset)
  if (effectiveConfig.custom && typeof effectiveConfig.custom === 'object') {
    const custom = effectiveConfig.custom;
    if (custom.opacity !== undefined) {
      for (let i = 0; i < keyframeCount; i++) {
        keyframes[i].opacity = getValue(custom.opacity, i);
      }
    }
    if (custom.translateX !== undefined || custom.translateY !== undefined || 
        custom.scale !== undefined || custom.rotate !== undefined ||
        custom.rotateX !== undefined || custom.rotateY !== undefined) {
      for (let i = 0; i < keyframeCount; i++) {
        keyframes[i].transform = buildTransform(i, true);
      }
    }
  }
  
  // Handle boxShadow
  if (validPresetProps.boxShadow !== undefined) {
    for (let i = 0; i < keyframeCount; i++) {
      const shadow = Array.isArray(validPresetProps.boxShadow) 
        ? validPresetProps.boxShadow[i] ?? validPresetProps.boxShadow[validPresetProps.boxShadow.length - 1]
        : validPresetProps.boxShadow;
      keyframes[i].boxShadow = typeof shadow === 'string' ? shadow : '';
    }
  }
  
  // Build options
  const options: AnimationOptions = {
    duration: finalDuration,
    delay: finalDelay,
    easing: finalEasing,
    fill: 'forwards' as const,
  };
  
  // Handle loop
  if (validPresetProps.loop !== undefined) {
    if (typeof validPresetProps.loop === 'boolean' && validPresetProps.loop) {
      options.iterations = Infinity;
    } else if (typeof validPresetProps.loop === 'number') {
      options.iterations = validPresetProps.loop;
    }
  }
  
  return { keyframes, options };
}

/**
 * Animation action for Svelte components
 * 
 * Usage:
 * ```svelte
 * <div use:animate={{ preset: 'fadeIn', duration: 300 }}>
 *   Content
 * </div>
 * ```
 */
export const animate: Action<HTMLElement, AnimationConfig | AnimationPreset | string> = (
  node,
  config
) => {
  // Handle string shorthand (just preset name)
  const fullConfig: AnimationConfig = typeof config === 'string' 
    ? { preset: config as AnimationPreset }
    : (typeof config === 'object' && config !== null ? config : {});
  
  // Check if animations are enabled
  if (!get(animationsEnabled) || fullConfig.enabled === false) {
    return {
      destroy() {}
    };
  }
  
  // Get effective config with user overrides
  const effectiveConfig = getEffectiveConfig(fullConfig.id, fullConfig);
  
  if (effectiveConfig.enabled === false) {
    return {
      destroy() {}
    };
  }
  
  // Determine trigger
  const trigger = effectiveConfig.trigger || 'mount';
  
  let animationInstance: Animation | null = null;
  let progressTracker: number | null = null;
  let isPlaying = false;
  let progress = 0;
  
  // Get preset config
  const preset = effectiveConfig.preset || 'fadeIn';
  
  // Early exit for 'none' preset
  if (preset === 'none') {
    return {
      update() {},
      destroy() {}
    };
  }
  
  const presetConfig = getPresetConfig(preset, effectiveConfig);
  
  // Validate presetConfig is an object
  if (!presetConfig || typeof presetConfig !== 'object') {
    console.warn(`[Animations] Invalid preset config for preset: ${preset}`, presetConfig);
    return {
      update() {},
      destroy() {}
    };
  }
  
  // Play animation based on trigger
  function playAnimation(): void {
    // Cancel existing animation if any
    if (animationInstance) {
      animationInstance.cancel();
      animationInstance = null;
    }
    
    // Clear progress tracker
    if (progressTracker !== null) {
      cancelAnimationFrame(progressTracker);
      progressTracker = null;
    }
    
    try {
      // Validate node is a valid HTMLElement
      if (!node || !(node instanceof HTMLElement)) {
        console.error('[Animations] Invalid node for animation:', node);
        return;
      }
      
      // Check if node is still in the DOM
      if (!node.isConnected) {
        // Silently skip - this is expected during initial mount
        return;
      }
      
      // Rebuild config fresh from current effective config
      const currentEffectiveConfig = getEffectiveConfig(fullConfig.id, fullConfig);
      const currentPreset = currentEffectiveConfig.preset || 'fadeIn';
      
      // Skip if preset is 'none'
      if (currentPreset === 'none') {
        return;
      }
      
      const currentPresetConfig = getPresetConfig(currentPreset, currentEffectiveConfig);
      
      // Validate presetConfig is an object
      if (!currentPresetConfig || typeof currentPresetConfig !== 'object') {
        console.warn(`[Animations] Invalid preset config for preset: ${currentPreset}`, currentPresetConfig);
        return;
      }
      
      const currentEasingName = currentEffectiveConfig.easing ?? currentPresetConfig.easing ?? 'easeOutCubic';
      const { keyframes, options } = buildAnimationConfig(node, currentPresetConfig, currentEffectiveConfig, currentEasingName);
      
      // Check if we have any keyframes to animate
      const hasKeyframes = keyframes.some(kf => 
        kf.opacity !== undefined || kf.transform !== undefined || kf.boxShadow !== undefined
      );
      
      if (!hasKeyframes) {
        // No keyframes, just call callbacks
        currentEffectiveConfig.onStart?.();
        currentEffectiveConfig.onUpdate?.(1);
        currentEffectiveConfig.onComplete?.();
        return;
      }
      
      // Handle perspective
      if (currentPresetConfig.perspective !== undefined && typeof currentPresetConfig.perspective === 'number') {
        node.style.perspective = `${currentPresetConfig.perspective}px`;
      }
      
      // Call onStart
      isPlaying = true;
      progress = 0;
      currentEffectiveConfig.onStart?.();
      
      // Create animation using Web Animations API
      // Cast keyframes to Keyframe[] for Web Animations API compatibility
      const anim = node.animate(keyframes as Keyframe[], options);
      animationInstance = anim;
      
      // Track progress
      const trackProgress = () => {
        if (!anim || anim.playState === 'finished' || anim.playState === 'idle') {
          progress = 1;
          isPlaying = false;
          currentEffectiveConfig.onUpdate?.(1);
          currentEffectiveConfig.onComplete?.();
          progressTracker = null;
          return;
        }
        
        if (anim.currentTime !== null && anim.effect) {
          const timing = (anim.effect as KeyframeEffect).getTiming();
          const duration = timing.duration as number;
          progress = Math.min(1, Math.max(0, (anim.currentTime as number) / duration));
          currentEffectiveConfig.onUpdate?.(progress);
        }
        
        progressTracker = requestAnimationFrame(trackProgress);
      };
      
      // Start tracking progress
      progressTracker = requestAnimationFrame(trackProgress);
      
      // Handle completion
      anim.addEventListener('finish', () => {
        isPlaying = false;
        progress = 1;
        currentEffectiveConfig.onUpdate?.(1);
        currentEffectiveConfig.onComplete?.();
        if (progressTracker !== null) {
          cancelAnimationFrame(progressTracker);
          progressTracker = null;
        }
      });
      
      // Handle cancellation
      anim.addEventListener('cancel', () => {
        isPlaying = false;
        if (progressTracker !== null) {
          cancelAnimationFrame(progressTracker);
          progressTracker = null;
        }
      });
      
    } catch (error) {
      console.error('[Animations] Failed to create animation:', error);
      isPlaying = false;
      progress = 0;
    }
  }
  
  // Helper to wait for element to be connected to DOM
  function waitForConnection(callback: () => void, maxAttempts = 10): void {
    let attempts = 0;
    const check = () => {
      if (node.isConnected) {
        callback();
      } else if (attempts < maxAttempts) {
        attempts++;
        requestAnimationFrame(check);
      }
    };
    requestAnimationFrame(check);
  }
  
  // Handle different triggers
  if (trigger === 'mount') {
    // Wait for element to be connected to DOM before animating
    waitForConnection(() => {
      playAnimation();
    });
  } else if (trigger === 'hover') {
    node.addEventListener('mouseenter', playAnimation);
  } else if (trigger === 'click') {
    node.addEventListener('click', playAnimation);
  } else if (trigger === 'focus') {
    node.addEventListener('focus', playAnimation);
  } else if (trigger === 'blur') {
    node.addEventListener('blur', playAnimation);
  }
  
  // Return animation control API
  const result: AnimationResult = {
    play: async () => {
      playAnimation();
      // Wait for completion
      return new Promise<void>((resolve) => {
        if (!animationInstance) {
          resolve();
          return;
        }
        const checkComplete = () => {
          if (animationInstance && animationInstance.playState === 'finished') {
            resolve();
          } else if (!animationInstance) {
            resolve();
          } else {
            requestAnimationFrame(checkComplete);
          }
        };
        checkComplete();
      });
    },
    pause: () => {
      animationInstance?.pause();
      isPlaying = false;
    },
    resume: () => {
      animationInstance?.play();
      isPlaying = true;
    },
    stop: () => {
      if (animationInstance) {
        animationInstance.cancel();
        animationInstance = null;
      }
      if (progressTracker !== null) {
        cancelAnimationFrame(progressTracker);
        progressTracker = null;
      }
      isPlaying = false;
      progress = 0;
    },
    restart: async () => {
      result.stop();
      await new Promise(resolve => requestAnimationFrame(resolve));
      return result.play();
    },
    isPlaying: () => isPlaying,
    getProgress: () => progress,
  };
  
  // Store result on node for programmatic access
  (node as any).__animation = result;
  
  return {
    update(newConfig) {
      // If trigger is 'mount' and animation has already run, ignore updates
      // This prevents re-animation when props like 'index' change
      if (trigger === 'mount' && animationInstance !== null) {
        return;
      }
      
      // Validate newConfig - clean it of any Svelte internal properties
      let cleanedConfig: AnimationConfig | AnimationPreset | string;
      if (typeof newConfig === 'string') {
        cleanedConfig = newConfig;
      } else if (typeof newConfig === 'object' && newConfig !== null) {
        // Create a clean copy without Svelte internal properties
        const clean: any = {};
        const allowedKeys = ['preset', 'custom', 'duration', 'easing', 'delay', 'trigger', 'stagger', 'enabled', 'id', 'onStart', 'onComplete', 'onUpdate'];
        for (const key of allowedKeys) {
          if (key in newConfig) {
            clean[key] = (newConfig as any)[key];
          }
        }
        cleanedConfig = clean;
      } else {
        cleanedConfig = {};
      }
      
      // Update config and restart if needed
      const newFullConfig: AnimationConfig = typeof cleanedConfig === 'string' 
        ? { preset: cleanedConfig as AnimationPreset }
        : (typeof cleanedConfig === 'object' && cleanedConfig !== null ? cleanedConfig : {});
      
      // Update the closure variable for playAnimation to use
      Object.assign(fullConfig, newFullConfig);
      
      // Stop existing animation
      if (animationInstance) {
        animationInstance.cancel();
        animationInstance = null;
      }
      if (progressTracker !== null) {
        cancelAnimationFrame(progressTracker);
        progressTracker = null;
      }
      
      // Get new effective config
      const newEffectiveConfig = getEffectiveConfig(newFullConfig.id, newFullConfig);
      const newPreset = newEffectiveConfig.preset || 'fadeIn';
      
      // If preset is 'none', stop any existing animation and return
      if (newPreset === 'none') {
        isPlaying = false;
        progress = 0;
        return;
      }
      
      // Restart animation with new config if needed
      if (trigger === 'mount' || isPlaying) {
        playAnimation();
      }
    },
    destroy() {
      // Cancel animation
      if (animationInstance) {
        animationInstance.cancel();
        animationInstance = null;
      }
      if (progressTracker !== null) {
        cancelAnimationFrame(progressTracker);
        progressTracker = null;
      }
      
      // Remove event listeners
      if (trigger === 'hover') {
        node.removeEventListener('mouseenter', playAnimation);
      } else if (trigger === 'click') {
        node.removeEventListener('click', playAnimation);
      } else if (trigger === 'focus') {
        node.removeEventListener('focus', playAnimation);
      } else if (trigger === 'blur') {
        node.removeEventListener('blur', playAnimation);
      }
      
      delete (node as any).__animation;
    },
  };
};

/**
 * Stagger animation for multiple elements
 * 
 * Usage:
 * ```svelte
 * <div use:stagger={{ preset: 'fadeIn', stagger: 50 }}>
 *   {#each items as item}
 *     <div use:animate={{ preset: 'fadeIn' }}>{item}</div>
 *   {/each}
 * </div>
 * ```
 */
export const stagger: Action<HTMLElement, { preset?: AnimationPreset; stagger?: number; config?: Partial<AnimationConfig> }> = (
  node,
  config
) => {
  const staggerDelay = config?.stagger ?? 100;
  const preset = config?.preset || 'fadeIn';
  const baseConfig = config?.config || {};
  
  // Find all child elements
  const children = Array.from(node.children) as HTMLElement[];
  
  if (children.length === 0) {
    return {
      destroy() {}
    };
  }
  
  // Apply staggered animations
  children.forEach((child, index) => {
    const childConfig: AnimationConfig = {
      ...baseConfig,
      preset,
      delay: (baseConfig.delay ?? 0) + (index * staggerDelay),
    };
    
    animate(child, childConfig);
  });
  
  return {
    update(newConfig) {
      // Reapply with new config
      children.forEach((child, index) => {
        const childConfig: AnimationConfig = {
          ...newConfig?.config || {},
          preset: newConfig?.preset || preset,
          delay: (newConfig?.config?.delay ?? 0) + (index * (newConfig?.stagger ?? staggerDelay)),
        };
        
        animate(child, childConfig);
      });
    },
    destroy() {}
  };
};

