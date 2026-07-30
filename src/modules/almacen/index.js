import WarehouseIcon from '@mui/icons-material/Warehouse';
import { defineModule } from '@core/modules/defineModule.js';
import { AlmacenPage } from '@modules/productos/apps/AlmacenPage.jsx';

/**
 * ALMACÉN — manifiesto del módulo.
 * ============================================================================
 * Recibe lo que antes vivía en Producto: Sucursales, Existencias, Transferencias
 * e Incidencias. Comparte el motor de inventario con Compras (mismo singleton).
 */
export const almacenModule = defineModule({
  id: 'almacen',
  name: 'Almacén',
  description: 'Sucursales, stock por sucursal, transferencias e incidencias.',
  icon: WarehouseIcon,
  enabled: true,
  basePath: '/almacen',
  permissions: [],
  navigation: { showInSidebar: true, group: 'catalog', order: 40 },
  routes: [
    { path: '', Component: AlmacenPage, handle: { crumb: 'Almacén' } },
  ],
});
