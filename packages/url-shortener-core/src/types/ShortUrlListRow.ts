/** List row shape shared by worker APIs and workspace UI. */
export interface ShortUrlListRow {
  shortCode: string;
  url: string;
  shortUrl: string;
  createdAt: string;
  clickCount: number;
  lastViewedAt?: string;
  viewsByHostKey?: Record<string, number>;
}