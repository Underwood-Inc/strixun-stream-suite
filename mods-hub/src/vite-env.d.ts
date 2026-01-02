/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MODS_API_URL?: string;
  readonly VITE_AUTH_API_URL?: string;
  readonly VITE_MODS_ENCRYPTION_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

