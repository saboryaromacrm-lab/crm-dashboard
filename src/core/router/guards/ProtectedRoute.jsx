import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@core/auth/AuthContext.jsx';
import { appConfig } from '@core/config/app.config.js';
import { FullScreenLoader } from '@shared/components/FullScreenLoader/FullScreenLoader.jsx';

/**
 * Route guard: allows the nested routes only for authenticated users.
 * While auth is resolving, shows a loader (prevents flicker/redirect races).
 * Unauthenticated users are sent to login, preserving the intended location.
 */
export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <FullScreenLoader label="Verificando sesión…" />;

  if (!isAuthenticated) {
    return (
      <Navigate
        to={appConfig.routes.login}
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return <Outlet />;
}
