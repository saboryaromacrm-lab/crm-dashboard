/**
 * GERENCIA — menú interno del módulo.
 * ============================================================================
 * `permiso` es la clave de SECCIÓN: el manifiesto deriva de acá qué claves
 * hacen visible el módulo, y la página filtra el sub-menú con las mismas.
 * Métricas, Resultados, Cash Flow, Asesor y Auditoría usan llaves que no están en el catálogo de
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
import AssessmentIcon from '@mui/icons-material/Assessment';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import PercentIcon from '@mui/icons-material/Percent';
import SpaceDashboardIcon from '@mui/icons-material/SpaceDashboard';
import RequestQuoteIcon from '@mui/icons-material/RequestQuote';

export const GERENCIA_SECCIONES = [
  {
    /* 5/11/2026 (pedido del dueño): los números que hay que mirar, explicados,
     * por mes o por semana. Misma llave que Resultados: solo el superadmin. */
    id: 'vista', label: 'Vista profesional', icon: SpaceDashboardIcon, permiso: 'gerencia.resultados',
    desc: 'Cómo le va al negocio y dónde está la plata, por mes o por semana, con gráficos y explicado.',
  },
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
    /* 1/11/2026 (0209): los números del negocio SOLO en %, sin montos, para la
     * encargada (rol Administrador), con explicación y objetivo en cada uno. */
    id: 'indicadores', label: 'Indicadores', icon: PercentIcon, permiso: 'gerencia.indicadores',
    desc: 'Cómo va el negocio en porcentajes, sin montos: ventas, margen, stock y cajas, cada uno con su objetivo y su explicación.',
  },
  {
    /* 9/10/2026 (0152): el estado de resultados completo, todo en neto (el IVA
     * aparte), por mes y por local, con objetivos y su configuración. */
    id: 'resultados', label: 'Resultados', icon: AssessmentIcon, permiso: 'gerencia.resultados',
    desc: 'El estado de resultados: ventas, costos, gastos y lo que queda, por mes y por local, con el IVA aparte.',
  },
  {
    /* 5/11/2026: sale de Resultados › Configuración a su propio botón (pedido
     * del dueño). Misma llave que Resultados: solo el superadmin. */
    id: 'gastosfijos', label: 'Gastos fijos y sueldos', icon: RequestQuoteIcon, permiso: 'gerencia.resultados',
    desc: 'Lo fijo de cada local, cuánto tiene que vender para cubrirlo, y la carga de gastos fijos, sueldos y bienes de uso.',
  },
  {
    /* 4/10/2026 (0133): la caja central de efectivo físico del dueño — los
     * sobres de cada cierre de caja, controlados uno por uno, y lo que se saca. */
    id: 'cashflow', label: 'Cash Flow', icon: PaymentsIcon, permiso: 'gerencia.cashflow',
    desc: 'El efectivo en mano: los sobres de los locales, controlados uno por uno, y cada peso que sale.',
  },
  {
    /* 21/10/2026 (0193): la IA que lee los números del negocio y aconseja. Solo superadmin. */
    id: 'asesor', label: 'Asesor', icon: AutoAwesomeIcon, permiso: 'gerencia.asesor',
    desc: 'Una IA que lee tus números (rentabilidad, granel y fraccionado, stock, cajas, gastos), te dice qué le parece raro y qué harías. También le podés preguntar.',
  },
  {
    /* 8/10/2026 (0144): lo que cada operación deja firmado, junto y por persona. */
    id: 'auditoria', label: 'Auditoría', icon: FactCheckIcon, permiso: 'gerencia.auditoria',
    desc: 'Quién hizo qué: anulaciones, notas de crédito, precios y descuentos a mano, ajustes de stock, diferencias de caja y cambios en el sistema.',
  },
];
