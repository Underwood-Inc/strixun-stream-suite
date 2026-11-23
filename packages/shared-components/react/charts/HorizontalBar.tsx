import styled from 'styled-components';

export interface HorizontalBarProps {
  value?: number;
  max?: number;
  label?: string;
  valueLabel?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

const Figure = styled.figure`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin: 0;
`;

const Caption = styled.figcaption`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
  color: var(--text-secondary, #b8b8b8);
`;

const Label = styled.span`
  font-weight: 500;
`;

const Track = styled.div`
  width: 100%;
  height: 10px;
  overflow: hidden;
  border-radius: 4px;
  border: 1px solid var(--border, #3d3627);
  background: var(--bg-dark, #0f0e0b);
`;

const Fill = styled.div<{ $pct: number; $variant: string }>`
  height: 100%;
  width: ${(p) => p.$pct}%;
  transition: width 0.35s ease;
  border-radius: 4px;
  background: ${(p) => {
    switch (p.$variant) {
      case 'success':
        return 'var(--success, #28a745)';
      case 'warning':
        return 'var(--warning, #ffc107)';
      case 'danger':
        return 'var(--danger, #ea2b1f)';
      default:
        return 'var(--accent, #edae49)';
    }
  }};
`;

const Footer = styled.div`
  font-size: 0.75rem;
  color: var(--muted, #888);
`;

const Pct = styled.span`
  font-weight: 600;
  color: var(--text, #f9f9f9);
`;

export function HorizontalBar({
  value = 0,
  max = 1,
  label = '',
  valueLabel = '',
  variant = 'default',
}: HorizontalBarProps) {
  const fillPercent = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const aria = label
    ? `${label}: ${valueLabel || `${value} of ${max}`}`
    : valueLabel || `${value} of ${max}`;

  return (
    <Figure role="img" aria-label={aria}>
      {label ? (
        <Caption>
          <Label>{label}</Label>
          <Pct>{fillPercent.toFixed(0)}%</Pct>
        </Caption>
      ) : null}
      <Track aria-hidden>
        <Fill $pct={fillPercent} $variant={variant} />
      </Track>
      {valueLabel ? <Footer>{valueLabel}</Footer> : null}
    </Figure>
  );
}