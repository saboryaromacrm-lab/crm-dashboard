/**
 * LO QUE EL CAJERO LE PIDIÓ A FRACCIONADO (0170) y cómo va. Lo usan la tira de
 * arriba de la caja y los renglones del ticket («en espera»).
 *
 * Pregunta cada 10 s solo mientras haya algo abierto; `version` (sube al pedir)
 * lo vuelve a despertar. Cuando un pedido termina suena, y si quedó listo avisa
 * con `onListo` (la caja recarga el catálogo: el stock nuevo destraba el cobro).
 * Lo terminado queda hasta que el cajero toca «Entendido».
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { tocarNotas } from '@core/services/sonido.js';
import { CADA_MS } from '@modules/productos/domain/pedidosCaja.js';
import { pedidosCajaApi } from '@modules/productos/services/pedidosCaja.js';

/** Do6 → Mi6, alegre: está listo. */
const sonarListo = () => tocarNotas([[1046.5, 0, 0.2], [1318.51, 0.12, 0.35]]);
/** Sol4 → Mi4, que baja: no se puede. */
const sonarNo = () => tocarNotas([[392, 0, 0.3], [329.63, 0.2, 0.4]], { onda: 'triangle' });

export const pedidoAbierto = (x) => x.estado === 'pendiente' || x.estado === 'armando';

export function useMisPedidosFraccion(activo, version, onListo) {
  const [pedidos, setPedidos] = useState([]);
  const previos = useRef(new Map());
  const cerrando = useRef(new Set());
  const alListo = useRef(onListo);
  useEffect(() => { alListo.current = onListo; }, [onListo]);

  const traer = useCallback(async () => {
    try {
      const lista = await pedidosCajaApi.mios();
      const cambio = (estado) => lista.some((x) => x.estado === estado && previos.current.has(x.id) && previos.current.get(x.id) !== estado);
      if (cambio('hecho')) { sonarListo(); alListo.current?.(); } else if (cambio('rechazado')) sonarNo();
      previos.current = new Map(lista.map((x) => [x.id, x.estado]));
      setPedidos(lista);
    } catch { /* API caída: el próximo tick reintenta */ }
  }, []);

  useEffect(() => { if (activo) traer(); }, [activo, traer, version]);

  const hayAbiertos = activo && pedidos.some(pedidoAbierto);
  useEffect(() => {
    if (!hayAbiertos) return undefined;
    const t = setInterval(traer, CADA_MS);
    return () => clearInterval(t);
  }, [hayAbiertos, traer]);

  const entendido = useCallback(async (id) => {
    if (cerrando.current.has(id)) return;
    cerrando.current.add(id);
    try { await pedidosCajaApi.visto(id); } catch { /* si falla, vuelve a aparecer y se toca de nuevo */ }
    cerrando.current.delete(id);
    traer();
  }, [traer]);

  return { pedidos: activo ? pedidos : [], entendido };
}
