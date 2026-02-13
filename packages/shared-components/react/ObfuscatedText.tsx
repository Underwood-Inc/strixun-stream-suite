/**
 * ObfuscatedText Component (React - Enhanced)
 * 
 * A reusable component for displaying obfuscated/scrambled text using various character sets.
 * Perfect for hiding undecided values, redacting sensitive information, or creating mysterious text effects.
 * 
 * @example
 * ```tsx
 * <ObfuscatedText text="$99.99" />
 * <ObfuscatedText text="1,000 users" length={5} />
 * <ObfuscatedText text="Secret data" animate={false} />
 * <ObfuscatedText text="API Key" charset="glitch" color="warning" />
 * <ObfuscatedText text="Hidden" revealOnHover pauseOnHover />
 * ```
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import './ObfuscatedText.scss';

// Character sets
const CHARS_ENCHANT = 'ᔑᒷᓵᒷ⊣╎⋮ꖌꖎᒲリ𝙹ᑑ∷ᓭℸ∴⨅';
const CHARS_GLITCH = '█▓▒░╔╗╚╝║═┌┐└┘│─┼▀▄▌▐■□▪▫●○';
const CHARS_BLOCK = '█▓▒░';
const CHARS_BINARY = '01';
const CHARS_HEX = '0123456789ABCDEF';

type CharsetType = 'enchant' | 'glitch' | 'block' | 'binary' | 'hex';
type ColorVariant = 'default' | 'info' | 'warning' | 'danger' | 'success';

interface ObfuscatedTextProps {
  text?: string; // Original text (used to determine length if length prop not provided)
  length?: number | null; // Custom length override
  animate?: boolean; // Whether to animate the scrambling
  className?: string; // Additional CSS classes
  charset?: CharsetType; // Character set to use
  color?: ColorVariant; // Color variant
  updateInterval?: number; // Update interval in ms
  blur?: boolean; // Apply blur effect
  revealOnHover?: boolean; // Show actual text on hover
  pauseOnHover?: boolean; // Pause animation on hover
  ariaLabel?: string; // Custom aria-label (defaults to text)
}

export const ObfuscatedText: React.FC<ObfuscatedTextProps> = ({
  text = '',
  length = null,
  animate = true,
  className = '',
  charset = 'enchant',
  color = 'default',
  updateInterval = 100,
  blur = false,
  revealOnHover = false,
  pauseOnHover = false,
  ariaLabel = '',
}) => {
  const [displayText, setDisplayText] = useState<string>('');
  const [measuredWidth, setMeasuredWidth] = useState<number>(0);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  
  const measureRef = useRef<HTMLSpanElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const isAnimatingRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);

  // Get character set based on charset prop
  const getCharset = useMemo((): string => {
    switch (charset) {
      case 'glitch': return CHARS_GLITCH;
      case 'block': return CHARS_BLOCK;
      case 'binary': return CHARS_BINARY;
      case 'hex': return CHARS_HEX;
      case 'enchant':
      default: return CHARS_ENCHANT;
    }
  }, [charset]);

  // Get a random character from the selected charset
  const getRandomChar = useCallback((): string => {
    const chars = [...getCharset];
    return chars[Math.floor(Math.random() * chars.length)] || '?';
  }, [getCharset]);

  // Generate scrambled text
  const generateScrambledText = useCallback((): string => {
    const textLength = length !== null ? length : [...text].length;
    return Array.from({ length: textLength }, () => getRandomChar()).join('');
  }, [length, text, getRandomChar]);

  // Measure the actual width of the original text
  const measureOriginalTextWidth = useCallback((): void => {
    if (measureRef.current) {
      setMeasuredWidth(measureRef.current.offsetWidth);
    }
  }, []);

  // Animation loop - updates scrambled text based on time interval
  const animateScramble = useCallback((timestamp: number): void => {
    if (!animate || !isAnimatingRef.current || isPausedRef.current) return;

    // Only update if enough time has passed since last update
    if (timestamp - lastUpdateTimeRef.current >= updateInterval) {
      setDisplayText(generateScrambledText());
      lastUpdateTimeRef.current = timestamp;
    }

    animationFrameRef.current = requestAnimationFrame(animateScramble);
  }, [animate, generateScrambledText, updateInterval]);

  // Start animation
  const startAnimation = useCallback((): void => {
    if (!animate) {
      setDisplayText(generateScrambledText());
      return;
    }

    lastUpdateTimeRef.current = 0;
    isAnimatingRef.current = true;
    animationFrameRef.current = requestAnimationFrame(animateScramble);
  }, [animate, generateScrambledText, animateScramble]);

  // Stop animation
  const stopAnimation = useCallback((): void => {
    isAnimatingRef.current = false;
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  // Handle mouse enter
  const handleMouseEnter = useCallback((): void => {
    setIsHovered(true);
    if (pauseOnHover) {
      isPausedRef.current = true;
    }
  }, [pauseOnHover]);

  // Handle mouse leave
  const handleMouseLeave = useCallback((): void => {
    setIsHovered(false);
    if (pauseOnHover) {
      isPausedRef.current = false;
    }
  }, [pauseOnHover]);

  // Handle copy event - copy actual text instead of scrambled
  const handleCopy = useCallback((event: React.ClipboardEvent<HTMLSpanElement>): void => {
    if (text) {
      event.preventDefault();
      event.clipboardData.setData('text/plain', text);
    }
  }, [text]);

  // Initialize on mount
  useEffect(() => {
    measureOriginalTextWidth();
    startAnimation();

    return () => {
      stopAnimation();
    };
  }, [measureOriginalTextWidth, startAnimation, stopAnimation]);

  // Restart animation if props change
  useEffect(() => {
    measureOriginalTextWidth();
    stopAnimation();
    startAnimation();
  }, [text, length, charset, measureOriginalTextWidth, stopAnimation, startAnimation]);

  // Generate placeholder text for width measurement (same length as obfuscated text)
  const placeholderText = useMemo(() => {
    return length !== null 
      ? '0'.repeat(length) 
      : text || '0'.repeat(5);
  }, [length, text]);

  // Determine what text to show
  const actualDisplayText = useMemo(() => {
    return (revealOnHover && isHovered) ? text : displayText;
  }, [revealOnHover, isHovered, text, displayText]);

  // Computed aria-label
  const computedAriaLabel = useMemo(() => {
    return ariaLabel || text || 'Obfuscated text';
  }, [ariaLabel, text]);

  // Build class names
  const classNames = useMemo(() => {
    const classes = ['obfuscated-text'];
    if (animate) classes.push('animated');
    if (blur) classes.push('blur');
    if (color !== 'default') classes.push(`color-${color}`);
    if (revealOnHover) classes.push('reveal-hover');
    if (className) classes.push(className);
    return classes.join(' ');
  }, [animate, blur, color, revealOnHover, className]);

  return (
    <>
      {/* Hidden element to measure original text width */}
      <span ref={measureRef} className="measure-text" aria-hidden="true">
        {placeholderText}
      </span>

      {/* Visible obfuscated text with fixed width */}
      <span
        className={classNames}
        style={{ width: `${measuredWidth}px` }}
        aria-label={computedAriaLabel}
        role="text"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onCopy={handleCopy}
      >
        {actualDisplayText}
      </span>
    </>
  );
};

export default ObfuscatedText;
