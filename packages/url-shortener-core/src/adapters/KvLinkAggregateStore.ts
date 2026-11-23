import type { LinkAggregateDoc, UserUrlListEntry } from '../molecules/mergeViewIntoLinkAggregate.js';
import type { LinkAggregateStore, UserViewTotalsDoc } from '../ports/LinkAggregateStore.js';

export interface KvNamespace {
  get(key: string, options?: { type?: 'json' | 'text' }): Promise<string | unknown | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

export class KvLinkAggregateStore implements LinkAggregateStore {
  constructor(private readonly kv: KvNamespace) {}

  private linkKey(shortCode: string): string {
    return `url_${shortCode}`;
  }

  private userListKey(userId: string): string {
    return `user_urls_${userId}`;
  }

  private userTotalsKey(userId: string): string {
    return `user_views_${userId}`;
  }

  async getLink(shortCode: string): Promise<LinkAggregateDoc | null> {
    const raw = await this.kv.get(this.linkKey(shortCode));
    if (!raw) return null;
    if (typeof raw === 'string') return JSON.parse(raw) as LinkAggregateDoc;
    return raw as LinkAggregateDoc;
  }

  async putLink(shortCode: string, doc: LinkAggregateDoc, options?: { expirationTtl?: number }): Promise<void> {
    await this.kv.put(this.linkKey(shortCode), JSON.stringify(doc), options);
  }

  async getUserUrlList(userId: string): Promise<UserUrlListEntry[]> {
    const list = await this.kv.get(this.userListKey(userId), { type: 'json' });
    return (list as UserUrlListEntry[] | null) ?? [];
  }

  async putUserUrlList(userId: string, entries: UserUrlListEntry[]): Promise<void> {
    await this.kv.put(this.userListKey(userId), JSON.stringify(entries));
  }

  async getUserViewTotals(userId: string): Promise<UserViewTotalsDoc | null> {
    const doc = await this.kv.get(this.userTotalsKey(userId), { type: 'json' });
    return (doc as UserViewTotalsDoc | null) ?? null;
  }

  async putUserViewTotals(userId: string, doc: UserViewTotalsDoc): Promise<void> {
    await this.kv.put(this.userTotalsKey(userId), JSON.stringify(doc));
  }
}