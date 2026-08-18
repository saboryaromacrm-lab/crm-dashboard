import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePermissions } from '@core/permissions/PermissionContext.jsx';
import { ProductosProvider } from '../context/ProductosContext.jsx';
import { InventoryShell } from '../pages/InventoryShell.jsx';
import { ALMACEN_PANELS } from '../config/productos.config.js';

/**
 * Página del módulo Almacén. El menú interno se arma SOLO con las secciones
 * que el rol tiene asignadas — lo que no está permitido no se muestra.
 *
 * `?panel=` abre directo en una sección: lo usan los "Ver todo →" del
 * Dashboard. Si la sección no está permitida se ignora y entra por la primera
 * visible — un link no puede abrir lo que el rol no puede ver.
 */
export function AlmacenPage() {
  const { can } = usePermissions();
  const [params] = useSearchParams();
  const panels = useMemo(() => ALMACEN_PANELS.filter((p) => can(p.permiso)), [can]);
  const pedido = params.get('panel');
  const inicial = panels.some((p) => p.id === pedido) ? pedido : panels[0]?.id;

  return (
    <ProductosProvider panels={panels} defaultPanel={inicial}>
      <InventoryShell
        title="Almacén"
        subtitle="Stock por sucursal, transferencias e incidencias"
      />
    </ProductosProvider>
  );
}
