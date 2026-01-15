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
    name: 'OTP Auth Dashboard',
    location: 'serverless/otp-auth-service',
    port: 5174,
    type: 'Frontend',
    url: 'http://localhost:5174',
    framework: 'Svelte',
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
    name: 'Access Hub',
    location: 'access-hub',
    port: 5178,
    type: 'Frontend',
    url: 'http://localhost:5178',
    framework: 'React',
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
    name: 'OTP Auth Service (Worker)',
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
    port: 8794,
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
  {
    name: 'Access Service API',
    location: 'serverless/access-service',
    port: 8795,
    type: 'Backend (Worker)',
    url: null,
    framework: 'Cloudflare Worker',
  },
];

async function probeUrl(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'manual',
    });
    return { ok: true, status: res.status };
  } catch {
    return { ok: false, status: null };
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveFrontendUrl(service) {
  // Vite will auto-shift ports if the requested one is taken (default behavior).
  // To avoid "page can't be found" confusion, probe a small range to find where it actually started.
  const startPort = service.port;
  const maxScan = 10;
  for (let i = 0; i <= maxScan; i++) {
    const port = startPort + i;
    const url = `http://localhost:${port}`;
    const probe = await probeUrl(url, 350);
    if (probe.ok) {
      return { url, port, status: 'UP' };
    }
  }
  return { url: service.url, port: service.port, status: 'DOWN' };
}

function padRight(value, width) {
  const str = String(value);
  return str.length >= width ? str.slice(0, width) : str + ' '.repeat(width - str.length);
}

async function formatTable(data) {
  const frontends = data.filter(s => s.type === 'Frontend');
  const backends = data.filter(s => s.type === 'Backend (Worker)');

  console.log('\n' + '='.repeat(80));
  console.log('DEVELOPMENT SERVERS SUMMARY');
  console.log('='.repeat(80) + '\n');

  if (frontends.length > 0) {
    console.log('FRONTEND APPLICATIONS\n');
    console.log(padRight('Application', 35) + ' | ' + padRight('Port', 6) + ' | ' + padRight('Status', 6) + ' | URL');
    console.log('-'.repeat(80));

    for (const service of frontends) {
      const resolved = await resolveFrontendUrl(service);
      console.log(
        padRight(service.name, 35) +
          ' | ' +
          padRight(resolved.port, 6) +
          ' | ' +
          padRight(resolved.status, 6) +
          ' | ' +
          resolved.url
      );
    }
    console.log('');
  }

  if (backends.length > 0) {
    console.log('BACKEND WORKERS\n');
    console.log(padRight('Service', 36) + ' | ' + padRight('Port', 6) + ' | Framework');
    console.log('-'.repeat(80));
    backends.forEach(service => {
      console.log(
        padRight(service.name, 36) +
          ' | ' +
          padRight(service.port, 6) +
          ' | ' +
          service.framework
      );
    });
    console.log('');
  }

  console.log('Quick access:\n');
  for (const service of frontends) {
    const resolved = await resolveFrontendUrl(service);
    console.log('  ' + padRight(service.name, 30) + ' -> ' + resolved.url);
  }

  console.log('\n' + '='.repeat(80));
  console.log(`Total: ${frontends.length} frontend(s) + ${backends.length} backend worker(s) = ${data.length} service(s)`);
  console.log('='.repeat(80) + '\n');
}

// Run if called directly
if (import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/')) || 
    import.meta.url.includes('show-dev-ports.js')) {
  formatTable(services).catch((err) => {
    console.error('Failed to render dev ports summary:', err);
    process.exitCode = 1;
  });
}

export { services, formatTable };
