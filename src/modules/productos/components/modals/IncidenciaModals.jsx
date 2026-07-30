import { useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../../context/ProductosContext.jsx';
import { fmtFecha } from '../../domain/format.js';
import { TIPOS_INCIDENCIA } from '../../domain/constants.js';
import { ModalShell } from '../Modal.jsx';
import { sucursalOptions, productoOptions, presentacionOptions, usuarioOptions } from '../selectOptions.jsx';
import { IncidPill, s } from '../ui.jsx';

/* ============================== NUEVA INCIDENCIA ============================== */
export function IncidenciaModal({ pre = {} }) {
  const { store, act, closeModal, sucOperativa } = useProductos();

  const prodInicial = pre.productoId || store.state.productos[0]?.id;

  const [tipo, setTipo] = useState(pre.tipoDefault || TIPOS_INCIDENCIA[0]);
  const [userId, setUserId] = useState(store.state.ctx.usuarioId);
  const [prodId, setProdId] = useState(prodInicial);
  const [sucId, setSucId] = useState(pre.sucursalId || sucOperativa());
  const [presId, setPresId] = useState(pre.presId != null ? String(pre.presId) : '');
  const [cant, setCant] = useState('');
  const [motivo, setMotivo] = useState('');

  const prod = store.getProducto(parseInt(prodId, 10));
  const presNum = presId ? parseInt(presId, 10) : null;
  const disp = store.cant(prod.id, parseInt(sucId, 10), presNum, 'disponible');
  const unidad = store.unidadDe(prod, presNum);
  const unitLabel = unidad === 'kg' ? 'kg' : presNum ? 'paquetes' : 'unidades';

  const crear = () =>
    act(
      store.crearIncidencia({
        tipo, productoId: prod.id, sucursalId: parseInt(sucId, 10), presId: presNum,
        cantidad: cant, responsableId: parseInt(userId, 10), motivo: motivo.trim(),
      }),
      'Incidencia creada.',
    );

  return (
    <ModalShell
      title="Nueva incidencia"
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Crear incidencia', clase: 'btn-primary', onClick: crear },
      ]}
    >
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Tipo de incidencia <span className={s.req}>*</span></label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS_INCIDENCIA.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className={s.field}>
          <label>Responsable</label>
          <select value={userId} onChange={(e) => setUserId(parseInt(e.target.value, 10))}>{usuarioOptions(store)}</select>
        </div>
      </div>
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Producto <span className={s.req}>*</span></label>
          <select value={prodId} onChange={(e) => { setProdId(e.target.value); setPresId(''); }}>{productoOptions(store, false)}</select>
        </div>
        <div className={s.field}>
          <label>Sucursal <span className={s.req}>*</span></label>
          <select value={sucId} onChange={(e) => setSucId(e.target.value)}>{sucursalOptions(store, false)}</select>
        </div>
      </div>
      <div className={s.field}>
        <label>Presentación</label>
        <select value={presId} onChange={(e) => setPresId(e.target.value)}>{presentacionOptions(prod, true)}</select>
      </div>
      <div className={s.field}>
        <label>Cantidad comprometida ({unitLabel}) <span className={s.req}>*</span></label>
        <input type="number" min="0" step={unidad === 'kg' ? '0.001' : '1'} value={cant} placeholder="0" onChange={(e) => setCant(e.target.value)} />
      </div>
      <div className={s.field}>
        <label>Motivo</label>
        <textarea rows="2" value={motivo} placeholder="Descripción del problema" onChange={(e) => setMotivo(e.target.value)} />
      </div>
      <div className={cx(s.callout, s.info)}>
        Disponible en esta sucursal: <strong>{store.fmtCant(prod, presNum, disp)}</strong>. Al crear la incidencia, la cantidad
        afectada pasa a <strong>stock comprometido</strong> hasta que se resuelva.
      </div>
    </ModalShell>
  );
}

/* ============================== RESOLVER INCIDENCIA ============================== */
export function ResolverIncidenciaModal({ id }) {
  const { store, act, closeModal } = useProductos();
  const inc = store.state.incidencias.find((x) => x.id === id);
  const [res, setRes] = useState('liberar');
  if (!inc) return null;
  const p = store.getProducto(inc.productoId);

  return (
    <ModalShell
      title="Resolver incidencia"
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Resolver', clase: 'btn-primary', onClick: () => act(store.resolverIncidencia(id, res), 'Incidencia resuelta.') },
      ]}
    >
      <div className={s.callout}>
        Incidencia <strong>{inc.codigo}</strong> · {inc.tipo}<br />
        {p.nombre} · {store.getSucursal(inc.sucursalId).nombre} · {store.fmtCant(p, inc.presId, inc.cantidad)} comprometido.
      </div>
      <div className={s.field}>
        <label>Resolución <span className={s.req}>*</span></label>
        <select value={res} onChange={(e) => setRes(e.target.value)}>
          <option value="liberar">Liberar (vuelve a disponible)</option>
          <option value="merma">Baja por merma</option>
          <option value="defectuoso">Baja: producto defectuoso</option>
          <option value="vencido">Baja: producto vencido</option>
        </select>
      </div>
    </ModalShell>
  );
}

/* ============================== DETALLE INCIDENCIA ============================== */
export function DetalleIncidenciaModal({ id }) {
  const { store, isAdmin, closeModal, openModal } = useProductos();
  const inc = store.state.incidencias.find((x) => x.id === id);
  if (!inc) return null;
  const p = store.getProducto(inc.productoId);

  const footer = [];
  if (inc.estado !== 'resuelta' && isAdmin) footer.push({ texto: 'Resolver', clase: 'btn-primary', onClick: () => openModal('resolverIncidencia', { id }) });
  footer.push({ texto: 'Cerrar', clase: 'btn-ghost', onClick: closeModal });

  const Di = ({ label, children }) => <div className={s.di}><div className={s.l}>{label}</div><div className={s.v}>{children}</div></div>;

  return (
    <ModalShell title={'Incidencia ' + inc.codigo} wide onClose={closeModal} footer={footer}>
      <div className={s['detalle-grid']}>
        <Di label="Código"><span className={s.mono}>{inc.codigo}</span></Di>
        <Di label="Estado"><IncidPill estado={inc.estado} /></Di>
        <Di label="Tipo">{inc.tipo}</Di>
        <Di label="Producto">{p.nombre}</Di>
        <Di label="Cant. comprometida">{store.fmtCant(p, inc.presId, inc.cantidad)}</Di>
        <Di label="Sucursal">{store.getSucursal(inc.sucursalId).nombre}</Di>
        <Di label="Responsable">{(store.getUsuario(inc.responsableId) || {}).nombre || '—'}</Di>
        <Di label="Fecha">{fmtFecha(inc.fecha)}</Di>
      </div>
      {inc.motivo && <div className={s.callout}>{inc.motivo}</div>}
      {inc.resolucion && <div className={cx(s.callout, s.ok)}>Resuelta: {inc.resolucion}</div>}
    </ModalShell>
  );
}
