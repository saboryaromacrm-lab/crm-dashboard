import LanguageIcon from '@mui/icons-material/Language';
import { defineModule } from '@core/modules/defineModule.js';
import { WebPage } from './pages/WebPage.jsx';
import { WEB_SECCIONES } from './config/web.config.js';
import { accesosTienda } from '@core/services/accesosTienda.js';

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
  description: 'La tienda mayorista online: productos publicados, destacados, imágenes, banners y quién puede comprar.',
  icon: LanguageIcon,
  enabled: true,
  basePath: '/web',
  permissions: WEB_SECCIONES.map((x) => x.permiso),
  navigation: {
    showInSidebar: true, group: 'catalog', order: 45,
    // Pendientes del sidebar: los pedidos de ingreso a la tienda (solo para quien tiene la sección).
    badgeCount: () => accesosTienda.count(),
    badgeSubscribe: (listener) => accesosTienda.subscribe(listener),
  },
  routes: [
    { path: '', Component: WebPage, handle: { crumb: 'Tienda online' } },
  ],
});
