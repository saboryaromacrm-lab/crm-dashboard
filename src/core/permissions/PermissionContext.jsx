import { createContext, useCallback, useContext, useMemo } from 'react';
import { useAuth } from '@core/auth/AuthContext.jsx';

const PermissionContext = createContext(null);

/**
 * Derives the permission-checking API from the current user.
 *
 * Permissions use "<resource>:<action>" strings (e.g. "customers:read").
 * A wildcard "*" grants everything (used by the admin role). Components and
 * route guards ask `can()` / `hasRole()` instead of inspecting the user object,
 * so the authorization model can evolve without touching call sites.
 */
export function PermissionProvider({ children }) {
  const { user } = useAuth();

  const permissions = useMemo(() => user?.permissions ?? [], [user]);
  const roles = useMemo(() => user?.roles ?? [], [user]);

  const can = useCallback(
    (permission) => {
      if (!permission) return true;
      if (permissions.includes('*')) return true;
      return permissions.includes(permission);
    },
    [permissions],
  );

  const canAny = useCallback(
    (list = []) => list.length === 0 || list.some((p) => can(p)),
    [can],
  );

  const hasRole = useCallback((role) => roles.includes(role), [roles]);

  /**
   * ¿Es un rol de ADMINISTRACIÓN? Distinto de `can()`: no pregunta si puede ver
   * una pantalla, sino si le corresponde una responsabilidad de conducción.
   *
   * Existe para los AVISOS. Un cajero puede tener permiso de mirar los pedidos
   * web y aun así no querer un cartel cada vez que entra uno — eso lo maneja el
   * administrador. Vive acá, y no repetido en cada componente, para que "quién
   * es administración" sea UNA definición en todo el sistema.
   */
  const esAdmin = useMemo(
    () => roles.includes('admin') || roles.includes('superadmin'),
    [roles],
  );

  const value = useMemo(
    () => ({ permissions, roles, can, canAny, hasRole, esAdmin }),
    [permissions, roles, can, canAny, hasRole, esAdmin],
  );

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  const ctx = useContext(PermissionContext);
  if (!ctx) {
    throw new Error('usePermissions must be used within <PermissionProvider>');
  }
  return ctx;
}
