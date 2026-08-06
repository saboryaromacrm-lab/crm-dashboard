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

export const GERENCIA_SECCIONES = [
  { id: 'usuarios', label: 'Usuarios y roles', icon: GroupIcon, permiso: 'gerencia.usuarios' },
  {
    id: 'reportes', label: 'Reportes de ventas', icon: BarChartIcon, permiso: 'gerencia.reportes', pronto: true,
    desc: 'Ventas por día, sucursal y cajero; tickets, medios de pago y comparativas entre períodos.',
  },
  {
    id: 'rentabilidad', label: 'Rentabilidad', icon: TrendingUpIcon, permiso: 'gerencia.rentabilidad', pronto: true,
    desc: 'Margen por producto, categoría y proveedor: qué deja plata y qué conviene dejar de vender.',
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
