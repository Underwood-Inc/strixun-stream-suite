import type { ShortenerPublicHostRow } from './shortenerPublicHostsCatalog.js';

export interface HostViewBarDatum {
  hostKey: string;
  label: string;
  value: number;
  max: number;
}

export function hostViewBarSeries(
  viewsByHostKey: Record<string, number> | undefined,
  catalog: readonly ShortenerPublicHostRow[],
): HostViewBarDatum[] {
  const views = viewsByHostKey ?? {};
  const values = catalog.map((h) => views[h.id] ?? 0);
  const max = Math.max(1, ...values, Object.values(views).reduce((m, v) => Math.max(m, v), 0));
  return catalog.map((h) => ({
    hostKey: h.id,
    label: h.label,
    value: views[h.id] ?? 0,
    max,
  }));
}

export function summaryHostBarSeries(
  byHost: Array<{ hostKey: string; label?: string; views: number }>,
  catalog: readonly ShortenerPublicHostRow[],
): HostViewBarDatum[] {
  const viewByKey = Object.fromEntries(byHost.map((h) => [h.hostKey, h.views]));
  return hostViewBarSeries(viewByKey, catalog);
}