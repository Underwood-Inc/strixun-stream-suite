/**
 * Page Handlers
 * 
 * Handles standalone HTML page serving
 */

/**
 * Serve standalone HTML page
 * GET /
 * 
 * Note: HTML content is embedded in worker.js and passed to this handler
 */
export async function handleStandalonePage(htmlContent) {
  return new Response(htmlContent, {
    headers: { 
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

