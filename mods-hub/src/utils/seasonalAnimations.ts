/**
 * Seasonal background animation utility
 * Provides CSS-in-JS styles for seasonal animations compatible with styled-components
 * Automatically detects current season and applies appropriate animations
 */

/**
 * Get the current season based on date
 * @returns 'spring' | 'summer' | 'autumn' | 'winter'
 */
export function getCurrentSeason(): 'spring' | 'summer' | 'autumn' | 'winter' {
  const now = new Date();
  const month = now.getMonth(); // 0-11
  
  // Northern hemisphere seasons
  // Spring: March (2), April (3), May (4)
  // Summer: June (5), July (6), August (7)
  // Autumn: September (8), October (9), November (10)
  // Winter: December (11), January (0), February (1)
  
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'autumn';
  return 'winter';
}

/**
 * Get seasonal animation CSS for styled-components
 * @param opacity - Opacity of particles (0-1)
 * @returns CSS string for seasonal background animation
 */
export function getSeasonalAnimationCSS(opacity: number = 0.6): string {
  const season = getCurrentSeason();
  
  // Base styles for all seasons
  const baseStyles = `
    position: relative;
    overflow: hidden;
    
    &::before,
    &::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 0;
      transform: translateZ(0);
      will-change: transform;
      backface-visibility: hidden;
    }
  `;
  
  // Season-specific styles
  const seasonStyles = {
    autumn: `
      &::before {
        background-image: 
          radial-gradient(circle at 10% 20%, rgba(255, 140, 0, ${opacity}) 2px, transparent 2px),
          radial-gradient(circle at 20% 30%, rgba(255, 165, 0, ${opacity}) 1.5px, transparent 1.5px),
          radial-gradient(circle at 30% 10%, rgba(255, 200, 0, ${opacity}) 2px, transparent 2px),
          radial-gradient(circle at 40% 50%, rgba(255, 140, 0, ${opacity}) 1px, transparent 1px),
          radial-gradient(circle at 50% 70%, rgba(255, 165, 0, ${opacity}) 2px, transparent 2px),
          radial-gradient(circle at 60% 40%, rgba(255, 200, 0, ${opacity}) 1.5px, transparent 1.5px),
          radial-gradient(circle at 70% 80%, rgba(255, 140, 0, ${opacity}) 2px, transparent 2px),
          radial-gradient(circle at 80% 20%, rgba(255, 165, 0, ${opacity}) 1px, transparent 1px),
          radial-gradient(circle at 90% 60%, rgba(255, 200, 0, ${opacity}) 2px, transparent 2px);
        background-size: 
          200% 200%,
          150% 150%,
          180% 180%,
          220% 220%,
          190% 190%,
          160% 160%,
          210% 210%,
          170% 170%,
          200% 200%;
        background-position: 
          0% 0%,
          10% 20%,
          20% 40%,
          30% 60%,
          40% 80%,
          50% 10%,
          60% 30%,
          70% 50%,
          80% 70%;
        animation: fall-leaf 15s linear infinite;
      }
      
      &::after {
        background-image: 
          radial-gradient(circle at 15% 25%, rgba(255, 140, 0, ${opacity}) 1.5px, transparent 1.5px),
          radial-gradient(circle at 25% 45%, rgba(255, 165, 0, ${opacity}) 2px, transparent 2px),
          radial-gradient(circle at 35% 15%, rgba(255, 200, 0, ${opacity}) 1px, transparent 1px),
          radial-gradient(circle at 45% 55%, rgba(255, 140, 0, ${opacity}) 2px, transparent 2px),
          radial-gradient(circle at 55% 75%, rgba(255, 165, 0, ${opacity}) 1.5px, transparent 1.5px),
          radial-gradient(circle at 65% 35%, rgba(255, 200, 0, ${opacity}) 2px, transparent 2px),
          radial-gradient(circle at 75% 85%, rgba(255, 140, 0, ${opacity}) 1px, transparent 1px),
          radial-gradient(circle at 85% 25%, rgba(255, 165, 0, ${opacity}) 2px, transparent 2px),
          radial-gradient(circle at 95% 65%, rgba(255, 200, 0, ${opacity}) 1.5px, transparent 1.5px);
        background-size: 
          180% 180%,
          200% 200%,
          160% 160%,
          190% 190%,
          210% 210%,
          170% 170%,
          200% 200%,
          150% 150%,
          180% 180%;
        background-position: 
          5% 10%,
          15% 30%,
          25% 50%,
          35% 70%,
          45% 90%,
          55% 15%,
          65% 35%,
          75% 55%,
          85% 75%;
        animation: fall-leaf 18s linear infinite reverse;
      }
    `,
    winter: `
      &::before {
        background-image: 
          radial-gradient(circle at 10% 20%, rgba(255, 255, 255, ${opacity}) 3px, transparent 3px),
          radial-gradient(circle at 20% 30%, rgba(240, 248, 255, ${opacity}) 2px, transparent 2px),
          radial-gradient(circle at 30% 10%, rgba(255, 255, 255, ${opacity}) 2.5px, transparent 2.5px),
          radial-gradient(circle at 40% 50%, rgba(240, 248, 255, ${opacity}) 3px, transparent 3px),
          radial-gradient(circle at 50% 70%, rgba(255, 255, 255, ${opacity}) 2px, transparent 2px),
          radial-gradient(circle at 60% 40%, rgba(240, 248, 255, ${opacity}) 2.5px, transparent 2.5px),
          radial-gradient(circle at 70% 80%, rgba(255, 255, 255, ${opacity}) 3px, transparent 3px),
          radial-gradient(circle at 80% 20%, rgba(240, 248, 255, ${opacity}) 2px, transparent 2px),
          radial-gradient(circle at 90% 60%, rgba(255, 255, 255, ${opacity}) 2.5px, transparent 2.5px);
        background-size: 
          200% 200%,
          150% 150%,
          180% 180%,
          220% 220%,
          190% 190%,
          160% 160%,
          210% 210%,
          170% 170%,
          200% 200%;
        background-position: 
          0% 0%,
          10% 20%,
          20% 40%,
          30% 60%,
          40% 80%,
          50% 10%,
          60% 30%,
          70% 50%,
          80% 70%;
        animation: fall-snow 20s linear infinite;
      }
      
      &::after {
        background-image: 
          radial-gradient(circle at 15% 25%, rgba(255, 255, 255, ${opacity}) 2.5px, transparent 2.5px),
          radial-gradient(circle at 25% 45%, rgba(240, 248, 255, ${opacity}) 3px, transparent 3px),
          radial-gradient(circle at 35% 15%, rgba(255, 255, 255, ${opacity}) 2px, transparent 2px),
          radial-gradient(circle at 45% 55%, rgba(240, 248, 255, ${opacity}) 2.5px, transparent 2.5px),
          radial-gradient(circle at 55% 75%, rgba(255, 255, 255, ${opacity}) 3px, transparent 3px),
          radial-gradient(circle at 65% 35%, rgba(240, 248, 255, ${opacity}) 2px, transparent 2px),
          radial-gradient(circle at 75% 85%, rgba(255, 255, 255, ${opacity}) 2.5px, transparent 2.5px),
          radial-gradient(circle at 85% 25%, rgba(240, 248, 255, ${opacity}) 3px, transparent 3px),
          radial-gradient(circle at 95% 65%, rgba(255, 255, 255, ${opacity}) 2px, transparent 2px);
        background-size: 
          180% 180%,
          200% 200%,
          160% 160%,
          190% 190%,
          210% 210%,
          170% 170%,
          200% 200%,
          150% 150%,
          180% 180%;
        background-position: 
          5% 10%,
          15% 30%,
          25% 50%,
          35% 70%,
          45% 90%,
          55% 15%,
          65% 35%,
          75% 55%,
          85% 75%;
        animation: fall-snow 25s linear infinite reverse;
      }
    `,
    spring: `
      &::before {
        background-image: 
          radial-gradient(circle at 10% 20%, rgba(255, 182, 193, ${opacity}) 2px, transparent 2px),
          radial-gradient(circle at 20% 30%, rgba(255, 192, 203, ${opacity}) 1.5px, transparent 1.5px),
          radial-gradient(circle at 30% 10%, rgba(255, 20, 147, ${opacity}) 2px, transparent 2px),
          radial-gradient(circle at 40% 50%, rgba(255, 182, 193, ${opacity}) 1.5px, transparent 1.5px),
          radial-gradient(circle at 50% 70%, rgba(255, 192, 203, ${opacity}) 2px, transparent 2px),
          radial-gradient(circle at 60% 40%, rgba(255, 20, 147, ${opacity}) 1.5px, transparent 1.5px),
          radial-gradient(circle at 70% 80%, rgba(255, 182, 193, ${opacity}) 2px, transparent 2px),
          radial-gradient(circle at 80% 20%, rgba(255, 192, 203, ${opacity}) 1.5px, transparent 1.5px),
          radial-gradient(circle at 90% 60%, rgba(255, 20, 147, ${opacity}) 2px, transparent 2px);
        background-size: 
          200% 200%,
          150% 150%,
          180% 180%,
          220% 220%,
          190% 190%,
          160% 160%,
          210% 210%,
          170% 170%,
          200% 200%;
        background-position: 
          0% 0%,
          10% 20%,
          20% 40%,
          30% 60%,
          40% 80%,
          50% 10%,
          60% 30%,
          70% 50%,
          80% 70%;
        animation: fall-petal 12s linear infinite;
      }
      
      &::after {
        background-image: 
          radial-gradient(circle at 15% 25%, rgba(255, 182, 193, ${opacity}) 1.5px, transparent 1.5px),
          radial-gradient(circle at 25% 45%, rgba(255, 192, 203, ${opacity}) 2px, transparent 2px),
          radial-gradient(circle at 35% 15%, rgba(255, 20, 147, ${opacity}) 1px, transparent 1px),
          radial-gradient(circle at 45% 55%, rgba(255, 182, 193, ${opacity}) 2px, transparent 2px),
          radial-gradient(circle at 55% 75%, rgba(255, 192, 203, ${opacity}) 1.5px, transparent 1.5px),
          radial-gradient(circle at 65% 35%, rgba(255, 20, 147, ${opacity}) 2px, transparent 2px),
          radial-gradient(circle at 75% 85%, rgba(255, 182, 193, ${opacity}) 1px, transparent 1px),
          radial-gradient(circle at 85% 25%, rgba(255, 192, 203, ${opacity}) 2px, transparent 2px),
          radial-gradient(circle at 95% 65%, rgba(255, 20, 147, ${opacity}) 1.5px, transparent 1.5px);
        background-size: 
          180% 180%,
          200% 200%,
          160% 160%,
          190% 190%,
          210% 210%,
          170% 170%,
          200% 200%,
          150% 150%,
          180% 180%;
        background-position: 
          5% 10%,
          15% 30%,
          25% 50%,
          35% 70%,
          45% 90%,
          55% 15%,
          65% 35%,
          75% 55%,
          85% 75%;
        animation: fall-petal 16s linear infinite reverse;
      }
    `,
    summer: `
      &::before {
        background-image: 
          radial-gradient(circle at 10% 20%, rgba(255, 255, 0, ${opacity}) 1.5px, transparent 1.5px),
          radial-gradient(circle at 20% 30%, rgba(255, 255, 224, ${opacity}) 2px, transparent 2px),
          radial-gradient(circle at 30% 10%, rgba(255, 255, 0, ${opacity}) 1px, transparent 1px),
          radial-gradient(circle at 40% 50%, rgba(255, 255, 224, ${opacity}) 1.5px, transparent 1.5px),
          radial-gradient(circle at 50% 70%, rgba(255, 255, 0, ${opacity}) 2px, transparent 2px),
          radial-gradient(circle at 60% 40%, rgba(255, 255, 224, ${opacity}) 1px, transparent 1px),
          radial-gradient(circle at 70% 80%, rgba(255, 255, 0, ${opacity}) 1.5px, transparent 1.5px),
          radial-gradient(circle at 80% 20%, rgba(255, 255, 224, ${opacity}) 2px, transparent 2px),
          radial-gradient(circle at 90% 60%, rgba(255, 255, 0, ${opacity}) 1px, transparent 1px);
        background-size: 
          200% 200%,
          150% 150%,
          180% 180%,
          220% 220%,
          190% 190%,
          160% 160%,
          210% 210%,
          170% 170%,
          200% 200%;
        background-position: 
          0% 0%,
          10% 20%,
          20% 40%,
          30% 60%,
          40% 80%,
          50% 10%,
          60% 30%,
          70% 50%,
          80% 70%;
        animation: firefly 8s ease-in-out infinite;
      }
      
      &::after {
        background-image: 
          radial-gradient(circle at 15% 25%, rgba(255, 255, 0, ${opacity}) 2px, transparent 2px),
          radial-gradient(circle at 25% 45%, rgba(255, 255, 224, ${opacity}) 1.5px, transparent 1.5px),
          radial-gradient(circle at 35% 15%, rgba(255, 255, 0, ${opacity}) 1px, transparent 1px),
          radial-gradient(circle at 45% 55%, rgba(255, 255, 224, ${opacity}) 2px, transparent 2px),
          radial-gradient(circle at 55% 75%, rgba(255, 255, 0, ${opacity}) 1.5px, transparent 1.5px),
          radial-gradient(circle at 65% 35%, rgba(255, 255, 224, ${opacity}) 1px, transparent 1px),
          radial-gradient(circle at 75% 85%, rgba(255, 255, 0, ${opacity}) 2px, transparent 2px),
          radial-gradient(circle at 85% 25%, rgba(255, 255, 224, ${opacity}) 1.5px, transparent 1.5px),
          radial-gradient(circle at 95% 65%, rgba(255, 255, 0, ${opacity}) 1px, transparent 1px);
        background-size: 
          180% 180%,
          200% 200%,
          160% 160%,
          190% 190%,
          210% 210%,
          170% 170%,
          200% 200%,
          150% 150%,
          180% 180%;
        background-position: 
          5% 10%,
          15% 30%,
          25% 50%,
          35% 70%,
          45% 90%,
          55% 15%,
          65% 35%,
          75% 55%,
          85% 75%;
        animation: firefly 10s ease-in-out infinite reverse;
      }
    `,
  };
  
  return baseStyles + seasonStyles[season];
}

/**
 * Get keyframes CSS for seasonal animations
 * Should be injected into a global style component
 */
export function getSeasonalKeyframesCSS(): string {
  return `
    @keyframes fall-leaf {
      0% {
        transform: translateY(-100vh) rotate(0deg);
        opacity: 0.8;
      }
      100% {
        transform: translateY(100vh) rotate(360deg);
        opacity: 0;
      }
    }
    
    @keyframes fall-snow {
      0% {
        transform: translateY(-100vh) translateX(0) rotate(0deg);
        opacity: 0.9;
      }
      100% {
        transform: translateY(100vh) translateX(50px) rotate(360deg);
        opacity: 0;
      }
    }
    
    @keyframes fall-petal {
      0% {
        transform: translateY(-100vh) rotate(0deg);
        opacity: 0.7;
      }
      100% {
        transform: translateY(100vh) rotate(720deg);
        opacity: 0;
      }
    }
    
    @keyframes firefly {
      0%, 100% {
        transform: translate(0, 0);
        opacity: 0.8;
      }
      25% {
        transform: translate(20px, -30px);
        opacity: 1;
      }
      50% {
        transform: translate(-15px, -50px);
        opacity: 0.6;
      }
      75% {
        transform: translate(30px, -20px);
        opacity: 0.9;
      }
    }
  `;
}
