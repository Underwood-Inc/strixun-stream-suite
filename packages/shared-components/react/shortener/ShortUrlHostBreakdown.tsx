import type { HostViewBarDatum } from '@strixun/url-shortener-core';
import { HorizontalBar } from '../charts/HorizontalBar';

export interface ShortUrlHostBreakdownProps {
  series: readonly HostViewBarDatum[];
  compact?: boolean;
}

export function ShortUrlHostBreakdown({ series, compact = false }: ShortUrlHostBreakdownProps) {
  return (
    <div className={compact ? 'host-breakdown compact' : 'host-breakdown'}>
      {series.map((bar) =>
        bar.value > 0 || !compact ? (
          <HorizontalBar
            key={bar.hostKey}
            label={bar.label}
            value={bar.value}
            max={bar.max}
            valueLabel={`${bar.value} views`}
          />
        ) : null,
      )}
    </div>
  );
}