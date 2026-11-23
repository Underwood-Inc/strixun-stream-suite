#!/usr/bin/env node
/**
 * Post-build: version.json, index.html cache bust query params, inline deploy guard.
 * Used in GitHub Pages deploy (dist/ root).
 */
import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve(process.argv[2] || 'dist');
const gitSha = process.env.GITHUB_SHA || process.env.GIT_SHA || 'local';
const shortSha = gitSha.slice(0, 7);
const deployedAt =
  process.env.DEPLOYED_AT || new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

const versionPath = path.join(distDir, 'version.json');
fs.writeFileSync(
  versionPath,
  `${JSON.stringify({ gitSha, shortSha, deployedAt }, null, 2)}\n`,
  'utf8',
);

const indexPath = path.join(distDir, 'index.html');
if (!fs.existsSync(indexPath)) {
  console.error(`inject-deploy-cache-bust: missing ${indexPath}`);
  process.exit(1);
}

let html = fs.readFileSync(indexPath, 'utf8');

if (!html.includes('http-equiv="Cache-Control"')) {
  html = html.replace(
    '<head>',
    '<head>\n    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">',
  );
}

const bootstrap = `<script id="deploy-cache-bust">(function(){var v="${gitSha}";var ls="stream_suite_deploy_sha";var ss="ss_deploy_reload";function dropSw(){if(!("serviceWorker"in navigator))return;navigator.serviceWorker.getRegistrations().then(function(rs){rs.forEach(function(r){r.unregister()})})}try{var p=localStorage.getItem(ls);if(p&&p!==v&&!sessionStorage.getItem(ss)){sessionStorage.setItem(ss,"1");localStorage.setItem(ls,v);dropSw();location.reload();}else if(!p||p!==v){localStorage.setItem(ls,v);if(p&&p!==v)dropSw()} }catch(e){}})();</script>`;

if (!html.includes('id="deploy-cache-bust"')) {
  html = html.replace(
    /<script src="(\/?)config\.js([^"]*)"><\/script>/,
    `${bootstrap}\n    <script src="/config.js?v=${shortSha}"></script>`,
  );
}

html = html.replace(/src="(\/?)config\.js(\?v=[^"]*)?"/g, `src="/config.js?v=${shortSha}"`);
html = html.replace(
  /src="(\/?)assets\/js\/main\.js(\?v=[^"]*)?"/g,
  `src="/assets/js/main.js?v=${shortSha}"`,
);
html = html.replace(
  /href="(\/?assets\/css\/[a-zA-Z0-9_.-]+\.css)(\?v=[^"]*)?"/g,
  `href="$1?v=${shortSha}"`,
);

fs.writeFileSync(indexPath, html, 'utf8');
console.log(`✓ deploy cache bust: version.json + index.html (sha ${shortSha})`);