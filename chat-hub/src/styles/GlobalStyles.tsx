/**
 * Global CSS styles for Chat Hub
 * Using CSS-in-JS for simplicity in a standalone app
 */
export function GlobalStyles() {
  return (
    <style>{`
      :root {
        /* Strixun Color Palette - Deep Amber/Gold Theme */
        --gold-primary: #d4af37;
        --gold-light: #f0d78c;
        --gold-dark: #9c7b20;
        
        /* Backgrounds */
        --bg: #0f0e0c;
        --bg-secondary: #1a1815;
        --bg-tertiary: #252017;
        --card: #1a1815;
        --card-hover: #252017;
        
        /* Text */
        --text: #f9f7f3;
        --text-secondary: #c4c0b8;
        --text-muted: #7a7672;
        
        /* Borders */
        --border: #3a3530;
        --border-hover: #504840;
        
        /* Semantic Colors */
        --success: #4caf50;
        --warning: #ff9800;
        --danger: #f44336;
        --info: #2196f3;
        
        /* Sizing */
        --header-height: 60px;
        --sidebar-width: 280px;
        --border-radius: 8px;
        --border-radius-sm: 4px;
        
        /* Typography */
        --font-sans: 'JetBrains Mono', 'Fira Code', 'SF Mono', Monaco, Consolas, monospace;
        --font-display: 'Cormorant Garamond', 'Playfair Display', Georgia, serif;
      }
      
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      html, body {
        height: 100%;
        width: 100%;
        overflow: hidden;
      }
      
      body {
        font-family: var(--font-sans);
        background: var(--bg);
        color: var(--text);
        line-height: 1.6;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }
      
      #root {
        height: 100%;
        display: flex;
        flex-direction: column;
      }
      
      /* Scrollbar Styling */
      ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }
      
      ::-webkit-scrollbar-track {
        background: var(--bg-secondary);
        border-radius: 4px;
      }
      
      ::-webkit-scrollbar-thumb {
        background: var(--border);
        border-radius: 4px;
        transition: background 0.2s;
      }
      
      ::-webkit-scrollbar-thumb:hover {
        background: var(--border-hover);
      }
      
      /* Firefox */
      * {
        scrollbar-width: thin;
        scrollbar-color: var(--border) var(--bg-secondary);
      }
      
      /* Focus Styles */
      :focus-visible {
        outline: 2px solid var(--gold-primary);
        outline-offset: 2px;
      }
      
      /* Link Styles */
      a {
        color: var(--gold-primary);
        text-decoration: none;
        transition: color 0.2s;
      }
      
      a:hover {
        color: var(--gold-light);
      }
      
      /* Button Base */
      button {
        font-family: inherit;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      /* Input Base */
      input, textarea {
        font-family: inherit;
        background: var(--bg-tertiary);
        border: 1px solid var(--border);
        color: var(--text);
        border-radius: var(--border-radius-sm);
        padding: 8px 12px;
        transition: border-color 0.2s, box-shadow 0.2s;
      }
      
      input:focus, textarea:focus {
        border-color: var(--gold-primary);
        box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.1);
      }
      
      input::placeholder, textarea::placeholder {
        color: var(--text-muted);
      }
    `}</style>
  );
}
