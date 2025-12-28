<script lang="ts">
  /**
   * Scripts Page
   * 
   * Script information and management
   */
  
  import { onMount } from 'svelte';
  import { stagger } from '../core/animations';
  
  onMount(() => {
    // Render scripts list
    if ((window as any).ScriptStatus?.renderScriptsList) {
      (window as any).ScriptStatus.renderScriptsList();
    }
  });
</script>

<div class="page scripts-page" use:stagger={{ preset: 'fadeIn', stagger: 80, config: { duration: 300 } }}>
  <div class="card">
    <h3>[EMOJI] Stream Suite Scripts</h3>
    <p class="hint" style="margin-bottom:12px">
      Lua scripts that run inside OBS Studio. Install via the Installer tab.
    </p>
    
    <div id="scriptsList" class="scripts-grid"></div>
  </div>
  
  <div class="card">
    <h3>[WEB] Browser Sources</h3>
    <p class="hint" style="margin-bottom:12px">
      HTML files to add as Browser Sources in OBS.
    </p>
    
    <div class="scripts-grid">
      <div class="script-card">
        <div class="script-header">
          <span class="script-icon">[EMOJI]</span>
          <div>
            <div class="script-name">Text Cycler Display</div>
            <div class="script-version">Browser Source</div>
          </div>
        </div>
        <p class="script-desc">
          Beautiful CSS-animated text display. Receives messages from the control panel for smooth text cycling effects.
        </p>
        <div class="script-file">text_cycler_display.html</div>
      </div>
      
      <div class="script-card">
        <div class="script-header">
          <span class="script-icon">[CONTROL]</span>
          <div>
            <div class="script-name">Control Panel Dock</div>
            <div class="script-version">Custom Dock</div>
          </div>
        </div>
        <p class="script-desc">
          This control panel! Add as a Custom Browser Dock in OBS for quick access to all features.
        </p>
        <div class="script-file">control_panel.html</div>
      </div>
    </div>
  </div>
  
  <div class="card">
    <h3>[EMOJI] Quick Reference</h3>
    <div class="info-box">
      <strong>Adding Scripts to OBS:</strong>
      <ol style="margin:8px 0 0 16px;font-size:0.85em">
        <li>Tools [EMOJI] Scripts</li>
        <li>Click + (Add Scripts)</li>
        <li>Navigate to your script folder</li>
        <li>Select the .lua files</li>
      </ol>
    </div>
    <div class="info-box" style="margin-top:8px">
      <strong>Adding Custom Browser Dock:</strong>
      <ol style="margin:8px 0 0 16px;font-size:0.85em">
        <li>View [EMOJI] Docks [EMOJI] Custom Browser Docks</li>
        <li>Name: "Stream Suite"</li>
        <li>URL: file:///path/to/control_panel.html</li>
      </ol>
    </div>
  </div>
</div>

<style lang="scss">
  @use '@styles/components/cards';
  
  .scripts-page {
    max-width: 1200px;
    margin: 0 auto;
    
    > .card {
      margin-bottom: 20px;
      
      &:last-child {
        margin-bottom: 0;
      }
    }
    
    .scripts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 16px;
      margin-top: 16px;
    }
    
    .script-card {
      padding: 16px;
      background: var(--bg-dark);
      border: 1px solid var(--border);
      border-radius: 6px;
      
      .script-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
        
        .script-icon {
          font-size: 2em;
        }
        
        .script-name {
          font-weight: 600;
          color: var(--text);
        }
        
        .script-version {
          font-size: 0.85em;
          color: var(--muted);
        }
      }
      
      .script-desc {
        font-size: 0.9em;
        color: var(--text-secondary);
        margin: 8px 0;
        line-height: 1.5;
      }
      
      .script-file {
        font-size: 0.8em;
        color: var(--accent);
        font-family: monospace;
        margin-top: 8px;
      }
    }
    
    .info-box {
      padding: 12px;
      background: var(--bg-dark);
      border-left: 3px solid var(--accent);
      border-radius: 4px;
      
      strong {
        color: var(--text);
        display: block;
        margin-bottom: 4px;
      }
      
      ol {
        color: var(--text-secondary);
      }
    }
  }
</style>
