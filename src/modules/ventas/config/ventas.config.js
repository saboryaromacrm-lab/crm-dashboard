/**
 * VENTAS — menú interno del módulo.
 * ============================================================================
 * Es DATO, no lógica: el shell arma el sub-sidebar a partir de esta lista y
 * `VentasShell` resuelve el componente por `id`.
 *
 * Presupuestos se suma cuando exista; no se dejan entradas vacías para no
 * ofrecer pantallas que no hacen nada.
 */
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import PaymentsIcon from '@mui/icons-material/Payments';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import SettingsIcon from '@mui/icons-material/Settings';

export const VENTAS_PANELS = [
  { id: 'pos', label: 'Punto de venta', icon: PointOfSaleIcon },
  { id: 'clientes', label: 'Clientes', icon: PeopleAltIcon },
  { id: 'cobranzas', label: 'Cobranzas', icon: PaymentsIcon },
  { id: 'caja', label: 'Caja', icon: AccountBalanceWalletIcon },
  { id: 'configuracion', label: 'Configuración', icon: SettingsIcon },
];
