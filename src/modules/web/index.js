import LanguageIcon from '@mui/icons-material/Language';
import { defineModule } from '@core/modules/defineModule.js';
import { WebPage } from './pages/WebPage.jsx';
import { WEB_SECCIONES } from './config/web.config.js';
import { accesosTienda } from '@core/services/accesosTienda.js';
import { ordenesWeb } from '@core/services/ordenesWeb.js';

/**
 * WEB — manifiesto del módulo.
 * ============================================================================
 * La administración del sitio mayorista: qué productos se ven (regla: precio en
 * lista Mayorista — solo lectura acá), destacados, imágenes, contenido de la
 * portada, estadísticas y la configuración del sitio. Todo lo demás del
 * producto se maneja en Compras.
 *
 * `permissions` sale del propio menú: con CUALQUIER sección el módulo aparece;
 * sin ninguna, desaparece entero del sidebar.
 */
export const webModule = defineModule({
  id: 'web',
  name: 'Tienda online',
  description: 'La tienda online, mayorista y minorista: pedidos y presupuestos, ofertas, banners, quién puede comprar y su configuración.',
  icon: LanguageIcon,
  enabled: true,
  basePath: '/web',
  permissions: WEB_SECCIONES.map((x) => x.permiso),
  navigation: {
    showInSidebar: true, group: 'catalog', order: 45,
    // Pendientes del sidebar: los pedidos web sin revisar y los pedidos de ingreso a la tienda.
    badgeCount: () => ordenesWeb.count() + accesosTienda.count(),
    badgeSubscribe: (listener) => {
      const sinOrdenes = ordenesWeb.subscribe(listener);
      const sinAccesos = accesosTienda.subscribe(listener);
      return () => { sinOrdenes(); sinAccesos(); };
    },
  },
  routes: [
    { path: '', Component: WebPage, handle: { crumb: 'Tienda online' } },
  ],
});
