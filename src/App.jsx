import { AppProviders } from '@core/providers/AppProviders.jsx';
import { AppRouter } from '@core/router/AppRouter.jsx';

/**
 * Application root.
 *
 * Responsibility is intentionally thin: compose global providers around the
 * router. Everything else (layout, navigation, modules) is resolved deeper in
 * the tree so that this file almost never changes as the platform grows.
 */
export default function App() {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  );
}
