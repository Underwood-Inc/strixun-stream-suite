/**
 * Pages Direct Upload: sync and read production_branch (Wrangler has no project update).
 */
const project = 'flags-admin';
const targetBranch = process.env.PAGES_PRODUCTION_BRANCH ?? 'main';

export function pagesProjectApiUrl(accountId) {
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${project}`;
}

export async function fetchProductionBranch(accountId, token) {
  const res = await fetch(pagesProjectApiUrl(accountId), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(JSON.stringify(json.errors ?? json));
  }
  return json.result?.production_branch ?? targetBranch;
}

/** PATCH production_branch to targetBranch. Returns branch name on success. */
export async function patchProductionBranch(accountId, token) {
  const res = await fetch(pagesProjectApiUrl(accountId), {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ production_branch: targetBranch }),
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(JSON.stringify(json.errors ?? json));
  }
  return json.result?.production_branch ?? targetBranch;
}