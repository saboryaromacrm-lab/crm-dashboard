/**
 * TIENDA ONLINE (ex «Web») — menú interno del módulo.
 * ============================================================================
 * `permiso` es la clave de SECCIÓN del catálogo de permisos: el manifiesto
 * deriva de acá qué claves hacen visible el módulo, y la página filtra el
 * sub-menú con las mismas.
 */
import StorefrontIcon from '@mui/icons-material/Storefront';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import ImageIcon from '@mui/icons-material/Image';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import SettingsIcon from '@mui/icons-material/Settings';

export const WEB_SECCIONES = [
  { id: 'productos', label: 'Productos del sitio', icon: StorefrontIcon, permiso: 'web.productos' },
  { id: 'ofertas', label: 'Ofertas del sitio', icon: LocalOfferIcon, permiso: 'web.ofertas' },
  { id: 'contenido', label: 'Contenido del sitio', icon: ImageIcon, permiso: 'web.contenido' },
  /* Métricas por modo (0179): la sección conserva el id y la llave con que nació. */
  { id: 'estadisticas', label: 'Métricas', icon: QueryStatsIcon, permiso: 'web.estadisticas' },
  /* Quién puede comprar (0155): pedidos de ingreso por DNI. La llave conserva el nombre con que nació. */
  { id: 'accesos', label: 'Accesos a la tienda online', icon: HowToRegIcon, permiso: 'ventas.accesos_tienda', badge: 'accesos' },
  /* Todo lo configurable de la tienda (16/10/2026, antes en Ventas › Configuración): general, mayorista y minorista. */
  { id: 'configuracion', label: 'Configuración', icon: SettingsIcon, permiso: 'web.configuracion' },
];
