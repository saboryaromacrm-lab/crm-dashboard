import { Card, Skeleton, Typography } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import { formatCurrency, formatNumber, formatPercent } from '@shared/utils/formatters.js';
import { cx } from '@shared/utils/classNames.js';
import styles from '../styles/Dashboard.module.css';

const FORMATTERS = {
  currency: formatCurrency,
  number: formatNumber,
};

/**
 * A single KPI card. Presentation-only: it receives a value + trend and renders.
 * The list of cards is driven by dashboardConfig, so adding/removing a metric is
 * a config change, not a code change.
 */
export function MetricCard({ label, value, format = 'number', trend, accent = 'primary', loading }) {
  const formatValue = FORMATTERS[format] ?? formatNumber;
  const isUp = (trend ?? 0) >= 0;

  return (
    <Card className={cx(styles.metricCard, styles[`accent_${accent}`])}>
      <span className={styles.metricAccentBar} aria-hidden="true" />
      <Typography variant="body2" color="text.secondary" className={styles.metricLabel}>
        {label}
      </Typography>

      {loading ? (
        <Skeleton width={120} height={40} />
      ) : (
        <Typography component="p" className={styles.metricValue}>
          {formatValue(value)}
        </Typography>
      )}

      {!loading && trend != null && (
        <span className={cx(styles.metricTrend, isUp ? styles.trendUp : styles.trendDown)}>
          {isUp ? <TrendingUpIcon fontSize="small" /> : <TrendingDownIcon fontSize="small" />}
          {formatPercent(Math.abs(trend))} vs. ayer
        </span>
      )}
    </Card>
  );
}
