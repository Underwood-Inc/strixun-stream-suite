/**
 * Direct Upload: PATCH production_branch (Wrangler has no project update).
 * See OPERATOR_RUNBOOK §8 — custom domains serve Production only.
 */
import { patchProductionBranch } from './pages-production-branch.mjs';

const project = 'flags-admin';
const branch = process.env.PAGES_PRODUCTION_BRANCH ?? 'main';
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;

if (!accountId || !token) {
  console.warn(
    `[${project}] Skip PATCH — set CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN, or set Production branch to "${branch}" in dashboard.`,
  );
  process.exit(process.env.CI ? 1 : 0);
}

try {
  const productionBranch = await patchProductionBranch(accountId, token);
  console.log(`[${project}] production_branch=${productionBranch}`);
} catch (err) {
  console.error(`[${project}] PATCH production_branch failed:`, err.message ?? err);
  process.exit(1);
}