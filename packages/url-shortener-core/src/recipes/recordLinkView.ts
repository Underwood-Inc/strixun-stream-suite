import type { ShortenerPublicHostRow } from '../molecules/shortenerPublicHostsCatalog.js';
import { resolvePublicHostKey } from '../molecules/resolvePublicHostKey.js';
import {
  mergeViewIntoLinkAggregate,
  mergeViewIntoUserListEntry,
} from '../molecules/mergeViewIntoLinkAggregate.js';
import type { LinkAggregateStore, UserViewTotalsDoc } from '../ports/LinkAggregateStore.js';
import type { LinkViewEvent, LinkViewEventSink } from '../ports/LinkViewEventSink.js';

export interface RecordLinkViewInput {
  shortCode: string;
  requestHostname: string;
  viewedAt: string;
  referer?: string | null;
  uaHash?: string | null;
}

export interface RecordLinkViewDeps {
  catalog: readonly ShortenerPublicHostRow[];
  aggregateStore: LinkAggregateStore;
  eventSink: LinkViewEventSink;
}

export interface RecordLinkViewResult {
  ok: boolean;
  reason?: 'not_found';
  hostKey?: string;
}

function mergeUserTotals(
  doc: UserViewTotalsDoc | null,
  hostKey: string,
  viewedAt: string,
): UserViewTotalsDoc {
  const totalsByHostKey = { ...(doc?.totalsByHostKey ?? {}) };
  totalsByHostKey[hostKey] = (totalsByHostKey[hostKey] ?? 0) + 1;
  return { totalsByHostKey, lastViewedAt: viewedAt };
}

export async function recordLinkView(
  input: RecordLinkViewInput,
  deps: RecordLinkViewDeps,
): Promise<RecordLinkViewResult> {
  const hostKey = resolvePublicHostKey(input.requestHostname, deps.catalog);
  const doc = await deps.aggregateStore.getLink(input.shortCode);
  if (!doc?.userId) {
    return { ok: false, reason: 'not_found' };
  }

  const merged = mergeViewIntoLinkAggregate(doc, { hostKey, viewedAt: input.viewedAt });
  await deps.aggregateStore.putLink(input.shortCode, merged);

  const list = await deps.aggregateStore.getUserUrlList(doc.userId);
  const idx = list.findIndex((u) => u.shortCode === input.shortCode);
  if (idx !== -1) {
    list[idx] = mergeViewIntoUserListEntry(list[idx], merged);
    await deps.aggregateStore.putUserUrlList(doc.userId, list);
  }

  const totals = mergeUserTotals(
    await deps.aggregateStore.getUserViewTotals(doc.userId),
    hostKey,
    input.viewedAt,
  );
  await deps.aggregateStore.putUserViewTotals(doc.userId, totals);

  const event: LinkViewEvent = {
    shortCode: input.shortCode,
    hostKey,
    viewedAt: input.viewedAt,
    userId: doc.userId,
    referer: input.referer,
    uaHash: input.uaHash,
  };
  await deps.eventSink.appendView(event);

  return { ok: true, hostKey };
}