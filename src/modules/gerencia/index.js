import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import { defineModule } from '@core/modules/defineModule.js';
import { GerenciaPage } from './pages/GerenciaPage.jsx';
import { GERENCIA_SECCIONES } from './config/gerencia.config.js';

/** GERENCIA — usuarios/roles hoy; reportes y tablero en la agenda. */
export const gerenciaModule = defineModule({
  id: 'gerencia',
  name: 'Gerencia',
  description: 'Usuarios, roles y tablero de gestión.',
  icon: BusinessCenterIcon,
  enabled: true,
  basePath: '/gerencia',
  // Cualquier sección hace visible el módulo; sin ninguna, no existe.
  permissions: GERENCIA_SECCIONES.map((x) => x.permiso),
  navigation: { showInSidebar: true, group: 'catalog', order: 50 },
  routes: [
    { path: '', Component: GerenciaPage, handle: { crumb: 'Gerencia' } },
  ],
});
