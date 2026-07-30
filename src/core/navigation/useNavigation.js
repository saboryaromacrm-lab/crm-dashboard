import { useMemo } from 'react';
import { moduleRegistry } from '@core/modules/registry.js';
import { usePermissions } from '@core/permissions/PermissionContext.jsx';
import { NAVIGATION_GROUPS } from './navigationGroups.js';

/**
 * Builds the sidebar navigation from the module registry, filtered by the
 * current user's permissions, and grouped for display.
 *
 * The sidebar component renders whatever this returns — it has no knowledge of
 * which modules exist. Register a new module and it appears here automatically.
 *
 * @returns {Array<{ key:string, label:string, items:Array }>}
 */
export function useNavigation() {
  const { canAny } = usePermissions();

  return useMemo(() => {
    const items = moduleRegistry
      .getNavigationItems()
      .filter((item) => canAny(item.permissions));

    // Group items, preserving the display order defined in navigationGroups.
    const grouped = NAVIGATION_GROUPS.map((group) => ({
      key: group.key,
      label: group.label,
      items: items.filter((i) => i.group === group.key),
    })).filter((group) => group.items.length > 0);

    // Any items whose group isn't declared fall into a trailing "Otros" bucket.
    const known = new Set(NAVIGATION_GROUPS.map((g) => g.key));
    const orphaned = items.filter((i) => !known.has(i.group));
    if (orphaned.length > 0) {
      grouped.push({ key: 'other', label: 'Otros', items: orphaned });
    }

    return grouped;
  }, [canAny]);
}
