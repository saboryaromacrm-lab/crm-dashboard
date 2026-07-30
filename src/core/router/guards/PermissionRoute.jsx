import { Navigate, Outlet } from 'react-router-dom';
import { usePermissions } from '@core/permissions/PermissionContext.jsx';
import { appConfig } from '@core/config/app.config.js';

/**
 * Route guard: allows nested routes only when the user has the required
 * permission(s). Use it to wrap a module's routes that need authorization.
 *
 * @param {{ anyOf?: string[], redirectTo?: string }} props
 */
export function PermissionRoute({ anyOf = [], redirectTo }) {
  const { canAny } = usePermissions();

  if (!canAny(anyOf)) {
    return <Navigate to={redirectTo ?? appConfig.routes.defaultAuthenticatedRoute} replace />;
  }
  return <Outlet />;
}
