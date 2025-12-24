const fs = require('fs');
const path = require('path');

// Read openapi.json
const spec = fs.readFileSync(path.join(__dirname, 'openapi.json'), 'utf8');

// Generate openapi.js
const output = `// OpenAPI 3.1.0 Specification
// Generated from openapi.json

export default ${spec};`;

fs.writeFileSync(path.join(__dirname, 'openapi.js'), output);
console.log('Generated openapi.js');

