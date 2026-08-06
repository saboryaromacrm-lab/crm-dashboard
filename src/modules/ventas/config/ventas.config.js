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
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import PublicIcon from '@mui/icons-material/Public';
import RequestQuoteIcon from '@mui/icons-material/RequestQuote';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import PaymentsIcon from '@mui/icons-material/Payments';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import SellIcon from '@mui/icons-material/Sell';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SettingsIcon from '@mui/icons-material/Settings';

/**
 * `permiso`: clave de sección del catálogo — sin ella, el panel no existe para
 * ese rol. `badge`: clave del contador que muestra el shell al lado del label.
 *
 * La administración del sitio web NO está acá: es su propio módulo (`/web`),
 * con su entrada en el sidebar y sus cinco secciones.
 */
export const VENTAS_PANELS = [
  { id: 'pos', label: 'Punto de venta', icon: PointOfSaleIcon, permiso: 'ventas.pos' },
  { id: 'caja', label: 'Caja', icon: AccountBalanceWalletIcon, permiso: 'ventas.caja' },
  { id: 'ordenes', label: 'Órdenes web', icon: PublicIcon, permiso: 'ventas.ordenes', badge: 'ordenes' },
  { id: 'presupuestos', label: 'Presupuestos', icon: RequestQuoteIcon, permiso: 'ventas.presupuestos' },
  { id: 'clientes', label: 'Clientes', icon: PeopleAltIcon, permiso: 'ventas.clientes' },
  { id: 'cobranzas', label: 'Cobranzas', icon: PaymentsIcon, permiso: 'ventas.cobranzas' },
  { id: 'listas', label: 'Formato de venta', icon: SellIcon, permiso: 'ventas.listas' },
  { id: 'ofertas', label: 'Ofertas', icon: LocalOfferIcon, permiso: 'ventas.ofertas' },
  { id: 'cambiosPrecio', label: 'Cambios de precio', icon: TrendingUpIcon, permiso: 'ventas.cambios' },
  { id: 'configuracion', label: 'Configuración', icon: SettingsIcon, permiso: 'ventas.configuracion' },
];
