/// <reference types="svelte" />
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CUSTOMER_API_URL?: string;
  readonly VITE_SERVICE_ENCRYPTION_KEY?: string; // CRITICAL: OTP encryption key for encrypting requests (must match SERVICE_ENCRYPTION_KEY on server)
  // Add other env variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}



