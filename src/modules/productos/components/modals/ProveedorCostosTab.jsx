import { useCallback, useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../../context/ProductosContext.jsx';
import { money } from '../../domain/format.js';
import { Table, Btn, s } from '../ui.jsx';

/**
 * COSTOS DEL PROVEEDOR
 * ============================================================================
 * Acá se actualizan **costo, descuento y flete**: las tres palancas que mueve
 * el proveedor. El margen no está — ése es decisión propia y vive en
 * Compras → Productos, transversal a todos los proveedores.
 *
 * La previsualización es **local**: el store ya tiene costos y márgenes en
 * memoria, así que escribir "+12%" recalcula al instante sin tocar la red.
 * Recién al Guardar viaja un único pedido con los cambios aprobados.
 */

const CAMPOS = [
  { id: 'costo', label: 'Costo', unidad: '$' },
  { id: 'descuento', label: 'Descuento', unidad: '%' },
  { id: 'flete', label: 'Flete', unidad: '%' },
];
const MODOS = [
  { id: 'porcentaje', label: 'Variar un %' },
  { id: 'monto', label: 'Sumar / restar' },
  { id: 'fijar', label: 'Fijar valor' },
];

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Valor resultante de aplicar la regla masiva sobre el valor actual. */
function aplicarRegla(actual, modo, valor) {
  const a = Number(actual) || 0;
  const v = Number(valor) || 0;
  if (modo === 'fijar') return r2(v);
  if (modo === 'monto') return r2(a + v);
  return r2(a * (1 + v / 100));
}

const costoNetoDe = (e) => (Number(e.costo) || 0) * (1 - (Number(e.descuento) || 0) / 100) * (1 + (Number(e.flete) || 0) / 100);

export function ProveedorCostosTab({ prov }) {
  const { store, isAdmin, openModal, toast, act } = useProductos();

  /** { [productoProveedorId]: { costo, descuento, flete } } — solo lo tocado. */
  const [edits, setEdits] = useState({});
  const [masiva, setMasiva] = useState({ campo: 'costo', modo: 'porcentaje', valor: '' });
  const [guardando, setGuardando] = useState(false);

  /** Filas: producto + su entrada de costo con este proveedor. */
  const filas = useMemo(() => store.state.productos
    .map((p) => {
      const entry = (p.proveedores || []).find((e) => e.proveedorId === prov.id);
      if (!entry) return null;
      const ganancia = (p.listasPrecio || [])[0]?.ganancia ?? 0;
      return { p, entry, ganancia, activo: p.proveedorActivoId === prov.id };
    })
    .filter(Boolean), [store.state.productos, prov.id]);

  /** Estado efectivo de una fila: lo editado si se tocó, si no lo guardado. */
  const efectivo = useCallback((f) => ({ ...f.entry, ...(edits[f.entry.id] || {}) }), [edits]);

  const setCampo = (id, campo, valor) => setEdits((e) => ({
    ...e, [id]: { ...(e[id] || {}), [campo]: valor === '' ? 0 : Number(valor) },
  }));

  /** Aplica la regla a TODAS las filas visibles, solo en pantalla. */
  const aplicarMasiva = () => {
    if (masiva.valor === '' || Number.isNaN(Number(masiva.valor))) { toast('Ingresá el valor.', 'err'); return; }
    setEdits((prev) => {
      const next = { ...prev };
      for (const f of filas) {
        const actual = { ...f.entry, ...(prev[f.entry.id] || {}) };
        const nuevo = Math.max(0, aplicarRegla(actual[masiva.campo], masiva.modo, masiva.valor));
        next[f.entry.id] = { ...(next[f.entry.id] || {}), [masiva.campo]: nuevo };
      }
      return next;
    });
  };

  /** Cambios reales (descarta los que quedaron iguales al valor guardado). */
  const cambios = useMemo(() => filas
    .map((f) => {
      const e = efectivo(f);
      const igual = Math.abs(e.costo - f.entry.costo) < 0.005
        && Math.abs(e.descuento - f.entry.descuento) < 0.005
        && Math.abs(e.flete - f.entry.flete) < 0.005;
      return igual ? null : { id: f.entry.id, costo: e.costo, descuento: e.descuento, flete: e.flete };
    })
    .filter(Boolean), [filas, efectivo]);

  const guardar = async () => {
    if (!cambios.length) return;
    setGuardando(true);
    const ok = await act(
      store.actualizarCostos({
        cambios,
        origen: 'masiva',
        motivo: `Actualización de costos · ${prov.nombre}`,
        usuarioId: store.state.ctx.usuarioId ?? undefined,
      }),
      `${cambios.length} costo(s) actualizado(s).`,
    );
    setGuardando(false);
    if (ok) setEdits({});
  };

  if (!filas.length) {
    return (
      <div className={cx(s.callout, s.info)}>
        Este proveedor no está asignado a ningún producto todavía. Asignalo desde el
        detalle del producto, pestaña <strong>Proveedor</strong>.
      </div>
    );
  }

  const cuerpo = filas.map((f) => {
    const e = efectivo(f);
    const tocada = !!edits[f.entry.id];
    const netoAntes = costoNetoDe(f.entry);
    const netoAhora = costoNetoDe(e);
    const precioAntes = netoAntes * (1 + f.ganancia / 100);
    const precioAhora = netoAhora * (1 + f.ganancia / 100);
    const subio = precioAhora > precioAntes;

    return (
      <tr key={f.entry.id}>
        <td>
          <strong>{f.p.nombre}</strong>
          {f.activo && <span className={cx(s.pill, s['st-disponible'])} style={{ marginLeft: 6 }}>Activo</span>}
          <div className={s.hint} style={{ margin: 0 }}>
            {f.p.marca || 'Sin marca'} · {f.p.categoria}
            {!f.activo && <span className={s.muted}> · no mueve el precio hasta ser el activo</span>}
          </div>
        </td>
        {CAMPOS.map((c) => (
          <td key={c.id} className={s.num}>
            <input
              type="number" min="0" step={c.id === 'costo' ? '0.01' : '0.5'}
              value={e[c.id]}
              disabled={!isAdmin}
              onChange={(ev) => setCampo(f.entry.id, c.id, ev.target.value)}
              style={{
                width: c.id === 'costo' ? 104 : 74, textAlign: 'right', padding: '5px 7px',
                border: `1px solid ${tocada ? 'var(--crm-color-primary)' : 'var(--crm-color-border)'}`,
                borderRadius: 'var(--crm-radius-sm)',
                background: 'var(--crm-color-surface)', color: 'var(--crm-color-text)',
              }}
            />
          </td>
        ))}
        <td className={cx(s.num, s.mono)}>{money(netoAhora)}</td>
        <td className={s.num}>
          {!f.activo ? <span className={s.muted}>—</span> : tocada ? (
            <>
              <span className={s.muted}>{money(precioAntes)}</span>{' → '}
              <strong style={{ color: subio ? 'var(--crm-color-danger)' : 'var(--crm-color-success)' }}>
                {money(precioAhora)}
              </strong>
            </>
          ) : money(precioAhora)}
        </td>
      </tr>
    );
  });

  return (
    <>
      <div className={cx(s.callout, s.info)}>
        Costo, descuento y flete de <strong>{prov.nombre}</strong>. El precio de venta se recalcula
        solo: no se edita a mano.
      </div>

      {isAdmin && (
        <div className={s.toolbar} style={{ marginBottom: 'var(--crm-space-3)' }}>
          <span className={s['mini-label']}>Aplicar a los {filas.length}:</span>
          <select className={s['select-inline']} value={masiva.campo} onChange={(e) => setMasiva((m) => ({ ...m, campo: e.target.value }))}>
            {CAMPOS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <select className={s['select-inline']} value={masiva.modo} onChange={(e) => setMasiva((m) => ({ ...m, modo: e.target.value }))}>
            {MODOS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          <input
            type="number" step="0.01" placeholder="Ej: 12"
            value={masiva.valor}
            onChange={(e) => setMasiva((m) => ({ ...m, valor: e.target.value }))}
            style={{
              width: 96, padding: '8px 11px', textAlign: 'right',
              border: '1px solid var(--crm-color-border)', borderRadius: 'var(--crm-radius-sm)',
              background: 'var(--crm-color-surface)', color: 'var(--crm-color-text)',
            }}
          />
          <Btn small onClick={aplicarMasiva}>Aplicar</Btn>
          <span className={s.ctxSpacer} />
          <Btn small onClick={() => openModal('historialPrecios', { proveedorId: prov.id })}>Historial</Btn>
        </div>
      )}

      <Table
        cols={[
          { h: 'Producto' }, { h: 'Costo', num: true }, { h: 'Desc. %', num: true }, { h: 'Flete %', num: true },
          { h: 'Costo neto', num: true }, { h: 'Precio de venta', num: true },
        ]}
      >
        {cuerpo}
      </Table>

      {cambios.length > 0 && (
        <div
          className={cx(s.callout, s.warn)}
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-4)', flexWrap: 'wrap' }}
        >
          <span style={{ flex: 1, minWidth: 240 }}>
            <strong>{cambios.length}</strong> cambio(s) sin guardar. Queda registrado en el historial
            y se puede deshacer.
          </span>
          <Btn small onClick={() => setEdits({})} disabled={guardando}>Descartar</Btn>
          <Btn variant="btn-primary" small onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </Btn>
        </div>
      )}

      <div className={s.hint}>
        El precio mostrado es el de la primera lista de cada producto, como referencia.
        Los productos cuyo proveedor activo es otro no cambian de precio al tocar estos costos.
      </div>
    </>
  );
}
