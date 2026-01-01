/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MODS_API_URL?: string;
  readonly VITE_AUTH_API_URL?: string;
  // VITE_SERVICE_ENCRYPTION_KEY removed - service key encryption was obfuscation only
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

