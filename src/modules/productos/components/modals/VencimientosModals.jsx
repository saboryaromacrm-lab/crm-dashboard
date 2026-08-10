/**
 * VENCIMIENTOS — modales del vigía de fechas.
 * ============================================================================
 * Dos actos sobre un registro (que NO es stock, es lista de control):
 *   · EDITAR lo abierto (cantidad / fecha / observaciones — el costo congelado
 *     no se recalcula: es la foto del día en que se anotó).
 *   · PROCESAR lo vencido: cuántas se salvaron vendiéndose y cuántas se
 *     tiran. Opcionalmente baja el stock real (movimiento 'vencido') en el
 *     mismo acto — atómico del lado de la API.
 *
 * La OFERTA no tiene modal propio acá: el botón lleva al motor de ofertas de
 * Ventas con el formulario ya lleno. Un solo lugar para crear ofertas en todo
 * el sistema, con su vista previa y sus siete mecánicas.
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
