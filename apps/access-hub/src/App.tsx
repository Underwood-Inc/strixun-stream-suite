import { useEffect } from 'react';
import { LandingPage } from './pages/LandingPage';
import './App.css';

// Extend Window interface for mermaid.js
declare global {
  interface Window {
    mermaid?: {
      initialize: (config: any) => void;
    };
  }
}

function App() {
  // Load mermaid.js for diagrams
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
    script.async = true;
    script.onload = () => {
      if (window.mermaid) {
        window.mermaid.initialize({
          startOnLoad: true,
          theme: 'dark',
          themeVariables: {
            darkMode: true,
            background: '#0a0a0a',
            primaryColor: '#edae49',
            primaryTextColor: '#f9f9f9',
            primaryBorderColor: '#edae49',
            lineColor: '#b8b8b8',
            secondaryColor: '#1a1611',
            tertiaryColor: '#2a2a2a',
            fontFamily: 'Monaco, Menlo, Consolas, monospace',
          },
        });
      }
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return <LandingPage />;
}

export default App;
