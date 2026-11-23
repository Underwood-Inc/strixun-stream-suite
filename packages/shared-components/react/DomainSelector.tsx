import type { ShortenerPublicHostRow } from '@strixun/url-shortener-core';

export interface DomainSelectorProps {
  hosts: readonly ShortenerPublicHostRow[];
  value: string;
  onChange: (hostKey: string) => void;
  id?: string;
  label?: string;
}

export function DomainSelector({
  hosts,
  value,
  onChange,
  id = 'shortener-public-host',
  label = 'Public link domain',
}: DomainSelectorProps) {
  return (
    <label className="domain-selector" htmlFor={id}>
      <span className="domain-selector__label">{label}</span>
      <select
        id={id}
        className="domain-selector__select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {hosts.map((host) => (
          <option key={host.id} value={host.id}>
            {host.label}
          </option>
        ))}
      </select>
    </label>
  );
}