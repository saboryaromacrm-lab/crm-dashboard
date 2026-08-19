import { useEffect, useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../../context/ProductosContext.jsx';
import { money, num, fmtFechaHora } from '../../domain/format.js';
import { ModalShell } from '../Modal.jsx';
import { Table, Btn, usePaginado, s } from '../ui.jsx';

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
  const { store, isAdmin, closeModal, toast } = useProductos();
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

  const pag = usePaginado(filas ?? [], 'historialCostos');

  const cuerpo = pag.visibles.map((h) => {
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
        pag={pag}
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
  const [lista, setLista] = useState('');
  const [modo, setModo] = useState('monto');
  const [valor, setValor] = useState('');
  const [guardando, setGuardando] = useState(false);

  /**
   * Filas DESTILDADAS de la vista previa: no siempre todos suben. Se guarda lo
   * excluido para que el default sea "todos tildados".
   */
  const [excluidos, setExcluidos] = useState(() => new Set());

  const claveDe = (c) => `${c.id}-${c.detalle}`;

  /** Solo listas donde algo trabaja por markup (precio definido no se pisa con un %). */
  const listas = useMemo(() => {
    const set = new Set();
    const sumar = (ls) => (ls || []).forEach((l) => { if (l.modoPrecio !== 'precio') set.add(l.etiqueta); });
    productos.forEach((p) => {
      sumar(p.listas);
      (p.presentaciones || []).forEach((pr) => sumar(pr.listas));
    });
    return [...set].sort();
  }, [productos]);

  /**
   * Filas objetivo con su precio actual y el resultante — todo en memoria.
   * El precio mostrado es el FINAL con IVA (el de la etiqueta), derivado con el
   * mismo helper que la ficha y el POS.
   *
   * Entran las filas del producto Y las de cada PAQUETE fraccionado: desde la
   * 0053 son la misma clase de fila (`producto_listas`), así que una sola masiva
   * mueve las dos cosas. Antes había un segundo modo para el `recargo` de
   * fraccionamiento, que ya no existe.
   */
  const cambios = useMemo(() => {
    if (valor === '' || Number.isNaN(Number(valor))) return [];
    const out = [];
    const agregar = (p, l, prefijo, costo) => {
      if (!l.id || l.modoPrecio === 'precio') return;
      if (lista && l.etiqueta !== lista) return;
      const nuevo = Math.max(0, aplicarRegla(l.markup, modo, valor));
      if (Math.abs(nuevo - l.markup) < 0.005) return;
      const conIva = 1 + (Number(p.iva) || 0) / 100;
      out.push({
        id: l.id, producto: p.nombre, detalle: `${prefijo}Lista ${l.etiqueta}`,
        actual: l.markup, nuevo,
        precioActual: l.precioFinalUnitario ?? r2((l.precio ?? 0) * conIva),
        precioNuevo: store.ventaFormato(p, { ...l, markup: nuevo }, costo).finalUnitario,
      });
    };
    for (const p of productos) {
      for (const l of p.listas || []) agregar(p, l, '', undefined);
      for (const pr of p.presentaciones || []) {
        const tam = pr.tamKg < 1 ? `${Math.round(pr.tamKg * 1000)} g` : `${pr.tamKg} kg`;
        // La BASE del precio del paquete (0072): la del kilo × su tamaño. El
        // `costoNeto` del payload es el costo REAL — acá se proyecta góndola.
        const basePaquete = store.costoPrecio(p) * (Number(pr.tamKg) || 0);
        for (const l of pr.listas || []) agregar(p, l, `${tam} · `, basePaquete);
      }
    }
    return out;
  }, [productos, store, lista, modo, valor]);

  const seleccionados = useMemo(
    () => cambios.filter((c) => !excluidos.has(claveDe(c))),
    [cambios, excluidos],
  );
  const todosSeleccionados = seleccionados.length === cambios.length;

  const toggleFila = (clave) => setExcluidos((prev) => {
    const next = new Set(prev);
    if (next.has(clave)) next.delete(clave); else next.add(clave);
    return next;
  });
  const toggleTodos = () => setExcluidos(
    todosSeleccionados ? new Set(cambios.map(claveDe)) : new Set(),
  );

  const guardar = async () => {
    if (!cambios.length) { toast('Ningún producto cambia con esos parámetros.', 'err'); return; }
    if (!seleccionados.length) { toast('No hay filas tildadas para aplicar.', 'err'); return; }
    setGuardando(true);
    await act(
      store.actualizarMargenes({
        cambios: seleccionados.map((c) => ({ id: c.id, valor: c.nuevo })),
        motivo: 'Actualización masiva de márgenes',
        usuarioId: store.state.ctx.usuarioId ?? undefined,
      }),
      `${seleccionados.length} margen(es) actualizado(s).`,
    );
    setGuardando(false);
  };

  const pag = usePaginado(cambios, 'margenesMasivos', `${lista}|${modo}|${valor}`);

  return (
    <ModalShell
      title="Actualizar márgenes"
      wide
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        {
          texto: guardando ? 'Aplicando…' : `Aplicar a ${seleccionados.length}`,
          clase: seleccionados.length ? 'btn-primary' : 'btn-ghost',
          onClick: guardar,
        },
      ]}
    >
      <div className={cx(s.callout, s.info)}>
        Mueve el <strong>markup del formato de venta</strong> de los <strong>{productos.length}</strong>{' '}
        producto(s) que quedaron filtrados en el panel — y también el de sus <strong>paquetes
        fraccionados</strong>, que se cotizan solos. En la vista previa, <strong>destildá</strong> los
        que no van a cambiar: se aplica solo a los tildados. Las filas en <strong>precio definido</strong>
        {' '}no entran — ese precio lo fijó una persona y un % no debe pisarlo.
      </div>

      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Lista</label>
          <select value={lista} onChange={(e) => setLista(e.target.value)}>
            <option value="">Todas</option>
            {listas.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
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
          {
            h: (
              <input
                type="checkbox"
                checked={cambios.length > 0 && todosSeleccionados}
                onChange={toggleTodos}
                aria-label="Tildar o destildar todos"
                title="Tildar / destildar todos"
                style={{ cursor: 'pointer' }}
              />
            ),
          },
          { h: 'Producto' }, { h: 'Margen', num: true }, { h: 'Precio final (IVA incl.)', num: true },
        ]}
        empty={valor === '' ? 'Ingresá un valor para ver el resultado.' : 'Ningún producto cambia con esos parámetros.'}
        pag={pag}
      >
        {pag.visibles.map((c) => {
          const clave = claveDe(c);
          const sel = !excluidos.has(clave);
          return (
          <tr key={clave} style={sel ? undefined : { opacity: 0.55 }}>
            <td style={{ width: 34, textAlign: 'center' }}>
              <input
                type="checkbox"
                checked={sel}
                onChange={() => toggleFila(clave)}
                aria-label={`Incluir ${c.producto} — ${c.detalle}`}
                style={{ cursor: 'pointer' }}
              />
            </td>
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
          );
        })}
      </Table>
    </ModalShell>
  );
}
