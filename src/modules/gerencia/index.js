import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import { defineModule } from '@core/modules/defineModule.js';
import { GerenciaPage } from './pages/GerenciaPage.jsx';

/** GERENCIA — placeholder. Se implementa más adelante. */
export const gerenciaModule = defineModule({
  id: 'gerencia',
  name: 'Gerencia',
  description: 'Reportes y tablero de gestión (próximamente).',
  icon: BusinessCenterIcon,
  enabled: true,
  basePath: '/gerencia',
  permissions: [],
  navigation: { showInSidebar: true, group: 'catalog', order: 50 },
  routes: [
    { path: '', Component: GerenciaPage, handle: { crumb: 'Gerencia' } },
  ],
});
