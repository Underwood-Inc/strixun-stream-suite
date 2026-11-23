export interface LinkViewEvent {
  shortCode: string;
  hostKey: string;
  viewedAt: string;
  userId: string;
  referer?: string | null;
  uaHash?: string | null;
}

export interface AnalyticsSummaryRow {
  hostKey: string;
  views: number;
}

export interface LinkViewEventSink {
  appendView(event: LinkViewEvent): Promise<void>;
  listRecentViewsForLink(shortCode: string, limit: number): Promise<LinkViewEvent[]>;
  querySummary(params: {
    userId?: string;
    shortCode?: string;
    since?: string;
  }): Promise<AnalyticsSummaryRow[]>;
}