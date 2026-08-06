import WarehouseIcon from '@mui/icons-material/Warehouse';
import { defineModule } from '@core/modules/defineModule.js';
import { AlmacenPage } from '@modules/productos/apps/AlmacenPage.jsx';
import { inventoryStore } from '@modules/productos/services/inventory.store.js';
import { ALMACEN_PANELS } from '@modules/productos/config/productos.config.js';

/**
 * ALMACÉN — manifiesto del módulo.
 * ============================================================================
 * Recibe lo que antes vivía en Producto: Existencias, Transferencias e
 * Incidencias. Comparte el motor de inventario con Compras (mismo singleton).
 *
 * `permissions` sale del propio menú: con CUALQUIER sección el módulo aparece;
 * sin ninguna, desaparece entero del sidebar.
 */
export const almacenModule = defineModule({
  id: 'almacen',
  name: 'Almacén',
  description: 'Stock por sucursal, transferencias e incidencias.',
  icon: WarehouseIcon,
  enabled: true,
  basePath: '/almacen',
  permissions: ALMACEN_PANELS.map((p) => p.permiso),
  navigation: {
    showInSidebar: true,
    group: 'catalog',
    order: 40,
    // Pendientes del sidebar: mismas cuentas que ya arman los badges del
    // sub-menú interno (transferencias en curso + incidencias abiertas).
    badgeCount: () => inventoryStore.transferenciasPendientes().length + inventoryStore.incidenciasAbiertas().length,
    // Dispara la carga si nadie entró todavía a Almacén/Compras en esta sesión
    // (init() es un no-op si ya está cargado o cargando) y re-emite el sidebar
    // cuando el store mute.
    badgeSubscribe: (listener) => {
      inventoryStore.init();
      return inventoryStore.subscribe(listener);
    },
  },
  routes: [
    { path: '', Component: AlmacenPage, handle: { crumb: 'Almacén' } },
  ],
});
