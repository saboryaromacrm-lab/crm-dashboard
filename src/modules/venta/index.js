import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import { defineModule } from '@core/modules/defineModule.js';
import { VentaPage } from './pages/VentaPage.jsx';

/** VENTA — placeholder. Se implementa más adelante. */
export const ventaModule = defineModule({
  id: 'venta',
  name: 'Venta',
  description: 'Módulo de ventas (próximamente).',
  icon: PointOfSaleIcon,
  enabled: true,
  basePath: '/venta',
  permissions: [],
  navigation: { showInSidebar: true, group: 'catalog', order: 30 },
  routes: [
    { path: '', Component: VentaPage, handle: { crumb: 'Venta' } },
  ],
});
