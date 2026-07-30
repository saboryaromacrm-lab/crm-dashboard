/**
 * Declares the sidebar groups and their display order. Modules attach to a group
 * via `navigation.group` in their manifest. Adding a group here is the only
 * change needed to introduce a new section (e.g. "Finanzas").
 */
export const NAVIGATION_GROUPS = Object.freeze([
  { key: 'general', label: 'General' },
  { key: 'operations', label: 'Operaciones' },
  { key: 'catalog', label: 'Catálogo' },
  { key: 'analytics', label: 'Análisis' },
  { key: 'administration', label: 'Administración' },
]);
