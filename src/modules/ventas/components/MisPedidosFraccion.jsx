/**
 * LO QUE EL CAJERO LE PIDIÓ A FRACCIONADO Y CÓMO VA (0170), arriba de la caja:
 * pedido → en preparación (con quién lo arma) → ¡listo! o «no se puede» con el
 * motivo. Mientras está abierto se cancela entero o por renglón (0171), con
 * confirmación. Los datos y el sonido vienen de `useMisPedidosFraccion`.
 */
import { useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { haceCuanto, textoRenglon } from '@modules/productos/domain/pedidosCaja.js';
import { pedidoAbierto } from '../hooks/useMisPedidosFraccion.js';
import { Btn } from './ui.jsx';
import p from '../styles/Pos.module.css';

export function MisPedidosFraccion({ pedidos, onEntendido, onCancelar }) {
  /** Lo que se está por cancelar: { id, itemId (null = el pedido), texto }. */
  const [confirmar, setConfirmar] = useState(null);
  const [error, setError] = useState(null);

  if (!pedidos.length) return null;
  const cancelar = async () => {
    const { id, itemId } = confirmar;
    setConfirmar(null);
    const msg = await onCancelar(id, itemId);
    setError(msg ? { id, msg } : null);
  };

  return (
    <div className={p.misPedidos} aria-live="polite">
      {pedidos.map((x) => {
        const abierto = pedidoAbierto(x);
        const aca = confirmar?.id === x.id;
        return (
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
            {aca ? (
              <>
                <span>¿Cancelar {confirmar.texto}?</span>
                <Btn small variant="btn-delete" onClick={cancelar}>Sí, cancelar</Btn>
                <Btn small onClick={() => setConfirmar(null)}>No</Btn>
              </>
            ) : (
              <>
                {x.items.map((it) => (
                  <span key={it.id} className={p.miPedidoRenglon}>
                    {textoRenglon(it)}
                    {abierto && (
                      <button
                        type="button" className={p.miPedidoQuitar} aria-label={`Cancelar ${textoRenglon(it)}`} title="Cancelar este producto"
                        onClick={() => setConfirmar({ id: x.id, itemId: it.id, texto: textoRenglon(it) })}
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
                {abierto
                  ? <Btn small onClick={() => setConfirmar({ id: x.id, itemId: null, texto: `todo el pedido ${x.codigo}` })}>Cancelar pedido</Btn>
                  : <Btn small onClick={() => onEntendido(x.id)}>Entendido</Btn>}
              </>
            )}
            {error?.id === x.id && <span className={p.sinStock}>{error.msg}</span>}
          </div>
        );
      })}
    </div>
  );
}
