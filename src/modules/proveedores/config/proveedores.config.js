/**
 * PROVEEDORES — menú interno del módulo (0068).
 * ============================================================================
 * Es DATO: el shell arma el sub-sidebar con esta lista. `permiso` es la clave
 * de sección del catálogo (todas arrancan solo en admin — decisión del dueño:
 * este módulo lo usan él y el encargado de confianza).
 */
import ViewKanbanIcon from '@mui/icons-material/ViewKanban';
import EventRepeatIcon from '@mui/icons-material/EventRepeat';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import BalanceIcon from '@mui/icons-material/Balance';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import CurrencyExchangeIcon from '@mui/icons-material/CurrencyExchange';
import AutorenewIcon from '@mui/icons-material/Autorenew';

/* El orden del menú (3/11/2026, pedido del dueño): Proveedores, Cuentas corrientes, Pedidos, Echeqs,
 * Estados de cuenta y después el resto. El primero que el rol puede ver es el que abre el módulo. */
export const PROVEEDORES_PANELS = [
  { id: 'padron', label: 'Proveedores', icon: LocalShippingIcon, permiso: 'proveedores.padron' },
  { id: 'ctasctes', label: 'Cuentas corrientes', icon: EventRepeatIcon, permiso: 'proveedores.ctasctes', badge: 'ctasctes' },
  { id: 'pedidos', label: 'Pedidos', icon: ViewKanbanIcon, permiso: 'proveedores.pedidos', badge: 'pedidos' },
  { id: 'echeqs', label: 'Echeqs', icon: AccountBalanceIcon, permiso: 'proveedores.echeqs', badge: 'echeqs' },
  { id: 'edoc', label: 'Estados de cuenta', icon: BalanceIcon, permiso: 'proveedores.edoc' },
  /* Cambios de mercadería (0202): lo que se le manda para que lo reponga. Lo ve quien maneja los pedidos. */
  { id: 'reposiciones', label: 'Cambios de mercadería', icon: AutorenewIcon, permiso: 'proveedores.pedidos' },
  { id: 'cuentas', label: 'Cuentas disponibles', icon: SwapHorizIcon, permiso: 'proveedores.cuentas', badge: 'cuentas' },
  /* La plata en mercadería de cada proveedor, a costo (14/10/2026). */
  { id: 'montos', label: 'Montos', icon: QueryStatsIcon, permiso: 'proveedores.montos' },
  /* Efectivo por transferencia (0175): pagos de la cuenta del proveedor, lo ve quien ve los estados de cuenta. */
  { id: 'cambios', label: 'Efectivo por transf.', icon: CurrencyExchangeIcon, permiso: 'proveedores.edoc' },
];
