/**
 * GERENCIA — menú interno del módulo.
 * ============================================================================
 * `permiso` es la clave de SECCIÓN: el manifiesto deriva de acá qué claves
 * hacen visible el módulo, y la página filtra el sub-menú con las mismas.
 * Métricas, Cash Flow y Auditoría usan llaves que no están en el catálogo de
 * permisos, así que no se asignan a ningún rol: solo el superadmin.
 *
 * 8/10/2026 (0144): salieron «Reportes de ventas», «Valorización de stock» y
 * «Configuración», que nunca se construyeron porque Métricas, Almacén › Sin
 * movimiento y Sistema ya hacen ese trabajo.
 */
import GroupIcon from '@mui/icons-material/Group';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import InsightsIcon from '@mui/icons-material/Insights';
import PaymentsIcon from '@mui/icons-material/Payments';

export const GERENCIA_SECCIONES = [
  { id: 'usuarios', label: 'Usuarios y roles', icon: GroupIcon, permiso: 'gerencia.usuarios' },
  {
    /* Construida el 19/8/2026 (0072): margen real vs aparente, IVA absorbido
     * por la mercadería sin factura, posición fiscal y control por proveedor. */
    id: 'rentabilidad', label: 'Rentabilidad', icon: TrendingUpIcon, permiso: 'gerencia.rentabilidad',
    desc: 'Margen real por producto, marca, categoría y proveedor — con el IVA absorbido por la mercadería sin factura a la vista.',
  },
  {
    /* 29/9/2026 (0122): ventas en el tiempo, rentabilidad, proveedores y listas,
     * stock que rota. Lee tablas resumen, así no frena las cajas. */
    id: 'metricas', label: 'Métricas', icon: InsightsIcon, permiso: 'gerencia.metricas',
    desc: 'Ventas, rentabilidad, proveedores, listas y stock, casi en vivo.',
  },
  {
    /* 4/10/2026 (0133): la caja central de efectivo físico del dueño — los
     * sobres de cada cierre de caja, controlados uno por uno, y lo que se saca. */
    id: 'cashflow', label: 'Cash Flow', icon: PaymentsIcon, permiso: 'gerencia.cashflow',
    desc: 'El efectivo en mano: los sobres de los locales, controlados uno por uno, y cada peso que sale.',
  },
  {
    /* 8/10/2026 (0144): lo que cada operación deja firmado, junto y por persona. */
    id: 'auditoria', label: 'Auditoría', icon: FactCheckIcon, permiso: 'gerencia.auditoria',
    desc: 'Quién hizo qué: anulaciones, notas de crédito, precios y descuentos a mano, ajustes de stock, diferencias de caja y cambios en el sistema.',
  },
];
