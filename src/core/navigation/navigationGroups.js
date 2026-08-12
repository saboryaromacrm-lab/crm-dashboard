/**
 * Declares the sidebar groups and their display order. Modules attach to a group
 * via `navigation.group` in their manifest. Adding a group here is the only
 * change needed to introduce a new section (e.g. "Finanzas").
 */
export const NAVIGATION_GROUPS = Object.freeze([
  { key: 'general', label: 'General' },
  { key: 'operations', label: 'Operaciones' },
  /*
   * La clave sigue siendo `catalog` porque la usan los manifiestos de los siete
   * módulos; lo que cambió es la ETIQUETA que se ve. "Catálogo" decía mal lo que
   * hay abajo: no es un catálogo de productos, son los módulos del sistema.
   */
  { key: 'catalog', label: 'Módulo' },
  { key: 'analytics', label: 'Análisis' },
  // El grupo `administration` se sacó (12/8): su único módulo, Gastos, pasó a
  // `catalog` — un encabezado para un solo ítem era ruido, no una sección.
]);
