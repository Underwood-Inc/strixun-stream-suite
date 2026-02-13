/**
 * StrixunSuiteLink - Interactive link to Strixun Stream Suite with tooltip
 * 
 * Shows all services in the suite with a rich, interactive tooltip
 */

import React from 'react';
import { Tooltip } from './Tooltip';

interface StrixunSuiteLinkProps {
  className?: string;
}

const StrixunSuiteLink: React.FC<StrixunSuiteLinkProps> = ({ className = '' }) => {
  const tooltipContent = (
    <div style={{ textAlign: 'left' }}>
      <h3 style={{ margin: '0 0 12px 0', color: 'var(--accent, #edae49)', fontSize: '1.125rem' }}>
        ⚡ Strixun Stream Suite
      </h3>
      <p style={{ margin: '0 0 16px 0', color: 'var(--text-secondary, #b8b8b8)', fontSize: '0.875rem', lineHeight: 1.6 }}>
        Professional streaming toolkit & comprehensive application ecosystem
      </p>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <h4 style={{ margin: '0 0 8px 0', color: 'var(--accent-light, #f9df74)', fontSize: '0.9375rem', fontWeight: 600 }}>
            🎯 User-Facing Services
          </h4>
          <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-secondary, #b8b8b8)', fontSize: '0.8125rem', lineHeight: 1.8 }}>
            <li><a href="http://streamkit.idling.app" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--info, #6495ed)', textDecoration: 'none', fontWeight: 500 }}>streamkit.idling.app</a> - OBS Control Panel & Streaming Tools</li>
            <li><a href="https://mods.idling.app" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--info, #6495ed)', textDecoration: 'none', fontWeight: 500 }}>mods.idling.app</a> - Mod Hosting & Distribution Platform</li>
            <li><a href="https://chat.idling.app" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--info, #6495ed)', textDecoration: 'none', fontWeight: 500 }}>chat.idling.app</a> - P2P Encrypted Messaging</li>
            <li><a href="https://auth.idling.app" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--info, #6495ed)', textDecoration: 'none', fontWeight: 500 }}>auth.idling.app</a> - OTP Authentication & Developer Dashboard</li>
            <li><a href="https://game.idling.app" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--info, #6495ed)', textDecoration: 'none', fontWeight: 500 }}>game.idling.app</a> - Idle Game & Interactive Features</li>
            <li><a href="https://docs.idling.app" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--info, #6495ed)', textDecoration: 'none', fontWeight: 500 }}>docs.idling.app</a> - Documentation & API Reference</li>
            <li><a href="https://design.idling.app" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--info, #6495ed)', textDecoration: 'none', fontWeight: 500 }}>design.idling.app</a> - Component Library (Storybook)</li>
            <li><a href="https://s.idling.app" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--info, #6495ed)', textDecoration: 'none', fontWeight: 500 }}>s.idling.app</a> / <a href="https://shorten.idling.app" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--info, #6495ed)', textDecoration: 'none', fontWeight: 500 }}>shorten.idling.app</a> / <a href="https://short.idling.app" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--info, #6495ed)', textDecoration: 'none', fontWeight: 500 }}>short.idling.app</a> / <a href="https://short.army" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--info, #6495ed)', textDecoration: 'none', fontWeight: 500 }}>short.army</a> - URL Shortener Service</li>
          </ul>
        </div>
        
        <div>
          <h4 style={{ margin: '0 0 8px 0', color: 'var(--accent-light, #f9df74)', fontSize: '0.9375rem', fontWeight: 600 }}>
            🔧 Backend APIs
          </h4>
          <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-secondary, #b8b8b8)', fontSize: '0.8125rem', lineHeight: 1.8 }}>
            <li><strong style={{ color: 'var(--text, #f9f9f9)' }}>mods-api.idling.app</strong> - Mod Management & Storage API</li>
            <li><strong style={{ color: 'var(--text, #f9f9f9)' }}>customer-api.idling.app</strong> - Customer Data & Profile Management</li>
            <li><strong style={{ color: 'var(--text, #f9f9f9)' }}>access-api.idling.app</strong> - Access Control & Permissions</li>
            <li><strong style={{ color: 'var(--text, #f9f9f9)' }}>streamkit-api.idling.app</strong> - Streamkit Cloud Storage & Scene Activity</li>
            <li><strong style={{ color: 'var(--text, #f9f9f9)' }}>api.idling.app</strong> - Main Gateway API</li>
            <li><strong style={{ color: 'var(--text, #f9f9f9)' }}>chat-api.idling.app</strong> - WebRTC Chat Signaling</li>
          </ul>
        </div>
        
        <div>
          <h4 style={{ margin: '0 0 8px 0', color: 'var(--accent-light, #f9df74)', fontSize: '0.9375rem', fontWeight: 600 }}>
            🏠 Main Site
          </h4>
          <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-secondary, #b8b8b8)', fontSize: '0.8125rem', lineHeight: 1.8 }}>
            <li><a href="https://idling.app" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--info, #6495ed)', textDecoration: 'none', fontWeight: 500 }}>idling.app</a> - Main Website & Portal</li>
          </ul>
        </div>
      </div>
      
      <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border, rgba(255, 255, 255, 0.2))' }}>
        <p style={{ margin: 0, color: 'var(--muted, #888)', fontSize: '0.75rem', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>⊕</span>
          <span>Open source on <a href="https://github.com/Underwood-Inc/strixun-stream-suite" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--info, #6495ed)', textDecoration: 'none' }}>GitHub</a> • Powered by Cloudflare Workers</span>
        </p>
      </div>
    </div>
  );

  return (
    <Tooltip
      content={tooltipContent}
      position="top"
      interactive={true}
      maxWidth="480px"
      maxHeight="550px"
      level="info"
    >
      <a 
        href="http://streamkit.idling.app/" 
        target="_blank" 
        rel="noopener noreferrer"
        className={`strixun-suite-link ${className}`}
        style={{
          color: 'var(--accent, #edae49)',
          textDecoration: 'underline',
          textDecorationStyle: 'dotted',
          textUnderlineOffset: '3px',
          fontWeight: 600,
          transition: 'all 0.2s ease',
          cursor: 'pointer',
        }}
      >
        Strixun Stream Suite
      </a>
    </Tooltip>
  );
};

export default StrixunSuiteLink;
