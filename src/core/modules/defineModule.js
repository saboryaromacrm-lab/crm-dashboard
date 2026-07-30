/**
 * MODULE CONTRACT
 * ============================================================================
 * Every feature module describes itself with a single manifest object created
 * through `defineModule`. The core knows NOTHING about individual modules — it
 * only understands this contract. That inversion of dependency (core depends on
 * an abstraction, modules depend on core) is what lets you add a module without
 * editing the core.
 *
 * A module manifest shape:
 *
 * defineModule({
 *   id: 'customers',                 // unique, stable, kebab/lowercase
 *   name: 'Clientes',                // display name (i18n key later)
 *   description: 'Gestión de clientes',
 *   icon: PeopleIcon,                // MUI icon component (optional)
 *   enabled: true,                   // feature flag
 *   basePath: '/customers',          // root route of the module
 *   navigation: {                    // how it appears in the sidebar
 *     showInSidebar: true,
 *     order: 20,
 *     group: 'operations',
 *   },
 *   permissions: ['customers:read'], // required to see/enter (optional)
 *   routes: [                        // react-router route objects (relative)
 *     { path: '', Component: CustomersListPage },   // use `Component`, not JSX
 *     { path: ':id', Component: CustomerDetailPage },
 *   ],
 * })
 *
 * Note: routes use React Router's `Component` field instead of a JSX `element`
 * so that manifest files stay plain `.js` (no JSX transform needed). Pages and
 * UI components are still authored as `.jsx`.
 *
 * `defineModule` normalizes defaults and fails fast on invalid manifests so
 * mistakes surface at startup, not at runtime deep in the tree.
 */

export function defineModule(manifest) {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('[modules] A module manifest object is required.');
  }
  const { id, name, basePath, routes } = manifest;

  if (!id) throw new Error('[modules] Module is missing "id".');
  if (!name) throw new Error(`[modules] Module "${id}" is missing "name".`);
  if (!basePath) {
    throw new Error(`[modules] Module "${id}" is missing "basePath".`);
  }
  if (!Array.isArray(routes) || routes.length === 0) {
    throw new Error(`[modules] Module "${id}" must declare at least one route.`);
  }

  return Object.freeze({
    id,
    name,
    description: manifest.description ?? '',
    icon: manifest.icon ?? null,
    enabled: manifest.enabled ?? true,
    basePath,
    permissions: manifest.permissions ?? [],
    navigation: Object.freeze({
      showInSidebar: manifest.navigation?.showInSidebar ?? true,
      order: manifest.navigation?.order ?? 100,
      group: manifest.navigation?.group ?? 'general',
      // A module may expose child links in the sidebar (sub-navigation).
      children: manifest.navigation?.children ?? [],
    }),
    routes,
  });
}
