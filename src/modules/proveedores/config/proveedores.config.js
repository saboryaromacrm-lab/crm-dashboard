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

export const PROVEEDORES_PANELS = [
  { id: 'pedidos', label: 'Pedidos', icon: ViewKanbanIcon, permiso: 'proveedores.pedidos', badge: 'pedidos' },
  { id: 'ctasctes', label: 'Cuentas corrientes', icon: EventRepeatIcon, permiso: 'proveedores.ctasctes', badge: 'ctasctes' },
  { id: 'echeqs', label: 'Echeqs', icon: AccountBalanceIcon, permiso: 'proveedores.echeqs', badge: 'echeqs' },
  { id: 'edoc', label: 'Estados de cuenta', icon: BalanceIcon, permiso: 'proveedores.edoc' },
  { id: 'padron', label: 'Proveedores', icon: LocalShippingIcon, permiso: 'proveedores.padron' },
];
