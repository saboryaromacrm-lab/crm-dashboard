import { useMemo, useState } from 'react';
import { useProveedores } from '../../context/ProveedoresContext.jsx';
import { provApi } from '../../services/proveedores.api.js';
import { Btn, ModalShell, s } from '../ui.jsx';

/**
 * SOLICITAR PEDIDOS — el alta del kanban, de a varios: se tildan los
 * proveedores a los que hay que pedirles y nace una tarjeta por cada uno.
 * "Ya lo pedí" registra un pedido hecho por teléfono: entra directo en
 * la columna Pedido con su fecha.
 */
export function SolicitarPedidosModal({ onChange, directo = false }) {
  const { proveedores, act, closeModal, toast } = useProveedores();
  const [buscar, setBuscar] = useState('');
  const [tildados, setTildados] = useState({});
  const [notas, setNotas] = useState('');

  const lista = useMemo(() => {
    const t = buscar.trim().toLowerCase();
    const base = proveedores.filter((p) => p.proveeMercaderia);
    return t ? base.filter((p) => p.nombre.toLowerCase().includes(t)) : base;
  }, [proveedores, buscar]);
  const ids = Object.keys(tildados).filter((k) => tildados[k]).map(Number);

  const guardar = async () => {
    if (!ids.length) { toast('Tildá al menos un proveedor.', 'err'); return; }
    if (directo && ids.length !== 1) { toast('El pedido ya hecho es de UN proveedor.', 'err'); return; }
    const res = directo
      ? await act(provApi.pedidoDirecto({ proveedorId: ids[0], notas: notas.trim() }), 'Pedido registrado en la columna Pedido.')
      : await act(provApi.solicitarPedidos({ proveedorIds: ids, notas: notas.trim() }), `${ids.length} tarjeta(s) en Solicitado.`);
    if (res) onChange?.();
  };

  return (
    <ModalShell
      title={directo ? 'Registrar un pedido ya hecho' : 'Solicitar pedidos'}
      subtitle={directo
        ? 'Ya lo hablaste con el proveedor: entra directo en Pedido, con fecha de hoy'
        : 'Una tarjeta por proveedor, en Solicitado — la guía de a quién hay que pedirle'}
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: directo ? 'Registrar' : `Solicitar (${ids.length})`, clase: 'btn-primary', onClick: guardar },
      ]}
    >
      <div className={s.field}>
        <label>Buscar proveedor</label>
        <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Escribí para filtrar…" autoFocus />
      </div>
      <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--border, #ddd)', borderRadius: 8, padding: 8, marginBottom: 10 }}>
        {lista.map((p) => (
          <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 4px' }}>
            <input
              type="checkbox"
              checked={!!tildados[p.id]}
              onChange={(e) => setTildados((m) => ({ ...m, [p.id]: e.target.checked }))}
            />
            {p.nombre}
          </label>
        ))}
        {!lista.length && <div className={s.hint}>Sin resultados.</div>}
      </div>
      <div className={s.field}>
        <label>Notas del pedido</label>
        <textarea
          rows={3} value={notas} onChange={(e) => setNotas(e.target.value)}
          placeholder="Qué pedirle: yerba x 20, harina integral…"
          style={{ width: '100%' }}
        />
        <div className={s.hint} style={{ margin: '6px 0 0' }}>
          Texto libre a propósito: es la nota interna entre vos y el encargado, no un remito.
        </div>
      </div>
    </ModalShell>
  );
}

/** Editar las notas (o el proveedor) de una tarjeta. */
export function PedidoNotasModal({ pedido, onChange }) {
  const { act, closeModal } = useProveedores();
  const [notas, setNotas] = useState(pedido?.notas ?? '');

  const guardar = async () => {
    const res = await act(provApi.editarPedido(pedido.id, { notas }), 'Notas guardadas.');
    if (res) onChange?.();
  };

  return (
    <ModalShell
      title={`Pedido a ${pedido?.proveedorNombre}`}
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Guardar', clase: 'btn-primary', onClick: guardar },
      ]}
    >
      <div className={s.field}>
        <label>Notas</label>
        <textarea
          rows={5} value={notas} onChange={(e) => setNotas(e.target.value)}
          style={{ width: '100%' }} autoFocus
        />
      </div>
    </ModalShell>
  );
}

/** Los dos botones de alta del kanban, con el mismo modal en dos variantes.
 *  `onChange` baja hasta el modal: sin él, la tarjeta nace pero la pizarra
 *  no se entera hasta el próximo refresh. */
export function BotonesAlta({ openModal, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <Btn variant="btn-primary" onClick={() => openModal('solicitarPedidos', { onChange })}>+ Solicitar pedidos</Btn>
      <Btn onClick={() => openModal('solicitarPedidos', { directo: true, onChange })}>Ya lo pedí</Btn>
    </div>
  );
}
