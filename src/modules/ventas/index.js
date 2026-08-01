import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import { defineModule } from '@core/modules/defineModule.js';
import { VentasPage } from './pages/VentasPage.jsx';

/**
 * VENTAS — manifiesto del módulo.
 * ============================================================================
 * Una entrada en el sidebar (grupo Catálogo) con su propio menú interno:
 * Clientes, Cobranzas y Configuración. Punto de venta y Presupuestos se suman
 * a `VENTAS_PANELS` cuando existan.
 *
 * A diferencia de Compras/Almacén, no comparte el motor de inventario: sus
 * datos son propios y se cargan con `GET /ventas/bootstrap`.
 */
export const ventasModule = defineModule({
  id: 'ventas',
  name: 'Ventas',
  description: 'Clientes, cuenta corriente y cobranzas.',
  icon: PointOfSaleIcon,
  enabled: true,
  basePath: '/ventas',
  permissions: [],
  navigation: { showInSidebar: true, group: 'catalog', order: 30 },
  routes: [
    { path: '', Component: VentasPage, handle: { crumb: 'Ventas' } },
  ],
});
