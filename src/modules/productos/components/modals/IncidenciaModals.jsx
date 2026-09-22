import { useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../../context/ProductosContext.jsx';
import { fmtFechaHora } from '../../domain/format.js';
import {
  ETIQUETA_RESOLUCION, ETIQUETA_TIPO_INCIDENCIA, RESOLUCIONES_SIN_STOCK,
  TIPOS_INCIDENCIA, TIPO_VENTA_SIN_STOCK,
} from '../../domain/constants.js';
import { ModalShell } from '../Modal.jsx';
import { sucursalOptions, productoOptions, presentacionOptions, usuarioOptions } from '../selectOptions.jsx';
import { IncidPill, s } from '../ui.jsx';

/* ============================== NUEVA INCIDENCIA ============================== */
export function IncidenciaModal({ pre = {} }) {
  const { store, act, closeModal, toast, sucOperativa } = useProductos();

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

  /*
   * LA CANTIDAD VIAJA COMO NÚMERO, no como el texto del campo.
   *
   * Acá iba `cantidad: cant` directo, que es lo que devuelve un `<input>`: la
   * cadena "10". El DTO de la API pide `@IsNumber()`, así que rebotaba con las
   * tres quejas juntas —no es número, es menor al mínimo y mayor al máximo—
   * sobre un campo que en pantalla tenía un 10 bien escrito. Un mensaje que no
   * se puede entender mirando el formulario.
   *
   * Y se valida ANTES de mandar. El servidor tiene las mismas reglas y las
   * sigue teniendo —es el que manda—, pero enterarse de que falta la cantidad
   * después del viaje, y en el idioma del validador, es peor que no avisar.
   */
  const crear = () => {
    const c = Number(cant);
    if (cant === '' || !Number.isFinite(c) || c <= 0) {
      toast('Poné cuánta mercadería queda comprometida.', 'err');
      return undefined;
    }
    if (c > disp + 1e-9) {
      toast(`No hay tanto disponible en esta sucursal: hay ${store.fmtCant(prod, presNum, disp)}.`, 'err');
      return undefined;
    }
    return act(
      store.crearIncidencia({
        tipo, productoId: prod.id, sucursalId: parseInt(sucId, 10), presId: presNum,
        cantidad: c, responsableId: parseInt(userId, 10), motivo: motivo.trim(),
      }),
      'Incidencia creada.',
    );
  };

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
  const { store, act, closeModal, toast } = useProductos();
  const inc = store.state.incidencias.find((x) => x.id === id);
  const sinStock = inc?.tipo === TIPO_VENTA_SIN_STOCK;
  const [res, setRes] = useState(sinStock ? 'ajustado' : 'liberar');
  const [contado, setContado] = useState('');
  if (!inc) return null;
  const p = store.getProducto(inc.productoId);

  /*
   * LA VENTA SIN STOCK SE CIERRA DISTINTO, y por eso este modal tiene dos caras.
   *
   * Las incidencias de siempre tienen mercaderia RETENIDA: cerrarlas es decidir
   * si vuelve a disponible o se da de baja. Una venta sin stock no retuvo nada
   * -la mercaderia ya salio por la puerta-, asi que ofrecer "liberar" aca seria
   * ofrecer inventar unidades. Sus dos salidas son contar la gondola (y ajustar
   * con ese numero) o reconocer que el negativo no era de la gondola.
   */
  const necesitaConteo = sinStock && res === 'ajustado';
  const resolver = () => {
    if (necesitaConteo && !(Number(contado) >= 0 && contado !== '')) {
      toast('Pon\u00e9 cu\u00e1ntas unidades contaste en la g\u00f3ndola (0 o m\u00e1s).', 'err');
      return;
    }
    act(
      store.resolverIncidencia(id, res, necesitaConteo ? Number(contado) : undefined),
      necesitaConteo ? 'Stock ajustado y incidencia resuelta.' : 'Incidencia resuelta.',
    );
  };

  return (
    <ModalShell
      title={sinStock ? 'Resolver venta sin stock' : 'Resolver incidencia'}
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Resolver', clase: 'btn-primary', onClick: resolver },
      ]}
    >
      <div className={s.callout}>
        Incidencia <strong>{inc.codigo}</strong> · {ETIQUETA_TIPO_INCIDENCIA[inc.tipo] || inc.tipo}<br />
        {p.nombre} · {store.getSucursal(inc.sucursalId).nombre} ·{' '}
        {sinStock
          ? <>el sistema tenía {store.fmtCant(p, inc.presId, inc.disponibleAntes)} y se vendieron{' '}
            {store.fmtCant(p, inc.presId, inc.vendido)}: faltan <strong>{store.fmtCant(p, inc.presId, inc.cantidad)}</strong>.</>
          : <>{store.fmtCant(p, inc.presId, inc.cantidad)} comprometido.</>}
      </div>
      <div className={s.field}>
        <label>Resolución <span className={s.req}>*</span></label>
        <select value={res} onChange={(e) => setRes(e.target.value)}>
          {sinStock
            ? Object.entries(RESOLUCIONES_SIN_STOCK).map(([k, v]) => <option key={k} value={k}>{v}</option>)
            : (
              <>
                <option value="liberar">Liberar (vuelve a disponible)</option>
                <option value="merma">Baja por merma</option>
                <option value="defectuoso">Baja: producto defectuoso</option>
                <option value="vencido">Baja: producto vencido</option>
              </>
            )}
        </select>
      </div>
      {necesitaConteo && (
        <>
          <div className={s.field}>
            <label>¿Cuántas hay en la góndola? <span className={s.req}>*</span></label>
            <input
              type="number" min="0" step="any" autoFocus
              value={contado} onChange={(e) => setContado(e.target.value)}
              placeholder="Lo que contaste recién"
            />
          </div>
          <div className={s.hint}>
            El stock queda <strong>en ese número</strong>. No se le suma lo que faltaba: entre
            la venta y ahora pudo entrar mercadería, y sumar a ciegas dejaría el número peor
            que antes. Queda un movimiento de ajuste con tu nombre.
          </div>
        </>
      )}
      {sinStock && res === 'error_carga' && (
        <div className={s.hint}>
          Cierra la incidencia <strong>sin tocar el stock</strong>. Usá esto cuando el negativo
          no era de la góndola (el producto estaba cargado dos veces, la compra no se había
          asentado).
        </div>
      )}
    </ModalShell>
  );
}

/* ============================== DETALLE INCIDENCIA ============================== */
export function DetalleIncidenciaModal({ id }) {
  const { store, isAdmin, closeModal, openModal } = useProductos();
  const inc = store.state.incidencias.find((x) => x.id === id);
  if (!inc) return null;
  const p = store.getProducto(inc.productoId);
  const sinStock = inc.tipo === TIPO_VENTA_SIN_STOCK;

  const footer = [];
  if (inc.estado !== 'resuelta' && isAdmin) footer.push({ texto: 'Resolver', clase: 'btn-primary', onClick: () => openModal('resolverIncidencia', { id }) });
  footer.push({ texto: 'Cerrar', clase: 'btn-ghost', onClick: closeModal });

  const Di = ({ label, children }) => <div className={s.di}><div className={s.l}>{label}</div><div className={s.v}>{children}</div></div>;

  return (
    <ModalShell title={'Incidencia ' + inc.codigo} wide onClose={closeModal} footer={footer}>
      <div className={s['detalle-grid']}>
        <Di label="Código"><span className={s.mono}>{inc.codigo}</span></Di>
        <Di label="Estado"><IncidPill estado={inc.estado} /></Di>
        <Di label="Tipo">{ETIQUETA_TIPO_INCIDENCIA[inc.tipo] || inc.tipo}</Di>
        <Di label="Producto">{p.nombre}</Di>
        {/* La venta sin stock se explica con TRES numeros, no con uno: sin el
            "tenia" y el "se vendio", la diferencia sola no dice nada. */}
        {sinStock ? (
          <>
            <Di label="El sistema tenía">{store.fmtCant(p, inc.presId, inc.disponibleAntes)}</Di>
            <Di label="Se vendió">{store.fmtCant(p, inc.presId, inc.vendido)}</Di>
            <Di label="Faltaron"><strong>{store.fmtCant(p, inc.presId, inc.cantidad)}</strong></Di>
            <Di label="Comprobante"><span className={s.mono}>{inc.comprobante || '—'}</span></Di>
            <Di label="Cliente">{inc.clienteNombre || '—'}</Di>
            <Di label="Cajero">{(store.getUsuario(inc.responsableId) || {}).nombre || '—'}</Di>
          </>
        ) : (
          <>
            <Di label="Cant. comprometida">{store.fmtCant(p, inc.presId, inc.cantidad)}</Di>
            <Di label="Responsable">{(store.getUsuario(inc.responsableId) || {}).nombre || '—'}</Di>
          </>
        )}
        <Di label="Sucursal">{store.getSucursal(inc.sucursalId).nombre}</Di>
        <Di label="Fecha">{fmtFechaHora(inc.fecha)}</Di>
      </div>
      {sinStock && inc.ventaEstado === 'anulada' && (
        <div className={cx(s.callout, s.warn)}>
          Esa venta después se <strong>anuló</strong>: el stock volvió, así que el negativo que
          denunciaba esta incidencia ya no existe.
        </div>
      )}
      {inc.motivo && <div className={s.callout}>{inc.motivo}</div>}
      {inc.resolucion && (
        <div className={cx(s.callout, s.ok)}>
          Resuelta: {ETIQUETA_RESOLUCION[inc.resolucion] || inc.resolucion}
          {inc.fechaResolucion ? ` \u00b7 ${fmtFechaHora(inc.fechaResolucion)}` : ''}
        </div>
      )}
    </ModalShell>
  );
}
