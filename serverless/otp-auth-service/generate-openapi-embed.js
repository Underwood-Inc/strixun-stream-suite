const fs = require('fs');
const path = require('path');

// Read openapi.json
const spec = JSON.parse(fs.readFileSync(path.join(__dirname, 'openapi.json'), 'utf8'));

// Generate openapi-json.js (embedded module)
const output = `// OpenAPI 3.1.0 Specification embedded as a module
// This file is generated from openapi.json
// To regenerate: node generate-openapi-embed.js

export default ${JSON.stringify(spec, null, 2)};`;

fs.writeFileSync(path.join(__dirname, 'openapi-json.js'), output);
console.log('Generated openapi-json.js');

