import { useMemo } from 'react';
import { usePermissions } from '@core/permissions/PermissionContext.jsx';
import { ProductosProvider } from '../context/ProductosContext.jsx';
import { InventoryShell } from '../pages/InventoryShell.jsx';
import { COMPRAS_PANELS } from '../config/productos.config.js';

/**
 * Página del módulo Compras. El menú interno se arma SOLO con las secciones
 * que el rol tiene asignadas — lo que no está permitido no se muestra.
 */
export function ComprasPage() {
  const { can } = usePermissions();
  const panels = useMemo(() => COMPRAS_PANELS.filter((p) => can(p.permiso)), [can]);

  return (
    <ProductosProvider panels={panels} defaultPanel={panels[0]?.id}>
      <InventoryShell
        title="Compras"
        subtitle="Catálogo de productos, ingresos de mercadería y existencias"
      />
    </ProductosProvider>
  );
}
