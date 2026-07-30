import { httpClient } from '@core/services/httpClient.js';

/**
 * Dashboard data access. All I/O for this module goes through here so pages and
 * hooks never call the network directly (Separation of Concerns). Today it
 * returns mock data; swap the bodies for `httpClient` calls when the API exists.
 */

const MOCK_LATENCY = 400;

function delay(value, ms = MOCK_LATENCY) {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export const dashboardService = {
  /** Aggregate KPI metrics for the metric cards. */
  async getMetrics() {
    // return httpClient.get('/dashboard/metrics');
    void httpClient;
    return delay({
      sales: 184500,
      orders: 63,
      customers: 12,
      ticket: 2929,
      trends: { sales: 8.4, orders: -2.1, customers: 15.0, ticket: 3.2 },
    });
  },

  /** Recent activity feed for the activity table. */
  async getRecentActivity() {
    // return httpClient.get('/dashboard/activity');
    return delay([
      { id: 1, type: 'Venta', description: 'Pedido #10432 confirmado', user: 'María G.', amount: 4200, status: 'success', at: minutesAgo(4) },
      { id: 2, type: 'Cliente', description: 'Nuevo cliente: Panadería El Sol', user: 'Lucas R.', amount: null, status: 'info', at: minutesAgo(22) },
      { id: 3, type: 'Inventario', description: 'Stock bajo: Café en grano 1kg', user: 'Sistema', amount: null, status: 'warning', at: minutesAgo(58) },
      { id: 4, type: 'Venta', description: 'Pedido #10429 reembolsado', user: 'Ana P.', amount: -1800, status: 'error', at: hoursAgo(2) },
      { id: 5, type: 'Venta', description: 'Pedido #10428 confirmado', user: 'María G.', amount: 6750, status: 'success', at: hoursAgo(3) },
    ]);
  },
};

function minutesAgo(m) {
  return new Date(Date.now() - m * 60_000).toISOString();
}
function hoursAgo(h) {
  return new Date(Date.now() - h * 3_600_000).toISOString();
}
