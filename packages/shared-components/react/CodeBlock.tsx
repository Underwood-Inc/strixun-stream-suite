/**
 * CodeBlock - Syntax-highlighted code block component (React)
 * 
 * Supports 25+ programming languages with copy-to-clipboard functionality
 * Uses Prism.js for syntax highlighting
 * 
 * @param code - The code string to display
 * @param language - Programming language (default: 'javascript')
 * @param className - Optional CSS class
 */

import React, { useEffect, useRef, useState } from 'react';
import Prism from 'prismjs';
// Base languages
import 'prismjs/components/prism-markup'; // Must be first for templating
import 'prismjs/components/prism-markup-templating'; // Required for PHP
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-scss';
import 'prismjs/components/prism-http';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-python';
// Additional languages for chat and comprehensive support
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-ruby';
import 'prismjs/components/prism-php'; // Must come after markup-templating
import 'prismjs/components/prism-swift';
import 'prismjs/components/prism-kotlin';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-toml';
import 'prismjs/components/prism-docker';
import 'prismjs/components/prism-markdown';
import 'prismjs/themes/prism-tomorrow.css';
import './CodeBlock.css';

interface CodeBlockProps {
  code: string;
  language?: string;
  className?: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ 
  code, 
  language = 'javascript', 
  className = '' 
}) => {
  const codeRef = useRef<HTMLElement>(null);
  const [copied, setCopied] = useState(false);

  // Map languages to Prism-supported languages
  const prismLanguage = (() => {
    if (language === 'svelte') return 'markup';
    if (language === 'html') return 'markup';
    if (language === 'ts') return 'typescript';
    if (language === 'js') return 'javascript';
    return language;
  })();

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Highlight code when component mounts or code/language changes
  useEffect(() => {
    if (codeRef.current) {
      Prism.highlightElement(codeRef.current);
    }
  }, [code, prismLanguage]);

  return (
    <div className={`code-block-wrapper ${className}`}>
      <button
        className={`copy-button ${copied ? 'copied' : ''}`}
        onClick={copyToClipboard}
        aria-label="Copy code to clipboard"
        title={copied ? 'Copied!' : 'Copy code'}
      >
        {copied ? (
          <>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M13.5 4L6 11.5L2.5 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>Copied!</span>
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="5" y="5" width="9" height="9" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              <path d="M3 3V11C3 11.5523 3.44772 12 4 12H11" stroke="currentColor" strokeWidth="1.5" fill="none"/>
            </svg>
            <span>Copy</span>
          </>
        )}
      </button>
      <pre>
        <code 
          className={`language-${prismLanguage}`} 
          ref={codeRef}
        >
          {code}
        </code>
      </pre>
    </div>
  );
};
