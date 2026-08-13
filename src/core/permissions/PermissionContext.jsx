import { createContext, useCallback, useContext, useMemo } from 'react';
import { useAuth } from '@core/auth/AuthContext.jsx';

const PermissionContext = createContext(null);

/**
 * La API de permisos, derivada del usuario de la sesión.
 *
 * Las claves son las del catálogo del servidor (`usuarios.module.ts`): las de
 * SECCIÓN tienen la forma `modulo.seccion` (`ventas.caja`, `web.productos`) y
 * las de ACCIÓN son una palabra (`merma`, `precio_manual`). El comodín `'*'` da
 * todo y lo tiene solo el superadmin.
 *
 * Las pantallas preguntan con `can()` en vez de mirar el objeto del usuario,
 * así el modelo puede cambiar sin tocar cada lugar que consulta. Ojo: esto
 * decide qué se MUESTRA; quién puede hacer qué lo decide el servidor.
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
    () => ({ permissions, roles, can, canAny, esAdmin }),
    [permissions, roles, can, canAny, esAdmin],
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
