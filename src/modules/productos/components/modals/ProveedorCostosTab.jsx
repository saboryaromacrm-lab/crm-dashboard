import { useCallback, useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../../context/ProductosContext.jsx';
import { money } from '../../domain/format.js';
import { norm } from '../CatalogoPicker.jsx';
import { Table, Btn, usePaginado, s } from '../ui.jsx';

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

/*
 * EL COSTO NETO SALE DEL MOTOR, NO DE UNA CUENTA ESCRITA ACÁ.
 *
 * Acá había una copia a mano de la cadena de costo, y estaba mal de tres formas
 * a la vez — las tres invisibles, porque el número que sale igual parece
 * razonable:
 *
 *  1. miraba SOLO `descuento` e ignoraba los otros tres. El importador del
 *     sistema viejo carga `descuento2`, así que con un "30 y 10" mostraba el
 *     neto con 30 nomás;
 *  2. ignoraba `modoCosto: 'final'` (el costo cargado con IVA incluido), donde
 *     `costo` vale 0 y el neto vive en `costoFinal`: mostraba 0;
 *  3. y lo peor: devolvía el neto **del bulto** mientras la ganancia se
 *     calculaba con el neto **unitario** (`store.costoNeto` → `costoNetoUnitario`).
 *     Para una bolsa de 20 kg, la columna "Precio de venta" mostraba veinte
 *     veces el precio de góndola.
 *
 * `costosFormato` es el mismo espejo de `pricing.ts` que usa el resto del
 * sistema, y devuelve las dos escalas con nombre. Era la quinta copia de esta
 * cadena; ahora son cuatro.
 */
// La BASE del precio (0072), no el costo real: esta columna proyecta góndola.
const costoNetoDe = (store, e, iva) => store.costosFormato(e, iva).costoPrecioUnitario;

export function ProveedorCostosTab({ prov }) {
  const { store, isAdmin, openModal, toast, act } = useProductos();

  /** { [productoProveedorId]: { costo, descuento, flete } } — solo lo tocado. */
  const [edits, setEdits] = useState({});
  const [masiva, setMasiva] = useState({ campo: 'costo', modo: 'porcentaje', valor: '' });
  const [guardando, setGuardando] = useState(false);

  /**
   * Alcance de la masiva: no siempre TODO el proveedor sube de precio. Se guarda
   * lo EXCLUIDO (no lo incluido) para que el default sea "todos tildados" y una
   * recarga del listado no pise lo que el usuario destildó.
   */
  const [excluidos, setExcluidos] = useState(() => new Set());

  /** Filas: producto + su entrada de costo con este proveedor. */
  const filas = useMemo(() => store.state.productos
    .map((p) => {
      const entry = (p.formatosCompra || []).find((e) => e.proveedorId === prov.id);
      if (!entry) return null;
      // Markup EQUIVALENTE del piso (vale también con precio definido): la
      // referencia de cuánto se movería la góndola si cambia este costo.
      // Sobre la BASE del precio (0072): el markup multiplica esa, no el real.
      const cnHoy = store.costoPrecio(p);
      const ganancia = cnHoy > 0 ? (store.precioBaseVenta(p) / cnHoy - 1) * 100 : 0;
      // "Activo" = el formato que manda el precio hoy es de ESTE proveedor.
      return { p, entry, ganancia, activo: store.formatoActivo(p)?.proveedorId === prov.id };
    })
    .filter(Boolean), [store.state.productos, prov.id]);

  /**
   * FILTRO DE LA TABLA — el que hace usable "subió una marca, no el proveedor".
   *
   * Un proveedor grande trae 130 productos de varias marcas, y lo que aumenta
   * casi nunca es todo: es "Coca Cola subió 10%". Sin esto había que destildar
   * a mano, de a 20 por página, todo lo que NO era Coca — con lo cual la regla
   * masiva no servía justo para el caso más común.
   *
   * El desplegable ofrece SOLO las marcas que este proveedor trae: una lista
   * con las 40 marcas del sistema, de las cuales 35 no están acá, es una lista
   * para elegir mal.
   */
  const [q, setQ] = useState('');
  const [marcaId, setMarcaId] = useState('');

  const marcasDelProveedor = useMemo(() => {
    const m = new Map();
    for (const f of filas) if (f.p.marcaId) m.set(f.p.marcaId, f.p.marca || `#${f.p.marcaId}`);
    return [...m].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [filas]);

  const hayFiltro = !!q.trim() || !!marcaId;
  const visibles = useMemo(() => {
    if (!hayFiltro) return filas;
    const n = norm(q);
    return filas.filter((f) => {
      if (marcaId && String(f.p.marcaId ?? '') !== String(marcaId)) return false;
      if (!n) return true;
      return norm(f.p.nombre).includes(n) || norm(f.p.marca).includes(n)
        || (f.p.codigoBarras || '').includes(q.trim()) || (f.p.codigoPropio || '').includes(q.trim());
    });
  }, [filas, q, marcaId, hayFiltro]);

  /** Estado efectivo de una fila: lo editado si se tocó, si no lo guardado. */
  const efectivo = useCallback((f) => ({ ...f.entry, ...(edits[f.entry.id] || {}) }), [edits]);

  const setCampo = (id, campo, valor) => setEdits((e) => ({
    ...e, [id]: { ...(e[id] || {}), [campo]: valor === '' ? 0 : Number(valor) },
  }));

  const estaSeleccionada = (f) => !excluidos.has(f.entry.id);

  /*
   * EL ALCANCE DE LA REGLA ES LO TILDADO **Y VISIBLE**, y esta línea es la que
   * evita el accidente caro.
   *
   * Los tildes arrancan todos puestos, así que filtrar por "Coca Cola" y
   * aplicar +10% sobre "los tildados" —los 134 del proveedor, incluidos los que
   * el filtro esconde— sería subirle el costo a todo el catálogo del proveedor
   * de un clic, sin verlo en pantalla. Con el filtro puesto, la regla alcanza
   * exactamente lo que se está mirando; sin filtro, todo, como antes.
   *
   * Los tildes NO se reinician al filtrar: si destildaste dos Coca y después
   * buscás otra cosa, siguen destildadas cuando volvés.
   */
  const seleccionadas = visibles.filter(estaSeleccionada);
  const todasSeleccionadas = visibles.length > 0 && seleccionadas.length === visibles.length;

  const toggleFila = (id) => setExcluidos((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  /** Tilda o destilda SOLO lo que se ve: con filtro puesto no toca el resto. */
  const toggleTodas = () => setExcluidos((prev) => {
    const next = new Set(prev);
    for (const f of visibles) {
      if (todasSeleccionadas) next.add(f.entry.id); else next.delete(f.entry.id);
    }
    return next;
  });

  /** Aplica la regla SOLO a las filas tildadas, solo en pantalla. */
  const aplicarMasiva = () => {
    if (masiva.valor === '' || Number.isNaN(Number(masiva.valor))) { toast('Ingresá el valor.', 'err'); return; }
    if (!seleccionadas.length) { toast('No hay productos tildados.', 'err'); return; }
    setEdits((prev) => {
      const next = { ...prev };
      for (const f of seleccionadas) {
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

  /*
   * EL HOOK VA ANTES DEL RETURN TEMPRANO, Y NO ES ESTILO.
   *
   * Estaba después, así que la cantidad de hooks del componente cambiaba según
   * hubiera filas o no. Y eso pasa de verdad: guardar costos recarga el
   * bootstrap y reescribe `state.productos`, así que `filas` se recalcula con el
   * modal abierto. Si cruza el cero en cualquier dirección, React tira
   * "Rendered fewer hooks than expected" y se cae la pantalla entera.
   */
  const pag = usePaginado(visibles, 'costosProveedor');

  if (!filas.length) {
    return (
      <div className={cx(s.callout, s.info)}>
        Este proveedor no está asignado a ningún producto todavía. Asignalo desde el
        detalle del producto, pestaña <strong>Proveedor</strong>.
      </div>
    );
  }

  const cuerpo = pag.visibles.map((f) => {
    const e = efectivo(f);
    const tocada = !!edits[f.entry.id];
    const sel = estaSeleccionada(f);
    // El IVA del PRODUCTO: `modoCosto: 'final'` lo necesita para sacarle el IVA
    // al costo cargado con impuesto incluido.
    const netoAntes = costoNetoDe(store, f.entry, f.p.iva);
    const netoAhora = costoNetoDe(store, e, f.p.iva);
    const precioAntes = netoAntes * (1 + f.ganancia / 100);
    const precioAhora = netoAhora * (1 + f.ganancia / 100);
    const subio = precioAhora > precioAntes;

    return (
      <tr key={f.entry.id} style={sel ? undefined : { opacity: 0.55 }}>
        {isAdmin && (
          <td style={{ width: 34, textAlign: 'center' }}>
            <input
              type="checkbox"
              checked={sel}
              onChange={() => toggleFila(f.entry.id)}
              aria-label={`Incluir ${f.p.nombre} en la masiva`}
              style={{ cursor: 'pointer' }}
            />
          </td>
        )}
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
        solo: no se edita a mano. La regla masiva alcanza <strong>solo a los productos tildados</strong> —
        destildá los que no cambian. Editar un campo a mano vale siempre, esté tildado o no.
      </div>

      {/* Acotar la tabla ANTES de la regla: "subió una marca" es el caso normal,
          y sin esto había que destildar a mano lo que no cambia. */}
      <div className={s.toolbar} style={{ marginBottom: 'var(--crm-space-2)' }}>
        <input
          value={q}
          placeholder="Buscar por nombre, marca o código…"
          onChange={(e) => setQ(e.target.value)}
          style={{
            flex: 1, minWidth: 220, padding: '8px 11px',
            border: '1px solid var(--crm-color-border)', borderRadius: 'var(--crm-radius-sm)',
            background: 'var(--crm-color-surface)', color: 'var(--crm-color-text)',
          }}
        />
        {marcasDelProveedor.length > 1 && (
          <select className={s['select-inline']} value={marcaId} onChange={(e) => setMarcaId(e.target.value)}>
            <option value="">Todas las marcas</option>
            {marcasDelProveedor.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select>
        )}
        {hayFiltro && (
          <>
            <span className={s.muted} style={{ fontSize: 13 }}>
              {visibles.length} de {filas.length}
            </span>
            <Btn small onClick={() => { setQ(''); setMarcaId(''); }}>Limpiar filtro</Btn>
          </>
        )}
      </div>

      {isAdmin && (
        <div className={s.toolbar} style={{ marginBottom: 'var(--crm-space-3)' }}>
          {/* El rótulo dice el número EXACTO sobre el que va a caer la regla. Con
              el filtro puesto nombra el filtro, porque "los 8 tildados" en una
              tabla de 134 se lee como si los otros 126 también fueran a moverse. */}
          <span className={s['mini-label']}>
            Aplicar a{' '}
            {hayFiltro
              ? `${seleccionadas.length} de los ${visibles.length} que se ven`
              : (todasSeleccionadas ? `los ${filas.length}` : `${seleccionadas.length} de ${filas.length} tildados`)}:
          </span>
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
          ...(isAdmin ? [{
            h: (
              <input
                type="checkbox"
                checked={todasSeleccionadas}
                onChange={toggleTodas}
                aria-label="Tildar o destildar todos"
                title="Tildar / destildar todos"
                style={{ cursor: 'pointer' }}
              />
            ),
          }] : []),
          { h: 'Producto' }, { h: 'Costo', num: true }, { h: 'Desc. %', num: true }, { h: 'Flete %', num: true },
          { h: 'Costo neto', num: true }, { h: 'Precio de venta', num: true },
        ]}
        pag={pag}
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
