import { ProductosProvider } from '../context/ProductosContext.jsx';
import { InventoryShell } from '../pages/InventoryShell.jsx';
import { COMPRAS_PANELS } from '../config/productos.config.js';

/** Página del módulo Compras (catálogo de productos, existencias, ingresos). */
export function ComprasPage() {
  return (
    <ProductosProvider panels={COMPRAS_PANELS} defaultPanel="dashboard">
      <InventoryShell
        title="Compras"
        subtitle="Catálogo de productos, ingresos de mercadería y existencias"
      />
    </ProductosProvider>
  );
}
