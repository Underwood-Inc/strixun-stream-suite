/**
 * Compare stored vs live deploy id; reload once when the server shipped a new build.
 */
export const DEPLOY_SHA_STORAGE_KEY = 'stream_suite_deploy_sha';

export type DeployVersionGuardAction = 'noop' | 'store' | 'reload';

export function resolveDeployVersionGuardAction(
  storedSha: string | null | undefined,
  liveSha: string | null | undefined,
): DeployVersionGuardAction {
  if (!liveSha || liveSha.length < 7) return 'noop';
  if (!storedSha) return 'store';
  if (storedSha === liveSha) return 'noop';
  return 'reload';
}