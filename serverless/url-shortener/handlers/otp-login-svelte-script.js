/**
 * Handler for serving the bundled OTP Login Svelte component
 * 
 * Serves the pre-built Svelte component bundle for use in standalone HTML
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let cachedScript = null;

export async function handleOtpLoginSvelteScript() {
  try {
    if (!cachedScript) {
      // Path to the bundled Svelte component from shared-components
      const scriptPath = join(__dirname, '../../../shared-components/otp-login/dist/otp-login-svelte.js');
      cachedScript = readFileSync(scriptPath, 'utf-8');
    }

    return new Response(cachedScript, {
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Failed to serve OTP Login Svelte script:', error);
    return new Response('// OTP Login Svelte component not found. Please build it first: pnpm --filter @strixun/otp-login build', {
      status: 404,
      headers: { 'Content-Type': 'application/javascript' },
    });
  }
}

