import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import { defineModule } from '@core/modules/defineModule.js';
import { ComprasPage } from '@modules/productos/apps/ComprasPage.jsx';

/**
 * COMPRAS — manifiesto del módulo.
 * ============================================================================
 * Aparece como una entrada en el sidebar (grupo Catálogo). Adentro tiene su
 * propio menú (Dashboard, Productos, Existencias, Fraccionamiento, Historial).
 * Comparte el motor de inventario con Almacén (mismo singleton).
 */
export const comprasModule = defineModule({
  id: 'compras',
  name: 'Compras',
  description: 'Catálogo de productos, ingresos de mercadería y existencias.',
  icon: ShoppingCartIcon,
  enabled: true,
  basePath: '/compras',
  permissions: [],
  navigation: { showInSidebar: true, group: 'catalog', order: 20 },
  routes: [
    { path: '', Component: ComprasPage, handle: { crumb: 'Compras' } },
  ],
});
