/**
 * LO QUE EL CAJERO LE PIDIÓ A FRACCIONADO Y CÓMO VA (0170), arriba de la caja:
 * pedido → en preparación (con quién lo arma) → ¡listo! o «no se puede» con el
 * motivo. Los datos y el sonido vienen de `useMisPedidosFraccion`.
 */
import { cx } from '@shared/utils/classNames.js';
import { haceCuanto, textoRenglon } from '@modules/productos/domain/pedidosCaja.js';
import { pedidoAbierto } from '../hooks/useMisPedidosFraccion.js';
import { Btn } from './ui.jsx';
import p from '../styles/Pos.module.css';

export function MisPedidosFraccion({ pedidos, onEntendido }) {
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
          {!pedidoAbierto(x) && <Btn small onClick={() => onEntendido(x.id)}>Entendido</Btn>}
        </div>
      ))}
    </div>
  );
}
