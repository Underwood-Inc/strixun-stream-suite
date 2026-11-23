import type { ShortUrlListRow } from '@strixun/url-shortener-core';
import { MappyIcon } from '@strixun/mappy-icons/react';
import styled from 'styled-components';

const Actions = styled.div`
  display: flex;
  gap: 0.35rem;
`;

const Btn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: var(--bg-secondary);
  color: var(--text);
  cursor: pointer;
  &:hover {
    border-color: var(--accent);
  }
`;

export interface ShortUrlRowActionsProps {
  row: ShortUrlListRow;
  onCopy?: (shortUrl: string) => void;
  onDelete?: (shortCode: string) => void;
}

export function ShortUrlRowActions({ row, onCopy, onDelete }: ShortUrlRowActionsProps) {
  return (
    <Actions>
      <Btn type="button" title="Copy short URL" aria-label="Copy short URL" onClick={() => onCopy?.(row.shortUrl)}>
        <MappyIcon alias="action.copy" size={16} />
      </Btn>
      <Btn type="button" title="Delete" aria-label="Delete short URL" onClick={() => onDelete?.(row.shortCode)}>
        <MappyIcon alias="action.delete" size={16} />
      </Btn>
    </Actions>
  );
}