const fs = require('fs');
const path = require('path');

/**
 * Generate landing-html.js from landing.html
 * 
 * This creates a JavaScript module that exports the landing page HTML as a string.
 * Used for embedding the landing page in the Cloudflare Worker.
 * 
 * Usage: node generate-landing-html.js
 * 
 * Note: The modern production build uses landing-page-assets.js which is generated
 * by the Vite build process. This script is for development/testing purposes.
 */

// Read landing.html
const html = fs.readFileSync(path.join(__dirname, 'landing.html'), 'utf8');

// Escape for template literal
const escaped = html
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\${/g, '\\${');

// Generate landing-html.js
const output = `// Landing page HTML embedded as a module
// This file is generated from landing.html
// To regenerate: node generate-landing-html.js
// 
// Generated: ${new Date().toISOString()}
// 
// Note: For production builds, use 'pnpm build' which generates landing-page-assets.js
// from the Vite build output. This file is for development/testing purposes.

export default \`${escaped}\`;
`;

fs.writeFileSync(path.join(__dirname, 'landing-html.js'), output);
console.log('✓ Generated landing-html.js from landing.html');
console.log('');
console.log('For production deployment, run: pnpm build');
console.log('This will generate landing-page-assets.js from the Vite build output.');
