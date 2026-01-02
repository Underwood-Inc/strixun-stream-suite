#!/usr/bin/env node
/**
 * Development Ports Summary
 * 
 * Shows a clean summary of all running dev servers and their ports.
 * Run this after starting dev servers with `pnpm dev:turbo`
 */

const services = [
  // Frontend Applications
  {
    name: 'Stream Suite (Root)',
    location: 'Root',
    port: 5173,
    type: 'Frontend',
    url: 'http://localhost:5173',
    framework: 'Svelte',
  },
  {
    name: 'Mods Hub',
    location: 'mods-hub',
    port: 3001,
    type: 'Frontend',
    url: 'http://localhost:3001',
    framework: 'React',
  },
  {
    name: 'Control Panel',
    location: 'control-panel',
    port: 5175,
    type: 'Frontend',
    url: 'http://localhost:5175',
    framework: 'React',
  },
  {
    name: 'OTP Auth Dashboard',
    location: 'serverless/otp-auth-service/dashboard',
    port: 5174,
    type: 'Frontend',
    url: 'http://localhost:5174',
    framework: 'Svelte',
  },
  {
    name: 'URL Shortener App',
    location: 'serverless/url-shortener/app',
    port: 5176,
    type: 'Frontend',
    url: 'http://localhost:5176',
    framework: 'React',
  },
  // Backend Workers
  {
    name: 'OTP Auth Service',
    location: 'serverless/otp-auth-service',
    port: 8787,
    type: 'Backend (Worker)',
    url: null,
    framework: 'Cloudflare Worker',
  },
  {
    name: 'Mods API',
    location: 'serverless/mods-api',
    port: 8788,
    type: 'Backend (Worker)',
    url: null,
    framework: 'Cloudflare Worker',
  },
  {
    name: 'Twitch API',
    location: 'serverless/twitch-api',
    port: 8789,
    type: 'Backend (Worker)',
    url: null,
    framework: 'Cloudflare Worker',
  },
  {
    name: 'Customer API',
    location: 'serverless/customer-api',
    port: 8790,
    type: 'Backend (Worker)',
    url: null,
    framework: 'Cloudflare Worker',
  },
  {
    name: 'Game API',
    location: 'serverless/game-api',
    port: 8791,
    type: 'Backend (Worker)',
    url: null,
    framework: 'Cloudflare Worker',
  },
  {
    name: 'Chat Signaling',
    location: 'serverless/chat-signaling',
    port: 8792,
    type: 'Backend (Worker)',
    url: null,
    framework: 'Cloudflare Worker',
  },
  {
    name: 'URL Shortener Worker',
    location: 'serverless/url-shortener',
    port: 8793,
    type: 'Backend (Worker)',
    url: null,
    framework: 'Cloudflare Worker',
  },
];

function formatTable(data) {
  const frontends = data.filter(s => s.type === 'Frontend');
  const backends = data.filter(s => s.type === 'Backend (Worker)');

  console.log('\n' + '='.repeat(80));
  console.log('🚀  DEVELOPMENT SERVERS SUMMARY');
  console.log('='.repeat(80) + '\n');

  if (frontends.length > 0) {
    console.log('📱  FRONTEND APPLICATIONS\n');
    console.log('┌─────────────────────────────────────┬────────┬─────────────────────────────┐');
    console.log('│ Application                         │ Port   │ URL                         │');
    console.log('├─────────────────────────────────────┼────────┼─────────────────────────────┤');
    
    frontends.forEach(service => {
      const name = service.name.padEnd(35);
      const port = String(service.port).padEnd(6);
      const url = service.url.padEnd(27);
      console.log(`│ ${name} │ ${port} │ ${url} │`);
    });
    
    console.log('└─────────────────────────────────────┴────────┴─────────────────────────────┘\n');
  }

  if (backends.length > 0) {
    console.log('⚙️   BACKEND WORKERS\n');
    console.log('┌─────────────────────────────────────┬────────┬─────────────────────────────┐');
    console.log('│ Service                             │ Port   │ Framework                   │');
    console.log('├─────────────────────────────────────┼────────┼─────────────────────────────┤');
    
    backends.forEach(service => {
      const name = service.name.padEnd(35);
      const port = String(service.port).padEnd(6);
      const framework = service.framework.padEnd(27);
      console.log(`│ ${name} │ ${port} │ ${framework} │`);
    });
    
    console.log('└─────────────────────────────────────┴────────┴─────────────────────────────┘\n');
  }

  console.log('💡  Quick Access:\n');
  frontends.forEach(service => {
    console.log(`   ${service.name.padEnd(30)} → ${service.url}`);
  });

  console.log('\n' + '='.repeat(80));
  console.log(`✅  Total: ${frontends.length} frontend(s) + ${backends.length} backend worker(s) = ${data.length} service(s)`);
  console.log('='.repeat(80) + '\n');
}

// Run if called directly
if (import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/')) || 
    import.meta.url.includes('show-dev-ports.js')) {
  formatTable(services);
}

export { services, formatTable };
