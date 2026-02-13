<script lang="ts">
  import Tooltip from './Tooltip.svelte';
  
  export let className: string = '';
  
  const tooltipContent = `
    <div style="text-align: left;">
      <h3 style="margin: 0 0 12px 0; color: var(--accent, #edae49); font-size: 1.125rem;">
        ⚡ Strixun Stream Suite
      </h3>
      <p style="margin: 0 0 16px 0; color: var(--text-secondary, #b8b8b8); font-size: 0.875rem; line-height: 1.6;">
        Professional streaming toolkit & comprehensive application ecosystem
      </p>
      
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div>
          <h4 style="margin: 0 0 8px 0; color: var(--accent-light, #f9df74); font-size: 0.9375rem; font-weight: 600;">
            🎯 User-Facing Services
          </h4>
          <ul style="margin: 0; padding-left: 20px; color: var(--text-secondary, #b8b8b8); font-size: 0.8125rem; line-height: 1.8;">
            <li><a href="http://streamkit.idling.app" target="_blank" rel="noopener noreferrer" style="color: var(--info, #6495ed); text-decoration: none; font-weight: 500;">streamkit.idling.app</a> - OBS Control Panel & Streaming Tools</li>
            <li><a href="https://mods.idling.app" target="_blank" rel="noopener noreferrer" style="color: var(--info, #6495ed); text-decoration: none; font-weight: 500;">mods.idling.app</a> - Mod Hosting & Distribution Platform</li>
            <li><a href="https://auth.idling.app" target="_blank" rel="noopener noreferrer" style="color: var(--info, #6495ed); text-decoration: none; font-weight: 500;">auth.idling.app</a> - OTP Authentication & Developer Dashboard</li>
            <li><a href="https://game.idling.app" target="_blank" rel="noopener noreferrer" style="color: var(--info, #6495ed); text-decoration: none; font-weight: 500;">game.idling.app</a> - Idle Game & Interactive Features</li>
            <li><a href="https://docs.idling.app" target="_blank" rel="noopener noreferrer" style="color: var(--info, #6495ed); text-decoration: none; font-weight: 500;">docs.idling.app</a> - Documentation & API Reference</li>
            <li><a href="https://design.idling.app" target="_blank" rel="noopener noreferrer" style="color: var(--info, #6495ed); text-decoration: none; font-weight: 500;">design.idling.app</a> - Component Library (Storybook)</li>
            <li><a href="https://s.idling.app" target="_blank" rel="noopener noreferrer" style="color: var(--info, #6495ed); text-decoration: none; font-weight: 500;">s.idling.app</a> / <a href="https://shorten.idling.app" target="_blank" rel="noopener noreferrer" style="color: var(--info, #6495ed); text-decoration: none; font-weight: 500;">shorten.idling.app</a> / <a href="https://short.idling.app" target="_blank" rel="noopener noreferrer" style="color: var(--info, #6495ed); text-decoration: none; font-weight: 500;">short.idling.app</a> / <a href="https://short.army" target="_blank" rel="noopener noreferrer" style="color: var(--info, #6495ed); text-decoration: none; font-weight: 500;">short.army</a> - URL Shortener Service</li>
          </ul>
        </div>
        
        <div>
          <h4 style="margin: 0 0 8px 0; color: var(--accent-light, #f9df74); font-size: 0.9375rem; font-weight: 600;">
            🔧 Backend APIs
          </h4>
          <ul style="margin: 0; padding-left: 20px; color: var(--text-secondary, #b8b8b8); font-size: 0.8125rem; line-height: 1.8;">
            <li><strong style="color: var(--text, #f9f9f9);">mods-api.idling.app</strong> - Mod Management & Storage API</li>
            <li><strong style="color: var(--text, #f9f9f9);">customer-api.idling.app</strong> - Customer Data & Profile Management</li>
            <li><strong style="color: var(--text, #f9f9f9);">access-api.idling.app</strong> - Access Control & Permissions</li>
            <li><strong style="color: var(--text, #f9f9f9);">streamkit-api.idling.app</strong> - Streamkit Cloud Storage & Scene Activity</li>
            <li><strong style="color: var(--text, #f9f9f9);">api.idling.app</strong> - Main Gateway API</li>
            <li><strong style="color: var(--text, #f9f9f9);">chat.idling.app</strong> - WebRTC Chat Signaling</li>
          </ul>
        </div>
        
        <div>
          <h4 style="margin: 0 0 8px 0; color: var(--accent-light, #f9df74); font-size: 0.9375rem; font-weight: 600;">
            🏠 Main Site
          </h4>
          <ul style="margin: 0; padding-left: 20px; color: var(--text-secondary, #b8b8b8); font-size: 0.8125rem; line-height: 1.8;">
            <li><a href="https://idling.app" target="_blank" rel="noopener noreferrer" style="color: var(--info, #6495ed); text-decoration: none; font-weight: 500;">idling.app</a> - Main Website & Portal</li>
          </ul>
        </div>
      </div>
      
      <div style="margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--border, rgba(255, 255, 255, 0.2));">
        <p style="margin: 0; color: var(--muted, #888); font-size: 0.75rem; font-style: italic; display: flex; align-items: center; gap: 8px;">
          <span>⊕</span>
          <span>Open source on <a href="https://github.com/Underwood-Inc/strixun-stream-suite" target="_blank" rel="noopener noreferrer" style="color: var(--info, #6495ed); text-decoration: none;">GitHub</a> • Powered by Cloudflare Workers</span>
        </p>
      </div>
    </div>
  `;
</script>

<Tooltip
  text={tooltipContent}
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
    class="strixun-suite-link {className}"
  >
    Strixun Stream Suite
  </a>
</Tooltip>

<style>
  .strixun-suite-link {
    color: inherit;
    text-decoration: none;
    cursor: help;
    border-bottom: 1px dotted currentColor;
    transition: color 0.2s ease, border-color 0.2s ease;
  }
  
  .strixun-suite-link:hover {
    color: var(--accent, #edae49);
    border-bottom-color: var(--accent, #edae49);
  }
</style>
