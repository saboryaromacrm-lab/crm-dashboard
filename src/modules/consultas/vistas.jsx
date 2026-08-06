/**
 * CONSULTAS RÁPIDAS — las vistas (filtros + grilla)
 * ============================================================================
 * Dos consultas transversales: **cambios de precio** y **existencias**. No son
 * de un módulo en particular — se preguntan desde donde uno esté, con el
 * cliente enfrente — así que viven acá y las usan tanto los modales globales
 * (Alt+F5 / Alt+F3) como los paneles del menú.
 *
 * Son AUTOSUFICIENTES a propósito: piden sus propios datos y no dependen del
 * contexto de Ventas. Si dependieran, el atajo solo andaría dentro de Ventas,
 * que es exactamente el bug que las trajo hasta acá.
 *
 * LAYOUT: tres franjas fijas (filtros / grilla con scroll / pie). Los filtros y
 * la cabecera no se van nunca de la vista, que es lo que permite recorrer
 * doscientas filas sin perder de vista qué columna es cuál.
 *
 * Todo se trae UNA vez y los filtros corren en memoria: cada tecla filtra al
 * instante, sin un viaje a la red por pulsación.
 */
import { useEffect, useMemo, useState } from 'react';
import { httpClient } from '@core/services/httpClient.js';
import { cx } from '@shared/utils/classNames.js';
import { money, num, fmtFechaHora } from '@modules/productos/domain/format.js';
import { usePaginado, Paginador } from '@modules/productos/components/ui.jsx';
import c from './Consultas.module.css';

/** Texto comparable: sin acentos ni mayúsculas. */
const norm = (v) => (v || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

const ORIGEN_PRECIO = {
  inicial: 'Alta',
  costo: 'Cambio de costo',
  formato_compra: 'Formato de compra',
  formato_venta: 'Formato de venta',
  activacion: 'Cambio de formato activo',
  reversion: 'Reversión',
};

/* ------------------------------------------------------------------ *
 * Piezas comunes
 * ------------------------------------------------------------------ */

function Campo({ label, ancho, children }) {
  return (
    <div className={cx(c.campo, ancho === 'buscador' && c.buscador)}>
      <label>{label}</label>
      {children}
    </div>
  );
}

/**
 * Barra de estado: cuántos resultados de cuántos, y el botón de limpiar que
 * aparece SOLO cuando hay algo que limpiar — un botón permanente que la mitad
 * del tiempo no hace nada es ruido.
 */
function BarraEstado({ visibles, total, cargando, hayFiltro, onLimpiar, extra }) {
  return (
    <div className={c.estado}>
      <span className={c.conteo}>
        {cargando
          ? 'Cargando…'
          : <><strong>{visibles}</strong>{visibles !== total && <> de {total}</>} {total === 1 ? 'resultado' : 'resultados'}</>}
        {extra && !cargando && <> · {extra}</>}
      </span>
      {hayFiltro && (
        <button type="button" className={c.limpiar} onClick={onLimpiar}>Limpiar filtros</button>
      )}
    </div>
  );
}

/** Cabecera de dos niveles: fila de grupos + fila de columnas. */
function Cabecera({ grupos, columnas }) {
  return (
    <thead>
      <tr className={c.grupoFila}>
        {grupos.map((g, i) => (
          <th key={i} colSpan={g.span} className={cx(i > 0 && c.grupo)}>{g.h}</th>
        ))}
      </tr>
      <tr className={c.colFila}>
        {columnas.map((col, i) => (
          <th key={i} className={cx(col.num && c.num, col.grupo && c.grupo, col.cls && c[col.cls])}>
            {col.h}
          </th>
        ))}
      </tr>
    </thead>
  );
}

/* ------------------------------------------------------------------ *
 * Cambios de precio  (Alt+F5)
 * ------------------------------------------------------------------ */

function Variacion({ valor }) {
  if (valor == null) return <span className={c.alta}>alta</span>;
  const sube = valor > 0;
  return (
    <span className={cx(c.variacion, sube ? c.sube : c.baja)}>
      {sube ? '▲' : '▼'}{num(Math.abs(valor), 2)}%
    </span>
  );
}

const FILTROS_PRECIO = { q: '', marca: '', lista: '', origen: '', desde: '' };

export function CambiosPrecioVista({ compacto = false }) {
  const [filas, setFilas] = useState(null);
  const [error, setError] = useState('');
  const [f, setF] = useState(FILTROS_PRECIO);
  const set = (patch) => setF((x) => ({ ...x, ...patch }));

  useEffect(() => {
    let vivo = true;
    httpClient.get('/precios/evolucion?limit=2000')
      .then((r) => { if (vivo) setFilas(r); })
      .catch((e) => { if (vivo) { setError(e?.message || 'No se pudo cargar.'); setFilas([]); } });
    return () => { vivo = false; };
  }, []);

  // Las opciones salen de lo que de verdad hay: no se ofrece un filtro vacío.
  const marcas = useMemo(() => [...new Set((filas ?? []).map((x) => x.marca).filter(Boolean))].sort(), [filas]);
  const listas = useMemo(() => [...new Set((filas ?? []).map((x) => x.lista))].sort(), [filas]);
  const origenes = useMemo(() => [...new Set((filas ?? []).map((x) => x.origen))], [filas]);

  const visibles = useMemo(() => {
    const n = norm(f.q);
    const corte = f.desde ? new Date(f.desde).getTime() : null;
    return (filas ?? []).filter((x) => (
      (!n || norm(x.producto).includes(n) || (x.codigo ?? '').includes(f.q) || (x.codigoPropio ?? '').includes(f.q))
      && (!f.marca || x.marca === f.marca)
      && (!f.lista || x.lista === f.lista)
      && (!f.origen || x.origen === f.origen)
      && (!corte || new Date(x.fecha).getTime() >= corte)
    ));
  }, [filas, f]);

  /** Cuántos subieron y cuántos bajaron: el resumen que se busca de un vistazo. */
  const resumen = useMemo(() => {
    const suben = visibles.filter((x) => x.variacion > 0).length;
    const bajan = visibles.filter((x) => x.variacion < 0).length;
    return suben || bajan ? `${suben} ↑ · ${bajan} ↓` : null;
  }, [visibles]);

  const hayFiltro = Object.keys(FILTROS_PRECIO).some((k) => f[k] !== FILTROS_PRECIO[k]);
  const pag = usePaginado(visibles, 'consultaPrecios', JSON.stringify(f));

  return (
    <div className={c.consulta}>
      <div className={c.filtros} style={{ gridTemplateColumns: '2.2fr 1fr 1.3fr 1.2fr 1fr' }}>
        <Campo label="Buscar producto o código" ancho="buscador">
          <input
            autoFocus={compacto}
            value={f.q}
            placeholder="Nombre, código de barras o código propio…"
            onChange={(e) => set({ q: e.target.value })}
          />
        </Campo>
        <Campo label="Marca">
          <select value={f.marca} onChange={(e) => set({ marca: e.target.value })}>
            <option value="">Todas</option>
            {marcas.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </Campo>
        <Campo label="Lista">
          <select value={f.lista} onChange={(e) => set({ lista: e.target.value })}>
            <option value="">Todas</option>
            {listas.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </Campo>
        <Campo label="Motivo">
          <select value={f.origen} onChange={(e) => set({ origen: e.target.value })}>
            <option value="">Todos</option>
            {origenes.map((o) => <option key={o} value={o}>{ORIGEN_PRECIO[o] || o}</option>)}
          </select>
        </Campo>
        <Campo label="Desde">
          <input type="date" value={f.desde} onChange={(e) => set({ desde: e.target.value })} />
        </Campo>
      </div>

      <BarraEstado
        visibles={visibles.length}
        total={(filas ?? []).length}
        cargando={filas === null}
        hayFiltro={hayFiltro}
        onLimpiar={() => setF(FILTROS_PRECIO)}
        extra={resumen}
      />

      <div className={c.scroll}>
        <table className={c.tabla}>
          <Cabecera
            grupos={[{ h: 'Producto', span: 2 }, { h: 'Precio de góndola', span: 3 }, { h: 'Origen', span: 2 }]}
            columnas={[
              { h: 'Producto' }, { h: 'Lista' },
              { h: 'Antes', num: true, grupo: true }, { h: 'Después', num: true }, { h: 'Variación', num: true },
              { h: 'Motivo', grupo: true }, { h: 'Fecha' },
            ]}
          />
          <tbody>
            {error && (
              <tr><td colSpan={7} className={c.vacio}>{error}</td></tr>
            )}
            {!error && filas === null && (
              <tr><td colSpan={7} className={c.vacio}>Cargando…</td></tr>
            )}
            {!error && filas !== null && visibles.length === 0 && (
              <tr>
                <td colSpan={7} className={c.vacio}>
                  {(filas ?? []).length === 0
                    ? 'Todavía no hay cambios de precio registrados.'
                    : 'Nada coincide con esos filtros.'}
                </td>
              </tr>
            )}
            {pag.visibles.map((x) => (
              <tr key={x.id}>
                <td>
                  <div className={c.prodNombre}>{x.producto}</div>
                  <div className={c.prodMeta}>
                    {x.marca || 'Sin marca'}{(x.codigoPropio || x.codigo) && ` · ${x.codigoPropio || x.codigo}`}
                  </div>
                </td>
                <td>{x.lista}</td>
                <td className={cx(c.num, c.mono, c.grupo, c.antes)}>
                  {x.precioAnterior != null ? money(x.precioAnterior) : '—'}
                </td>
                <td className={cx(c.num, c.mono, c.precioBase)}>{money(x.precio)}</td>
                <td className={c.num}><Variacion valor={x.variacion} /></td>
                <td className={c.grupo}>
                  <div className={c.motivo}>{ORIGEN_PRECIO[x.origen] || x.origen}</div>
                  {x.detalle && <div className={c.motivoDetalle}>{x.detalle}</div>}
                </td>
                <td className={c.mono} style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{fmtFechaHora(x.fecha)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Paginador pag={pag} />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Existencias  (Alt+F3)
 * ------------------------------------------------------------------ */

const FILTROS_STOCK = { q: '', proveedor: '', categoria: '', marca: '', soloConStock: false };

export function ExistenciasVista({ compacto = false }) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [f, setF] = useState(FILTROS_STOCK);
  const set = (patch) => setF((x) => ({ ...x, ...patch }));

  useEffect(() => {
    let vivo = true;
    // La sucursal se pide solo para tener un id válido con el que pedir el
    // catálogo; las COLUMNAS salen de `stockSucursales`, que ya trae todas las
    // sucursales con su nombre para cada artículo.
    httpClient.get('/sucursales')
      .then((sucs) => {
        if (!vivo) return null;
        if (!sucs?.length) { setDatos({ items: [], sucursales: [], listas: new Map(), baseId: null, proveedores: [] }); return null; }
        return httpClient.get(`/ventas/catalogo?sucursalId=${sucs[0].id}`);
      })
      .then((cat) => {
        if (!vivo || !cat) return;
        const items = cat.items ?? [];
        setDatos({
          items,
          sucursales: items[0]?.stockSucursales?.map((x) => ({ id: x.sucursalId, nombre: x.nombre })) ?? [],
          listas: new Map((cat.listas ?? []).map((l) => [l.listaId, l.etiqueta])),
          baseId: (cat.listas ?? []).find((l) => l.esBase)?.listaId ?? null,
          proveedores: cat.proveedoresCatalogo ?? [],
        });
      })
      .catch((e) => { if (vivo) { setError(e?.message || 'No se pudo cargar.'); setDatos({ items: [], sucursales: [], listas: new Map(), baseId: null, proveedores: [] }); } });
    return () => { vivo = false; };
  }, []);

  const { items = [], sucursales = [], listas = new Map(), baseId = null, proveedores = [] } = datos ?? {};

  const marcas = useMemo(() => [...new Set(items.map((i) => i.marca).filter(Boolean))].sort(), [items]);
  const categorias = useMemo(() => [...new Set(items.map((i) => i.categoria).filter(Boolean))].sort(), [items]);

  const totalDe = (i) => (i.stockSucursales ?? []).reduce((a, x) => a + (x.cantidad || 0), 0);

  const visibles = useMemo(() => {
    const n = norm(f.q);
    const prov = f.proveedor ? Number(f.proveedor) : null;
    return items.filter((i) => (
      (!n || norm(i.nombre).includes(n) || (i.codigoBarras ?? '').includes(f.q) || (i.codigo ?? '').includes(f.q))
      && (!prov || (i.proveedorIds ?? []).includes(prov))
      && (!f.marca || i.marca === f.marca)
      && (!f.categoria || i.categoria === f.categoria)
      && (!f.soloConStock || totalDe(i) > 0)
    ));
  }, [items, f]);

  const hayFiltro = Object.keys(FILTROS_STOCK).some((k) => f[k] !== FILTROS_STOCK[k]);
  const pag = usePaginado(visibles, 'consultaExistencias', JSON.stringify(f));
  const nCols = 2 + sucursales.length + 2 + 1;

  const stockEn = (item, sucursalId) =>
    item.stockSucursales?.find((x) => x.sucursalId === sucursalId)?.cantidad ?? 0;

  return (
    <div className={c.consulta}>
      <div className={c.filtros} style={{ gridTemplateColumns: '2.2fr 1.3fr 1.2fr 1.2fr auto' }}>
        <Campo label="Buscar producto o código" ancho="buscador">
          <input
            autoFocus={compacto}
            value={f.q}
            placeholder="Escaneá un código o escribí el nombre…"
            onChange={(e) => set({ q: e.target.value })}
          />
        </Campo>
        <Campo label="Proveedor">
          <select value={f.proveedor} onChange={(e) => set({ proveedor: e.target.value })}>
            <option value="">Todos</option>
            {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </Campo>
        <Campo label="Categoría">
          <select value={f.categoria} onChange={(e) => set({ categoria: e.target.value })}>
            <option value="">Todas</option>
            {categorias.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </Campo>
        <Campo label="Marca">
          <select value={f.marca} onChange={(e) => set({ marca: e.target.value })}>
            <option value="">Todas</option>
            {marcas.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </Campo>
        <Campo label="Stock">
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, whiteSpace: 'nowrap', padding: '7px 0' }}>
            <input
              type="checkbox"
              checked={f.soloConStock}
              onChange={(e) => set({ soloConStock: e.target.checked })}
            />
            Solo con stock
          </label>
        </Campo>
      </div>

      <BarraEstado
        visibles={visibles.length}
        total={items.length}
        cargando={datos === null}
        hayFiltro={hayFiltro}
        onLimpiar={() => setF(FILTROS_STOCK)}
      />

      <div className={c.scroll}>
        <table className={c.tabla}>
          <Cabecera
            grupos={[
              { h: 'Producto', span: 2 },
              { h: 'Stock por sucursal', span: sucursales.length + 1 },
              { h: 'Precios', span: 2 },
            ]}
            columnas={[
              { h: 'Código' }, { h: 'Producto' },
              ...sucursales.map((su, i) => ({ h: su.nombre, num: true, grupo: i === 0 })),
              { h: 'Total', num: true, cls: 'totalCol' },
              { h: 'Mostrador', num: true, grupo: true }, { h: 'Otras listas' },
            ]}
          />
          <tbody>
            {error && <tr><td colSpan={nCols} className={c.vacio}>{error}</td></tr>}
            {!error && datos === null && (
              <tr><td colSpan={nCols} className={c.vacio}>Cargando…</td></tr>
            )}
            {!error && datos !== null && visibles.length === 0 && (
              <tr><td colSpan={nCols} className={c.vacio}>Nada coincide con esos filtros.</td></tr>
            )}
            {pag.visibles.map((i) => {
              const total = totalDe(i);
              const otras = (i.precios ?? []).filter((p) => p.listaId !== baseId);
              return (
                <tr key={i.key}>
                  <td className={c.mono} style={{ fontSize: 12 }}>{i.codigo || '—'}</td>
                  <td>
                    <div className={c.prodNombre}>{i.nombre}</div>
                    <div className={c.prodMeta}>{i.detalle} · {i.marca || 'Sin marca'}</div>
                  </td>
                  {sucursales.map((su, idx) => {
                    const q = stockEn(i, su.id);
                    return (
                      // El cero se atenúa: lo que HAY tiene que saltar a la vista.
                      <td
                        key={su.id}
                        className={cx(c.num, c.mono, idx === 0 && c.grupo, q <= 0 && c.cero)}
                      >
                        {num(q)}{i.unidad === 'kg' ? ' kg' : ''}
                      </td>
                    );
                  })}
                  <td className={cx(c.num, c.mono, c.total, c.totalCol, total <= 0 && c.cero)}>
                    {num(total)}{i.unidad === 'kg' ? ' kg' : ''}
                  </td>
                  <td className={cx(c.num, c.mono, c.precioBase, c.grupo)}>
                    {i.precio > 0 ? money(i.precio) : '—'}
                  </td>
                  <td>
                    {otras.length
                      ? otras.map((p) => (
                        <span key={p.listaId} className={c.chipLista}>
                          {listas.get(p.listaId) ?? `Lista ${p.listaId}`} <b>{money(p.precio)}</b>
                        </span>
                      ))
                      : <span className={c.alta}>—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Paginador pag={pag} />
    </div>
  );
}
