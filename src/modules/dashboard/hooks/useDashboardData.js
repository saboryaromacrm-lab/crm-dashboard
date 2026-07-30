import { useCallback, useEffect, useState } from 'react';
import { dashboardService } from '../services/dashboard.service.js';
import { logger } from '@core/services/logger.js';

/**
 * Encapsulates dashboard data fetching + loading/error state. The page stays
 * declarative and free of fetch logic (Separation of Concerns). This is the
 * pattern every module should follow: a hook per screen's data needs.
 */
export function useDashboardData() {
  const [metrics, setMetrics] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [m, a] = await Promise.all([
        dashboardService.getMetrics(),
        dashboardService.getRecentActivity(),
      ]);
      setMetrics(m);
      setActivity(a);
    } catch (err) {
      logger.error('Failed to load dashboard data', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { metrics, activity, loading, error, reload: load };
}
