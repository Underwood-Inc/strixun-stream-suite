import type { LinkAggregateDoc, UserUrlListEntry } from '../../molecules/mergeViewIntoLinkAggregate.js';
import type { LinkAggregateStore, UserViewTotalsDoc } from '../../ports/LinkAggregateStore.js';

export class InMemoryLinkAggregateStore implements LinkAggregateStore {
  private links = new Map<string, LinkAggregateDoc>();
  private userLists = new Map<string, UserUrlListEntry[]>();
  private userTotals = new Map<string, UserViewTotalsDoc>();

  async getLink(shortCode: string): Promise<LinkAggregateDoc | null> {
    return this.links.get(shortCode) ?? null;
  }

  async putLink(shortCode: string, doc: LinkAggregateDoc): Promise<void> {
    this.links.set(shortCode, structuredClone(doc));
  }

  async getUserUrlList(userId: string): Promise<UserUrlListEntry[]> {
    return structuredClone(this.userLists.get(userId) ?? []);
  }

  async putUserUrlList(userId: string, entries: UserUrlListEntry[]): Promise<void> {
    this.userLists.set(userId, structuredClone(entries));
  }

  async getUserViewTotals(userId: string): Promise<UserViewTotalsDoc | null> {
    const doc = this.userTotals.get(userId);
    return doc ? structuredClone(doc) : null;
  }

  async putUserViewTotals(userId: string, doc: UserViewTotalsDoc): Promise<void> {
    this.userTotals.set(userId, structuredClone(doc));
  }
}