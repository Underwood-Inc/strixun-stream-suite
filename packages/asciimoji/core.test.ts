/**
 * ASCIImoji Core Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AsciimojiTransformer, transformText } from './core.js';
import { getAsciimoji, hasAsciimoji } from './patterns.js';

describe('AsciimojiTransformer', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('should transform text nodes with ASCIImoji patterns', () => {
    container.innerHTML = '<p>Hello (bear)!</p>';
    
    const transformer = new AsciimojiTransformer({
      selector: 'div',
      observe: false,
      transformOnInit: true,
    });

    expect(container.textContent).toContain('ʕ·͡ᴥ·ʔ');
  });

  it('should not transform excluded elements', () => {
    container.innerHTML = '<p>Hello (bear)!</p><script>const x = "(bear)";</script>';
    
    const transformer = new AsciimojiTransformer({
      selector: 'div',
      observe: false,
      transformOnInit: true,
    });

    const script = container.querySelector('script');
    expect(script?.textContent).toBe('const x = "(bear)";');
  });

  it('should transform multiple patterns', () => {
    container.innerHTML = '<p>Hello (bear)! How are you? (shrug)</p>';
    
    const transformer = new AsciimojiTransformer({
      selector: 'div',
      observe: false,
      transformOnInit: true,
    });

    const text = container.textContent || '';
    expect(text).toContain('ʕ·͡ᴥ·ʔ');
    expect(text).toContain('¯\\_(ツ)_/¯');
  });

  it('should handle unknown patterns gracefully', () => {
    container.innerHTML = '<p>Hello (unknownpattern)!</p>';
    
    const transformer = new AsciimojiTransformer({
      selector: 'div',
      observe: false,
      transformOnInit: true,
    });

    expect(container.textContent).toBe('Hello (unknownpattern)!');
  });

  it('should work with observe enabled', () => {
    container.innerHTML = '<p>Initial: (bear)</p>';
    
    const transformer = new AsciimojiTransformer({
      selector: 'div',
      observe: true,
      transformOnInit: true,
    });

    // Add new content
    const newP = document.createElement('p');
    newP.textContent = 'New: (shrug)';
    container.appendChild(newP);

    // Wait for mutation observer
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(container.textContent).toContain('¯\\_(ツ)_/¯');
        transformer.destroy();
        resolve();
      }, 100);
    });
  });
});

describe('transformText', () => {
  it('should transform text strings', () => {
    const result = transformText('Hello (bear)!');
    expect(result).toBe('Hello ʕ·͡ᴥ·ʔ!');
  });

  it('should handle multiple patterns', () => {
    const result = transformText('Hello (bear)! How are you? (shrug)');
    expect(result).toContain('ʕ·͡ᴥ·ʔ');
    expect(result).toContain('¯\\_(ツ)_/¯');
  });

  it('should handle unknown patterns', () => {
    const result = transformText('Hello (unknownpattern)!');
    expect(result).toBe('Hello (unknownpattern)!');
  });

  it('should handle empty strings', () => {
    const result = transformText('');
    expect(result).toBe('');
  });
});

describe('Pattern Functions', () => {
  it('should get ASCIImoji for known patterns', () => {
    const bear = getAsciimoji('bear');
    expect(bear).toBe('ʕ·͡ᴥ·ʔ');
  });

  it('should return null for unknown patterns', () => {
    const unknown = getAsciimoji('unknownpattern');
    expect(unknown).toBeNull();
  });

  it('should handle patterns with parentheses', () => {
    const bear = getAsciimoji('(bear)');
    expect(bear).toBe('ʕ·͡ᴥ·ʔ');
  });

  it('should be case-insensitive', () => {
    const bear1 = getAsciimoji('bear');
    const bear2 = getAsciimoji('BEAR');
    const bear3 = getAsciimoji('Bear');
    expect(bear1).toBe(bear2);
    expect(bear2).toBe(bear3);
  });

  it('should check if pattern exists', () => {
    expect(hasAsciimoji('bear')).toBe(true);
    expect(hasAsciimoji('unknownpattern')).toBe(false);
  });
});
