export interface AnalyticsSummaryByHost {
  hostKey: string;
  label: string;
  views: number;
}

export interface ShortUrlAnalyticsSummaryPort {
  getUserSummary(): Promise<AnalyticsSummaryByHost[]>;
}