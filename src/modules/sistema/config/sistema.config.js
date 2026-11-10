/**
 * SISTEMA — menú interno del módulo.
 * ============================================================================
 * `permiso` es la clave de SECCIÓN del catálogo de permisos: el manifiesto
 * deriva de acá qué claves hacen visible el módulo, y la página filtra el
 * sub-menú con las mismas.
 */
import GroupIcon from '@mui/icons-material/Group';
import StorefrontIcon from '@mui/icons-material/Storefront';
import BusinessIcon from '@mui/icons-material/Business';
import PrintIcon from '@mui/icons-material/Print';
import BackupIcon from '@mui/icons-material/Backup';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import EventIcon from '@mui/icons-material/Event';
import ScheduleIcon from '@mui/icons-material/Schedule';

export const SISTEMA_SECCIONES = [
  /* 9/11/2026 (0225, pedido del dueño): mudadas de Gerencia, cada una con su llave. */
  { id: 'usuarios', label: 'Usuarios y roles', icon: GroupIcon, permiso: 'sistema.usuarios' },
  { id: 'sucursales', label: 'Sucursales', icon: StorefrontIcon, permiso: 'sistema.sucursales' },
  { id: 'empresa', label: 'Empresa', icon: BusinessIcon, permiso: 'sistema.empresa' },
  { id: 'impresion', label: 'Impresión', icon: PrintIcon, permiso: 'sistema.impresion' },
  { id: 'terminales', label: 'Este equipo', icon: PointOfSaleIcon, permiso: 'sistema.terminales' },
  {
    id: 'respaldos', label: 'Respaldos', icon: BackupIcon, permiso: 'sistema.respaldos',
    desc: 'La copia externa de la base: automática a Google Drive o descargada a esta máquina, con el rastro de quién y cuándo.',
  },
  /* 0182: los feriados de Formosa y qué hace cada sucursal; administración (también recibe el aviso). */
  { id: 'feriados', label: 'Feriados', icon: EventIcon, permiso: 'sistema.feriados' },
  /* 7/11/2026: los locales y sus horarios, mudados de Tienda online › General; misma llave que Feriados. */
  { id: 'horarios', label: 'Horarios', icon: ScheduleIcon, permiso: 'sistema.feriados' },
];
