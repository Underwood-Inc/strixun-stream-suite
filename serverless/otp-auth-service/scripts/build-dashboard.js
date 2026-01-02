import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log(' Processing built files for embedding...');

const rootDir = path.join(__dirname, '..');

// Note: Service key encryption has been completely removed - we do not use it
// Build should already be done by the parent script (cd dashboard && pnpm build)
// This script just processes the built files and generates the assets module
process.chdir(rootDir);

// Read built files and convert to base64 for embedding
// Dashboard builds to dashboard/dist/, not dist/
const distDir = path.join(rootDir, 'dashboard', 'dist');

// Verify dist directory exists
if (!fs.existsSync(distDir)) {
  console.error(`✗ Dashboard dist directory does not exist at: ${distDir}`);
  console.error('   Build may have failed. Make sure to run: cd dashboard && pnpm build');
  process.exit(1);
}

const files = {};

function readDirectory(dir, basePath = '') {
  if (!fs.existsSync(dir)) {
    console.warn(`⚠  Directory does not exist: ${dir}`);
    return;
  }
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  if (entries.length === 0) {
    console.warn(`⚠  Directory is empty: ${dir}`);
    return;
  }
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.join(basePath, entry.name).replace(/\\/g, '/');
    
    if (entry.isDirectory()) {
      readDirectory(fullPath, relativePath);
    } else {
      try {
        const content = fs.readFileSync(fullPath);
        // Convert binary files to base64, text files keep as string
        const isBinary = /\.(png|jpg|jpeg|gif|svg|woff|woff2|ico)$/i.test(relativePath);
        const encoded = isBinary 
          ? `data:${getMimeType(relativePath)};base64,${content.toString('base64')}`
          : content.toString('utf8');
        
        files[relativePath] = encoded;
        console.log(` ★ ${relativePath} (${(content.length / 1024).toFixed(2)} KB)`);
      } catch (error) {
        console.error(`✗ Failed to read file: ${fullPath}`, error.message);
      }
    }
  }
}

function getMimeType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html';
  if (filePath.endsWith('.js')) return 'application/javascript';
  if (filePath.endsWith('.css')) return 'text/css';
  if (filePath.endsWith('.json')) return 'application/json';
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) return 'image/jpeg';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  if (filePath.endsWith('.woff')) return 'font/woff';
  if (filePath.endsWith('.woff2')) return 'font/woff2';
  return 'application/octet-stream';
}

console.log(` Reading dashboard dist directory: ${distDir}`);
readDirectory(distDir);

// Verify CSS files are included
const cssFiles = Object.keys(files).filter(key => key.endsWith('.css'));
if (cssFiles.length === 0) {
  console.warn('⚠  WARNING: No CSS files found in build output!');
} else {
  console.log(`✓ Found ${cssFiles.length} CSS file(s): ${cssFiles.join(', ')}`);
}

// Verify we have files to embed
const fileCount = Object.keys(files).length;
if (fileCount === 0) {
  console.error('✗ No files found in dist directory. Build may have failed.');
  process.exit(1);
}

console.log(` ★ Found ${fileCount} files to embed`);

// Verify index.html exists
if (!files['index.html']) {
  console.error('✗ index.html not found in dist directory. Build may have failed.');
  process.exit(1);
}

// Fix asset paths in index.html - Vite's base path should handle this, but ensure it's correct
console.log(' ★ Fixing asset paths in index.html...');
let htmlContent = files['index.html'];
// Vite with base: '/dashboard/' should generate /dashboard/assets/... but it's generating /assets/...
// We need to convert /assets/... to /dashboard/assets/... so they resolve correctly
// Also handle both absolute paths (/assets/...) and relative paths (assets/...)
htmlContent = htmlContent.replace(
  /(href|src)=(["'])(\/?)(assets\/[^"']+)\2/g,
  (match, attr, quote, leadingSlash, path) => {
    // Convert /assets/... or assets/... to /dashboard/assets/...
    return `${attr}=${quote}/dashboard/${path}${quote}`;
  }
);
files['index.html'] = htmlContent;
console.log('✓ Fixed asset paths in index.html');

// Generate dashboard-assets.js module
console.log(' ★ Generating assets module...');
const startTime = Date.now();
const output = `// Dashboard built files embedded as a module
// This file is generated automatically when building the dashboard
// Generated: ${new Date().toISOString()}
// DO NOT EDIT - This file is auto-generated

export default ${JSON.stringify(files, null, 2)};
`;

const outputPath = path.join(__dirname, '..', 'dashboard-assets.js');
console.log(' Writing assets module to disk...');
fs.writeFileSync(outputPath, output);
const writeTime = Date.now() - startTime;
console.log(`[TIME]  Generated in ${writeTime}ms`);

console.log(`✓ Generated dashboard-assets.js (${Object.keys(files).length} files)`);
console.log(' Build complete!');

