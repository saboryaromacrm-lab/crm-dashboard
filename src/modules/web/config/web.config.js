/**
 * WEB — menú interno del módulo.
 * ============================================================================
 * `permiso` es la clave de SECCIÓN del catálogo de permisos: el manifiesto
 * deriva de acá qué claves hacen visible el módulo, y la página filtra el
 * sub-menú con las mismas.
 */
import StorefrontIcon from '@mui/icons-material/Storefront';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import ImageIcon from '@mui/icons-material/Image';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import SettingsIcon from '@mui/icons-material/Settings';

export const WEB_SECCIONES = [
  { id: 'productos', label: 'Productos del sitio', icon: StorefrontIcon, permiso: 'web.productos' },
  { id: 'ofertas', label: 'Ofertas del sitio', icon: LocalOfferIcon, permiso: 'web.ofertas' },
  { id: 'contenido', label: 'Contenido del sitio', icon: ImageIcon, permiso: 'web.contenido' },
  { id: 'estadisticas', label: 'Estadísticas', icon: QueryStatsIcon, permiso: 'web.estadisticas' },
  { id: 'configuracion', label: 'Configuración del sitio', icon: SettingsIcon, permiso: 'web.configuracion' },
];
