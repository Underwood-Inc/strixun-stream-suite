import type { AnalyticsSummaryRow, LinkViewEvent, LinkViewEventSink } from '../../ports/LinkViewEventSink.js';

export class InMemoryLinkViewEventSink implements LinkViewEventSink {
  readonly events: LinkViewEvent[] = [];

  async appendView(event: LinkViewEvent): Promise<void> {
    this.events.push(structuredClone(event));
  }

  async listRecentViewsForLink(shortCode: string, limit: number): Promise<LinkViewEvent[]> {
    return this.events
      .filter((e) => e.shortCode === shortCode)
      .slice(-limit)
      .reverse();
  }

  async querySummary(params: {
    userId?: string;
    shortCode?: string;
    since?: string;
  }): Promise<AnalyticsSummaryRow[]> {
    const sinceMs = params.since ? Date.parse(params.since) : 0;
    const tallies = new Map<string, number>();
    for (const e of this.events) {
      if (params.userId && e.userId !== params.userId) continue;
      if (params.shortCode && e.shortCode !== params.shortCode) continue;
      if (sinceMs && Date.parse(e.viewedAt) < sinceMs) continue;
      tallies.set(e.hostKey, (tallies.get(e.hostKey) ?? 0) + 1);
    }
    return [...tallies.entries()].map(([hostKey, views]) => ({ hostKey, views }));
  }
}