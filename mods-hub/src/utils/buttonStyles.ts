/**
 * Button style utilities for styled-components
 * Provides CSS-in-JS styles matching the shared-styles SCSS mixins
 * Ensures consistent button styling across all apps
 */

import { css, keyframes } from 'styled-components';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'link' | 'icon';

// Candy shop slanted bar animation keyframes
// Uses background-position for smooth movement
const candyShopBars = keyframes`
  0% {
    background-position: 0 0;
  }
  100% {
    background-position: 56.568px 56.568px;
  }
`;

/**
 * Get button styles for styled-components
 * Matches the @mixin button from shared-styles/_mixins.scss
 * 
 * @param variant - Button variant: 'primary', 'secondary', 'danger', 'link', or 'icon'
 * @returns CSS template literal for styled-components
 */
export function getButtonStyles(variant: ButtonVariant = 'primary') {
  const baseStyles = css`
    font-family: inherit;
    cursor: pointer;
    border: none;
    outline: none;
    transition: all 0.1s cubic-bezier(0.4, 0, 0.2, 1);
  `;

  switch (variant) {
    case 'primary':
      return css`
        ${baseStyles}
        position: relative;
        background: var(--accent, #edae49);
        border: 3px solid var(--accent-dark, #c68214);
        border-radius: 0;
        color: #000;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
        padding: 12px 24px;
        box-shadow: 0 4px 0 var(--accent-dark, #c68214);
        overflow: hidden;
        
        &::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0;
          height: 0;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.3);
          transform: translate(-50%, -50%);
          transition: width 0.6s, height 0.6s;
        }
        
        &:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 0 var(--accent-dark, #c68214);
          color: #000;
        }
        
        &:active:not(:disabled) {
          transform: translateY(2px);
          box-shadow: 0 2px 0 var(--accent-dark, #c68214);
          
          &::before {
            width: 300px;
            height: 300px;
          }
        }
        
        &:focus-visible {
          outline: 3px solid var(--accent, #edae49);
          outline-offset: 2px;
        }
        
        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
          box-shadow: 0 2px 0 var(--accent-dark, #c68214);
          
          &:hover {
            transform: none;
          }
        }
      `;

    case 'secondary':
      return css`
        ${baseStyles}
        position: relative;
        background: var(--border, #3d3627);
        border: 3px solid var(--border-light, #4a4336);
        border-radius: 0;
        color: var(--text, #f9f9f9);
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
        padding: 12px 24px;
        box-shadow: 0 4px 0 var(--border-light, #4a4336);
        overflow: hidden;
        
        &::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0;
          height: 0;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.1);
          transform: translate(-50%, -50%);
          transition: width 0.6s, height 0.6s;
        }
        
        &:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 0 var(--border-light, #4a4336);
          color: var(--text, #f9f9f9);
        }
        
        &:active:not(:disabled) {
          transform: translateY(2px);
          box-shadow: 0 2px 0 var(--border-light, #4a4336);
          
          &::before {
            width: 300px;
            height: 300px;
          }
        }
        
        &:focus-visible {
          outline: 3px solid var(--border, #3d3627);
          outline-offset: 2px;
        }
        
        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
          box-shadow: 0 2px 0 var(--border-light, #4a4336);
          
          &:hover {
            transform: none;
          }
        }
      `;

    case 'danger':
      return css`
        ${baseStyles}
        position: relative;
        background: var(--danger, #ea2b1f);
        border: 3px solid rgba(234, 43, 31, 0.8);
        border-radius: 0;
        color: #fff;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
        padding: 12px 24px;
        box-shadow: 0 4px 0 rgba(234, 43, 31, 0.8);
        overflow: hidden;
        
        &::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0;
          height: 0;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          transform: translate(-50%, -50%);
          transition: width 0.6s, height 0.6s;
        }
        
        &:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 0 rgba(234, 43, 31, 0.8);
          color: #fff;
        }
        
        &:active:not(:disabled) {
          transform: translateY(2px);
          box-shadow: 0 2px 0 rgba(234, 43, 31, 0.8);
          
          &::before {
            width: 300px;
            height: 300px;
          }
        }
        
        &:focus-visible {
          outline: 3px solid var(--danger, #ea2b1f);
          outline-offset: 2px;
        }
        
        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
          box-shadow: 0 2px 0 rgba(234, 43, 31, 0.8);
          
          &:hover {
            transform: none;
          }
        }
      `;

    case 'link':
      return css`
        ${baseStyles}
        background: transparent;
        color: var(--accent, #edae49);
        padding: 4px 8px;
        border: none;
        border-radius: 0;
        font-weight: 500;
        text-decoration: none;
        
        &:hover:not(:disabled) {
          background: rgba(237, 174, 73, 0.1);
          color: var(--accent-light, #f9df74);
          text-decoration: none;
        }
        
        &:active:not(:disabled) {
          background: rgba(237, 174, 73, 0.2);
        }
        
        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `;

    case 'icon':
      return css`
        ${baseStyles}
        background: transparent;
        border: 2px solid var(--border, #3d3627);
        color: var(--text, #f9f9f9);
        padding: 8px 10px;
        border-radius: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 0 var(--border, #3d3627);
        position: relative;
        overflow: hidden;
        
        &::after {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0;
          height: 0;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          transform: translate(-50%, -50%);
          transition: width 0.6s, height 0.6s;
          pointer-events: none;
        }
        
        &:hover:not(:disabled) {
          background: var(--border, #3d3627);
          color: var(--text, #f9f9f9);
          transform: translateY(-1px);
          box-shadow: 0 3px 0 var(--border, #3d3627);
        }
        
        &:active:not(:disabled) {
          transform: translateY(1px);
          box-shadow: 0 1px 0 var(--border, #3d3627);
          
          &::after {
            width: 300px;
            height: 300px;
          }
        }
        
        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
          box-shadow: 0 2px 0 var(--border, #3d3627);
          
          &:hover {
            transform: none;
          }
        }
      `;

    default:
      return getButtonStyles('primary');
  }
}

/**
 * Helper function to create a styled button component
 * Usage in styled-components:
 * 
 * const MyButton = styled.button<{ variant?: ButtonVariant }>`
 *   ${({ variant = 'primary' }) => getButtonStyles(variant)}
 * `;
 */
export function buttonStyles(variant: ButtonVariant = 'primary') {
  return getButtonStyles(variant);
}
