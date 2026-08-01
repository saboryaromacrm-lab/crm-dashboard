import { useEffect, useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../../context/ProductosContext.jsx';
import { money, num, fmtFechaHora } from '../../domain/format.js';
import { ModalShell } from '../Modal.jsx';
import { Table, Btn, s } from '../ui.jsx';

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/* ==================================================================== *
 * Historial de costos + deshacer
 * ==================================================================== */

const ORIGENES = {
  alta: 'Alta',
  manual: 'Manual',
  masiva: 'Masiva',
  recepcion: 'Recepción',
  reversion: 'Reversión',
};

/**
 * Auditoría de costos. Cada actualización masiva queda agrupada en un **lote**,
 * y el lote se puede deshacer: es la red de seguridad de una actualización
 * equivocada. Se saltean las entradas que cambiaron después del lote, para no
 * pisar en silencio un cambio más nuevo.
 */
export function HistorialPreciosModal({ proveedorId, productoId }) {
  const { store, isAdmin, closeModal, toast, act } = useProductos();
  const [filas, setFilas] = useState(null);
  const [error, setError] = useState(null);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (proveedorId) p.set('proveedorId', proveedorId);
    if (productoId) p.set('productoId', productoId);
    p.set('limit', '150');
    return `?${p.toString()}`;
  }, [proveedorId, productoId]);

  const cargar = useMemo(() => async () => {
    try { setFilas(await store.historialPrecios(query)); setError(null); }
    catch (e) { setError(e?.data?.message || 'No se pudo cargar el historial.'); }
  }, [store, query]);

  useEffect(() => { cargar(); }, [cargar]);

  const revertir = async (lote) => {
    const res = await store.revertirLotePrecios(lote);
    if (res?.ok === false) { toast(res.error || 'No se pudo revertir.', 'err'); return; }
    toast('Lote revertido.', 'ok');
    cargar();
  };

  const cuerpo = (filas ?? []).map((h) => {
    const subio = h.costo > h.costoAnterior;
    const esReversion = h.origen === 'reversion';
    return (
      <tr key={h.id}>
        <td>
          {fmtFechaHora(h.fecha)}
          <div className={s.hint} style={{ margin: 0 }}>{h.usuario || 'Sistema'}</div>
        </td>
        <td>
          <strong>{h.producto}</strong>
          <div className={s.hint} style={{ margin: 0 }}>{h.proveedor}</div>
        </td>
        <td>
          <span className={cx(s.badge)}>{ORIGENES[h.origen] || h.origen}</span>
          {h.motivo && <div className={s.hint} style={{ margin: 0 }}>{h.motivo}</div>}
        </td>
        <td className={s.num}>
          <span className={s.muted}>{money(h.costoAnterior)}</span>{' → '}
          <strong style={{ color: subio ? 'var(--crm-color-danger)' : 'var(--crm-color-success)' }}>
            {money(h.costo)}
          </strong>
        </td>
        <td className={s.num}>{num(h.descuento, 1)}% / {num(h.flete, 1)}%</td>
        <td className={s['actions-col']}>
          {isAdmin && !esReversion && (
            <Btn variant="btn-delete" small onClick={() => revertir(h.lote)}>Deshacer lote</Btn>
          )}
        </td>
      </tr>
    );
  });

  return (
    <ModalShell
      title="Historial de costos"
      wide
      onClose={closeModal}
      footer={[{ texto: 'Cerrar', clase: 'btn-ghost', onClick: closeModal }]}
    >
      <div className={cx(s.callout, s.info)}>
        Cada cambio de costo queda registrado con su origen. <strong>Deshacer lote</strong> revierte
        toda la tanda de esa actualización; las entradas que cambiaron después quedan como están.
      </div>

      {error && <div className={cx(s.callout, s.warn)}>{error}</div>}

      <Table
        cols={[
          { h: 'Cuándo' }, { h: 'Producto' }, { h: 'Origen' },
          { h: 'Costo', num: true }, { h: 'Desc. / Flete', num: true },
          { h: '', cls: 'actions-col' },
        ]}
        empty={filas === null ? 'Cargando…' : 'Todavía no hay cambios de costo registrados.'}
      >
        {cuerpo}
      </Table>
    </ModalShell>
  );
}

/* ==================================================================== *
 * Márgenes masivos
 * ==================================================================== */

const MODOS = [
  { id: 'porcentaje', label: 'Variar un %' },
  { id: 'monto', label: 'Sumar / restar puntos' },
  { id: 'fijar', label: 'Fijar valor' },
];

function aplicarRegla(actual, modo, valor) {
  const a = Number(actual) || 0;
  const v = Number(valor) || 0;
  if (modo === 'fijar') return r2(v);
  if (modo === 'monto') return r2(a + v);
  return r2(a * (1 + v / 100));
}

/**
 * El margen es una decisión propia y transversal a los proveedores, por eso vive
 * acá y no en la pantalla del proveedor. Opera sobre los productos que el panel
 * ya tiene filtrados: lo que ves en la tabla es lo que se actualiza.
 */
export function MargenesMasivosModal({ productos }) {
  const { store, closeModal, toast, act } = useProductos();
  const [tipo, setTipo] = useState('ganancia_lista');
  const [lista, setLista] = useState('');
  const [modo, setModo] = useState('monto');
  const [valor, setValor] = useState('');
  const [guardando, setGuardando] = useState(false);

  const listas = useMemo(() => {
    const set = new Set();
    productos.forEach((p) => (p.listasPrecio || []).forEach((l) => set.add(l.nombre)));
    return [...set].sort();
  }, [productos]);

  /** Filas objetivo con su precio actual y el resultante — todo en memoria. */
  const cambios = useMemo(() => {
    if (valor === '' || Number.isNaN(Number(valor))) return [];
    const out = [];
    for (const p of productos) {
      const cn = store.costoNeto(p);
      if (tipo === 'ganancia_lista') {
        for (const l of p.listasPrecio || []) {
          if (lista && l.nombre !== lista) continue;
          const nuevo = Math.max(0, aplicarRegla(l.ganancia, modo, valor));
          if (Math.abs(nuevo - l.ganancia) < 0.005) continue;
          out.push({
            id: l.id, producto: p.nombre, detalle: `Lista ${l.nombre}`,
            actual: l.ganancia, nuevo,
            precioActual: r2(cn * (1 + l.ganancia / 100)),
            precioNuevo: r2(cn * (1 + nuevo / 100)),
          });
        }
      } else {
        const gRef = (p.listasPrecio || [])[0]?.ganancia ?? 0;
        const porKg = cn * (1 + gRef / 100);
        for (const pr of p.presentaciones || []) {
          const nuevo = Math.max(0, aplicarRegla(pr.recargo, modo, valor));
          if (Math.abs(nuevo - pr.recargo) < 0.005) continue;
          out.push({
            id: pr.id, producto: p.nombre,
            detalle: pr.tamKg < 1 ? `${Math.round(pr.tamKg * 1000)} g` : `${pr.tamKg} kg`,
            actual: pr.recargo, nuevo,
            precioActual: r2(porKg * pr.tamKg * (1 + pr.recargo / 100)),
            precioNuevo: r2(porKg * pr.tamKg * (1 + nuevo / 100)),
          });
        }
      }
    }
    return out;
  }, [productos, store, tipo, lista, modo, valor]);

  const guardar = async () => {
    if (!cambios.length) { toast('Ningún producto cambia con esos parámetros.', 'err'); return; }
    setGuardando(true);
    await act(
      store.actualizarMargenes({ tipo, cambios: cambios.map((c) => ({ id: c.id, valor: c.nuevo })) }),
      `${cambios.length} margen(es) actualizado(s).`,
    );
    setGuardando(false);
  };

  return (
    <ModalShell
      title="Actualizar márgenes"
      wide
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        {
          texto: guardando ? 'Aplicando…' : `Aplicar a ${cambios.length}`,
          clase: cambios.length ? 'btn-primary' : 'btn-ghost',
          onClick: guardar,
        },
      ]}
    >
      <div className={cx(s.callout, s.info)}>
        Alcanza a los <strong>{productos.length}</strong> producto(s) que quedaron filtrados en el
        panel. El margen es decisión propia: no depende del proveedor.
      </div>

      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Qué margen</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="ganancia_lista">Ganancia de una lista</option>
            <option value="ganancia_presentacion">Recargo de fraccionamiento</option>
          </select>
        </div>
        {tipo === 'ganancia_lista' && (
          <div className={s.field}>
            <label>Lista</label>
            <select value={lista} onChange={(e) => setLista(e.target.value)}>
              <option value="">Todas</option>
              {listas.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Cómo</label>
          <select value={modo} onChange={(e) => setModo(e.target.value)}>
            {MODOS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </div>
        <div className={s.field}>
          <label>Valor <span className={s.req}>*</span></label>
          <input type="number" step="0.5" placeholder="Ej: 5" value={valor} onChange={(e) => setValor(e.target.value)} />
        </div>
      </div>

      <Table
        cols={[
          { h: 'Producto' }, { h: 'Margen', num: true }, { h: 'Precio de venta', num: true },
        ]}
        empty={valor === '' ? 'Ingresá un valor para ver el resultado.' : 'Ningún producto cambia con esos parámetros.'}
      >
        {cambios.slice(0, 200).map((c) => (
          <tr key={`${c.id}-${c.detalle}`}>
            <td>
              <strong>{c.producto}</strong>
              <div className={s.hint} style={{ margin: 0 }}>{c.detalle}</div>
            </td>
            <td className={s.num}>
              <span className={s.muted}>{num(c.actual, 1)}%</span> → <strong>{num(c.nuevo, 1)}%</strong>
            </td>
            <td className={s.num}>
              <span className={s.muted}>{money(c.precioActual)}</span>{' → '}
              <strong style={{ color: c.precioNuevo > c.precioActual ? 'var(--crm-color-danger)' : 'var(--crm-color-success)' }}>
                {money(c.precioNuevo)}
              </strong>
            </td>
          </tr>
        ))}
      </Table>

      {cambios.length > 200 && (
        <div className={s.hint}>Se muestran los primeros 200 de {cambios.length}; se aplican todos.</div>
      )}
    </ModalShell>
  );
}
