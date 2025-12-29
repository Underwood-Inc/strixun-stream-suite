import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('❓ Processing built files for embedding...');

const rootDir = path.join(__dirname, '..');

// Get VITE_SERVICE_ENCRYPTION_KEY from environment or Cloudflare Worker secrets
function getEncryptionKey() {
  // First, check if it's already in the environment
  if (process.env.VITE_SERVICE_ENCRYPTION_KEY) {
    console.log('✅ Found VITE_SERVICE_ENCRYPTION_KEY in environment');
    return process.env.VITE_SERVICE_ENCRYPTION_KEY;
  }

  // Try to read from .env file in dashboard directory
  const envPath = path.join(rootDir, 'dashboard', '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/VITE_SERVICE_ENCRYPTION_KEY=(.+)/);
    if (match && match[1]) {
      const key = match[1].trim().replace(/^["']|["']$/g, ''); // Remove quotes
      if (key.length >= 32) {
        console.log('✅ Found VITE_SERVICE_ENCRYPTION_KEY in dashboard/.env');
        return key;
      }
    }
  }

  // Try to get from Cloudflare Worker secrets using wrangler
  try {
    console.log('🔍 Attempting to get VITE_SERVICE_ENCRYPTION_KEY from Cloudflare Worker secrets...');
    const result = execSync('wrangler secret get VITE_SERVICE_ENCRYPTION_KEY 2>&1', {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: 'pipe'
    });
    const key = result.trim();
    if (key && key.length >= 32 && !key.includes('error') && !key.includes('not found')) {
      console.log('✅ Found VITE_SERVICE_ENCRYPTION_KEY in Cloudflare Worker secrets');
      return key;
    }
  } catch (error) {
    // wrangler secret get might fail if not authenticated or secret doesn't exist
    console.warn('⚠️  Could not get VITE_SERVICE_ENCRYPTION_KEY from Cloudflare Worker secrets');
  }

  console.error('❌ VITE_SERVICE_ENCRYPTION_KEY not found!');
  console.error('   Please set it in one of the following ways:');
  console.error('   1. Environment variable: export VITE_SERVICE_ENCRYPTION_KEY=your-key');
  console.error('   2. Dashboard .env file: echo "VITE_SERVICE_ENCRYPTION_KEY=your-key" > dashboard/.env');
  console.error('   3. Cloudflare Worker secret: wrangler secret put VITE_SERVICE_ENCRYPTION_KEY');
  process.exit(1);
}

// Note: Build should already be done by the parent script (cd dashboard && pnpm build)
// This script just processes the built files and generates the assets module
process.chdir(rootDir);

// Read built files and convert to base64 for embedding
// Dashboard builds to dashboard/dist/, not dist/
const distDir = path.join(rootDir, 'dashboard', 'dist');

// Verify dist directory exists
if (!fs.existsSync(distDir)) {
  console.error(`❌ Dashboard dist directory does not exist at: ${distDir}`);
  console.error('   Build may have failed. Make sure to run: cd dashboard && pnpm build');
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

console.log(`❓ Reading dashboard dist directory: ${distDir}`);
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

// Fix asset paths in index.html to include /dashboard/ prefix
// Vite's base path should do this, but we ensure it's correct
console.log('🔧 Fixing asset paths in index.html...');
let htmlContent = files['index.html'];
// Replace absolute asset paths that don't have /dashboard/ prefix
htmlContent = htmlContent.replace(
  /(href|src)=["']\/(assets\/[^"']+)["']/g,
  (match, attr, path) => {
    // Only fix if it doesn't already have /dashboard/ prefix
    if (!path.startsWith('dashboard/')) {
      return `${attr}="/dashboard/${path}"`;
    }
    return match;
  }
);
files['index.html'] = htmlContent;
console.log('✅ Fixed asset paths in index.html');

// Generate dashboard-assets.js module
console.log('📝 Generating assets module...');
const startTime = Date.now();
const output = `// Dashboard built files embedded as a module
// This file is generated automatically when building the dashboard
// Generated: ${new Date().toISOString()}
// DO NOT EDIT - This file is auto-generated

export default ${JSON.stringify(files, null, 2)};
`;

const outputPath = path.join(__dirname, '..', 'dashboard-assets.js');
console.log('❓ Writing assets module to disk...');
fs.writeFileSync(outputPath, output);
const writeTime = Date.now() - startTime;
console.log(`⏱️  Generated in ${writeTime}ms`);

console.log(`✅ Generated dashboard-assets.js (${Object.keys(files).length} files)`);
console.log('❓ Build complete!');

