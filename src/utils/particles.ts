/**
 * Particle Effects Utility
 * 
 * Lightweight particle effects using canvas-confetti
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

/**
 * Trigger a connection success effect
 */
export function celebrateConnection(): void {
  if (!isConfettiAvailable()) return;
  
  const duration = 3000;
  const animationEnd = Date.now() + duration;
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

  function randomInRange(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }

  const interval = setInterval(() => {
    const timeLeft = animationEnd - Date.now();

    if (timeLeft <= 0) {
      return clearInterval(interval);
    }

    const particleCount = 50 * (timeLeft / duration);

    window.confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      colors: ['#28a745', '#edae49'],
    });
    window.confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      colors: ['#28a745', '#edae49'],
    });
  }, 250);
}

