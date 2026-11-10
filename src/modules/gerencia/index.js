import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import { defineModule } from '@core/modules/defineModule.js';
import { GerenciaPage } from './pages/GerenciaPage.jsx';
import { GERENCIA_SECCIONES } from './config/gerencia.config.js';

/** GERENCIA — los números del negocio (usuarios, roles y sucursales están en Sistema desde el 9/11/2026). */
export const gerenciaModule = defineModule({
  id: 'gerencia',
  name: 'Gerencia',
  description: 'Rentabilidad, resultados, métricas, caja central y auditoría.',
  icon: BusinessCenterIcon,
  enabled: true,
  basePath: '/gerencia',
  // Cualquier sección hace visible el módulo; sin ninguna, no existe.
  permissions: [...new Set(GERENCIA_SECCIONES.map((x) => x.permiso))],
  navigation: { showInSidebar: true, group: 'catalog', order: 50 },
  routes: [
    { path: '', Component: GerenciaPage, handle: { crumb: 'Gerencia' } },
  ],
});
