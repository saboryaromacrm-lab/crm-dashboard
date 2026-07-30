import { MetricCard } from './MetricCard.jsx';
import { dashboardConfig } from '../config/dashboard.config.js';
import styles from '../styles/Dashboard.module.css';

/**
 * Responsive grid of KPI cards. The cards it renders come from
 * dashboardConfig.metrics — the grid itself is agnostic to which metrics exist.
 * On mobile the grid collapses to a single column (cards stack vertically).
 */
export function MetricsGrid({ metrics, trends, loading }) {
  return (
    <section className={styles.metricsGrid} aria-label="Métricas principales">
      {dashboardConfig.metrics.map((cfg) => (
        <MetricCard
          key={cfg.key}
          label={cfg.label}
          value={metrics?.[cfg.key]}
          trend={trends?.[cfg.key]}
          format={cfg.format}
          accent={cfg.accent}
          loading={loading}
        />
      ))}
    </section>
  );
}
