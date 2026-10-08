/**
 * MÉTRICAS › PRODUCTOS (2/10/2026)
 * ============================================================================
 * Pedido del dueño: «la métrica por productos y a la vez por categorías y
 * subcategorías». Se recorre como un árbol, con un clic por nivel:
 *
 *     Todas las categorías › Alimentos › Harinas › Harina 000 x 1 kg
 *
 * En cada nivel se ve lo mismo, así se compara sin pensar: cuánto vendió cada
 * parte, qué parte es del nivel y de TODO, contra el período anterior, el
 * margen, la cantidad y cuántos productos activos NO vendieron nada. «Todos los
 * productos» lista los productos del nivel de una sola vez, sin bajar. El
 * último nivel es la ficha de un producto: su puesto, sus sucursales, sus
 * paquetes y sus listas.
 *
 * Los filtros de arriba (período, sucursal, agrupar) valen igual que en las
 * otras pestañas; acá se suma «Todo / Solo granel / Solo enteros».
 *
 * PESTAÑA «MARCAS» (7/10/2026): el mismo componente con `porMarca`. Se recorre
 * Todas las marcas › una marca (sus productos) › la ficha del producto.
 */
import { useMemo, useState } from 'react';
import { httpClient } from '@core/services/httpClient.js';
import { useResource } from '@modules/ventas/hooks/useResource.js';
import { cx } from '@shared/utils/classNames.js';
import { descargarCsv, csvNum } from '@shared/utils/csv.js';
import { money, num } from '@modules/productos/domain/format.js';
import { Table, Btn, usePaginado, s } from '@modules/productos/components/ui.jsx';
import { Barras, Columnas } from './graficos.jsx';
import { compacto, etiquetaPeriodo, fechaLarga, nombrePaso, pctTxt, tituloPeriodo } from './formato.js';
import { Aviso, Bloque, Cargando, Grilla, Tile, Tiles, Variacion } from './piezas.jsx';

const TIPOS = [['', 'Todo'], ['granel', 'Solo granel'], ['entero', 'Solo enteros']];
const ORDENES = {
  ventaNeta: 'Más vendido', margen: 'Más ganancia ($)', margenPct: 'Mayor margen (%)', margenPctAsc: 'Menor margen (%)',
  sube: 'Lo que más creció ($)', baja: 'Lo que más cayó ($)', nombre: 'Por nombre',
};
const RAIZ = { categoriaId: null, subcategoriaId: null, marcaId: null, productoId: null, plano: false };

/** Cantidad en su unidad: kg el granel, unidades el resto; un grupo mezcla puede tener las dos. */
function cantidadTxt(x) {
  const partes = [];
  if (Math.abs(x.unidadesEnteros) > 0.0005) partes.push(`${num(x.unidadesEnteros, 0)} u.`);
  if (Math.abs(x.kilosGranel) > 0.0005) partes.push(`${num(x.kilosGranel, x.kilosGranel >= 100 ? 0 : 2)} kg`);
  return partes.join(' · ') || '—';
}
/* Los títulos de las columnas de números van a la DERECHA, sobre sus números (el `num` de la tabla solo alinea el valor). */
const der = (txt) => <span style={{ display: 'block', textAlign: 'right' }}>{txt}</span>;
const NOWRAP = { whiteSpace: 'nowrap' };

const MargenPct = ({ v }) => <strong style={{ color: v != null && v < 0 ? 'var(--crm-color-danger)' : undefined }}>{pctTxt(v)}</strong>;

/** El nombre que abre el nivel de abajo: un botón de verdad (teclado y lector de pantalla), con cara de texto. */
function Enlace({ children, onClick, title }) {
  return (
    <button
      type="button" onClick={onClick} title={title}
      style={{ background: 'none', border: 0, padding: 0, font: 'inherit', fontWeight: 600, color: 'var(--crm-color-text)', cursor: 'pointer', textAlign: 'left', textDecoration: 'underline', textDecorationColor: 'var(--crm-color-border)', textUnderlineOffset: 3 }}
    >{children}</button>
  );
}

/** La barrita de «qué parte es»: el % escrito al lado, así no depende del color. */
function Parte({ p }) {
  if (p == null) return <span className={s.muted}>—</span>;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', minWidth: 90 }}>
      <span aria-hidden="true" style={{ width: 44, height: 6, borderRadius: 3, background: 'var(--crm-color-surface-2, rgba(0,0,0,.06))', overflow: 'hidden' }}>
        <span style={{ display: 'block', height: '100%', width: `${Math.max(2, Math.min(100, p))}%`, background: 'var(--crm-color-primary)' }} />
      </span>
      <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{pctTxt(p)}</strong>
    </span>
  );
}

export function PestanaProductos({ qs, paso, version, porMarca = false }) {
  const [nodo, setNodo] = useState(RAIZ);
  const [tipo, setTipo] = useState('');
  const ir = (n) => setNodo({ ...RAIZ, ...n });

  const qn = `${qs}${tipo ? `&tipo=${tipo}` : ''}`
    + (nodo.productoId ? `&productoId=${nodo.productoId}` : '')
    + (nodo.categoriaId != null ? `&categoriaId=${nodo.categoriaId}` : '')
    + (nodo.subcategoriaId != null ? `&subcategoriaId=${nodo.subcategoriaId}` : '')
    + (nodo.plano ? '&plano=1' : '')
    + (porMarca ? `&porMarca=1${nodo.marcaId != null ? `&marcaId=${nodo.marcaId}` : ''}` : '');
  const { data: d, loading, error } = useResource(`metricas:productos:${qn}:${version}`, () => httpClient.get(`/metricas/productos?${qn}`));

  if (error) return <Aviso tono="warn">{error}</Aviso>;
  if (!d) return <Cargando />;

  const r = d.ruta;
  /* Las migas: cada paso vuelve a ese nivel. «Todos los productos» de una categoría vuelve a su lista de subcategorías. */
  const migas = porMarca
    ? [{ texto: 'Todas las marcas', n: RAIZ }, ...(r.marca ? [{ texto: r.marca.nombre, n: { marcaId: r.marca.id } }] : [])]
    : [{ texto: 'Todas las categorías', n: RAIZ }];
  if (!porMarca) {
    if (r.categoria) migas.push({ texto: r.categoria.nombre, n: { categoriaId: r.categoria.id } });
    if (r.subcategoria && (d.nivel === 'detalle' || !d.plano)) migas.push({ texto: r.subcategoria.nombre, n: { categoriaId: r.categoria?.id ?? 0, subcategoriaId: r.subcategoria.id } });
    if (d.plano) migas.push({ texto: 'Todos los productos', n: null });
  }
  if (r.producto) migas.push({ texto: r.producto.nombre, n: null });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: loading ? 0.6 : 1 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <nav aria-label="Dónde estás" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, fontSize: 14 }}>
          {migas.map((m, i) => {
            const ultima = i === migas.length - 1;
            return (
              <span key={`${i}-${m.texto}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {i > 0 && <span aria-hidden="true" className={s.muted}>›</span>}
                {ultima || !m.n ? <strong aria-current={ultima ? 'page' : undefined}>{m.texto}</strong> : <Enlace onClick={() => ir(m.n)}>{m.texto}</Enlace>}
              </span>
            );
          })}
        </nav>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TIPOS.map(([k, l]) => (
            <Btn key={k || 'todo'} small variant={tipo === k ? 'btn-primary' : 'btn-ghost'} onClick={() => setTipo(k)}>{l}</Btn>
          ))}
        </div>
      </div>
      {tipo && <div className={s.hint} style={{ margin: 0 }}>Todos los números son solo de {tipo === 'granel' ? 'granel (en paquetes y suelto)' : 'enteros'}.</div>}

      {d.nivel === 'detalle'
        ? <DetalleProducto d={d} paso={paso} porMarca={porMarca} />
        : <NivelArbol d={d} paso={paso} ir={ir} porMarca={porMarca} />}
    </div>
  );
}

/* ============================================================================
 * UN NIVEL DEL ÁRBOL: categorías, subcategorías o productos
 * ========================================================================== */
const NOMBRE_NIVEL = { categoria: ['Categoría', 'categorías'], subcategoria: ['Subcategoría', 'subcategorías'], marca: ['Marca', 'marcas'], producto: ['Producto', 'productos'] };

function NivelArbol({ d, paso, ir, porMarca }) {
  const [q, setQ] = useState('');
  const [orden, setOrden] = useState('ventaNeta');
  const t = d.nodo;
  const [uno, varios] = NOMBRE_NIVEL[d.nivel];
  const esProd = d.nivel === 'producto';
  const enRaiz = porMarca ? !d.ruta.marca : !d.ruta.categoria;
  const lugar = porMarca ? d.ruta.marca?.nombre : d.ruta.subcategoria && !d.plano ? d.ruta.subcategoria.nombre : d.ruta.categoria?.nombre;

  const filas = useMemo(() => {
    const txt = q.trim().toLowerCase();
    const base = d.filas.filter((x) => !txt || x.nombre.toLowerCase().includes(txt)
      || (esProd && (`${x.marca} ${x.categoria} ${x.subcategoria}`).toLowerCase().includes(txt)));
    const val = {
      ventaNeta: (x) => x.ventaNeta, margen: (x) => x.margen, margenPct: (x) => x.margenPct ?? -Infinity,
      margenPctAsc: (x) => -(x.margenPct ?? Infinity), sube: (x) => x.diferencia, baja: (x) => -x.diferencia,
    }[orden];
    return [...base].sort(orden === 'nombre' ? (a, b) => a.nombre.localeCompare(b.nombre, 'es') : (a, b) => val(b) - val(a) || b.ventaNeta - a.ventaNeta);
  }, [d, q, orden, esProd]);
  const pag = usePaginado(filas, `metricas-productos-${d.nivel}`, `${q}|${orden}|${d.nivel}|${JSON.stringify(d.ruta)}|${d.plano}|${d.tipo ?? ''}`);

  /** Bajar un nivel desde una fila. */
  const abrir = (x) => {
    if (esProd) return ir({ productoId: x.clave });
    if (d.nivel === 'marca') return ir({ marcaId: x.clave });
    if (d.nivel === 'categoria') return ir({ categoriaId: x.clave });
    return ir({ categoriaId: d.ruta.categoria.id, subcategoriaId: x.clave });
  };

  const exportar = () => descargarCsv(
    `ventas-por-${d.nivel}${lugar ? `-${lugar}` : ''}${d.tipo ? `-solo-${d.tipo}` : ''}-${d.desde}-${d.hasta}.csv`.replace(/[^\w.-]+/g, '-'),
    [uno, ...(esProd ? ['Marca', 'Categoría', 'Subcategoría', 'Tipo'] : []), 'Venta neta', 'Venta anterior', 'Variación %', `% de ${lugar || 'todo'}`, '% del total',
      'Unidades', 'Kg', 'Costo', 'Margen', 'Margen %', 'Veces vendido', ...(esProd ? [] : ['Productos que vendieron', 'Productos sin ventas'])],
    filas.map((x) => [x.nombre, ...(esProd ? [x.marca, x.categoria, x.subcategoria, x.granel ? 'granel' : 'entero'] : []),
      csvNum(x.ventaNeta), csvNum(x.ventaAnterior), x.variacion == null ? '' : csvNum(x.variacion, 1), x.participacion == null ? '' : csvNum(x.participacion, 1),
      x.participacionTotal == null ? '' : csvNum(x.participacionTotal, 1), csvNum(x.unidadesEnteros, 3), csvNum(x.kilosGranel, 3), csvNum(x.costo), csvNum(x.margen),
      x.margenPct == null ? '' : csvNum(x.margenPct, 1), x.renglones, ...(esProd ? [] : [x.productos, x.sinVenta])]),
  );

  const conVenta = d.filas.filter((x) => x.ventaNeta > 0);
  const top = conVenta.slice(0, 10);
  const resto = conVenta.slice(10).reduce((s2, x) => s2 + x.ventaNeta, 0);
  const sinNada = !t.ventaNeta && !t.renglones && !t.ventaAnterior;

  return (
    <>
      <Tiles>
        <Tile label={enRaiz ? 'Vendido en total' : `Vendido en ${lugar}`} valor={money(t.ventaNeta)} variacion={t.variacion} detalle={`Anterior: ${money(t.ventaAnterior)}`} />
        {!enRaiz && <Tile label="Parte de todo lo vendido" valor={pctTxt(t.participacionTotal)} detalle={`De ${money(d.totalGeneral.ventaNeta)} en el período`} />}
        <Tile label="Margen (ganancia bruta)" valor={money(t.margen)} variacion={t.variacionMargen} detalle={`Margen ${pctTxt(t.margenPct)} · antes ${pctTxt(t.margenPctAnterior)}`} />
        <Tile label="Cantidad vendida" valor={cantidadTxt(t)} detalle={`${num(t.renglones, 0)} veces en tickets`} />
        <Tile
          label="Productos" valor={`${num(t.productos, 0)} vendieron`}
          detalle={t.sinVenta ? `${num(t.sinVenta, 0)} activos sin ninguna venta` : 'Todos los activos vendieron algo'}
        />
      </Tiles>
      <div className={s.hint} style={{ margin: 0 }}>
        Venta neta, sin IVA; las notas de crédito restan. Se compara con {fechaLarga(d.anterior.desde)} → {fechaLarga(d.anterior.hasta)}.
        Cada producto cuenta en la {porMarca ? 'marca' : 'categoría'} que tiene <strong>hoy</strong>.
      </div>

      {sinNada ? <Aviso>No hay ventas{lugar ? ` de ${lugar}` : ''} en este período.</Aviso> : (
        <Grilla>
          <Bloque titulo={enRaiz ? 'Lo vendido en el tiempo' : `${lugar} en el tiempo`} sub={`Venta neta por ${nombrePaso(paso)}`}>
            <Columnas
              titulo="Venta neta en el tiempo"
              datos={d.serie.map((x) => ({ etiqueta: etiquetaPeriodo(x.periodo, paso), titulo: tituloPeriodo(x.periodo, paso), valor: x.ventaNeta, detalle: `Margen ${money(x.margen)} · ${pctTxt(x.margenPct)}` }))}
              formato={money}
            />
          </Bloque>
          <Bloque titulo={`Qué parte es cada ${uno.toLowerCase()}`} sub={top.length < conVenta.length ? `Las 10 que más venden y el resto junto` : `De lo vendido${lugar ? ` en ${lugar}` : ''}`}>
            <Barras
              datos={[
                ...top.map((x) => ({ clave: x.clave, etiqueta: x.nombre, valor: x.ventaNeta, p: x.participacion, detalle: `Margen ${pctTxt(x.margenPct)}` })),
                ...(resto > 0 ? [{ clave: 'resto', etiqueta: `Otras ${conVenta.length - 10}`, valor: resto, p: t.ventaNeta ? (resto / t.ventaNeta) * 100 : null }] : []),
              ]}
              formato={compacto}
              sufijo={(x) => `· ${pctTxt(x.p)}`}
            />
          </Bloque>
        </Grilla>
      )}

      <Bloque
        titulo={d.plano ? `Todos los productos${lugar ? ` de ${lugar}` : ''}` : `Por ${uno.toLowerCase()}${lugar ? ` · ${lugar}` : ''}`}
        sub={esProd ? 'Tocá un producto para ver su ficha: puesto, sucursales, paquetes y listas.' : `Tocá una ${uno.toLowerCase()} para ver ${d.nivel === 'categoria' ? 'sus subcategorías' : 'sus productos'}.`}
        acciones={!porMarca && (!esProd || d.plano) ? (
          <Btn small variant="btn-ghost" onClick={() => ir(d.plano
            ? { categoriaId: d.ruta.categoria?.id ?? null }
            : { categoriaId: d.ruta.categoria?.id ?? null, plano: true })}
          >{d.plano ? `Ver por ${d.ruta.categoria ? 'subcategoría' : 'categoría'}` : `Ver todos los productos${lugar ? ` de ${lugar}` : ''}`}</Btn>
        ) : null}
      >
        <div className={s.toolbar} style={{ margin: 0 }}>
          <input type="search" placeholder={`Buscar ${uno.toLowerCase()}${esProd ? (porMarca ? ', categoría o subcategoría' : ', marca o subcategoría') : ''}…`} value={q} onChange={(ev) => setQ(ev.target.value)} style={{ minWidth: 200 }} aria-label={`Buscar ${uno.toLowerCase()}`} />
          <select className={s['select-inline']} value={orden} onChange={(ev) => setOrden(ev.target.value)} aria-label="Ordenar">
            {Object.entries(ORDENES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <Btn small onClick={exportar} disabled={!filas.length}>Exportar CSV</Btn>
          <span className={s.hint} style={{ margin: 0 }}>{num(filas.length, 0)} {varios}</span>
        </div>
        <Table
          cols={[
            { h: uno }, { h: der('Venta neta'), num: true }, { h: der('Contra antes'), num: true },
            { h: der(enRaiz ? '% del total' : `% de ${lugar}`), num: true }, ...(enRaiz ? [] : [{ h: der('% del total'), num: true }]),
            { h: der('Cantidad'), num: true }, { h: der('Margen'), num: true }, { h: der('Margen %'), num: true },
            ...(esProd ? [] : [{ h: der('Productos'), num: true }]),
          ]}
          empty={q ? 'Nada coincide con la búsqueda.' : 'Sin ventas en el período.'}
          pag={pag}
        >
          {pag.visibles.map((x) => {
            const parcial = x.renglones > 0 && x.conCosto < x.renglones;
            return (
              <tr key={x.clave}>
                <td>
                  <Enlace onClick={() => abrir(x)} title={esProd ? 'Ver la ficha del producto' : `Ver ${d.nivel === 'categoria' ? 'sus subcategorías' : 'sus productos'}`}>{x.nombre}</Enlace>
                  {esProd && (
                    <div className={s.hint} style={{ margin: 0 }}>
                      {(porMarca
                        ? [`${x.categoria} › ${x.subcategoria}`, x.granel ? 'granel' : '']
                        : [d.plano ? (d.ruta.categoria ? x.subcategoria : `${x.categoria} › ${x.subcategoria}`) : '', x.marca, x.granel ? 'granel' : '']).filter(Boolean).join(' · ')}
                    </div>
                  )}
                  {parcial && <div className={s.hint} style={{ margin: 0 }} title="Hay renglones vendidos sin costo cargado: no entran al margen">{num(x.renglones - x.conCosto, 0)} renglón(es) sin costo</div>}
                </td>
                <td className={cx(s.num, s.mono)} style={NOWRAP}><strong>{money(x.ventaNeta)}</strong></td>
                <td className={s.num} style={NOWRAP} title={`Antes: ${money(x.ventaAnterior)}`}>
                  {x.variacion != null ? <Variacion valor={x.variacion} contra="" />
                    : x.ventaNeta > 0 && !x.ventaAnterior ? <span className={s.hint} style={{ margin: 0 }}>nuevo</span> : <span className={s.muted}>—</span>}
                </td>
                <td className={s.num}><Parte p={x.participacion} /></td>
                {!enRaiz && <td className={s.num}>{pctTxt(x.participacionTotal)}</td>}
                <td className={cx(s.num, s.mono)} style={NOWRAP}>{cantidadTxt(x)}</td>
                <td className={cx(s.num, s.mono)} style={{ ...NOWRAP, color: x.margen < 0 ? 'var(--crm-color-danger)' : undefined }}>{money(x.margen)}</td>
                <td className={s.num}><MargenPct v={x.margenPct} /></td>
                {!esProd && (
                  <td className={s.num}>
                    {num(x.productos, 0)}
                    {x.sinVenta > 0 && <div className={s.hint} style={{ margin: 0, color: 'var(--crm-color-warning, #b45309)' }}>{num(x.sinVenta, 0)} sin ventas</div>}
                  </td>
                )}
              </tr>
            );
          })}
        </Table>
      </Bloque>

      {esProd && d.sinVentas.length > 0 && <SinVentas lista={d.sinVentas} recortado={d.sinVentasRecortado} total={t.sinVenta} ir={ir} lugar={lugar} />}

      {t.ventaSinCosto > 0.5 && (
        <Aviso tono="warn">{money(t.ventaSinCosto)} de venta no tiene costo cargado al momento de vender: no entra al margen, para no inventar un número.</Aviso>
      )}
    </>
  );
}

/** Los productos activos que no vendieron nada: plegado, porque puede ser una lista larga. */
function SinVentas({ lista, recortado, total, ir, lugar }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <Bloque
      titulo={`${num(total, 0)} producto(s) activos sin ninguna venta${lugar ? ` en ${lugar}` : ''}`}
      sub="En el período y con los filtros de arriba. Puede ser mercadería parada o algo que nadie pide."
      acciones={<Btn small variant="btn-ghost" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto}>{abierto ? 'Ocultar' : 'Ver la lista'}</Btn>}
    >
      {abierto && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {lista.map((x) => (
              <button
                key={x.productoId} type="button" className={s.badge} onClick={() => ir({ productoId: x.productoId })} title="Ver la ficha"
                style={{ cursor: 'pointer', border: '1px solid var(--crm-color-border)', font: 'inherit', fontSize: 12 }}
              >{x.nombre}{x.granel ? ' · granel' : ''}</button>
            ))}
          </div>
          {recortado && <div className={s.hint} style={{ margin: 0 }}>Se muestran los primeros 300, por nombre.</div>}
        </>
      )}
    </Bloque>
  );
}

/* ============================================================================
 * LA FICHA DE UN PRODUCTO
 * ========================================================================== */
const puestoTxt = (p) => (p ? `${num(p.puesto, 0)}.º de ${num(p.de, 0)}` : '—');

function DetalleProducto({ d, paso, porMarca }) {
  const p = d.producto;
  const t = d.nodo;
  const r = d.ruta;
  const unidad = p.granel ? 'kg' : 'unidad';
  const vendio = t.renglones > 0 || Math.abs(t.ventaNeta) > 0.005;
  return (
    <>
      <div className={s.hint} style={{ margin: 0 }}>
        {[p.marca, p.codigo && `Código ${p.codigo}`, p.granel ? 'Granel' : 'Entero', p.estado !== 'activo' && `Estado: ${p.estado}`].filter(Boolean).join(' · ')}
      </div>
      <Tiles>
        <Tile label="Venta neta" valor={money(t.ventaNeta)} variacion={t.variacion} detalle={`Anterior: ${money(t.ventaAnterior)}`} />
        <Tile label="Margen (ganancia bruta)" valor={money(t.margen)} variacion={t.variacionMargen} detalle={`Margen ${pctTxt(t.margenPct)} · antes ${pctTxt(t.margenPctAnterior)}`} />
        <Tile label="Cantidad vendida" valor={cantidadTxt(t)} detalle={`${num(t.renglones, 0)} veces en tickets`} />
        <Tile label={`Precio promedio por ${unidad}`} valor={t.precioPromedio == null ? '—' : money(t.precioPromedio)} detalle="Cobrado, sin IVA" />
        {porMarca ? (
          <Tile
            label="Puesto en ventas" valor={vendio ? puestoTxt(d.puesto.marca) : 'Sin ventas'}
            detalle={vendio ? `en ${d.marca.nombre} · ${puestoTxt(d.puesto.subcategoria)} en ${r.subcategoria?.nombre} · ${puestoTxt(d.puesto.total)} de todo` : 'No vendió en el período'}
            alerta={!vendio}
          />
        ) : (
          <Tile
            label="Puesto en ventas" valor={vendio ? puestoTxt(d.puesto.subcategoria) : 'Sin ventas'}
            detalle={vendio ? `en ${r.subcategoria?.nombre} · ${puestoTxt(d.puesto.categoria)} en ${r.categoria?.nombre} · ${puestoTxt(d.puesto.total)} de todo` : 'No vendió en el período'}
            alerta={!vendio}
          />
        )}
      </Tiles>
      <div className={s.hint} style={{ margin: 0 }}>
        {porMarca
          ? <>Es el {pctTxt(t.participacionMarca)} de lo vendido de {d.marca.nombre} y el {pctTxt(t.participacionTotal)} de todo ({r.categoria?.nombre} › {r.subcategoria?.nombre}).</>
          : <>Es el {pctTxt(t.participacionSubcategoria)} de lo vendido en {r.subcategoria?.nombre}, el {pctTxt(t.participacionCategoria)} de {r.categoria?.nombre} y el {pctTxt(t.participacionTotal)} de todo.</>}{' '}
        Se compara con {fechaLarga(d.anterior.desde)} → {fechaLarga(d.anterior.hasta)}.
      </div>

      {!vendio && !t.ventaAnterior ? <Aviso>Este producto no se vendió en el período ni en el anterior.</Aviso> : (
        <>
          <Grilla>
            <Bloque titulo="Venta en el tiempo" sub={`Por ${nombrePaso(paso)}`}>
              <Columnas
                titulo={`Venta de ${p.nombre} en el tiempo`}
                datos={d.serie.map((x) => ({ etiqueta: etiquetaPeriodo(x.periodo, paso), titulo: tituloPeriodo(x.periodo, paso), valor: x.ventaNeta, detalle: `Margen ${money(x.margen)} · ${pctTxt(x.margenPct)}` }))}
                formato={money}
              />
            </Bloque>
            <Bloque titulo="Por sucursal" sub="Dónde se vende">
              <Barras datos={d.porSucursal.map((x) => ({ clave: x.clave, etiqueta: x.nombre, valor: x.ventaNeta, p: x.participacion, detalle: `${p.granel ? `${num(x.cantidadBase, 2)} kg` : `${num(x.unidades, 0)} u.`} · margen ${pctTxt(x.margenPct)}` }))} formato={compacto} sufijo={(x) => `· ${pctTxt(x.p)}`} />
            </Bloque>
          </Grilla>
          <Grilla>
            <Desglose titulo={p.granel ? 'Cómo se vende: paquetes o suelto' : 'Cómo se vende'} filas={d.porPresentacion} granel={p.granel} />
            <Desglose titulo="Con qué lista de precios" filas={d.porLista} granel={p.granel} />
          </Grilla>
        </>
      )}
      {t.ventaSinCosto > 0.5 && <Aviso tono="warn">{money(t.ventaSinCosto)} de venta no tenía costo cargado al venderse: no entra al margen.</Aviso>}
    </>
  );
}

function Desglose({ titulo, filas, granel }) {
  return (
    <Bloque titulo={titulo}>
      <Table cols={[{ h: '' }, { h: der('Cantidad'), num: true }, { h: der('Venta neta'), num: true }, { h: der('%'), num: true }, { h: der('Margen %'), num: true }]} empty="Sin ventas.">
        {filas.map((x) => (
          <tr key={x.clave}>
            <td>{x.nombre}</td>
            <td className={cx(s.num, s.mono)} style={NOWRAP}>{granel ? `${num(x.cantidadBase, 2)} kg` : `${num(x.unidades, 0)} u.`}{granel && x.clave ? <div className={s.hint} style={{ margin: 0 }}>{num(x.unidades, 0)} paq.</div> : null}</td>
            <td className={cx(s.num, s.mono)} style={NOWRAP}>{money(x.ventaNeta)}</td>
            <td className={s.num}><strong>{pctTxt(x.participacion)}</strong></td>
            <td className={s.num}><MargenPct v={x.margenPct} /></td>
          </tr>
        ))}
      </Table>
    </Bloque>
  );
}
