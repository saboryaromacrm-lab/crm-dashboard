/**
 * SISTEMA — menú interno del módulo.
 * ============================================================================
 * `permiso` es la clave de SECCIÓN del catálogo de permisos: el manifiesto
 * deriva de acá qué claves hacen visible el módulo, y la página filtra el
 * sub-menú con las mismas.
 */
import BusinessIcon from '@mui/icons-material/Business';
import PrintIcon from '@mui/icons-material/Print';
import BackupIcon from '@mui/icons-material/Backup';

export const SISTEMA_SECCIONES = [
  { id: 'empresa', label: 'Empresa', icon: BusinessIcon, permiso: 'sistema.empresa' },
  { id: 'impresion', label: 'Impresión', icon: PrintIcon, permiso: 'sistema.impresion' },
  {
    id: 'respaldos', label: 'Respaldos', icon: BackupIcon, permiso: 'sistema.respaldos', pronto: true,
    desc: 'Copias de seguridad de la base de datos y restauración.',
  },
];
