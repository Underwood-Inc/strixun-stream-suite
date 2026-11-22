/**
 * Deploy dist to Pages on the branch that maps to Production (flags.idling.app).
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  fetchProductionBranch,
  patchProductionBranch,
} from './pages-production-branch.mjs';

const project = 'flags-admin';
const targetBranch = process.env.PAGES_PRODUCTION_BRANCH ?? 'flags-admin';
const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const assets = '../../dist/flags-admin';

function productionBranchFromWranglerList() {
  const result = spawnSync(
    'pnpm',
    ['exec', 'wrangler', 'pages', 'deployment', 'list', `--project-name=${project}`],
    { cwd: appRoot, encoding: 'utf8', shell: true },
  );
  if (result.status !== 0) {
    return null;
  }
  for (const line of result.stdout.split(/\r?\n/)) {
    if (!line.includes('Production')) {
      continue;
    }
    const parts = line.split(/[│|]/).map((p) => p.trim());
    const envIdx = parts.findIndex((p) => p === 'Production');
    if (envIdx >= 0 && parts[envIdx + 1]) {
      return parts[envIdx + 1];
    }
  }
  return null;
}

async function resolveDeployBranch() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;

  if (accountId && token) {
    try {
      await patchProductionBranch(accountId, token);
      const branch = await fetchProductionBranch(accountId, token);
      console.log(`[${project}] production_branch=${branch} (API)`);
      return branch;
    } catch (err) {
      console.warn(`[${project}] PATCH/read failed — falling back to wrangler list:`, err.message ?? err);
    }
  }

  const listed = productionBranchFromWranglerList();
  if (listed) {
    if (listed !== targetBranch) {
      console.warn(
        `[${project}] Deploying Production branch "${listed}" (target "${targetBranch}"). One-time: $env:CLOUDFLARE_ACCOUNT_ID='…'; $env:CLOUDFLARE_API_TOKEN='…'; pnpm run pages:patch-production-branch`,
      );
    } else {
      console.log(`[${project}] production_branch=${listed} (wrangler list)`);
    }
    return listed;
  }

  console.warn(`[${project}] Could not read production_branch — using "${targetBranch}".`);
  return targetBranch;
}

const branch = await resolveDeployBranch();

const deploy = spawnSync(
  'pnpm',
  [
    'exec',
    'wrangler',
    'pages',
    'deploy',
    assets,
    `--project-name=${project}`,
    `--branch=${branch}`,
    '--commit-dirty=true',
  ],
  { cwd: appRoot, stdio: 'inherit', shell: true },
);

process.exit(deploy.status === 0 ? 0 : deploy.status ?? 1);