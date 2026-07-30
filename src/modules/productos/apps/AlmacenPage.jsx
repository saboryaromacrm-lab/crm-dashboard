import { ProductosProvider } from '../context/ProductosContext.jsx';
import { InventoryShell } from '../pages/InventoryShell.jsx';
import { ALMACEN_PANELS } from '../config/productos.config.js';

/** Página del módulo Almacén (sucursales, existencias, transferencias, incidencias). */
export function AlmacenPage() {
  return (
    <ProductosProvider panels={ALMACEN_PANELS} defaultPanel="sucursales">
      <InventoryShell
        title="Almacén"
        subtitle="Sucursales, stock por sucursal, transferencias e incidencias"
      />
    </ProductosProvider>
  );
}
