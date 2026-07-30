import DashboardIcon from '@mui/icons-material/SpaceDashboard';
import { defineModule } from '@core/modules/defineModule.js';
import { DashboardPage } from './pages/DashboardPage.jsx';

/**
 * DASHBOARD MODULE MANIFEST
 * ============================================================================
 * A self-contained feature module. Everything it needs — pages, components,
 * services, hooks, config, styles — lives under this folder. The rest of the
 * app only ever sees this manifest.
 *
 * This is the reference implementation to copy when creating new modules.
 */
export const dashboardModule = defineModule({
  id: 'dashboard',
  name: 'Dashboard',
  description: 'Panel principal con métricas y actividad reciente.',
  icon: DashboardIcon,
  enabled: true,
  basePath: '/dashboard',
  // No permissions required to view the home dashboard.
  permissions: [],
  navigation: {
    showInSidebar: true,
    group: 'general',
    order: 10,
  },
  routes: [
    {
      // Relative to basePath -> resolves to '/dashboard'.
      // We use React Router's `Component` field (not a JSX `element`) so that
      // module manifests stay plain `.js` with NO JSX — the router instantiates
      // the component itself. This keeps manifests free of the JSX transform and
      // portable across build tools. (Pages/components still use `.jsx`.)
      path: '',
      Component: DashboardPage,
      handle: { crumb: 'Dashboard' },
    },
  ],
});
