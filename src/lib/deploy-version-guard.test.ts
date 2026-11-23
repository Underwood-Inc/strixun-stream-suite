import { describe, expect, test } from 'vitest';
import {
  DEPLOY_SHA_STORAGE_KEY,
  resolveDeployVersionGuardAction,
} from './deploy-version-guard';

test('[FR-SS-DEPLOY-001] resolveDeployVersionGuardAction stores on first seen sha', () => {
  expect(resolveDeployVersionGuardAction(null, 'a8c6838e9f0')).toBe('store');
  expect(DEPLOY_SHA_STORAGE_KEY).toBe('stream_suite_deploy_sha');
});

test('[FR-SS-DEPLOY-001] resolveDeployVersionGuardAction reloads when sha changes', () => {
  expect(resolveDeployVersionGuardAction('5976e879abc', 'a8c6838e9f0')).toBe('reload');
});

test('[FR-SS-DEPLOY-001] resolveDeployVersionGuardAction noops when sha matches', () => {
  expect(resolveDeployVersionGuardAction('a8c6838e9f0', 'a8c6838e9f0')).toBe('noop');
});