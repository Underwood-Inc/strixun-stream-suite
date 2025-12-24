const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔨 Building dashboard with Vite...');

// Build the dashboard
const dashboardDir = path.join(__dirname, '..', 'dashboard');
process.chdir(dashboardDir);

try {
  execSync('pnpm build', { stdio: 'inherit' });
  console.log('✅ Dashboard built successfully');
} catch (error) {
  console.error('❌ Dashboard build failed');
  process.exit(1);
}

// Read built files and convert to base64 for embedding
const distDir = path.join(dashboardDir, 'dist');
const files = {};

function readDirectory(dir, basePath = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.join(basePath, entry.name).replace(/\\/g, '/');
    
    if (entry.isDirectory()) {
      readDirectory(fullPath, relativePath);
    } else {
      const content = fs.readFileSync(fullPath);
      // Convert binary files to base64, text files keep as string
      const isBinary = /\.(png|jpg|jpeg|gif|svg|woff|woff2|ico)$/i.test(relativePath);
      const encoded = isBinary 
        ? `data:${getMimeType(relativePath)};base64,${content.toString('base64')}`
        : content.toString('utf8');
      
      files[relativePath] = encoded;
      console.log(`  📄 ${relativePath} (${(content.length / 1024).toFixed(2)} KB)`);
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

readDirectory(distDir);

// Generate dashboard-assets.js module
// Files are stored as strings (text) or base64 data URIs (binary)
const output = `// Dashboard built files embedded as a module
// This file is generated automatically when building the dashboard
// Generated: ${new Date().toISOString()}
// DO NOT EDIT - This file is auto-generated

export default ${JSON.stringify(files, null, 2)};
`;

const outputPath = path.join(__dirname, '..', 'dashboard-assets.js');
fs.writeFileSync(outputPath, output);

console.log(`✅ Generated dashboard-assets.js (${Object.keys(files).length} files)`);
console.log('🎉 Dashboard build complete!');

