/**
 * LO QUE EL CAJERO LE PIDIÓ A FRACCIONADO Y CÓMO VA (0170), arriba de la caja:
 * pedido → en preparación (con quién lo arma) → ¡listo! o «no se puede» con el
 * motivo. Suena cuando termina. Lo terminado queda hasta que toca «Entendido».
 *
 * Pregunta cada 10 s solo mientras haya algo abierto; `version` (sube al pedir)
 * lo vuelve a despertar.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { tocarNotas } from '@core/services/sonido.js';
import { CADA_MS, haceCuanto, textoRenglon } from '@modules/productos/domain/pedidosCaja.js';
import { pedidosCajaApi } from '@modules/productos/services/pedidosCaja.js';
import { Btn } from './ui.jsx';
import p from '../styles/Pos.module.css';

/** Do6 → Mi6, alegre: está listo. */
const sonarListo = () => tocarNotas([[1046.5, 0, 0.2], [1318.51, 0.12, 0.35]]);
/** Sol4 → Mi4, que baja: no se puede. */
const sonarNo = () => tocarNotas([[392, 0, 0.3], [329.63, 0.2, 0.4]], { onda: 'triangle' });

const abierto = (x) => x.estado === 'pendiente' || x.estado === 'armando';

export function MisPedidosFraccion({ version }) {
  const [pedidos, setPedidos] = useState([]);
  const previos = useRef(new Map());
  const cerrando = useRef(new Set());

  const traer = useCallback(async () => {
    try {
      const lista = await pedidosCajaApi.mios();
      const cambio = (estado) => lista.some((x) => x.estado === estado && previos.current.has(x.id) && previos.current.get(x.id) !== estado);
      if (cambio('hecho')) sonarListo();
      else if (cambio('rechazado')) sonarNo();
      previos.current = new Map(lista.map((x) => [x.id, x.estado]));
      setPedidos(lista);
    } catch { /* API caída: el próximo tick reintenta */ }
  }, []);

  useEffect(() => { traer(); }, [traer, version]);

  const hayAbiertos = pedidos.some(abierto);
  useEffect(() => {
    if (!hayAbiertos) return undefined;
    const t = setInterval(traer, CADA_MS);
    return () => clearInterval(t);
  }, [hayAbiertos, traer]);

  const entendido = async (id) => {
    if (cerrando.current.has(id)) return;
    cerrando.current.add(id);
    try { await pedidosCajaApi.visto(id); } catch { /* si falla, vuelve a aparecer y se toca de nuevo */ }
    cerrando.current.delete(id);
    traer();
  };

  if (!pedidos.length) return null;
  return (
    <div className={p.misPedidos} aria-live="polite">
      {pedidos.map((x) => (
        <div
          key={x.id}
          className={cx(p.miPedido, x.estado === 'armando' && p.miPedidoArmando, x.estado === 'hecho' && p.miPedidoListo, x.estado === 'rechazado' && p.miPedidoNo)}
        >
          <span className={p.miPedidoEstado}>
            {x.estado === 'pendiente' && `⏳ Pedido a fraccionado · ${haceCuanto(x.creadoEn)}`}
            {x.estado === 'armando' && `🛠 Lo está armando ${x.operador || x.tomadoPor || 'fraccionado'}`}
            {x.estado === 'hecho' && '✅ ¡Listo! Te lo traen'}
            {x.estado === 'rechazado' && `❌ No se puede: ${x.motivo}`}
          </span>
          <span>{x.items.map(textoRenglon).join(' · ')}</span>
          {!abierto(x) && <Btn small onClick={() => entendido(x.id)}>Entendido</Btn>}
        </div>
      ))}
    </div>
  );
}
