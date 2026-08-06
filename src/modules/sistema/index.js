import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import { defineModule } from '@core/modules/defineModule.js';
import { SistemaPage } from './pages/SistemaPage.jsx';
import { SISTEMA_SECCIONES } from './config/sistema.config.js';

/** SISTEMA — identidad de la empresa, impresión y configuración general. */
export const sistemaModule = defineModule({
  id: 'sistema',
  name: 'Sistema',
  description: 'Empresa, impresoras y configuración general.',
  icon: SettingsSuggestIcon,
  enabled: true,
  basePath: '/sistema',
  // Cualquier sección hace visible el módulo; sin ninguna, no existe.
  permissions: SISTEMA_SECCIONES.map((x) => x.permiso),
  navigation: { showInSidebar: true, group: 'catalog', order: 55 },
  routes: [
    { path: '', Component: SistemaPage, handle: { crumb: 'Sistema' } },
  ],
});
