import { useEffect, useMemo, useState } from 'react';
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
 * Some modules attach a pending-count badge (`badgeCount`/`badgeSubscribe` on
 * their manifest's `navigation`, e.g. Almacén sums transferencias+incidencias
 * abiertas). The core stays agnostic: it just calls whatever the module gave
 * it and re-renders when that module's own subscription fires.
 *
 * @returns {Array<{ key:string, label:string, items:Array }>}
 */
export function useNavigation() {
  const { canAny } = usePermissions();
  const [tick, setTick] = useState(0);

  const rawItems = useMemo(
    () => moduleRegistry.getNavigationItems().filter((item) => canAny(item.permissions)),
    [canAny],
  );

  useEffect(() => {
    const unsubs = rawItems
      .filter((item) => typeof item.badgeSubscribe === 'function')
      .map((item) => item.badgeSubscribe(() => setTick((t) => t + 1)));
    return () => unsubs.forEach((u) => typeof u === 'function' && u());
  }, [rawItems]);

  return useMemo(() => {
    const items = rawItems.map((item) => ({
      ...item,
      badgeCount: typeof item.badgeCount === 'function' ? item.badgeCount() : null,
    }));

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
    // `tick` no se lee acá adentro: solo fuerza el recálculo cuando un módulo avisa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawItems, tick]);
}
