/**
 * GERENCIA › STOCK VALORIZADO (17/11/2026, pedido del dueño)
 * ============================================================================
 * La plata que hay en mercadería, a costo de hoy y sin IVA. Antes era la
 * pestaña Stock de Métricas; ahora tiene su sección y su llave (`gerencia.stock`).
 * Es la misma cuenta que Proveedores › Montos y la Vista profesional.
 *
 * El local y la ventana de ventas van al servidor (cambian lo vendido y los días
 * de stock). Proveedor, marca, categoría, tipo, clase ABC, estado, búsqueda,
 * orden y agrupado se resuelven acá al instante, y los totales de arriba siguen
 * a esos filtros (ver `stockValorizado.js`). Abajo, las fotos de fin de mes que
 * el servidor guarda cada madrugada (0231).
 */
import { useCallback, useMemo, useState } from 'react';
import { httpClient } from '@core/services/httpClient.js';
import { useResource } from '@modules/ventas/hooks/useResource.js';
import { cx } from '@shared/utils/classNames.js';
import { descargarCsv, csvNum } from '@shared/utils/csv.js';
import { money, num } from '@modules/productos/domain/format.js';
import { Table, PanelHead, Btn, usePaginado, s } from '@modules/productos/components/ui.jsx';
import { Barras } from '../metricas/graficos.jsx';
import { compacto, fechaLarga, nombreMes, parte, pctTxt } from '../metricas/formato.js';
import { Aviso, Bloque, Cargando, ConParte, Grilla, Tile, Tiles } from '../metricas/piezas.jsx';
import { fechaHoraAr } from '@shared/utils/hora.js';
import {
  AGRUPAR, CLASES_ABC, ESTADOS_STOCK, ORDENES_GRUPO,
  agruparStock, conVariacion, filtrarStock, marcarAbc, opcionesStock, ordenarStock, resumirStock, siguienteOrden,
} from './stockValorizado.js';

const articulos = (n) => `${num(n, 0)} artículo${n === 1 ? '' : 's'}`;
const FILTROS_VACIOS = { proveedor: '', marca: '', categoria: '', tipo: '', abc: '', estado: '', falta: '', q: '' };
const VISTAS = { articulos: 'Artículo por artículo', ...Object.fromEntries(Object.entries(AGRUPAR).map(([k, g]) => [k, g.label])) };
const veces = (v) => (v == null ? '—' : `${num(v, 1)} ${v === 1 ? 'vez' : 'veces'}`);
const porPeso = (v) => (v == null ? '—' : money(v));
const cuando = (ts) => fechaHoraAr(ts, {
  timeZone: 'America/Argentina/Buenos_Aires', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit',
});

/** Un desplegable con su etiqueta arriba. */
function Campo({ id, label, valor, onChange, children }) {
  return (
    <label className={s.hint} style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 2 }} htmlFor={id}>
      {label}
      <select id={id} value={valor} onChange={(e) => onChange(e.target.value)} style={{ maxWidth: 220 }}>{children}</select>
    </label>
  );
}

/** Un filtro de lista con «Todos» arriba y «Sin …» al final si hay artículos sin el dato. */
function Filtro({ opciones, sinTexto, ...campo }) {
  return (
    <Campo {...campo}>
      <option value="">Todos</option>
      {opciones.lista.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      {opciones.sin && <option value="0">{sinTexto}</option>}
    </Campo>
  );
}

/** Un aviso de datos que faltan, con el botón que muestra (o deja de mostrar) solo esos artículos. */
function AvisoFalta({ n, activo, onVer, que, detalle }) {
  if (!n) return null;
  return (
    <Aviso tono="warn">
      <strong>{articulos(n)} {que}</strong>{detalle}
      {' '}<button type="button" className={s.linkBtn} onClick={onVer}>{activo ? 'Ver todos' : 'Ver cuáles'}</button>
    </Aviso>
  );
}

/** Las fotos de fin de mes y el detalle de cada una para el contador. */
function FotosFinDeMes({ sucursalId }) {
  const qs = sucursalId ? `?sucursalId=${sucursalId}` : '';
  const { data, error } = useResource(`stock-valorizado:fotos${qs}`, () => httpClient.get(`/stock-valorizado/fotos${qs}`));
  const [bajando, setBajando] = useState('');
  const [errorDetalle, setErrorDetalle] = useState('');
  const meses = useMemo(() => conVariacion(data?.meses ?? []), [data]);

  const descargar = async (dia) => {
    setBajando(dia); setErrorDetalle('');
    try {
      const d = await httpClient.get(`/stock-valorizado/fotos/${dia}`);
      const filas = sucursalId ? d.filas.filter((x) => String(x.sucursalId) === String(sucursalId)) : d.filas;
      descargarCsv(`stock-valorizado-al-${dia}${sucursalId ? `-local-${sucursalId}` : ''}.csv`,
        ['Producto', 'Marca', 'Categoría', 'Local', 'Cantidad', 'Unidad', 'Costo u.', 'Valor'],
        filas.map((x) => [x.nombre, x.marca, x.categoria, x.sucursal, csvNum(x.cantidad, 3), x.unidad,
          csvNum(x.cantidad > 0 ? x.valor / x.cantidad : 0), csvNum(x.valor)]));
    } catch (e) {
      setErrorDetalle(e?.message ?? 'No se pudo bajar el detalle.');
    } finally {
      setBajando('');
    }
  };

  return (
    <Bloque
      titulo="Foto de fin de mes"
      sub="Cada madrugada se guarda el stock valorizado del día que cerró, como quedó: el pasado no se puede rearmar porque los costos cambian. Acá, la última foto de cada mes; el detalle artículo por artículo es el inventario de cierre para el contador."
    >
      {error && <Aviso tono="warn">{error}</Aviso>}
      {errorDetalle && <Aviso tono="warn">{errorDetalle}</Aviso>}
      {data && !meses.length && <div className={s.hint} style={{ margin: 0 }}>Todavía no hay fotos: la primera se guarda esta madrugada, después de las 4.</div>}
      {meses.length > 0 && (
        <Table
          cols={[
            { h: 'Mes' }, { h: 'Plata a costo', num: true }, { h: 'Vs mes anterior', num: true },
            ...(sucursalId ? [] : [{ h: 'Parado', num: true }, { h: 'Artículos', num: true }]),
            { h: 'Foto del' }, { h: 'Detalle' },
          ]}
        >
          {meses.map((m) => (
            <tr key={m.mes}>
              <td>{nombreMes(m.mes)}</td>
              <td className={cx(s.num, s.mono)}>{money(m.valor)}</td>
              <td className={cx(s.num, s.mono)}>{m.variacion == null ? '—' : `${m.variacion > 0 ? '+' : ''}${num(m.variacion, 1)}%`}</td>
              {!sucursalId && <td className={cx(s.num, s.mono)}>{money(m.valorParado)}</td>}
              {!sucursalId && <td className={cx(s.num, s.mono)}>{num(m.articulos, 0)}</td>}
              <td>
                {fechaLarga(m.dia)}
                <div className={s.hint} style={{ margin: 0 }}>guardada el {cuando(m.hechaEn)}</div>
              </td>
              <td>
                {m.conDetalle
                  ? <Btn small variant="btn-ghost" onClick={() => descargar(m.dia)} disabled={!!bajando}>{bajando === m.dia ? 'Bajando…' : 'CSV'}</Btn>
                  : <span className={s.muted}>solo totales</span>}
              </td>
            </tr>
          ))}
        </Table>
      )}
    </Bloque>
  );
}

export function StockValorizadoPanel() {
  const [sucursalId, setSucursalId] = useState('');
  const [ventana, setVentana] = useState(60);
  const [f, setF] = useState(FILTROS_VACIOS);
  const [orden, setOrden] = useState({ col: 'valor', dir: 'desc' });
  const [vista, setVista] = useState('articulos');
  const [ordenGrupo, setOrdenGrupo] = useState({ col: 'valor', dir: 'desc' });
  const poner = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const alternarFalta = (k) => () => setF((x) => ({ ...x, falta: x.falta === k ? '' : k }));

  const { data: sucs } = useResource('stock-valorizado:sucursales', () => httpClient.get('/sucursales'));
  const qs = `ventana=${ventana}${sucursalId ? `&sucursalId=${sucursalId}` : ''}`;
  const { data: d, loading, error } = useResource(`stock-valorizado:${qs}`, () => httpClient.get(`/stock-valorizado?${qs}`));

  const nombreSuc = useMemo(() => {
    const m = new Map((sucs ?? []).map((x) => [x.id, x.nombre]));
    for (const x of d?.porSucursal ?? []) if (!m.has(x.sucursalId)) m.set(x.sucursalId, x.nombre);
    return (id) => m.get(id);
  }, [sucs, d]);
  const todas = useMemo(() => marcarAbc(d?.filas ?? []), [d]);
  const opciones = useMemo(() => opcionesStock(todas), [todas]);
  const filtradas = useMemo(() => filtrarStock(todas, f), [todas, f]);
  const filas = useMemo(() => ordenarStock(filtradas, orden), [filtradas, orden]);
  const grupos = useMemo(
    () => (vista === 'articulos' ? [] : ordenarStock(agruparStock(filtradas, vista), ordenGrupo, ORDENES_GRUPO)),
    [filtradas, vista, ordenGrupo],
  );
  const r = useMemo(() => resumirStock(filtradas, nombreSuc), [filtradas, nombreSuc]);
  const claveFiltros = `${JSON.stringify(f)}|${qs}`;
  const pag = usePaginado(filas, 'gerencia-stock-valorizado', `${claveFiltros}|${orden.col}|${orden.dir}`);
  const pagGrupos = usePaginado(grupos, 'gerencia-stock-valorizado-grupos', `${claveFiltros}|${vista}|${ordenGrupo.col}|${ordenGrupo.dir}`);
  const filtrado = Object.values(f).some(Boolean);

  const exportar = useCallback(() => {
    if (vista !== 'articulos') {
      descargarCsv(`stock-valorizado-por-${vista}-${d?.hoy}.csv`,
        [AGRUPAR[vista].columna, 'Artículos', 'Valor a costo', 'Valor a venta', 'Margen esperando %', 'Parado', 'Rotación (veces por año)', 'Margen 12 meses por $1 de stock'],
        grupos.map((x) => [x.nombre, x.articulos, csvNum(x.valor), csvNum(x.venta), x.margenPotencialPct ?? '', csvNum(x.parado), x.rotacion ?? '', x.rinde ?? '']));
      return;
    }
    descargarCsv(`stock-valorizado-${d?.hoy}.csv`,
      ['Producto', 'Clase ABC', 'Proveedor', 'Marca', 'Categoría', 'Tipo', 'Unidad', 'Stock', 'Costo u.', 'Valor', 'Valor a venta', `Vendido ${ventana} días`, 'Por día', 'Días de stock', 'Margen 12 meses', 'Última venta', 'Estado', 'De Coffit'],
      filas.map((x) => [x.nombre, x.abc ?? '', x.proveedor, x.marca, x.categoria, x.tipo === 'granel' ? 'Granel' : 'Entero', x.unidad, csvNum(x.stock, 3), csvNum(x.costoUnitario), csvNum(x.valor),
        x.valorVenta == null ? '' : csvNum(x.valorVenta), csvNum(x.vendido, 3), csvNum(x.promedioPorDia, 3), x.diasDeStock ?? '', csvNum(x.margenAnio), x.ultimaVenta ?? '',
        ESTADOS_STOCK[x.estado]?.label ?? x.estado, x.deCoffit ? 'sí' : '']));
  }, [d, filas, grupos, vista, ventana]);

  /** Una columna que ordena al tocarla. */
  const col = (h, clave, titulo) => ({
    h, num: clave !== 'nombre', orden: orden.col === clave ? orden.dir : undefined,
    onOrden: () => setOrden((o) => siguienteOrden(o, clave)), titulo: titulo ?? `Ordenar por ${h.toLowerCase()}`,
  });
  const colGrupo = (h, clave, titulo) => ({
    h, num: clave !== 'nombre', orden: ordenGrupo.col === clave ? ordenGrupo.dir : undefined,
    onOrden: () => setOrdenGrupo((o) => siguienteOrden(o, clave, ORDENES_GRUPO)), titulo: titulo ?? `Ordenar por ${h.toLowerCase()}`,
  });
  /** Tocar un grupo: queda filtrado por él y se ven sus artículos. */
  const abrirGrupo = (clave) => { setF((x) => ({ ...x, [vista]: clave })); setVista('articulos'); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <PanelHead
        title="Stock valorizado"
        desc="La plata en mercadería a costo de hoy, sin IVA (la misma cuenta que Proveedores › Montos), y lo que vale al precio de mostrador. Stock y ventas en kg (granel) o unidades; un paquete de 500 g cuenta 0,5 kg."
      />

      <div className={s.toolbar} style={{ margin: 0, alignItems: 'flex-end', flexWrap: 'wrap', gap: 10 }}>
        <Campo id="sv-sucursal" label="Local" valor={sucursalId} onChange={setSucursalId}>
          <option value="">Todos los locales</option>
          {(sucs ?? []).map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
        </Campo>
        <Filtro id="sv-proveedor" label="Proveedor" valor={f.proveedor} onChange={poner('proveedor')} opciones={opciones.proveedores} sinTexto="Sin proveedor" />
        <Filtro id="sv-marca" label="Marca" valor={f.marca} onChange={poner('marca')} opciones={opciones.marcas} sinTexto="Sin marca" />
        <Filtro id="sv-categoria" label="Categoría" valor={f.categoria} onChange={poner('categoria')} opciones={opciones.categorias} sinTexto="Sin categoría" />
        <Campo id="sv-tipo" label="Tipo" valor={f.tipo} onChange={poner('tipo')}>
          <option value="">Granel y enteros</option>
          <option value="entero">Enteros (unidades)</option>
          <option value="granel">Granel (kg)</option>
        </Campo>
        <Campo id="sv-abc" label="Clase ABC" valor={f.abc} onChange={poner('abc')}>
          <option value="">A, B y C</option>
          {Object.entries(CLASES_ABC).map(([k, c]) => <option key={k} value={k} title={c.desc}>{k}</option>)}
        </Campo>
        <Campo id="sv-ventana" label="Ritmo de venta" valor={ventana} onChange={(v) => setVentana(Number(v))}>
          {[30, 60, 90].map((v) => <option key={v} value={v}>Últimos {v} días</option>)}
        </Campo>
        {filtrado && <Btn small variant="btn-ghost" onClick={() => setF(FILTROS_VACIOS)}>Sacar filtros</Btn>}
      </div>

      {error && <Aviso tono="warn">{error}</Aviso>}
      {!d && !error && <Cargando />}
      {d && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: loading ? 0.6 : 1 }}>
          <Tiles>
            <Tile label={filtrado ? 'Plata con estos filtros' : 'Plata en mercadería'} valor={money(r.valor)}
              detalle={`${articulos(r.articulos)} con stock${filtrado && d.resumen.valorPropio > 0 ? ` · ${pctTxt(parte(r.valor, d.resumen.valorPropio))} de ${money(d.resumen.valorPropio)}` : ' · a costo de hoy'}`} />
            <Tile label="A precio de venta" valor={money(r.venta)}
              detalle={r.margenPotencialPct == null ? 'Al precio de mostrador, sin IVA' : `Margen esperando ${money(r.margenPotencial)} · ${pctTxt(r.margenPotencialPct)} de la venta`} />
            <Tile label="Rinde por año" valor={porPeso(r.rinde)}
              detalle={r.rinde == null ? 'Sin stock para medir' : `de margen por cada $ 1 de stock · rota ${veces(r.rotacion)} por año`} />
            <Tile label="Parado (sin ventas)" valor={money(r.parado)} detalle={`${articulos(r.parados)} · ${pctTxt(r.porcentajeParado)} de esta plata`} alerta={r.parado > 0} />
            <Tile label="En sobrestock" valor={money(r.sobrestock)} detalle="Más de 180 días de stock" alerta={r.sobrestock > 0} />
            <Tile label="Por agotarse" valor={num(r.porAgotarse, 0)} detalle="Menos de 7 días de stock" alerta={r.porAgotarse > 0} />
            {r.coffit > 0 && <Tile label="Guardado de Coffit" valor={money(r.coffit)} detalle="Ya se le cargó a Coffit: no suma" />}
          </Tiles>
          <AvisoFalta n={r.sinCosto} activo={f.falta === 'costo'} onVer={alternarFalta('costo')}
            que="con stock y sin costo cargado" detalle=": valen $ 0 acá, así que la plata real es mayor." />
          <AvisoFalta n={r.sinPrecio} activo={f.falta === 'precio'} onVer={alternarFalta('precio')}
            que="con stock y sin precio de venta" detalle=" (el producto o alguno de sus paquetes no tiene formato de venta): no se pueden cobrar y no suman al valor a venta." />

          <Grilla>
            <Bloque titulo="Dónde está la plata (ABC)" sub="De mayor a menor plata: los A juntan el primer 80 %, los B el 15 % que sigue y los C la cola. Elegí la clase arriba para ver cuáles son.">
              <Barras datos={r.abc.map((a) => ({ clave: a.clase, etiqueta: `Clase ${a.clase}`, valor: a.valor, p: parte(a.valor, r.valor), n: a.articulos, detalle: `${articulos(a.articulos)}: ${CLASES_ABC[a.clase].desc}` }))}
                formato={compacto} sufijo={(x) => `· ${pctTxt(x.p)} · ${num(x.n, 0)} art.`} />
            </Bloque>
            {r.porSucursal.length > 1 && (
              <Bloque titulo={filtrado ? 'Plata por local, con estos filtros' : 'Plata en mercadería por local'}>
                <Barras datos={r.porSucursal.map((x) => ({ clave: x.sucursalId, etiqueta: x.nombre, valor: x.valor, p: parte(x.valor, r.valor), detalle: articulos(x.productos) }))}
                  formato={compacto} sufijo={(x) => `· ${pctTxt(x.p)}`} />
              </Bloque>
            )}
          </Grilla>

          <Bloque
            titulo={VISTAS[vista]}
            sub={vista === 'articulos'
              ? 'Tocá el título de una columna para ordenar: la primera vez de mayor a menor, la segunda al revés.'
              : 'Rota: cuántas veces por año se vende lo que hay (costo vendido en 12 meses ÷ stock). Rinde: el margen de 12 meses por cada $ 1 de stock. Tocá un nombre para ver sus artículos.'}
          >
            <div role="group" aria-label="Cómo ver la lista" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {Object.entries(VISTAS).map(([k, label]) => (
                <Btn key={k} small variant={vista === k ? 'btn-primary' : 'btn-ghost'} onClick={() => setVista(k)}>{label}</Btn>
              ))}
            </div>
            <div className={s.toolbar} style={{ margin: 0 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Btn small variant={!f.estado ? 'btn-primary' : 'btn-ghost'} onClick={() => poner('estado')('')}>Todos</Btn>
                {Object.entries(ESTADOS_STOCK).map(([k, v]) => (
                  <Btn key={k} small variant={f.estado === k ? 'btn-primary' : 'btn-ghost'} onClick={() => poner('estado')(k)} title={v.desc}>{v.label}</Btn>
                ))}
              </div>
              <input id="sv-buscar" type="search" placeholder="Buscar producto, marca, categoría o proveedor…" value={f.q} onChange={(ev) => poner('q')(ev.target.value)} style={{ minWidth: 240 }} />
              <Btn small onClick={exportar} disabled={vista === 'articulos' ? !filas.length : !grupos.length}>Exportar CSV</Btn>
            </div>

            {vista === 'articulos' ? (
              <>
                {orden.col === 'stock' && !f.tipo && (
                  <div className={s.hint} style={{ margin: 0 }}>Ojo: ordenar por cantidad mezcla kg con unidades. Elegí <strong>Tipo</strong> para comparar parejo.</div>
                )}
                <Table
                  cols={[
                    col('Producto', 'nombre'), col('Stock', 'stock', 'Ordenar por cantidad'), col('Costo u.', 'costo'), col('Valor · %', 'valor', 'Ordenar por plata'),
                    col('A venta · margen', 'venta', 'Ordenar por valor a precio de venta'),
                    col(`Vendido ${ventana} d`, 'vendido'), col('Días de stock', 'dias'), { h: 'Última venta' }, { h: 'Estado' },
                  ]}
                  empty="Nada con estos filtros."
                  pag={pag}
                >
                  {pag.visibles.map((x) => (
                    <tr key={x.productoId}>
                      {/* Con nueve columnas, el nombre no se aprieta a una palabra por renglón: la tabla se corre de costado. */}
                      <td style={{ minWidth: 220 }}>
                        {x.abc && <span className={s.badge} title={CLASES_ABC[x.abc].desc} style={{ marginRight: 6 }}>{x.abc}</span>}
                        {x.nombre}
                        <div className={s.hint} style={{ margin: 0 }}>
                          {[x.marca, x.categoria, x.proveedor].filter(Boolean).join(' · ') || '—'}{x.deCoffit ? ' · de Coffit' : ''}
                        </div>
                      </td>
                      <td className={cx(s.num, s.mono)}>{num(x.stock, x.unidad === 'kg' ? 2 : 0)} {x.unidad}</td>
                      <td className={cx(s.num, s.mono)}>{x.costoUnitario > 0 ? money(x.costoUnitario) : <span className={s.muted}>sin costo</span>}</td>
                      <td className={cx(s.num, s.mono)}>
                        {/* Lo de Coffit no suma a la plata propia: su % contra ese total confundiría. */}
                        <ConParte p={x.deCoffit ? null : parte(x.valor, r.valor)} title="Parte de la plata de esta lista">{money(x.valor)}</ConParte>
                      </td>
                      <td className={cx(s.num, s.mono)}>
                        {x.valorVenta == null ? <span className={s.muted}>sin precio</span> : (
                          <ConParte p={x.costoUnitario > 0 ? parte(x.valorVenta - x.valor, x.valorVenta) : null} title="Margen sobre la venta">{money(x.valorVenta)}</ConParte>
                        )}
                      </td>
                      <td className={cx(s.num, s.mono)}>{num(x.vendido, x.unidad === 'kg' ? 2 : 0)}</td>
                      <td className={cx(s.num, s.mono)}>{x.diasDeStock == null ? '—' : num(x.diasDeStock, 0)}</td>
                      <td>{x.ultimaVenta ? fechaLarga(x.ultimaVenta) : <span className={s.muted}>más de 2 años o nunca</span>}</td>
                      <td>
                        <span className={s.badge} title={ESTADOS_STOCK[x.estado]?.desc} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 4, background: ESTADOS_STOCK[x.estado]?.color }} />
                          {ESTADOS_STOCK[x.estado]?.label ?? x.estado}
                        </span>
                      </td>
                    </tr>
                  ))}
                </Table>
              </>
            ) : (
              <Table
                cols={[
                  colGrupo(AGRUPAR[vista].columna, 'nombre', 'Ordenar por nombre'),
                  colGrupo('Artículos', 'articulos'), colGrupo('Valor · %', 'valor', 'Ordenar por plata'),
                  colGrupo('A venta', 'venta', 'Ordenar por valor a precio de venta'), colGrupo('Margen esperando', 'margen'),
                  colGrupo('Parado', 'parado'), colGrupo('Rota', 'rotacion', 'Ordenar por rotación'), colGrupo('Rinde por año', 'rinde', 'Ordenar por rendimiento'),
                ]}
                empty="Nada con estos filtros."
                pag={pagGrupos}
              >
                {pagGrupos.visibles.map((x) => (
                  <tr key={x.clave}>
                    <td style={{ minWidth: 200 }}>
                      <button type="button" className={s.linkBtn} style={{ textAlign: 'left' }} onClick={() => abrirGrupo(x.clave)} title="Ver sus artículos">{x.nombre}</button>
                    </td>
                    <td className={cx(s.num, s.mono)}>{num(x.articulos, 0)}</td>
                    <td className={cx(s.num, s.mono)}><ConParte p={parte(x.valor, r.valor)} title="Parte de la plata de esta lista">{money(x.valor)}</ConParte></td>
                    <td className={cx(s.num, s.mono)}>{money(x.venta)}</td>
                    <td className={cx(s.num, s.mono)}>{pctTxt(x.margenPotencialPct)}</td>
                    <td className={cx(s.num, s.mono)}>{x.parado > 0 ? money(x.parado) : '—'}</td>
                    <td className={cx(s.num, s.mono)}>{veces(x.rotacion)}</td>
                    <td className={cx(s.num, s.mono)}>{porPeso(x.rinde)}</td>
                  </tr>
                ))}
              </Table>
            )}
          </Bloque>

          <FotosFinDeMes sucursalId={sucursalId} />
        </div>
      )}
    </div>
  );
}
