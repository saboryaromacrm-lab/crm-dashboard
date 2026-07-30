import { appConfig } from '@core/config/app.config.js';

const locale = appConfig.i18n.defaultLocale;

/** Format a number as currency (defaults to ARS for the target market). */
export function formatCurrency(value, currency = 'ARS') {
  if (value == null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Format a number with grouping (e.g. 1.234). */
export function formatNumber(value) {
  if (value == null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat(locale).format(value);
}

/** Format a percentage from a ratio or explicit number. */
export function formatPercent(value, { fromRatio = false } = {}) {
  if (value == null || Number.isNaN(value)) return '—';
  const n = fromRatio ? value : value / 100;
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(n);
}

/** Human-friendly relative time (e.g. "hace 5 min"). */
export function formatRelativeTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  const diffMs = d.getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const minutes = Math.round(diffMs / 60000);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, 'hour');
  const days = Math.round(hours / 24);
  return rtf.format(days, 'day');
}
