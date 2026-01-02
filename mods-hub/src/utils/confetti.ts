/**
 * Confetti Effects Utility for Mods Hub
 * 
 * Lightweight particle effects using canvas-confetti CDN
 * All effects are debounced and optimized for performance
 */

declare global {
  interface Window {
    confetti: (options?: ConfettiOptions) => void;
  }
}

interface ConfettiOptions {
  particleCount?: number;
  angle?: number;
  spread?: number;
  startVelocity?: number;
  decay?: number;
  gravity?: number;
  drift?: number;
  ticks?: number;
  origin?: { x: number; y: number };
  colors?: string[];
  shapes?: ('square' | 'circle')[];
  scalar?: number;
  zIndex?: number;
}

// Debounce helper
function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Check if confetti is available
function isConfettiAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.confetti === 'function';
}

/**
 * Trigger a success celebration with confetti
 */
export function celebrateSuccess(element?: HTMLElement): void {
  if (!isConfettiAvailable()) return;
  
  const origin = element
    ? {
        x: (element.getBoundingClientRect().left + element.getBoundingClientRect().width / 2) / window.innerWidth,
        y: (element.getBoundingClientRect().top + element.getBoundingClientRect().height / 2) / window.innerHeight,
      }
    : { x: 0.5, y: 0.5 };

  // Main burst
  window.confetti({
    particleCount: 100,
    spread: 70,
    origin,
    colors: ['#edae49', '#f9df74', '#28a745', '#6495ed'],
  });

  // Secondary burst after delay
  setTimeout(() => {
    window.confetti({
      particleCount: 50,
      angle: 60,
      spread: 55,
      origin,
      colors: ['#edae49', '#f9df74'],
    });
  }, 250);

  setTimeout(() => {
    window.confetti({
      particleCount: 50,
      angle: 120,
      spread: 55,
      origin,
      colors: ['#edae49', '#f9df74'],
    });
  }, 400);
}

/**
 * Trigger a subtle click effect
 */
export const celebrateClick = debounce((element?: HTMLElement) => {
  if (!isConfettiAvailable()) return;
  
  const origin = element
    ? {
        x: (element.getBoundingClientRect().left + element.getBoundingClientRect().width / 2) / window.innerWidth,
        y: (element.getBoundingClientRect().top + element.getBoundingClientRect().height / 2) / window.innerHeight,
      }
    : { x: 0.5, y: 0.5 };

  window.confetti({
    particleCount: 30,
    spread: 45,
    origin,
    colors: ['#edae49', '#f9df74'],
    scalar: 0.8,
  });
}, 100);

/**
 * Trigger an error/warning effect
 */
export function showError(element?: HTMLElement): void {
  if (!isConfettiAvailable()) return;
  
  const origin = element
    ? {
        x: (element.getBoundingClientRect().left + element.getBoundingClientRect().width / 2) / window.innerWidth,
        y: (element.getBoundingClientRect().top + element.getBoundingClientRect().height / 2) / window.innerHeight,
      }
    : { x: 0.5, y: 0.5 };

  window.confetti({
    particleCount: 20,
    spread: 30,
    origin,
    colors: ['#ea2b1f', '#ffc107'],
    scalar: 0.6,
  });
}
