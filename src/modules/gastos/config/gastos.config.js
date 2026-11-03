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

export const GASTOS_PANELS = [
  // "Pagos en sucursal" ya no es sección propia: es la segunda pestaña de
  // Gastos (espejo de Compras › Facturación). El badge de pagos sin rendir
  // viaja con la sección que la contiene.
  { id: 'gastos', label: 'Gastos', icon: ReceiptLongIcon, permiso: 'gastos.gastos', badge: 'sinAplicar' },
  { id: 'cuentas', label: 'Cuentas a pagar', icon: EventBusyIcon, permiso: 'gastos.pagos', badge: 'vencidos' },
  // Gastos fijos y sueldos (0152) se mudaron a Gerencia › Resultados › Configuración (3/11/2026).
  { id: 'categorias', label: 'Rubros', icon: CategoryIcon, permiso: 'gastos.categorias' },
  // El ABM de Proveedores se fue al MÓDULO Proveedores (0068): la ficha única
  // con lo comercial completo vive allá. Acá quedó solo lo que es de gastos.
  { id: 'resumen', label: 'Resumen', icon: InsightsIcon, permiso: 'gastos.resumen' },
];
