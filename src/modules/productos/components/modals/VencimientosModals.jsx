/**
 * VENCIMIENTOS — modales del vigía de fechas.
 * ============================================================================
 * Tres actos sobre un registro (que NO es stock, es lista de control):
 *   · EDITAR lo abierto (cantidad / fecha / observaciones — el costo congelado
 *     no se recalcula: es la foto del día en que se anotó).
 *   · ARMAR OFERTA real (Ventas › Ofertas, aplica en caja): porcentaje sobre
 *     el producto, vigente hasta el día del vencimiento, por defecto solo en
 *     la sucursal del registro.
 *   · PROCESAR lo vencido: cuántas se salvaron vendiéndose y cuántas se
 *     tiran. Opcionalmente baja el stock real (movimiento 'vencido') en el
 *     mismo acto — atómico del lado de la API.
 */
import { useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../../context/ProductosContext.jsx';
import { money, num, fmtFechaVenc } from '../../domain/format.js';
import { ModalShell } from '../Modal.jsx';
import { s } from '../ui.jsx';

function Di({ label, children }) {
  return <div className={s.di}><div className={s.l}>{label}</div><div className={s.v}>{children}</div></div>;
}

/* ============================== EDITAR ============================== */
export function VencimientoEditarModal({ registro }) {
  const { store, act, closeModal } = useProductos();
  const [cantidad, setCantidad] = useState(String(registro.cantidad));
  const [fecha, setFecha] = useState(registro.fechaVencimiento);
  const [obs, setObs] = useState(registro.observaciones || '');

  const guardar = () => act(
    store.editarVencimiento(registro.id, {
      cantidad: Number(cantidad), fechaVencimiento: fecha, observaciones: obs.trim(),
    }),
    'Registro actualizado.',
  );

  return (
    <ModalShell
      title={'Editar registro — ' + registro.nombre}
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Guardar', clase: 'btn-primary', onClick: guardar },
      ]}
    >
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Cantidad ({registro.unidad}) <span className={s.req}>*</span></label>
          <input type="number" min="0" step={registro.unidad === 'kg' ? '0.001' : '1'} value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
        </div>
        <div className={s.field}>
          <label>Fecha de vencimiento <span className={s.req}>*</span></label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
      </div>
      <div className={s.field}>
        <label>Observaciones</label>
        <input value={obs} placeholder="Góndola, lote visible, lo que ayude a encontrarlo…" onChange={(e) => setObs(e.target.value)} />
      </div>
      <div className={s.hint}>
        El costo congelado ({money(registro.costoUnitario)} por {registro.unidad}) no se recalcula: es la foto del día en que se anotó.
      </div>
    </ModalShell>
  );
}

/* ============================== PROCESAR ============================== */
export function VencimientoProcesarModal({ registro }) {
  const { store, act, closeModal, can } = useProductos();
  const [vendidas, setVendidas] = useState('0');
  const disponible = store.cant(registro.productoId, registro.sucursalId, registro.presentacionId ?? null, 'disponible');
  const puedeBajar = can('inventario');

  const v = Number(vendidas) || 0;
  const perdidas = Math.max(0, Math.round((registro.cantidad - v) * 100) / 100);
  const alcanza = disponible + 1e-9 >= perdidas;
  const [bajarStock, setBajarStock] = useState(puedeBajar);
  const excede = v > registro.cantidad + 1e-9;

  const procesar = () => act(
    store.procesarVencimiento(registro.id, {
      unidadesVendidas: v,
      generarMerma: bajarStock && perdidas > 0,
    }),
    perdidas > 0
      ? `Procesado: pérdida real ${money(perdidas * registro.costoUnitario)}.`
      : 'Procesado: se vendió todo antes de vencer — pérdida cero.',
  );

  return (
    <ModalShell
      title={'Procesar vencido — ' + registro.nombre}
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Procesar', clase: 'btn-primary', onClick: () => { if (!excede) procesar(); } },
      ]}
    >
      <div className={s['detalle-grid']}>
        <Di label="Venció">{fmtFechaVenc(registro.fechaVencimiento)}</Di>
        <Di label="Sucursal">{store.getSucursal(registro.sucursalId)?.nombre ?? '—'}</Di>
        <Di label="Registrado">{num(registro.cantidad)} {registro.unidad}</Di>
        <Di label="Costo congelado">{money(registro.costoUnitario)} / {registro.unidad}</Di>
      </div>
      <div className={s.field} style={{ marginTop: 10 }}>
        <label>¿Cuántas se vendieron ANTES de vencer? <span className={s.req}>*</span></label>
        <input
          type="number" min="0" max={registro.cantidad} step={registro.unidad === 'kg' ? '0.001' : '1'}
          value={vendidas} autoFocus onChange={(e) => setVendidas(e.target.value)}
        />
      </div>
      <div className={cx(s.callout, excede ? s.warn : perdidas > 0 ? undefined : s.ok)}>
        {excede
          ? `⚠ No pueden superar lo registrado (${num(registro.cantidad)}).`
          : perdidas > 0
            ? <>Se pierden <strong>{num(perdidas)} {registro.unidad}</strong> → pérdida real <strong>{money(perdidas * registro.costoUnitario)}</strong>.</>
            : 'Se vendió todo antes de vencer: pérdida cero. Bien ahí.'}
      </div>
      {perdidas > 0 && (
        puedeBajar ? (
          <>
            <label className={s.field} style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 6 }}>
              <input type="checkbox" checked={bajarStock} onChange={(e) => setBajarStock(e.target.checked)} style={{ width: 'auto' }} />
              <span>Bajar del stock lo perdido (movimiento «vencido», disponible → estado vencido)</span>
            </label>
            {bajarStock && !alcanza && (
              <div className={cx(s.callout, s.warn)}>
                ⚠ El stock disponible es {store.fmtCant(store.getProducto(registro.productoId), registro.presentacionId ?? null, disponible)}: no alcanza
                para bajar {num(perdidas)}. Destildá para procesar solo el registro, o corregí el stock primero.
              </div>
            )}
          </>
        ) : (
          <div className={s.hint}>La baja de stock la registra alguien con permiso de inventario; el registro queda asentado igual.</div>
        )
      )}
    </ModalShell>
  );
}

/* ============================== ARMAR OFERTA ============================== */
export function VencimientoOfertaModal({ registro }) {
  const { store, act, closeModal } = useProductos();
  const [pct, setPct] = useState('25');
  const [todas, setTodas] = useState(false);
  const suc = store.getSucursal(registro.sucursalId)?.nombre ?? '—';
  const p = Number(pct) || 0;
  const invalido = !(p > 0 && p < 100);

  const armar = () => act(
    store.armarOfertaVencimiento(registro.id, {
      porcentaje: p,
      sucursales: todas ? '' : undefined,
    }),
    'Oferta armada — vive en Ventas › Ofertas y aplica en caja.',
  );

  return (
    <ModalShell
      title={'Armar oferta — ' + registro.nombre}
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Armar oferta', clase: 'btn-primary', onClick: () => { if (!invalido) armar(); } },
      ]}
    >
      <div className={s.field}>
        <label>Descuento (%) <span className={s.req}>*</span></label>
        <input type="number" min="1" max="99" step="1" value={pct} autoFocus onChange={(e) => setPct(e.target.value)} />
      </div>
      <label className={s.field} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <input type="checkbox" checked={todas} onChange={(e) => setTodas(e.target.checked)} style={{ width: 'auto' }} />
        <span>En todas las sucursales (si no, solo en {suc} — donde está el lote por vencer)</span>
      </label>
      <div className={cx(s.callout, invalido ? s.warn : s.ok)}>
        {invalido
          ? '⚠ El porcentaje va entre 1 y 99.'
          : <>Oferta REAL «Por vencer · {registro.nombre}»: <strong>{p}% de descuento</strong>, vigente
            hasta el <strong>{fmtFechaVenc(registro.fechaVencimiento)}</strong> inclusive. Aplica en la caja como
            cualquier oferta y se administra desde Ventas › Ofertas.</>}
      </div>
      <div className={s.hint}>
        El alcance es el PRODUCTO completo (así matchea el motor del POS): si tiene otras
        presentaciones a la venta, también entran mientras dure.
      </div>
    </ModalShell>
  );
}
