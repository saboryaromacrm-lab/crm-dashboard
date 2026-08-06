import MenuBookIcon from '@mui/icons-material/MenuBook';
import { defineModule } from '@core/modules/defineModule.js';
import { ManualPage } from './pages/ManualPage.jsx';

/**
 * INFO DE SISTEMA — manifiesto del módulo.
 * ============================================================================
 * La documentación viva del sistema: cómo trabajan los procesos y por qué están
 * así. Va adentro de la app y no en un archivo aparte porque acá se consulta en
 * el momento en que aparece la duda, que es cuando sirve.
 *
 * `order: 90` la deja al final del menú: se consulta, no se opera.
 */
export const manualModule = defineModule({
  id: 'manual',
  name: 'Info de sistema',
  description: 'Cómo trabajan los procesos y las lógicas del sistema.',
  icon: MenuBookIcon,
  enabled: true,
  basePath: '/info',
  // Sección 'manual' del catálogo de permisos: sin ella, no aparece.
  permissions: ['manual'],
  navigation: { showInSidebar: true, group: 'general', order: 90 },
  routes: [
    { path: '', Component: ManualPage, handle: { crumb: 'Info de sistema' } },
  ],
});
