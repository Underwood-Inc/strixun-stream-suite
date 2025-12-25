/**
 * Health Check Handler
 * 
 * Health check endpoint for URL Shortener worker
 */

/**
 * Health check
 * GET /health
 */
export async function handleHealth() {
  return new Response(JSON.stringify({
    status: 'ok',
    service: 'url-shortener',
    timestamp: new Date().toISOString(),
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

