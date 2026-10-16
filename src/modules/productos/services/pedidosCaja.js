/**
 * PEDIDOS DE LA CAJA A FRACCIONADO (0170) — las llamadas que comparten la caja
 * (pide), el aviso de fraccionado (atiende) y su historial. Las reglas y los
 * textos están en domain/pedidosCaja.js.
 *
 * Liviano a propósito: el aviso vive en el marco del ERP y no puede arrastrar
 * el store de Almacén a la pantalla de todos.
 */
import { httpClient } from '@core/services/httpClient.js';

const BASE = '/pedidos-fraccion/caja';
export const pedidosCajaApi = {
  pedir: (o) => httpClient.post(BASE, o),
  mios: () => httpClient.get(`${BASE}/mios`),
  visto: (id) => httpClient.post(`${BASE}/${id}/visto`),
  /** Sin `itemId`, el pedido entero (0171). */
  cancelar: (id, itemId) => httpClient.post(`${BASE}/${id}/cancelar`, itemId ? { itemId } : {}),
  abiertos: () => httpClient.get(`${BASE}/abiertos`),
  tomar: (id, operadorId) => httpClient.post(`${BASE}/${id}/tomar`, { operadorId }),
  /** `armadosCancelados`: de lo que la caja canceló, lo que se armó igual (0172). */
  listo: (id, armadosCancelados) => httpClient.post(`${BASE}/${id}/listo`, { armadosCancelados }),
  /** Cancelado entero mientras se armaba: lo que se armó igual; vacío = «No armé nada». */
  resolverCancelado: (id, itemIds) => httpClient.post(`${BASE}/${id}/resolver-cancelado`, { itemIds }),
  rechazar: (id, motivo) => httpClient.post(`${BASE}/${id}/rechazar`, { motivo }),
  historial: (desde, hasta) => httpClient.get(`${BASE}/historial?${new URLSearchParams({ desde, hasta })}`),
  operadores: () => httpClient.get('/fraccionamientos/operadores'),
};
