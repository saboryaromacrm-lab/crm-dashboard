import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePermissions } from '@core/permissions/PermissionContext.jsx';
import { ProductosProvider } from '../context/ProductosContext.jsx';
import { InventoryShell } from '../pages/InventoryShell.jsx';
import { COMPRAS_PANELS } from '../config/productos.config.js';

/**
 * Página del módulo Compras. El menú interno se arma SOLO con las secciones
 * que el rol tiene asignadas — lo que no está permitido no se muestra.
 *
 * `?panel=` abre directo en una sección: lo usan los "Ver todo →" del
 * Dashboard. Si la sección no está permitida se ignora y entra por la primera
 * visible — un link no puede abrir lo que el rol no puede ver.
 */
export function ComprasPage() {
  const { can } = usePermissions();
  const [params] = useSearchParams();
  /* `permiso` puede ser una lista: alcanza con tener uno. Una sección a la
     que llegan dos roles por caminos distintos no debería necesitar dos
     entradas de menú que hacen exactamente lo mismo. */
  const panels = useMemo(
    () => COMPRAS_PANELS.filter((p) => (Array.isArray(p.permiso) ? p.permiso.some(can) : can(p.permiso))),
    [can],
  );
  const pedido = params.get('panel');
  const inicial = panels.some((p) => p.id === pedido) ? pedido : panels[0]?.id;

  return (
    <ProductosProvider panels={panels} defaultPanel={inicial}>
      <InventoryShell
        title="Compras"
        subtitle="Catálogo de productos, ingresos de mercadería y existencias"
      />
    </ProductosProvider>
  );
}
