export interface LinkAggregateDoc {
  shortCode?: string;
  url?: string;
  userId?: string;
  createdAt?: string;
  clickCount?: number;
  lastViewedAt?: string;
  viewsByHostKey?: Record<string, number>;
  expiresAt?: string;
  [key: string]: unknown;
}

export interface ViewMergeInput {
  hostKey: string;
  viewedAt: string;
}

export function mergeViewIntoLinkAggregate(
  doc: LinkAggregateDoc,
  input: ViewMergeInput,
): LinkAggregateDoc {
  const viewsByHostKey = { ...(doc.viewsByHostKey ?? {}) };
  const prev = viewsByHostKey[input.hostKey] ?? 0;
  viewsByHostKey[input.hostKey] = prev + 1;
  return {
    ...doc,
    clickCount: (doc.clickCount ?? 0) + 1,
    lastViewedAt: input.viewedAt,
    viewsByHostKey,
  };
}

export interface UserUrlListEntry {
  shortCode: string;
  url?: string;
  createdAt?: string;
  clickCount?: number;
  lastViewedAt?: string;
  viewsByHostKey?: Record<string, number>;
  [key: string]: unknown;
}

export function mergeViewIntoUserListEntry(
  entry: UserUrlListEntry,
  merged: Pick<LinkAggregateDoc, 'clickCount' | 'lastViewedAt' | 'viewsByHostKey'>,
): UserUrlListEntry {
  return {
    ...entry,
    clickCount: merged.clickCount,
    lastViewedAt: merged.lastViewedAt,
    viewsByHostKey: merged.viewsByHostKey ? { ...merged.viewsByHostKey } : entry.viewsByHostKey,
  };
}