/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MODS_API_URL?: string;
  readonly VITE_AUTH_API_URL?: string;
  readonly VITE_SERVICE_ENCRYPTION_KEY?: string; // CRITICAL: OTP encryption key for encrypting requests (must match SERVICE_ENCRYPTION_KEY on server)
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

