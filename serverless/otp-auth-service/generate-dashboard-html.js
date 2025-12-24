const fs = require('fs');
const path = require('path');

// Read dashboard.html
const html = fs.readFileSync(path.join(__dirname, 'dashboard.html'), 'utf8');

// Escape for template literal
const escaped = html
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\${/g, '\\${');

// Generate dashboard-html.js
const output = `// Dashboard HTML embedded as a module
// This file is generated from dashboard.html
// To regenerate: node generate-dashboard-html.js

export default \`${escaped}\`;`;

fs.writeFileSync(path.join(__dirname, 'dashboard-html.js'), output);
console.log('Generated dashboard-html.js');

