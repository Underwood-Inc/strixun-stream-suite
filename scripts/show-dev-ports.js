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
    location: 'apps/mods-hub',
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
    location: 'apps/control-panel',
    port: 5175,
    type: 'Frontend',
    url: 'http://localhost:5175',
    framework: 'React',
  },
  {
    name: 'Access Hub',
    location: 'apps/access-hub',
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
  {
    name: 'Dice Board Game',
    location: 'apps/dice-board-game',
    port: 5179,
    type: 'Frontend',
    url: 'http://localhost:5179',
    framework: 'React',
  },
  {
    name: 'Chat Hub',
    location: 'apps/chat-hub',
    port: 5180,
    type: 'Frontend',
    url: 'http://localhost:5180',
    framework: 'React',
  },
  // Backend Workers
  {
    name: 'OTP Auth Service (Worker)',
    location: 'serverless/otp-auth-service',
    port: 8787,
    type: 'Backend (Worker)',
    url: 'http://localhost:8787',
    framework: 'Cloudflare Worker',
    hasLandingPage: true,
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
    name: 'Suite API',
    location: 'serverless/suite-api',
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
  {
    name: 'Streamkit API',
    location: 'serverless/streamkit-api',
    port: 8796,
    type: 'Backend (Worker)',
    url: 'http://localhost:8796',
    framework: 'Cloudflare Worker',
    hasLandingPage: true,
  },
  {
    name: 'Music API',
    location: 'serverless/music-api',
    port: 8791,
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
  // Only check the exact configured port - no scanning.
  // The old scanning approach caused false positives where a different service
  // running at a higher port would be reported for multiple services.
  const url = service.url;
  const probe = await probeUrl(url, 350);
  if (probe.ok) {
    return { url, port: service.port, status: 'UP' };
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
    console.log(padRight('Service', 36) + ' | ' + padRight('Port', 6) + ' | ' + padRight('Landing', 8) + ' | URL');
    console.log('-'.repeat(90));
    backends.forEach(service => {
      const landingStatus = service.hasLandingPage ? 'Yes' : '-';
      const urlDisplay = service.url || '-';
      console.log(
        padRight(service.name, 36) +
          ' | ' +
          padRight(service.port, 6) +
          ' | ' +
          padRight(landingStatus, 8) +
          ' | ' +
          urlDisplay
      );
    });
    console.log('');
  }

  // Quick access includes frontends and backend workers with landing pages
  const workersWithLanding = backends.filter(s => s.hasLandingPage);
  console.log('Quick access:\n');
  for (const service of frontends) {
    const resolved = await resolveFrontendUrl(service);
    console.log('  ' + padRight(service.name, 30) + ' -> ' + resolved.url);
  }
  if (workersWithLanding.length > 0) {
    console.log('');
    console.log('  Backend Landing Pages:');
    for (const service of workersWithLanding) {
      console.log('  ' + padRight(service.name, 30) + ' -> ' + service.url);
    }
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
