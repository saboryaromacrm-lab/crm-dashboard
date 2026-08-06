import RequestQuoteIcon from '@mui/icons-material/RequestQuote';
import { defineModule } from '@core/modules/defineModule.js';
import { gastosPendientes } from '@core/services/gastosPendientes.js';
import { GastosPage } from './pages/GastosPage.jsx';
import { GASTOS_PANELS } from './config/gastos.config.js';

/**
 * GASTOS — manifiesto del módulo.
 * ============================================================================
 * Todo lo que la empresa paga y NO es mercadería: alquiler, servicios, fletes,
 * el plomero. Y el registro de la plata que sale hacia cualquier proveedor,
 * incluida la del cajón de la sucursal.
 *
 * Vive en Administración y no en Catálogo: no se toca todos los días como el
 * punto de venta, pero es de donde salen los números de gerencia.
 *
 * `permissions` sale del propio menú: con CUALQUIER sección el módulo aparece;
 * sin ninguna, desaparece entero del sidebar.
 */
export const gastosModule = defineModule({
  id: 'gastos',
  name: 'Gastos',
  description: 'Comprobantes de gasto, vencimientos y pagos a proveedores.',
  icon: RequestQuoteIcon,
  enabled: true,
  basePath: '/gastos',
  permissions: GASTOS_PANELS.map((p) => p.permiso),
  navigation: {
    showInSidebar: true,
    group: 'administration',
    order: 10,
    // Pendientes del sidebar: gastos vencidos + pagos que nadie aplicó todavía.
    badgeCount: () => gastosPendientes.count(),
    badgeSubscribe: (listener) => gastosPendientes.subscribe(listener),
  },
  routes: [
    { path: '', Component: GastosPage, handle: { crumb: 'Gastos' } },
  ],
});
