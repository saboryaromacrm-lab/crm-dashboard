import { useState } from 'react';
import { useProductos } from '../../context/ProductosContext.jsx';
import { fmtFechaHora } from '../../domain/format.js';
import { ModalShell } from '../Modal.jsx';
import { sucursalOptions, productoOptions, presentacionOptions, usuarioOptions } from '../selectOptions.jsx';
import { Table, TransferPill, s } from '../ui.jsx';

/* ============================== NUEVA TRANSFERENCIA ============================== */
export function TransferenciaModal() {
  const { store, act, closeModal } = useProductos();
  const dist = store.distribuidora();
  const primerDestino = store.state.sucursales.find((su) => su.id !== dist.id);

  const [origenId, setOrigenId] = useState(dist.id);
  const [destinoId, setDestinoId] = useState(primerDestino ? primerDestino.id : dist.id);
  const [userId, setUserId] = useState(store.state.ctx.usuarioId);
  const [items, setItems] = useState(() => [nuevoItem(store)]);

  function setItem(i, patch) { setItems((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r))); }
  function addItem() { setItems((rows) => [...rows, nuevoItem(store)]); }
  function delItem(i) { setItems((rows) => rows.filter((_, j) => j !== i)); }

  const crear = () => {
    const parsed = items.map((it) => ({
      productoId: parseInt(it.prodId, 10),
      presId: it.presId ? parseInt(it.presId, 10) : null,
      cantidad: parseFloat(it.cant) || 0,
    })).filter((it) => it.productoId && it.cantidad > 0);
    act(store.crearTransferencia({ origenId: parseInt(origenId, 10), destinoId: parseInt(destinoId, 10), usuarioId: parseInt(userId, 10), items: parsed }), 'Transferencia creada (Pendiente).');
  };

  return (
    <ModalShell
      title="Nueva transferencia"
      wide
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Crear (Pendiente)', clase: 'btn-primary', onClick: crear },
      ]}
    >
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Origen <span className={s.req}>*</span></label>
          <select value={origenId} onChange={(e) => setOrigenId(parseInt(e.target.value, 10))}>{sucursalOptions(store, false)}</select>
        </div>
        <div className={s.field}>
          <label>Destino <span className={s.req}>*</span></label>
          <select value={destinoId} onChange={(e) => setDestinoId(parseInt(e.target.value, 10))}>{sucursalOptions(store, false)}</select>
        </div>
      </div>
      <div className={s.field}>
        <label>Responsable</label>
        <select value={userId} onChange={(e) => setUserId(parseInt(e.target.value, 10))}>{usuarioOptions(store)}</select>
      </div>

      <div className={s['section-title']}>Ítems a transferir</div>
      {items.map((it, i) => {
        const prod = store.getProducto(parseInt(it.prodId, 10));
        const presNum = it.presId ? parseInt(it.presId, 10) : null;
        const disp = store.cant(prod.id, parseInt(origenId, 10), presNum, 'disponible');
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.1fr .9fr auto', gap: 8, marginBottom: 8, alignItems: 'end' }}>
            <div>
              <div className={s['mini-label']}>Producto</div>
              <select value={it.prodId} onChange={(e) => setItem(i, { prodId: e.target.value, presId: '' })}>{productoOptions(store, false)}</select>
            </div>
            <div>
              <div className={s['mini-label']}>Present.</div>
              <select value={it.presId} onChange={(e) => setItem(i, { presId: e.target.value })}>{presentacionOptions(prod, true)}</select>
            </div>
            <div>
              <div className={s['mini-label']}>Cantidad (disp. {store.fmtCant(prod, presNum, disp)})</div>
              <input type="number" min="0" step="0.001" value={it.cant} onChange={(e) => setItem(i, { cant: e.target.value })} />
            </div>
            <button type="button" className={s['pres-remove']} onClick={() => delItem(i)}>×</button>
          </div>
        );
      })}
      <button type="button" className={cxBtn()} onClick={addItem}>+ Agregar ítem</button>
    </ModalShell>
  );
}

function cxBtn() {
  return s.btn + ' ' + s['btn-ghost'] + ' ' + s['btn-sm'];
}

function nuevoItem(store) {
  return { prodId: store.state.productos[0]?.id ?? '', presId: '', cant: '0' };
}

/* ============================== DETALLE TRANSFERENCIA ============================== */
export function DetalleTransferModal({ id }) {
  const { store, isAdmin, act, closeModal } = useProductos();
  const t = store.state.transferencias.find((x) => x.id === id);
  if (!t) return null;

  const items = t.items.map((it, i) => {
    const p = store.getProducto(it.productoId);
    return (
      <tr key={i}>
        <td>{p.nombre}</td>
        <td>{store.presLabel(p, it.presId)}</td>
        <td className={s.num}>{store.fmtCant(p, it.presId, it.cantidad)}</td>
      </tr>
    );
  });
  const hist = t.hist.map((h, i) => (
    <tr key={i}>
      <td><TransferPill estado={h.estado} /></td>
      <td>{fmtFechaHora(h.fecha)}</td>
      <td>{(store.getUsuario(h.usuarioId) || {}).nombre || '—'}</td>
    </tr>
  ));

  const finalizada = t.estado === 'recibida' || t.estado === 'cancelada';
  const footer = [];
  if (isAdmin && !finalizada) footer.push({ texto: 'Avanzar →', clase: 'btn-primary', onClick: () => act(store.avanzarTransferencia(t.id), 'Transferencia actualizada.') });
  footer.push({ texto: 'Cerrar', clase: 'btn-ghost', onClick: closeModal });

  return (
    <ModalShell title={'Transferencia ' + t.codigo} wide onClose={closeModal} footer={footer}>
      <div className={s['detalle-grid']}>
        <div className={s.di}><div className={s.l}>Código</div><div className={s.v + ' ' + s.mono}>{t.codigo}</div></div>
        <div className={s.di}><div className={s.l}>Ruta</div><div className={s.v}>{store.getSucursal(t.origenId).nombre} → {store.getSucursal(t.destinoId).nombre}</div></div>
        <div className={s.di}><div className={s.l}>Estado</div><div className={s.v}><TransferPill estado={t.estado} /></div></div>
      </div>
      <h3 className={s['card-title']}>Ítems</h3>
      <Table cols={[{ h: 'Producto' }, { h: 'Present.' }, { h: 'Cant.', num: true }]}>{items}</Table>
      <h3 className={s['card-title']} style={{ marginTop: 12 }}>Historial de estados</h3>
      <Table cols={[{ h: 'Estado' }, { h: 'Fecha' }, { h: 'Usuario' }]}>{hist}</Table>
    </ModalShell>
  );
}
