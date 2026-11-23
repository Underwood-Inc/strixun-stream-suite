import type { AnalyticsSummaryRow, LinkViewEvent, LinkViewEventSink } from '../ports/LinkViewEventSink.js';

export interface AnalyticsEngineDataset {
  writeDataPoint(event: { blobs?: string[]; doubles?: number[]; indexes?: string[] }): void;
}

export interface AnalyticsEngineSqlClient {
  query<T = Record<string, unknown>>(sql: string): Promise<T[]>;
}

export interface AnalyticsEngineBinding {
  writeDataPoint(event: { blobs?: string[]; doubles?: number[]; indexes?: string[] }): void;
}

const DATASET_INDEX = 'url_shortener_link_view';

export class AnalyticsEngineLinkViewSink implements LinkViewEventSink {
  constructor(
    private readonly ae: AnalyticsEngineBinding,
    private readonly sql?: AnalyticsEngineSqlClient,
  ) {}

  async appendView(event: LinkViewEvent): Promise<void> {
    this.ae.writeDataPoint({
      indexes: [DATASET_INDEX],
      blobs: [
        event.shortCode,
        event.hostKey,
        event.userId,
        event.referer ?? '',
        event.uaHash ?? '',
      ],
      doubles: [Date.parse(event.viewedAt)],
    });
  }

  async listRecentViewsForLink(_shortCode: string, _limit: number): Promise<LinkViewEvent[]> {
    if (!this.sql) return [];
    const rows = await this.sql.query<{ shortCode: string; hostKey: string; viewedAt: number; userId: string }>(`
      SELECT blob1 AS shortCode, blob2 AS hostKey, double1 AS viewedAt, blob3 AS userId
      FROM url_shortener_link_view
      WHERE blob1 = '${_shortCode.replace(/'/g, "''")}'
      ORDER BY timestamp DESC
      LIMIT ${_limit}
    `);
    return rows.map((r) => ({
      shortCode: r.shortCode,
      hostKey: r.hostKey,
      viewedAt: new Date(r.viewedAt).toISOString(),
      userId: r.userId,
    }));
  }

  async querySummary(params: {
    userId?: string;
    shortCode?: string;
    since?: string;
  }): Promise<AnalyticsSummaryRow[]> {
    if (!this.sql) return [];
    const clauses: string[] = [`index1 = '${DATASET_INDEX}'`];
    if (params.userId) clauses.push(`blob3 = '${params.userId.replace(/'/g, "''")}'`);
    if (params.shortCode) clauses.push(`blob1 = '${params.shortCode.replace(/'/g, "''")}'`);
    if (params.since) clauses.push(`timestamp >= toDateTime(${Date.parse(params.since)} / 1000)`);
    const rows = await this.sql.query<{ hostKey: string; views: number }>(`
      SELECT blob2 AS hostKey, count() AS views
      FROM url_shortener_link_view
      WHERE ${clauses.join(' AND ')}
      GROUP BY hostKey
    `);
    return rows;
  }
}