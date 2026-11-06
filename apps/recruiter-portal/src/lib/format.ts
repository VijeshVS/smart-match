import { TALENT_LEVEL_LABELS, type TalentLevel } from '@talent-ai/api-client';

export function initials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || '?';
}

export function levelLabel(level: TalentLevel): string {
  return TALENT_LEVEL_LABELS[level];
}

export function levelShortLabel(level: TalentLevel): string {
  switch (level) {
    case 'LEVEL_1_ENTRY':
      return 'L1 · Entry';
    case 'LEVEL_2_MID':
      return 'L2 · Mid';
    case 'LEVEL_3_LEAD':
      return 'L3 · Elite';
  }
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value);
}

export function formatPercent(value: number, digits = 0): string {
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value * 100)}%`;
}

export function formatRelativeTime(value: string): string {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return '';

  const diffSeconds = Math.round((timestamp - Date.now()) / 1000);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 60 * 60 * 24 * 365],
    ['month', 60 * 60 * 24 * 30],
    ['day', 60 * 60 * 24],
    ['hour', 60 * 60],
    ['minute', 60],
    ['second', 1],
  ];

  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  for (const [unit, seconds] of units) {
    if (Math.abs(diffSeconds) >= seconds || unit === 'second') {
      return formatter.format(Math.round(diffSeconds / seconds), unit);
    }
  }

  return 'just now';
}

export function formatDate(value: string): string {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(timestamp));
}
