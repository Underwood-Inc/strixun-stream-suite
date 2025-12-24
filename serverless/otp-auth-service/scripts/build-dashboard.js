import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔨 Processing built files for embedding...');

const rootDir = path.join(__dirname, '..');

// Note: Build should already be done by the parent script (tsc && vite build)
// This script just processes the built files and generates the assets module
process.chdir(rootDir);

// Read built files and convert to base64 for embedding
const distDir = path.join(rootDir, 'dist');

// Verify dist directory exists
if (!fs.existsSync(distDir)) {
  console.error('❌ dist directory does not exist. Build may have failed.');
  process.exit(1);
}

const files = {};

function readDirectory(dir, basePath = '') {
  if (!fs.existsSync(dir)) {
    console.warn(`⚠️  Directory does not exist: ${dir}`);
    return;
  }
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  if (entries.length === 0) {
    console.warn(`⚠️  Directory is empty: ${dir}`);
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
        console.log(`  📄 ${relativePath} (${(content.length / 1024).toFixed(2)} KB)`);
      } catch (error) {
        console.error(`❌ Failed to read file: ${fullPath}`, error.message);
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

console.log('📂 Reading dist directory...');
readDirectory(distDir);

// Verify we have files to embed
const fileCount = Object.keys(files).length;
if (fileCount === 0) {
  console.error('❌ No files found in dist directory. Build may have failed.');
  process.exit(1);
}

console.log(`📊 Found ${fileCount} files to embed`);

// Verify index.html exists
if (!files['index.html']) {
  console.error('❌ index.html not found in dist directory. Build may have failed.');
  process.exit(1);
}

// Generate landing-page-assets.js module (includes dashboard now)
console.log('📝 Generating assets module...');
const startTime = Date.now();
const output = `// App built files embedded as a module (includes landing page and dashboard)
// This file is generated automatically when building the app
// Generated: ${new Date().toISOString()}
// DO NOT EDIT - This file is auto-generated

export default ${JSON.stringify(files, null, 2)};
`;

const outputPath = path.join(__dirname, '..', 'landing-page-assets.js');
console.log('💾 Writing assets module to disk...');
fs.writeFileSync(outputPath, output);
const writeTime = Date.now() - startTime;
console.log(`⏱️  Generated in ${writeTime}ms`);

console.log(`✅ Generated landing-page-assets.js (${Object.keys(files).length} files)`);
console.log('🎉 Build complete!');

