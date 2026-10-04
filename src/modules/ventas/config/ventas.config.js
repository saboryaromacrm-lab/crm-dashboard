/**
 * VENTAS — menú interno del módulo.
 * ============================================================================
 * Es DATO, no lógica: el shell arma el sub-sidebar a partir de esta lista y
 * `VentasShell` resuelve el componente por `id`. El primer panel que el rol
 * tenga permitido es con el que abre el módulo.
 *
 * El ORDEN sigue el día del mostrador: se vende (Punto de venta), se maneja el
 * turno (Caja), entran los pedidos del sitio (Órdenes web) y se cotiza a los
 * mayoristas (Presupuestos). Después viene lo que se consulta de vez en cuando
 * —clientes, cobranzas— y al final lo que se configura y casi no se toca.
 */
import CloudOffIcon from '@mui/icons-material/CloudOff';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import PublicIcon from '@mui/icons-material/Public';
import RequestQuoteIcon from '@mui/icons-material/RequestQuote';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import PaymentsIcon from '@mui/icons-material/Payments';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SettingsIcon from '@mui/icons-material/Settings';
import PercentIcon from '@mui/icons-material/Percent';

/**
 * `permiso`: clave de sección del catálogo — sin ella, el panel no existe para
 * ese rol. `badge`: clave del contador que muestra el shell al lado del label.
 *
 * La administración del sitio web NO está acá: es su propio módulo (`/web`),
 * con su entrada en el sidebar y sus cinco secciones.
 */
export const VENTAS_PANELS = [
  { id: 'pos', label: 'Punto de venta', icon: PointOfSaleIcon, permiso: 'ventas.pos' },
  /* ORDEN DEL DUEÑO (3/10/2026): Punto de venta, Caja, Ventas, Clientes,
     Cobranzas y Carteles — la caja pegada al mostrador, que es donde se abre
     y se cierra el turno. Caídas por ARCA sigue al listado (son ventas). */
  { id: 'caja', label: 'Caja', icon: AccountBalanceWalletIcon, permiso: 'ventas.caja' },
  { id: 'listado', label: 'Ventas', icon: ReceiptLongIcon, permiso: 'ventas.listado' },
  /* Las cobradas que ARCA no pudo facturar (26/9/2026): misma llave que el
     listado, porque el que vende es el que tiene que dejarlas en regla. */
  { id: 'arca', label: 'Caídas por ARCA', icon: CloudOffIcon, permiso: 'ventas.listado', badge: 'arca' },
  { id: 'ordenes', label: 'Órdenes web', icon: PublicIcon, permiso: 'ventas.ordenes', badge: 'ordenes' },
  { id: 'presupuestos', label: 'Presupuestos', icon: RequestQuoteIcon, permiso: 'ventas.presupuestos' },
  { id: 'clientes', label: 'Clientes', icon: PeopleAltIcon, permiso: 'ventas.clientes' },
  { id: 'cobranzas', label: 'Cobranzas', icon: PaymentsIcon, permiso: 'ventas.cobranzas' },
  { id: 'ofertas', label: 'Ofertas', icon: LocalOfferIcon, permiso: 'ventas.ofertas' },
  { id: 'cambiosPrecio', label: 'Cambios de precio', icon: TrendingUpIcon, permiso: 'ventas.cambios' },
  /* LISTAS DE PRECIOS (3/10/2026, pedido del dueño: estaba en Compras). Mismo
     permiso que allá —`compras.productos`— porque muestra costos. */
  { id: 'listasPrecios', label: 'Listas de precios', icon: PercentIcon, permiso: 'compras.productos' },
  /* `ventas.carteles` es de fábrica para todos los roles (ver `permisos-base.ts`
     en la API): rehacer el cartel de un estante es trabajo de mostrador. Pedía
     `ventas.cambios`, que es la llave de los CAMBIOS DE PRECIO — usarla para
     esto obligaba a abrir de más por la puerta de al lado. */
  { id: 'carteles', label: 'Carteles de góndola', icon: LocalOfferIcon, permiso: 'ventas.carteles' },
  /* El Formato de venta vive adentro, como primera pestaña (28/9/2026, pedido
     del dueño), y la Tienda online también (4/10/2026, con los datos del sitio
     que antes estaban en Web): por eso la sección abre con cualquiera de las llaves. */
  { id: 'configuracion', label: 'Configuración', icon: SettingsIcon, permiso: ['ventas.configuracion', 'ventas.listas', 'web.configuracion'] },
];
