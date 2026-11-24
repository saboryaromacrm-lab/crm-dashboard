/**
 * GASTOS — menú interno del módulo.
 * ============================================================================
 * Es DATO, no lógica: el shell arma el sub-sidebar con esta lista y resuelve el
 * componente por `id`. `permiso` es la clave de SECCIÓN del catálogo: un rol sin
 * ella no ve el panel, y sin ninguna del módulo no ve el módulo entero.
 *
 * `badge` es la clave del contador que el shell pinta al lado del label.
 */
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import CategoryIcon from '@mui/icons-material/Category';
import InsightsIcon from '@mui/icons-material/Insights';
import StorefrontIcon from '@mui/icons-material/Storefront';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';

export const GASTOS_PANELS = [
  // "Pagos en sucursal" ya no es sección propia: es la segunda pestaña de
  // Gastos (espejo de Compras › Facturación). El badge de pagos sin rendir
  // viaja con la sección que la contiene.
  { id: 'gastos', label: 'Gastos', icon: ReceiptLongIcon, permiso: 'gastos.gastos', badge: 'sinAplicar' },
  { id: 'cuentas', label: 'Cuentas a pagar', icon: EventBusyIcon, permiso: 'gastos.pagos', badge: 'vencidos' },
  // Gastos fijos y sueldos (0152) se mudaron a Gerencia (3/11/2026; desde el 5/11 con botón propio en su menú).
  { id: 'categorias', label: 'Rubros', icon: CategoryIcon, permiso: 'gastos.categorias' },
  // Los proveedores que facturan GASTOS (19/11/2026, pedido del dueño): el mismo
  // padrón del módulo Proveedores, solo los de gastos y con lo que se les debe.
  { id: 'proveedores', label: 'Proveedores', icon: StorefrontIcon, permiso: 'gastos.proveedores' },
  // Lo que cuesta traer la mercadería de cada proveedor (0244), de las facturas de los transportes.
  { id: 'fletes', label: 'Fletes', icon: LocalShippingIcon, permiso: 'gastos.resumen' },
  { id: 'resumen', label: 'Resumen', icon: InsightsIcon, permiso: 'gastos.resumen' },
];
