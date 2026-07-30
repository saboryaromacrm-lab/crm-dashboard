import { Button } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { PageHeader } from '@shared/components/PageHeader/PageHeader.jsx';
import { MetricsGrid } from '../components/MetricsGrid.jsx';
import { RecentActivityTable } from '../components/RecentActivityTable.jsx';
import { useDashboardData } from '../hooks/useDashboardData.js';
import styles from '../styles/Dashboard.module.css';

/**
 * DASHBOARD PAGE
 * ----------------------------------------------------------------------------
 * Composition only: header + metrics grid + activity table. Data comes from the
 * `useDashboardData` hook; formatting/rendering lives in child components. The
 * page reads top-to-bottom with no fetch or business logic inline.
 */
export function DashboardPage() {
  const { metrics, activity, loading, reload } = useDashboardData();

  return (
    <div className={styles.page}>
      <PageHeader
        title="Dashboard"
        subtitle="Resumen de la actividad de tu comercio en tiempo real"
        actions={
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={reload}
            disabled={loading}
          >
            Actualizar
          </Button>
        }
      />

      <MetricsGrid
        metrics={metrics}
        trends={metrics?.trends}
        loading={loading}
      />

      <RecentActivityTable rows={activity} loading={loading} />
    </div>
  );
}
