/**
 * INVENTARIO — configuración de los menús internos.
 * ============================================================================
 * El subsistema de inventario alimenta DOS módulos del CRM que comparten el
 * mismo motor (singleton): **Compras** y **Almacén**. Cada uno define su propio
 * sub-menú (sub-sidebar izquierdo) con este catálogo. Es DATO, no lógica.
 *
 * Sin lote: se quitaron Presentaciones (se editan en el detalle del producto),
 * Vencimientos y Trazabilidad (eran por lote). Sucursales, Transferencias e
 * Incidencias viven en Almacén.
 */
import SpaceDashboardIcon from '@mui/icons-material/SpaceDashboard';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import WarehouseIcon from '@mui/icons-material/Warehouse';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import HistoryIcon from '@mui/icons-material/History';
import StorefrontIcon from '@mui/icons-material/Storefront';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';

/**
 * Menú interno del módulo COMPRAS.
 *
 * Existencias y Fraccionamiento viven solo en Almacén: son operación de
 * depósito, no de compra, y tenerlas en los dos lados obligaba a mantener la
 * misma pantalla en dos menús.
 */
export const COMPRAS_PANELS = [
  { id: 'dashboard',      label: 'Dashboard',      icon: SpaceDashboardIcon },
  { id: 'productos',      label: 'Productos',      icon: Inventory2Icon },
  { id: 'proveedores',    label: 'Proveedores',    icon: LocalShippingIcon },
  { id: 'facturacion',    label: 'Facturación',    icon: ReceiptLongIcon },
  { id: 'historial',      label: 'Historial',      icon: HistoryIcon },
];

/** Menú interno del módulo ALMACÉN. */
export const ALMACEN_PANELS = [
  { id: 'sucursales',     label: 'Sucursales',     icon: StorefrontIcon },
  { id: 'existencias',    label: 'Existencias',    icon: WarehouseIcon },
  { id: 'fraccionamiento', label: 'Fraccionamiento', icon: CallSplitIcon },
  { id: 'transferencias', label: 'Transferencias', icon: SwapHorizIcon, badge: 'transferencias' },
  { id: 'incidencias',    label: 'Incidencias',    icon: ReportProblemIcon, badge: 'incidencias' },
];
