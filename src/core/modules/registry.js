import { env } from '@core/config/env.js';
import { logger } from '@core/services/logger.js';

/**
 * MODULE REGISTRY
 * ============================================================================
 * A small in-memory registry that holds every module manifest and derives the
 * things the core needs from them: the route table and the navigation tree.
 *
 * Design goals:
 *   - Open/Closed: adding a module = registering a manifest, never editing core.
 *   - Single source of truth: routes AND navigation are generated from the same
 *     manifests, so they can never drift apart.
 *   - Filtering: env allow-list + `enabled` flag gate which modules load.
 */
class ModuleRegistry {
  constructor() {
    /** @type {Map<string, object>} */
    this._modules = new Map();
  }

  /** Register one module manifest (created via defineModule). */
  register(module) {
    if (this._modules.has(module.id)) {
      logger.warn(`Module "${module.id}" is already registered — ignoring duplicate.`);
      return this;
    }
    this._modules.set(module.id, module);
    return this;
  }

  /** Register many at once. */
  registerAll(modules = []) {
    modules.forEach((m) => this.register(m));
    return this;
  }

  /** Is a module active? Respects the `enabled` flag and the env allow-list. */
  isActive(module) {
    if (!module.enabled) return false;
    if (env.enabledModules.length > 0) {
      return env.enabledModules.includes(module.id);
    }
    return true;
  }

  /** All active modules. */
  getActiveModules() {
    return [...this._modules.values()].filter((m) => this.isActive(m));
  }

  getModule(id) {
    return this._modules.get(id) ?? null;
  }

  /**
   * Flattened react-router route objects for every active module.
   * Each module's relative routes are prefixed with its basePath.
   */
  getRouteObjects() {
    return this.getActiveModules().flatMap((module) =>
      module.routes.map((route) => ({
        ...route,
        path: joinPaths(module.basePath, route.path),
        handle: { moduleId: module.id, ...(route.handle ?? {}) },
      })),
    );
  }

  /**
   * Navigation items for the sidebar, sorted by group then order.
   * Permission filtering happens in the UI layer (it needs the live user),
   * so this returns the full candidate set with the data needed to filter.
   */
  getNavigationItems() {
    return this.getActiveModules()
      .filter((m) => m.navigation.showInSidebar)
      .map((m) => ({
        id: m.id,
        label: m.name,
        path: m.basePath,
        icon: m.icon,
        group: m.navigation.group,
        order: m.navigation.order,
        permissions: m.permissions,
        children: m.navigation.children,
      }))
      .sort((a, b) => a.order - b.order);
  }
}

function joinPaths(base, path) {
  if (!path) return base;
  const b = base.endsWith('/') ? base.slice(0, -1) : base;
  const p = path.startsWith('/') ? path.slice(1) : path;
  return `${b}/${p}`;
}

// A single shared instance is intentional — the app has exactly one registry.
export const moduleRegistry = new ModuleRegistry();
