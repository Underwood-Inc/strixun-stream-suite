/// <reference types="svelte" />
/// <reference types="vite/client" />

// Global type definitions for the application

interface ImportMetaEnv {
  readonly VITE_SERVICE_ENCRYPTION_KEY?: string; // CRITICAL: OTP encryption key for encrypting requests (must match SERVICE_ENCRYPTION_KEY on server)
  // Add other env variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  interface Window {
    // Storage system
    SSS_Storage?: {
      storage: any;
      idbReady: () => boolean;
    };
    
    // Modules
    SourceSwaps?: any;
    TextCycler?: any;
    Layouts?: any;
    Sources?: any;
    StorageSync?: any;
    ScriptStatus?: any;
    TwitchAPI?: any;
    Version?: any;
    UIUtils?: any;
    Installer?: any;
    
    // Global functions
    App?: any;
    
    // Legacy globals (for compatibility)
    swapConfigs?: any[];
    textCyclerConfigs?: any[];
    currentTextConfigIndex?: number;
    layoutPresets?: any[];
    sourceOpacityConfigs?: Record<string, number>;
    textSources?: any[];
    sources?: any[];
    connected?: boolean;
    currentScene?: string;
    ws?: WebSocket;
    msgId?: number;
  }
}

export {};

