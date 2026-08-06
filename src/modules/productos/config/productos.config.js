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
import SellIcon from '@mui/icons-material/Sell';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import PaymentsIcon from '@mui/icons-material/Payments';
import WarehouseIcon from '@mui/icons-material/Warehouse';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import HistoryIcon from '@mui/icons-material/History';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import LocalCafeIcon from '@mui/icons-material/LocalCafe';

/**
 * Menú interno del módulo COMPRAS.
 *
 * Existencias y Fraccionamiento viven solo en Almacén: son operación de
 * depósito, no de compra, y tenerlas en los dos lados obligaba a mantener la
 * misma pantalla en dos menús.
 *
 * `permiso` es la clave de SECCIÓN del catálogo de permisos: un rol sin esa
 * clave no ve el panel, y sin ninguna del módulo no ve el módulo entero.
 */
export const COMPRAS_PANELS = [
  { id: 'dashboard',      label: 'Dashboard',      icon: SpaceDashboardIcon, permiso: 'compras.dashboard' },
  { id: 'productos',      label: 'Productos',      icon: Inventory2Icon,     permiso: 'compras.productos' },
  { id: 'catalogos',      label: 'Catálogos',      icon: SellIcon,           permiso: 'compras.catalogos' },
  { id: 'proveedores',    label: 'Proveedores',    icon: LocalShippingIcon,  permiso: 'compras.proveedores' },
  { id: 'facturacion',    label: 'Facturación',    icon: ReceiptLongIcon,    permiso: 'compras.facturacion' },
  { id: 'historial',      label: 'Historial',      icon: HistoryIcon,        permiso: 'compras.historial' },
];

/** Menú interno del módulo ALMACÉN. */
export const ALMACEN_PANELS = [
  { id: 'existencias',    label: 'Existencias',    icon: WarehouseIcon,      permiso: 'almacen.existencias' },
  { id: 'fraccionamiento', label: 'Fraccionamiento', icon: CallSplitIcon,    permiso: 'almacen.fraccionamiento' },
  { id: 'transferencias', label: 'Transferencias', icon: SwapHorizIcon,      permiso: 'almacen.transferencias', badge: 'transferencias' },
  { id: 'operaciones',    label: 'Operaciones',    icon: ReceiptLongIcon,    permiso: 'almacen.operaciones' },
  { id: 'incidencias',    label: 'Incidencias',    icon: ReportProblemIcon,  permiso: 'almacen.incidencias', badge: 'incidencias' },
  // Punto de SALIDA hacia coffit: el CRM no lleva el stock del café.
  { id: 'cafeteria',      label: 'Cafetería',      icon: LocalCafeIcon,      permiso: 'almacen.cafeteria' },
];
