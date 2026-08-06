import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import { defineModule } from '@core/modules/defineModule.js';
import { ordenesWeb } from '@core/services/ordenesWeb.js';
import { VentasPage } from './pages/VentasPage.jsx';
import { VENTAS_PANELS } from './config/ventas.config.js';

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
  // Cualquier sección del menú interno hace visible el módulo; sin ninguna, no existe.
  permissions: VENTAS_PANELS.map((p) => p.permiso),
  navigation: {
    showInSidebar: true,
    group: 'catalog',
    order: 30,
    // Pendientes del sidebar: los pedidos del sitio web sin revisar.
    badgeCount: () => ordenesWeb.count(),
    badgeSubscribe: (listener) => ordenesWeb.subscribe(listener),
  },
  routes: [
    { path: '', Component: VentasPage, handle: { crumb: 'Ventas' } },
  ],
});
