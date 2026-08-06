import { Navigate, Outlet, useMatches } from 'react-router-dom';
import { moduleRegistry } from '@core/modules/registry.js';
import { usePermissions } from '@core/permissions/PermissionContext.jsx';

/**
 * Segunda tranca de los permisos de sección: el sidebar ya esconde los módulos
 * no permitidos, pero la URL se puede tipear a mano. Acá se corta eso — si el
 * rol no tiene NINGUNA sección del módulo de la ruta, vuelve al inicio (que a
 * su vez resuelve el primer módulo que sí puede ver).
 */
export function ModuleGuard() {
  const { canAny } = usePermissions();
  const matches = useMatches();

  const moduleId = [...matches].reverse().find((m) => m.handle?.moduleId)?.handle?.moduleId;
  const mod = moduleId ? moduleRegistry.getModule(moduleId) : null;

  if (mod && !canAny(mod.permissions)) return <Navigate to="/" replace />;
  return <Outlet />;
}
