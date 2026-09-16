/**
 * MÁRGENES — todos los markups del catálogo, de un pantallazo.
 * ============================================================================
 * Nació de un pedido del dueño (16/9/2026): *"para ver qué markup tiene cada
 * producto tengo que entrar producto por producto y no termino más, siendo que
 * muchos comparten el mismo"*.
 *
 * LA PANTALLA SON DOS MIRADAS DEL MISMO DATO, una arriba de la otra:
 *
 *   1. EL RESUMEN. No lista productos: lista los VALORES que se están usando,
 *      con cuántos artículos tiene cada uno — "en Minorista, 1.240 al 35%".
 *      Esa es la vista que hace corto el trabajo, porque aprovecha justamente
 *      que muchos comparten el número. Y de paso las excepciones saltan a la
 *      vista: los tres al 62% que nadie se acuerda por qué están ahí.
 *   2. LA GRILLA. Producto en la fila, lista en la columna, el markup en la
 *      celda. Es el "ver todos" literal, para comparar una lista contra otra.
 *
 * Y LAS DOS ESTÁN ENGANCHADAS: al hacer clic en un valor del resumen, la grilla
 * de abajo queda mostrando exactamente esos artículos. Ese es el movimiento que
 * reemplaza al "entrar producto por producto".
 *
 * NO PIDE NADA AL SERVIDOR. Todo sale del snapshot del inventario que el módulo
 * ya tiene en memoria (ver `domain/margenes.js`): abrir esta pantalla no cuesta
 * una consulta, y cambiar un filtro tampoco. Lo único que se cuida es no
 * dibujar miles de filas de una — para eso está el paginado de siempre.
 */
import { useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { descargarCsv, csvNum } from '@shared/utils/csv.js';
import { useProductos } from '../context/ProductosContext.jsx';
import { money, num } from '../domain/format.js';
import {
  filasDeMargenes, agruparMargenes, resumenPorLista, columnasDeMargenes, grillaDeMargenes,
} from '../domain/margenes.js';
import { Table, PanelHead, Btn, Stat, usePaginado, s } from '../components/ui.jsx';

/** Texto comparable: sin mayúsculas ni acentos. Igual que en Productos. */
const norm = (v) => (v || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

/**
 * Cuántos valores se muestran por lista antes de plegar el resto.
 *
 * El caso normal son unos pocos —es el sentido de esta pantalla—, pero un
 * catálogo donde cada producto tiene su propio markup generaría cientos de
 * renglones y el resumen dejaría de resumir. Se muestran los más usados, que es
 * la respuesta a "qué markups uso", y el resto queda a un clic.
 */
const TOPE_VALORES = 12;

/** Cómo se lee un grupo: "35%" o el cartel del precio puesto a mano. */
const etiquetaValor = (g) => (g.modoPrecio === 'precio' ? 'Precio definido' : `${num(g.markup, 1)}%`);

export function MargenesPanel() {
  const { store, isAdmin, openModal } = useProductos();
  const [q, setQ] = useState('');
  const [marca, setMarca] = useState('');
  const [categoria, setCategoria] = useState('');
  const [proveedorId, setProveedorId] = useState('');
  const [estadoF, setEstadoF] = useState('vigentes');
  /** El valor elegido en el resumen: filtra la grilla de abajo. */
  const [grupoSel, setGrupoSel] = useState(null);
  /** Listas cuyo resumen se desplegó entero (ver `TOPE_VALORES`). */
  const [desplegadas, setDesplegadas] = useState(() => new Set());

  /** Opciones de los filtros, derivadas del catálogo ya cargado (sin red). */
  const opciones = useMemo(() => {
    const marcas = new Set();
    const categorias = new Set();
    for (const p of store.state.productos) {
      if (p.marca) marcas.add(p.marca);
      if (p.categoria) categorias.add(p.categoria);
    }
    return { marcas: [...marcas].sort(), categorias: [...categorias].sort() };
  }, [store.state.productos]);

  // Mismo criterio de filtrado que el panel de Productos: si acá filtrara
  // distinto, el mismo filtro daría dos universos según la pantalla.
  const productos = useMemo(() => {
    const ql = norm(q);
    const provId = proveedorId ? Number(proveedorId) : null;
    return store.state.productos.filter((p) => {
      const est = p.estado || 'activo';
      if (estadoF === 'vigentes' && est === 'archivado') return false;
      if (estadoF !== 'vigentes' && estadoF !== '' && est !== estadoF) return false;
      if (marca && p.marca !== marca) return false;
      if (categoria && p.categoria !== categoria) return false;
      if (provId && !(p.formatosCompra || []).some((e) => e.proveedorId === provId)) return false;
      if (!ql) return true;
      return norm(p.nombre).includes(ql) || norm(p.marca).includes(ql) || norm(p.categoria).includes(ql);
    });
  }, [store.state.productos, q, marca, categoria, proveedorId, estadoF]);

  const filas = useMemo(() => filasDeMargenes(productos), [productos]);
  const grupos = useMemo(() => agruparMargenes(filas), [filas]);
  const resumen = useMemo(() => resumenPorLista(grupos), [grupos]);
  const columnas = useMemo(() => columnasDeMargenes(filas), [filas]);
  const grillaTodas = useMemo(() => grillaDeMargenes(filas), [filas]);

  const seleccionado = useMemo(
    () => (grupoSel ? grupos.find((g) => g.clave === grupoSel) ?? null : null),
    [grupoSel, grupos],
  );
  /** Las filas del grupo elegido, para filtrar la grilla y para resaltar la celda. */
  const idsSel = useMemo(
    () => (seleccionado ? new Set(seleccionado.filaIds) : null),
    [seleccionado],
  );

  const grilla = useMemo(() => {
    if (!idsSel) return grillaTodas;
    return grillaTodas.filter((f) => [...f.celdas.values()].some((c) => idsSel.has(c.filaId)));
  }, [grillaTodas, idsSel]);

  const totales = useMemo(() => ({
    articulos: filas.length,
    valores: grupos.filter((g) => g.modoPrecio === 'markup').length,
    aMano: grupos.filter((g) => g.modoPrecio === 'precio').reduce((a, g) => a + g.cantidad, 0),
  }), [filas, grupos]);

  const hayFiltro = !!(q || marca || categoria || proveedorId || estadoF !== 'vigentes');
  const limpiar = () => {
    setQ(''); setMarca(''); setCategoria(''); setProveedorId(''); setEstadoF('vigentes');
    setGrupoSel(null);
  };

  const pag = usePaginado(
    grilla,
    'margenes',
    `${q}|${marca}|${categoria}|${proveedorId}|${estadoF}|${grupoSel ?? ''}`,
  );

  /**
   * CAMBIAR TODO UN GRUPO DE UNA. El alcance viaja como los ids de las filas
   * exactas, no como "estos productos": un producto puede estar al 40% suelto
   * y al 55% en su paquete de 500 g, y mandar el producto movería las dos.
   */
  const cambiarGrupo = (g) => openModal('margenesMasivos', {
    productos,
    soloFilas: new Set(g.filaIds),
    listaInicial: g.lista,
    contexto: `${num(g.cantidad, 0)} artículo(s) al ${etiquetaValor(g)} en ${g.lista}`,
  });

  const exportar = () => descargarCsv(
    'margenes.csv',
    ['Producto', 'Forma', 'Marca', 'Categoría', 'Costo', ...columnas.map((c) => c.lista)],
    grilla.map((f) => [
      f.producto, f.forma, f.marca, f.categoria, csvNum(f.costo),
      ...columnas.map((c) => {
        const celda = f.celdas.get(c.listaId);
        if (!celda) return '';
        return celda.modoPrecio === 'precio' ? 'precio definido' : csvNum(celda.markup, 1);
      }),
    ]),
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Márgenes"
        desc="Qué markup tiene cada producto en cada lista, sin entrar uno por uno. Clic en un valor para ver quiénes lo tienen."
        actions={(
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn small onClick={exportar} disabled={!grilla.length}>Exportar CSV</Btn>
          </div>
        )}
      />

      <div className={s.stats}>
        <Stat label="Artículos con precio" value={num(totales.articulos, 0)} />
        <Stat label="Listas" value={num(columnas.length, 0)} />
        <Stat label="Markups distintos" value={num(totales.valores, 0)} />
        {/* El precio puesto a mano no sigue ningún markup: si son muchos, el
            mapa de márgenes explica menos de lo que parece. Por eso se cuenta. */}
        <Stat label="Con precio a mano" value={num(totales.aMano, 0)} accent={totales.aMano ? 'accent-amber' : undefined} />
      </div>

      <div className={s.toolbar}>
        <input type="search" placeholder="Buscar por nombre, marca o categoría..." value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={s['select-inline']} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          <option value="">Todas las categorías</option>
          {opciones.categorias.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className={s['select-inline']} value={marca} onChange={(e) => setMarca(e.target.value)}>
          <option value="">Todas las marcas</option>
          {opciones.marcas.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select className={s['select-inline']} value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
          <option value="">Todos los proveedores</option>
          {store.state.proveedores
            .filter((p) => p.proveeMercaderia !== false)
            .map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        <select className={s['select-inline']} value={estadoF} onChange={(e) => setEstadoF(e.target.value)}>
          <option value="vigentes">En juego (activos + discontinuados)</option>
          <option value="activo">Solo activos</option>
          <option value="discontinuado">Solo discontinuados</option>
          <option value="archivado">Solo archivados</option>
          <option value="">Todos, incluso archivados</option>
        </select>
        {hayFiltro && <Btn small onClick={limpiar}>Limpiar</Btn>}
      </div>

      {/* ------------------------- 1. EL RESUMEN ------------------------- */}
      {resumen.length === 0 ? (
        <div className={cx(s.callout, s.info)}>
          No hay ningún formato de venta cargado con los filtros puestos. El markup se carga en la
          ficha del producto, en <strong>Compras › Productos → Formato de Venta</strong>.
        </div>
      ) : resumen.map((l) => {
        const abierta = desplegadas.has(l.listaId);
        const visibles = abierta ? l.grupos : l.grupos.slice(0, TOPE_VALORES);
        const ocultos = l.grupos.length - visibles.length;
        return (
          <div key={l.listaId} className={cx(s.card, s.cardPad)}>
            <div className={s['card-title']}>
              {l.lista}
              <span className={s.muted} style={{ fontWeight: 400 }}>
                {' · '}{num(l.total, 0)} artículo(s){l.modalidad ? ` · ${l.modalidad}` : ''}
              </span>
            </div>
            {visibles.map((g) => {
              const activo = g.clave === grupoSel;
              const ancho = l.mayor > 0 ? Math.max(2, Math.round((g.cantidad / l.mayor) * 100)) : 0;
              return (
                <div
                  key={g.clave}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '5px 6px',
                    borderRadius: 6, cursor: 'pointer',
                    background: activo ? 'var(--crm-color-surface-2, rgba(0,0,0,.05))' : undefined,
                  }}
                  onClick={() => setGrupoSel(activo ? null : g.clave)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setGrupoSel(activo ? null : g.clave); } }}
                  title={`Ver los ${g.cantidad} artículos`}
                >
                  <strong style={{ minWidth: 104, fontVariantNumeric: 'tabular-nums' }}>
                    {etiquetaValor(g)}
                  </strong>
                  {/* La barra es comparativa DENTRO de su lista: lo que se lee
                      de un vistazo es cuál es el markup dominante. */}
                  <span style={{ flex: '0 0 42%', height: 10, borderRadius: 5, background: 'var(--crm-color-border, rgba(0,0,0,.08))', overflow: 'hidden' }}>
                    <span style={{
                      display: 'block', width: `${ancho}%`, height: '100%', borderRadius: 5,
                      background: g.modoPrecio === 'precio' ? 'var(--crm-color-accent-2)' : 'var(--crm-color-primary, #2e7d32)',
                    }}
                    />
                  </span>
                  <span style={{ minWidth: 150, fontVariantNumeric: 'tabular-nums' }}>
                    {num(g.cantidad, 0)} artículo(s)
                    {g.productos.size !== g.cantidad && (
                      <span className={s.muted}>{` · ${num(g.productos.size, 0)} producto(s)`}</span>
                    )}
                  </span>
                  {isAdmin && g.modoPrecio === 'markup' && (
                    <Btn small onClick={(e) => { e.stopPropagation(); cambiarGrupo(g); }}>
                      Cambiar estos {num(g.cantidad, 0)}
                    </Btn>
                  )}
                </div>
              );
            })}
            {ocultos > 0 && (
              <Btn
                small
                onClick={() => setDesplegadas((prev) => {
                  const next = new Set(prev);
                  next.add(l.listaId);
                  return next;
                })}
              >
                Ver los otros {num(ocultos, 0)} valores
              </Btn>
            )}
          </div>
        );
      })}

      {/* ------------------------- 2. LA GRILLA -------------------------- */}
      {seleccionado && (
        <div className={s.chipRow}>
          <span className={s.chip}>
            {seleccionado.lista} · {etiquetaValor(seleccionado)}
            <button type="button" className={s.chipX} onClick={() => setGrupoSel(null)} aria-label="Quitar el filtro del valor">×</button>
          </span>
          <span className={s.hint} style={{ margin: 0 }}>
            Mostrando solo los artículos con ese markup. El resto de la tabla vuelve al quitarlo.
          </span>
        </div>
      )}

      <Table
        cols={[
          { h: 'Producto' }, { h: 'Marca' }, { h: 'Costo', num: true },
          ...columnas.map((c) => ({ h: c.lista, num: true })),
        ]}
        empty="Sin artículos con precio cargado."
        pag={pag}
      >
        {pag.visibles.map((f) => (
          <tr key={f.clave}>
            <td>
              {f.presentacionId ? <span className={s.muted}>↳ </span> : null}
              {f.producto}
              <div className={s.hint} style={{ margin: 0 }}>{f.forma}</div>
            </td>
            <td className={s.muted}>{f.marca}</td>
            <td className={s.num}>{money(f.costo)}</td>
            {columnas.map((c) => {
              const celda = f.celdas.get(c.listaId);
              if (!celda) return <td key={c.listaId} className={cx(s.num, s.muted)}>—</td>;
              const resaltada = idsSel?.has(celda.filaId);
              return (
                <td key={c.listaId} className={s.num}>
                  {celda.modoPrecio === 'precio' ? (
                    <span className={s.badge} title={`Precio puesto a mano: ${money(celda.precioFijo)}`}>a mano</span>
                  ) : (
                    <strong style={resaltada ? { color: 'var(--crm-color-primary, #2e7d32)' } : undefined}>
                      {num(celda.markup, 1)}%
                    </strong>
                  )}
                  {/* El precio final es el control de realidad del markup: un
                      porcentaje suelto no dice si el número de la góndola cierra. */}
                  <div className={s.hint} style={{ margin: 0 }}>{money(celda.precioFinal)}</div>
                </td>
              );
            })}
          </tr>
        ))}
      </Table>
    </div>
  );
}
