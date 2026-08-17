/**
 * MODULE COMPOSITION ROOT
 * ============================================================================
 * This is the ONLY file you edit to add or remove a feature module from the
 * platform. Import the module's manifest and add it to the array — routing and
 * navigation update automatically because both are generated from the registry.
 *
 * Note the dependency direction: feature modules depend on the core (they import
 * `defineModule` and register into `moduleRegistry`). The core never imports
 * from here, so the core stays closed for modification and open for extension.
 *
 * To add a module later, e.g. Customers:
 *   import { customersModule } from './customers';
 *   ...and add `customersModule` to the array below. Nothing else changes.
 */
import { moduleRegistry } from '@core/modules/registry.js';
import { dashboardModule } from './dashboard';
import { comprasModule } from './compras';
import { ventasModule } from './ventas';
import { almacenModule } from './almacen';
import { webModule } from './web';
import { gastosModule } from './gastos';
import { proveedoresModule } from './proveedores';
import { gerenciaModule } from './gerencia';
import { sistemaModule } from './sistema';
import { manualModule } from './manual';

/** The ordered list of every module the application ships with. */
export const appModules = [
  dashboardModule,
  comprasModule,
  proveedoresModule,
  ventasModule,
  almacenModule,
  webModule,
  gastosModule,
  gerenciaModule,
  sistemaModule,
  manualModule,
];

/** Registers all application modules. Call once at startup (see main.jsx). */
export function registerModules() {
  moduleRegistry.registerAll(appModules);
  return moduleRegistry;
}
