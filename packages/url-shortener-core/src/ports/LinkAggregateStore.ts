import type { LinkAggregateDoc, UserUrlListEntry } from '../molecules/mergeViewIntoLinkAggregate.js';

export interface LinkAggregateStore {
  getLink(shortCode: string): Promise<LinkAggregateDoc | null>;
  putLink(shortCode: string, doc: LinkAggregateDoc, options?: { expirationTtl?: number }): Promise<void>;
  getUserUrlList(userId: string): Promise<UserUrlListEntry[]>;
  putUserUrlList(userId: string, entries: UserUrlListEntry[]): Promise<void>;
  getUserViewTotals(userId: string): Promise<UserViewTotalsDoc | null>;
  putUserViewTotals(userId: string, doc: UserViewTotalsDoc): Promise<void>;
}

export interface UserViewTotalsDoc {
  totalsByHostKey: Record<string, number>;
  lastViewedAt?: string;
}