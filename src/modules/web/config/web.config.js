/**
 * TIENDA ONLINE (ex «Web») — menú interno del módulo.
 * ============================================================================
 * `permiso` es la clave de SECCIÓN del catálogo de permisos: el manifiesto
 * deriva de acá qué claves hacen visible el módulo, y la página filtra el
 * sub-menú con las mismas.
 */
import PublicIcon from '@mui/icons-material/Public';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import RequestQuoteIcon from '@mui/icons-material/RequestQuote';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import ImageIcon from '@mui/icons-material/Image';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import SettingsIcon from '@mui/icons-material/Settings';

export const WEB_SECCIONES = [
  /* Quién puede comprar (0155): pedidos de ingreso por DNI. La llave conserva el nombre con que nació.
   * Primera (25/10/2026, pedido del dueño): es lo que abre la sección. */
  { id: 'accesos', label: 'Accesos a la tienda online', icon: HowToRegIcon, permiso: 'ventas.accesos_tienda', badge: 'accesos' },
  /*
   * EL RECORRIDO DEL PEDIDO WEB, ACÁ (25/10/2026, pedido del dueño; antes en
   * Ventas): los que llegan y, aceptados, sus presupuestos. Las llaves son las
   * de Ventas con que nacieron, así cada rol sigue viendo lo mismo.
   */
  { id: 'pedidos', label: 'Pedidos online', icon: PublicIcon, permiso: 'ventas.ordenes', badge: 'ordenes' },
  /* Lo que la tienda ya vendió (28/10/2026, pedido del dueño): el listado de Ventas, solo con lo del sitio. */
  { id: 'ventas', label: 'Ventas online', icon: ReceiptLongIcon, permiso: 'ventas.listado' },
  { id: 'presupuestos', label: 'Presupuestos', icon: RequestQuoteIcon, permiso: 'ventas.presupuestos' },
  /* «Productos del sitio» ya no está (19/10/2026): la foto, el destacado y el mínimo web viven en Compras › Productos. */
  { id: 'ofertas', label: 'Ofertas del sitio', icon: LocalOfferIcon, permiso: 'web.ofertas' },
  { id: 'contenido', label: 'Contenido del sitio', icon: ImageIcon, permiso: 'web.contenido' },
  /* Métricas por modo (0179): la sección conserva el id y la llave con que nació. */
  { id: 'estadisticas', label: 'Métricas', icon: QueryStatsIcon, permiso: 'web.estadisticas' },
  /* Todo lo configurable de la tienda (16/10/2026, antes en Ventas › Configuración): general, mayorista y minorista. */
  { id: 'configuracion', label: 'Configuración', icon: SettingsIcon, permiso: 'web.configuracion' },
];
