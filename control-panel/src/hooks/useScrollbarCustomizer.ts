import { useEffect, useState, useCallback } from 'react';

/**
 * Type definitions for the ScrollbarCustomizer global
 */
declare global {
  interface Window {
    ScrollbarCustomizer?: new (config?: ScrollbarConfig) => ScrollbarCustomizerInstance;
    ScrollbarCustomizerInstance?: ScrollbarCustomizerInstance;
    getWorkerApiUrl?: () => string;
  }
}

export interface ScrollbarConfig {
  width?: number;
  trackColor?: string;
  thumbColor?: string;
  thumbHoverColor?: string;
  borderRadius?: number;
  contentAdjustment?: boolean;
  namespace?: string;
}

export interface ScrollbarCustomizerInstance {
  config: ScrollbarConfig;
  isInitialized: boolean;
  init(): void;
  destroy(): void;
  updateConfig(newConfig: Partial<ScrollbarConfig>): void;
  toggleContentAdjustment(enabled?: boolean | null): boolean;
}

/**
 * Hook to load and manage the ScrollbarCustomizer CDN script
 */
export function useScrollbarCustomizer(workerUrl?: string | null) {
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [instance, setInstance] = useState<ScrollbarCustomizerInstance | null>(null);

  // Get the worker URL
  const getWorkerUrl = useCallback(() => {
    if (workerUrl) return workerUrl;
    
    // Try to get from window.getWorkerApiUrl if available
    if (typeof window !== 'undefined' && window.getWorkerApiUrl) {
      return window.getWorkerApiUrl();
    }
    
    // Fallback to hardcoded URL
    return 'https://strixun-twitch-api.strixuns-script-suite.workers.dev';
  }, [workerUrl]);

  // Load the CDN script
  useEffect(() => {
    if (loaded || loading) return;

    const scriptUrl = `${getWorkerUrl()}/cdn/scrollbar-customizer.js`;
    
    setLoading(true);
    setError(null);

    // Check if script already exists
    const existingScript = document.querySelector(`script[src="${scriptUrl}"]`);
    if (existingScript) {
      // Script already loaded, check for instance
      if (window.ScrollbarCustomizerInstance) {
        setInstance(window.ScrollbarCustomizerInstance);
        setLoaded(true);
        setLoading(false);
        return;
      }
      // Wait a bit for initialization
      const checkInterval = setInterval(() => {
        if (window.ScrollbarCustomizerInstance) {
          setInstance(window.ScrollbarCustomizerInstance);
          setLoaded(true);
          setLoading(false);
          clearInterval(checkInterval);
        }
      }, 100);
      
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!window.ScrollbarCustomizerInstance) {
          setError('Script loaded but instance not initialized');
          setLoading(false);
        }
      }, 5000);
      return;
    }

    // Create and load script
    const script = document.createElement('script');
    script.src = scriptUrl;
    script.async = true;
    
    script.onload = () => {
      // Wait for initialization
      const checkInterval = setInterval(() => {
        if (window.ScrollbarCustomizerInstance) {
          setInstance(window.ScrollbarCustomizerInstance);
          setLoaded(true);
          setLoading(false);
          clearInterval(checkInterval);
        }
      }, 100);
      
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!window.ScrollbarCustomizerInstance) {
          setError('Script loaded but instance not initialized');
          setLoading(false);
        }
      }, 5000);
    };
    
    script.onerror = () => {
      setError(`Failed to load scrollbar customizer from ${scriptUrl}`);
      setLoading(false);
    };
    
    document.head.appendChild(script);
    
    return () => {
      // Cleanup on unmount - don't remove script as it might be used elsewhere
    };
  }, [loaded, loading, getWorkerUrl]);

  // Create a new custom instance
  const createInstance = useCallback((config: ScrollbarConfig) => {
    if (!window.ScrollbarCustomizer) {
      setError('ScrollbarCustomizer class not available');
      return null;
    }

    // Destroy existing instance if any
    if (window.ScrollbarCustomizerInstance) {
      window.ScrollbarCustomizerInstance.destroy();
    }

    const newInstance = new window.ScrollbarCustomizer(config);
    newInstance.init();
    window.ScrollbarCustomizerInstance = newInstance;
    setInstance(newInstance);
    return newInstance;
  }, []);

  return {
    loaded,
    loading,
    error,
    instance,
    createInstance,
    getWorkerUrl,
  };
}

