import type { SVGProps } from 'react';
import { ClipboardCopy, Link, RefreshCw, Trash2 } from 'lucide-react';
import { resolveActionIconLucideName } from '../canon/mappyActionIconAliasCatalog.js';

const LUCIDE_BY_NAME = {
  ClipboardCopy,
  Link,
  RefreshCw,
  Trash2,
} as const;

export interface MappyIconProps extends SVGProps<SVGSVGElement> {
  alias: string;
  size?: number;
}

export function MappyIcon({ alias, size = 16, ...rest }: MappyIconProps) {
  const lucide = resolveActionIconLucideName(alias);
  if (!lucide) return null;
  const Icon = LUCIDE_BY_NAME[lucide as keyof typeof LUCIDE_BY_NAME];
  if (!Icon) return null;
  return <Icon size={size} aria-hidden={rest['aria-label'] ? undefined : true} {...rest} />;
}