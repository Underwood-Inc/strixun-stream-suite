/**
 * Landing Page Handler
 * Serves the static HTML landing page at root path
 */

// Import the landing page HTML as a string
// esbuild loads this as text via --loader:.html=text
import landingHtml from '../landing.html';

interface Env {
  ENVIRONMENT?: string;
  [key: string]: any;
}

/**
 * Handle landing page request
 * Serves the static HTML landing page
 */
export async function handleLandingPage(request: Request, env: Env): Promise<Response> {
  return new Response(landingHtml, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
    },
  });
}
