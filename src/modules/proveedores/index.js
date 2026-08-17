import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import { defineModule } from '@core/modules/defineModule.js';
import { ProveedoresPage } from './pages/ProveedoresPage.jsx';
import { PROVEEDORES_PANELS } from './config/proveedores.config.js';

/**
 * PROVEEDORES — manifiesto del módulo (0068).
 * ============================================================================
 * La app externa de cuentas por pagar, vuelta módulo: el kanban de pedidos,
 * las cuentas corrientes (compromisos), la cartera de echeqs, los estados de
 * cuenta con conciliación, y la ficha única del padrón. La deuda nace en
 * Compras y se paga por los circuitos de siempre — este módulo la administra.
 *
 * `permissions` sale del propio menú: con CUALQUIER sección el módulo
 * aparece; sin ninguna, desaparece del sidebar (las cinco arrancan solo en
 * admin — decisión del dueño, 17/8).
 */
export const proveedoresModule = defineModule({
  id: 'proveedores',
  name: 'Proveedores',
  description: 'Pedidos, cuentas corrientes, echeqs y estados de cuenta.',
  icon: LocalShippingIcon,
  enabled: true,
  basePath: '/proveedores',
  permissions: PROVEEDORES_PANELS.map((p) => p.permiso),
  navigation: {
    showInSidebar: true,
    group: 'catalog',
    // Entre Compras (20) y Gastos (60): es el lado "administración" de comprar.
    order: 25,
  },
  routes: [
    { path: '', Component: ProveedoresPage, handle: { crumb: 'Proveedores' } },
  ],
});
