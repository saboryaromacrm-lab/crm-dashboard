/**
 * GERENCIA — menú interno del módulo.
 * ============================================================================
 * Las marcadas "pronto" son la agenda de Gerencia: se construyen más adelante,
 * pero el lugar donde van a vivir ya queda a la vista.
 *
 * `permiso` es la clave de SECCIÓN del catálogo de permisos: el manifiesto
 * deriva de acá qué claves hacen visible el módulo, y la página filtra el
 * sub-menú con las mismas.
 */
import GroupIcon from '@mui/icons-material/Group';
import BarChartIcon from '@mui/icons-material/BarChart';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import SettingsIcon from '@mui/icons-material/Settings';
import InsightsIcon from '@mui/icons-material/Insights';

export const GERENCIA_SECCIONES = [
  { id: 'usuarios', label: 'Usuarios y roles', icon: GroupIcon, permiso: 'gerencia.usuarios' },
  {
    id: 'reportes', label: 'Reportes de ventas', icon: BarChartIcon, permiso: 'gerencia.reportes', pronto: true,
    desc: 'Ventas por día, sucursal y cajero; tickets, medios de pago y comparativas entre períodos.',
  },
  {
    /* Construida el 19/8/2026 (0072): margen real vs aparente, IVA absorbido
     * por la mercadería sin factura, posición fiscal y control por proveedor. */
    id: 'rentabilidad', label: 'Rentabilidad', icon: TrendingUpIcon, permiso: 'gerencia.rentabilidad',
    desc: 'Margen real por producto, marca, categoría y proveedor — con el IVA absorbido por la mercadería sin factura a la vista.',
  },
  {
    /* 29/9/2026 (0122): ventas en el tiempo, rentabilidad, proveedores y listas,
     * stock que rota. Lee tablas resumen, así no frena las cajas. La llave
     * `gerencia.metricas` no se asigna a ningún rol: solo el superadmin. */
    id: 'metricas', label: 'Métricas', icon: InsightsIcon, permiso: 'gerencia.metricas',
    desc: 'Ventas, rentabilidad, proveedores, listas y stock, casi en vivo.',
  },
  {
    id: 'valorizacion', label: 'Valorización de stock', icon: Inventory2Icon, permiso: 'gerencia.valorizacion', pronto: true,
    desc: 'Cuánta plata hay parada en mercadería, valuada a costo, por sucursal y por estado.',
  },
  {
    id: 'auditoria', label: 'Auditoría', icon: FactCheckIcon, permiso: 'gerencia.auditoria', pronto: true,
    desc: 'Quién hizo qué: anulaciones, reversiones de precios, ajustes de stock y diferencias de caja.',
  },
  {
    id: 'configuracion', label: 'Configuración', icon: SettingsIcon, permiso: 'gerencia.configuracion', pronto: true,
    desc: 'Parámetros generales del sistema: datos de la empresa, numeraciones y preferencias.',
  },
];
