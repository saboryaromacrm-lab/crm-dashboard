/**
 * Module-scoped configuration. Keeping module config next to the module (not in
 * the global config) is part of the "each module is self-contained" rule —
 * global config never grows just because a module was added.
 */
export const dashboardConfig = Object.freeze({
  // How often the dashboard could refetch (ms) — wired for a future polling hook.
  refreshIntervalMs: 60_000,

  // Which metric cards to show and in what order. Editing this array changes the
  // dashboard without touching component code.
  metrics: [
    { key: 'sales', label: 'Ventas del día', format: 'currency', accent: 'primary' },
    { key: 'orders', label: 'Pedidos', format: 'number', accent: 'info' },
    { key: 'customers', label: 'Clientes nuevos', format: 'number', accent: 'success' },
    { key: 'ticket', label: 'Ticket promedio', format: 'currency', accent: 'accent' },
  ],
});
