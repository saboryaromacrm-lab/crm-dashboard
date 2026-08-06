import { useMemo } from 'react';
import { usePermissions } from '@core/permissions/PermissionContext.jsx';
import { ProductosProvider } from '../context/ProductosContext.jsx';
import { InventoryShell } from '../pages/InventoryShell.jsx';
import { ALMACEN_PANELS } from '../config/productos.config.js';

/**
 * Página del módulo Almacén. El menú interno se arma SOLO con las secciones
 * que el rol tiene asignadas — lo que no está permitido no se muestra.
 */
export function AlmacenPage() {
  const { can } = usePermissions();
  const panels = useMemo(() => ALMACEN_PANELS.filter((p) => can(p.permiso)), [can]);

  return (
    <ProductosProvider panels={panels} defaultPanel={panels[0]?.id}>
      <InventoryShell
        title="Almacén"
        subtitle="Stock por sucursal, transferencias e incidencias"
      />
    </ProductosProvider>
  );
}
