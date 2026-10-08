/**
 * GERENCIA › MÉTRICAS (0122, 29/9/2026)
 * ============================================================================
 * El tablero del dueño: ventas en el tiempo, rentabilidad de lo vendido,
 * proveedores y listas, y stock que rota o está parado. Solo el superadmin.
 *
 * La pantalla no calcula nada pesado: la API lee tablas resumen que se
 * mantienen solas cada 10 minutos (ver `crm-api/src/metricas`). Arriba se ve
 * «Actualizado hace X min» y el botón «Sincronizar» para traer lo último en el
 * momento. Por eso abrir esta pantalla no frena a ninguna caja.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { httpClient } from '@core/services/httpClient.js';
import { useResource } from '@modules/ventas/hooks/useResource.js';
import { cx } from '@shared/utils/classNames.js';
import { descargarCsv, csvNum } from '@shared/utils/csv.js';
import { money, num } from '@modules/productos/domain/format.js';
import { Table, PanelHead, Btn, usePaginado, s } from '@modules/productos/components/ui.jsx';
import { Barras, Columnas } from './graficos.jsx';
import {
  DIAS_SEMANA, MEDIOS, PRESETS, compacto, etiquetaPeriodo, fechaLarga, haceCuanto, nombrePaso, pasoPara, pctTxt, rangoDe, tituloPeriodo,
} from './formato.js';
import { Aviso, Bloque, Cargando, Grilla, Tile, Tiles } from './piezas.jsx';
import { PestanaGranel } from './PestanaGranel.jsx';
import { PestanaComparar } from './PestanaComparar.jsx';
import { PestanaProductos } from './PestanaProductos.jsx';
import { PestanaIva } from './PestanaIva.jsx';

/* ============================================================================
 * EL PANEL
 * ========================================================================== */
const PESTANAS = [
  ['ventas', 'Ventas'], ['productos', 'Productos y categorías'], ['marcas', 'Marcas'], ['comparar', 'Comparar fechas'], ['granel', 'Granel y enteros'], ['rentabilidad', 'Rentabilidad'],
  ['proveedores', 'Proveedores y listas'], ['stock', 'Stock'], ['iva', 'Resultados IVA'],
];

export function MetricasPanel({ pestanaInicial = 'ventas' } = {}) {
  const [pestana, setPestana] = useState(pestanaInicial);
  /** Rentabilidad: todo, solo granel o solo enteros. Vive acá para que «Ver todos» desde Granel llegue filtrado. */
  const [tipoRent, setTipoRent] = useState('');
  const [preset, setPreset] = useState('mes');
  const [manual, setManual] = useState(() => rangoDe('mes'));
  const [desde, hasta] = preset === 'otro' ? manual : rangoDe(preset);
  const [sucursalId, setSucursalId] = useState('');
  const [pasoElegido, setPasoElegido] = useState('');
  const paso = pasoElegido || pasoPara(desde, hasta);
  const [version, setVersion] = useState(0);

  const sucs = useResource('metricas:sucursales', () => httpClient.get('/metricas/sucursales'));
  const estado = useResource(`metricas:estado:${version}`, () => httpClient.get('/metricas/estado'));
  const [sincronizando, setSincronizando] = useState(false);
  const [msgSync, setMsgSync] = useState(null);
  const enVuelo = useRef(false);

  const sincronizar = async () => {
    if (enVuelo.current) return;
    enVuelo.current = true; setSincronizando(true); setMsgSync(null);
    try {
      const r = await httpClient.post('/metricas/sincronizar', { modo: 'reciente' });
      setMsgSync({ tono: 'ok', texto: `Actualizado en ${num((r.ms ?? 0) / 1000, 1)} s.` });
      setVersion((v) => v + 1);
    } catch (e) {
      setMsgSync({ tono: 'warn', texto: e?.data?.message || 'No se pudo sincronizar.' });
    } finally {
      enVuelo.current = false; setSincronizando(false);
    }
  };

  // «hace 3 min» se va actualizando solo.
  const [, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 30_000); return () => clearInterval(t); }, []);

  const qs = `desde=${desde}&hasta=${hasta}${sucursalId ? `&sucursalId=${sucursalId}` : ''}&paso=${paso}`;
  const e = estado.data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)', minWidth: 0 }}>
      <PanelHead
        title="Métricas"
        desc="Ventas, productos y categorías, marcas, comparación de fechas, granel y enteros, rentabilidad, proveedores y stock. Se actualiza solo cada 10 minutos; con «Sincronizar» traés lo último en el momento."
        actions={(
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span className={s.hint} style={{ margin: 0 }} title={e?.ultimaOk ? new Date(e.ultimaOk).toLocaleString('es-AR') : ''}>
              {e?.corriendo ? 'Actualizando…' : `Actualizado ${haceCuanto(e?.ultimaOk)}`}
            </span>
            <Btn variant="btn-primary" disabled={sincronizando} onClick={sincronizar}>{sincronizando ? 'Sincronizando…' : 'Sincronizar'}</Btn>
          </div>
        )}
      />
      {e?.error && <Aviso tono="warn"><strong>La última actualización falló:</strong> {e.error}</Aviso>}
      {e?.vacio && !e?.error && <Aviso>Las métricas se están armando por primera vez con toda la historia. Tarda unos segundos: apretá «Sincronizar» o volvé en un momento.</Aviso>}
      {e?.tiposCambiaron && !e?.vacio && (
        <Aviso>Cambió el tipo (granel o entero) de algún producto: en unos minutos se reacomoda toda la historia sola, para que granel y enteros usen la misma clasificación en todos los días.</Aviso>
      )}
      {msgSync && <Aviso tono={msgSync.tono}>{msgSync.texto}</Aviso>}

      {/* Filtros: una sola fila, arriba de todo, valen para todas las pestañas. */}
      <div className={s.toolbar} style={{ margin: 0 }}>
        {pestana !== 'stock' && (
          <select className={s['select-inline']} value={preset} onChange={(ev) => { const v = ev.target.value; if (v === 'otro') setManual([desde, hasta]); setPreset(v); }} aria-label={pestana === 'comparar' ? 'Período A' : 'Período'}>
            {PRESETS.map(([k, l]) => <option key={k} value={k}>{pestana === 'comparar' ? `A: ${l}` : l}</option>)}
          </select>
        )}
        {preset === 'otro' && pestana !== 'stock' && (
          <>
            <input type="date" value={manual[0]} max={manual[1]} onChange={(ev) => setManual([ev.target.value, manual[1]])} aria-label="Desde" />
            <input type="date" value={manual[1]} min={manual[0]} onChange={(ev) => setManual([manual[0], ev.target.value])} aria-label="Hasta" />
          </>
        )}
        <select className={s['select-inline']} value={sucursalId} onChange={(ev) => setSucursalId(ev.target.value)} aria-label="Sucursal">
          <option value="">Todas las sucursales</option>
          {(sucs.data ?? []).map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
        </select>
        {pestana !== 'stock' && (
          <select className={s['select-inline']} value={pasoElegido} onChange={(ev) => setPasoElegido(ev.target.value)} aria-label="Agrupar por">
            <option value="">Agrupar: automático ({nombrePaso(paso)})</option>
            <option value="dia">Por día</option>
            <option value="semana">Por semana</option>
            <option value="mes">Por mes</option>
          </select>
        )}
        <span className={s.hint} style={{ margin: 0 }}>{pestana === 'stock' ? 'Stock de hoy' : `${fechaLarga(desde)} → ${fechaLarga(hasta)}`}</span>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} role="tablist">
        {PESTANAS.map(([id, label]) => (
          <button
            key={id} type="button" role="tab" aria-selected={pestana === id} className={s.badge} onClick={() => setPestana(id)}
            style={{
              cursor: 'pointer', padding: '7px 14px', fontSize: 13, border: '1px solid var(--crm-color-border)',
              ...(pestana === id ? { background: 'var(--crm-color-primary)', color: 'var(--crm-color-primary-contrast)', borderColor: 'var(--crm-color-primary)' } : {}),
            }}
          >{label}</button>
        ))}
      </div>

      {pestana === 'ventas' && <PestanaVentas qs={qs} paso={paso} version={version} />}
      {pestana === 'productos' && <PestanaProductos key="productos" qs={qs} paso={paso} version={version} />}
      {pestana === 'marcas' && <PestanaProductos key="marcas" qs={qs} paso={paso} version={version} porMarca />}
      {pestana === 'comparar' && <PestanaComparar desde={desde} hasta={hasta} sucursalId={sucursalId} paso={paso} version={version} />}
      {pestana === 'granel' && (
        <PestanaGranel qs={qs} paso={paso} version={version} onVerTodos={(t) => { setTipoRent(t); setPestana('rentabilidad'); }} />
      )}
      {pestana === 'rentabilidad' && <PestanaRentabilidad qs={qs} paso={paso} version={version} tipo={tipoRent} setTipo={setTipoRent} />}
      {pestana === 'proveedores' && <PestanaProveedores qs={qs} version={version} />}
      {pestana === 'stock' && <PestanaStock sucursalId={sucursalId} version={version} />}
      {/* Resultados IVA (3/10/2026): con y sin factura, y la posición de IVA mes a mes. */}
      {pestana === 'iva' && <PestanaIva qs={qs} version={version} />}
    </div>
  );
}

/* ============================================================================
 * VENTAS EN EL TIEMPO
 * ========================================================================== */
function PestanaVentas({ qs, paso, version }) {
  const { data: d, loading, error } = useResource(`metricas:ventas:${qs}:${version}`, () => httpClient.get(`/metricas/ventas?${qs}`));
  if (error) return <Aviso tono="warn">{error}</Aviso>;
  if (!d) return <Cargando />;
  const t = d.totales;
  const sinVentas = t.tickets === 0 && t.ventaNeta === 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: loading ? 0.6 : 1 }}>
      <Tiles>
        <Tile label="Venta neta (sin IVA)" valor={money(t.ventaNeta)} variacion={t.variacionVenta} detalle={`Anterior: ${money(d.anterior.ventaNeta)}`} />
        <Tile label="Tickets" valor={num(t.tickets, 0)} variacion={t.variacionTickets} detalle={t.notas ? `${num(t.notas, 0)} nota(s) de crédito o devoluciones` : undefined} />
        <Tile label="Ticket promedio" valor={money(t.ticketPromedio)} detalle={`Anterior: ${money(d.anterior.ticketPromedio)}`} />
        <Tile label="Promedio por día con venta" valor={money(t.promedioPorDia)} detalle={`${num(t.diasConVenta, 0)} día(s) con ventas`} />
        <Tile label="Total cobrado (con IVA)" valor={money(t.total)} />
      </Tiles>
      <div className={s.hint} style={{ margin: 0 }}>
        Se compara con {fechaLarga(d.anterior.desde)} → {fechaLarga(d.anterior.hasta)}, el período anterior del mismo largo.
        Las notas de crédito y devoluciones restan; las anuladas y los borradores no cuentan.
      </div>
      {sinVentas ? <Aviso>No hay ventas en este período.</Aviso> : (
        <>
          <Bloque titulo="Venta neta en el tiempo" sub={`Por ${paso === 'dia' ? 'día' : paso}`}>
            <Columnas
              titulo="Venta neta en el tiempo"
              datos={d.serie.map((x) => ({ etiqueta: etiquetaPeriodo(x.periodo, paso), titulo: tituloPeriodo(x.periodo, paso), valor: x.ventaNeta, detalle: `${num(x.tickets, 0)} tickets · promedio ${money(x.ticketPromedio)}` }))}
              formato={money}
            />
          </Bloque>
          <Grilla>
            <Bloque titulo="Por sucursal" sub="Venta neta y participación">
              <Barras datos={d.porSucursal.map((x) => ({ clave: x.sucursalId, etiqueta: x.nombre, valor: x.ventaNeta, detalle: `${num(x.tickets, 0)} tickets · promedio ${money(x.ticketPromedio)}`, p: x.participacion }))} formato={compacto} sufijo={(x) => `· ${pctTxt(x.p)}`} />
            </Bloque>
            <Bloque titulo="Cómo se cobra" sub="Por medio de pago">
              <Barras datos={d.porMedio.map((x) => ({ clave: x.medio, etiqueta: MEDIOS[x.medio] ?? x.medio, valor: x.importe, detalle: `${num(x.cantidad, 0)} cobros` }))} formato={compacto} />
            </Bloque>
          </Grilla>
          <Grilla>
            <Bloque titulo="A qué hora se vende" sub="Tickets por hora del día (hora argentina)">
              <Columnas
                titulo="Tickets por hora"
                datos={Array.from({ length: 24 }, (_, h) => h).filter((h) => h >= 6 || d.porHora.some((x) => x.hora === h)).map((h) => {
                  const x = d.porHora.find((y) => y.hora === h);
                  return { etiqueta: `${h}`, titulo: `${h}:00 a ${h}:59`, valor: x?.tickets ?? 0, detalle: x ? `Venta ${money(x.ventaNeta)}` : 'Sin ventas' };
                })}
                formato={(v) => `${num(v, 0)} tickets`}
                alto={200}
              />
            </Bloque>
            <Bloque titulo="Qué día de la semana" sub="Venta promedio por día (así no pesa que un mes tenga más lunes)">
              <Columnas
                titulo="Venta promedio por día de la semana"
                datos={[1, 2, 3, 4, 5, 6, 7].map((dw) => {
                  const x = d.porDiaSemana.find((y) => y.dia === dw);
                  return { etiqueta: DIAS_SEMANA[dw], valor: x?.promedioPorDia ?? 0, detalle: x ? `${num(x.dias, 0)} día(s) · ${num(x.tickets, 0)} tickets` : 'Sin ventas' };
                })}
                formato={money}
                alto={200}
                etiquetaCada={1}
              />
            </Bloque>
          </Grilla>
          <Grilla>
            <Bloque titulo="Mejores clientes" sub="Los 10 que más compraron en el período">
              <Table cols={[{ h: 'Cliente' }, { h: 'Tickets', num: true }, { h: 'Venta neta', num: true }, { h: '%', num: true }]} empty="Sin datos.">
                {d.topClientes.map((x) => (
                  <tr key={x.clienteId}><td>{x.nombre}</td><td className={s.num}>{num(x.tickets, 0)}</td><td className={cx(s.num, s.mono)}>{money(x.ventaNeta)}</td><td className={s.num}>{pctTxt(x.participacion)}</td></tr>
                ))}
              </Table>
            </Bloque>
            <Bloque titulo="Quién cobró" sub="Por usuario">
              <Table cols={[{ h: 'Usuario' }, { h: 'Tickets', num: true }, { h: 'Venta neta', num: true }, { h: 'Promedio', num: true }]} empty="Sin datos.">
                {d.porCajero.map((x) => (
                  <tr key={x.usuarioId}><td>{x.nombre}</td><td className={s.num}>{num(x.tickets, 0)}</td><td className={cx(s.num, s.mono)}>{money(x.ventaNeta)}</td><td className={cx(s.num, s.mono)}>{money(x.ticketPromedio)}</td></tr>
                ))}
              </Table>
            </Bloque>
          </Grilla>
        </>
      )}
    </div>
  );
}

/* ============================================================================
 * RENTABILIDAD Y PROVEEDORES/LISTAS — una tabla de márgenes con lentes
 * ========================================================================== */
const NOMBRE_LENTE = { producto: 'Producto', categoria: 'Categoría', marca: 'Marca', proveedor: 'Proveedor', lista: 'Lista de precios', sucursal: 'Sucursal' };
const ORDENES = { ventaNeta: 'Más vendido', margen: 'Más ganancia ($)', margenPct: 'Mayor margen (%)', margenPctAsc: 'Menor margen (%)' };

function TablaMargenes({ d, lente, conCompras, clave }) {
  const [q, setQ] = useState('');
  const [orden, setOrden] = useState('ventaNeta');
  const filas = useMemo(() => {
    const txt = q.trim().toLowerCase();
    const base = d.filas.filter((x) => !txt || x.nombre.toLowerCase().includes(txt));
    const k = orden === 'margenPctAsc' ? 'margenPct' : orden;
    const dir = orden === 'margenPctAsc' ? 1 : -1;
    return [...base].sort((a, b) => {
      const va = a[k] ?? (dir > 0 ? Infinity : -Infinity); const vb = b[k] ?? (dir > 0 ? Infinity : -Infinity);
      return (va - vb) * dir;
    });
  }, [d, q, orden]);
  const pag = usePaginado(filas, clave, `${q}|${orden}|${lente}|${d.tipo ?? ''}`);
  const exportar = () => descargarCsv(`margenes-por-${lente}${d.tipo ? `-solo-${d.tipo}` : ''}-${d.desde}-${d.hasta}.csv`,
    [NOMBRE_LENTE[lente], ...(lente === 'producto' ? ['Unidades'] : []), 'Venta neta', 'Costo', 'Margen', 'Margen %', 'IVA absorbido', 'Participación %', ...(conCompras ? ['Compras (neto)'] : [])],
    filas.map((x) => [x.nombre, ...(lente === 'producto' ? [csvNum(x.unidades ?? 0, 3)] : []), csvNum(x.ventaNeta), csvNum(x.costo), csvNum(x.margen), x.margenPct == null ? '' : csvNum(x.margenPct, 1), csvNum(x.ivaAbsorbido), x.participacion == null ? '' : csvNum(x.participacion, 1), ...(conCompras ? [x.comprasNeto == null ? '' : csvNum(x.comprasNeto)] : [])]));
  return (
    <>
      <div className={s.toolbar} style={{ margin: 0 }}>
        <input type="search" placeholder={`Buscar ${NOMBRE_LENTE[lente].toLowerCase()}…`} value={q} onChange={(ev) => setQ(ev.target.value)} style={{ minWidth: 200 }} />
        <select className={s['select-inline']} value={orden} onChange={(ev) => setOrden(ev.target.value)} aria-label="Ordenar">
          {Object.entries(ORDENES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <Btn small onClick={exportar} disabled={!filas.length}>Exportar CSV</Btn>
        {d.recortado && <span className={s.hint} style={{ margin: 0 }}>Se muestran los 500 con más venta.</span>}
      </div>
      <Table
        cols={[
          { h: NOMBRE_LENTE[lente] }, ...(lente === 'producto' ? [{ h: 'Unidades', num: true }] : []),
          { h: 'Venta neta', num: true }, { h: 'Costo', num: true }, { h: 'Margen', num: true }, { h: 'Margen %', num: true },
          { h: 'Particip.', num: true }, ...(conCompras ? [{ h: 'Compras', num: true }] : []),
        ]}
        empty="Sin ventas en el período."
        pag={pag}
      >
        {pag.visibles.map((x) => {
          const parcial = x.renglones > 0 && x.conCosto < x.renglones;
          return (
            <tr key={x.clave}>
              <td>
                {x.nombre}
                {parcial && <div className={s.hint} style={{ margin: 0 }} title="Hay renglones vendidos sin costo cargado: no entran al margen">{num(x.renglones - x.conCosto, 0)} renglón(es) sin costo</div>}
              </td>
              {lente === 'producto' && <td className={cx(s.num, s.mono)}>{num(x.unidades ?? 0, 2)}</td>}
              <td className={cx(s.num, s.mono)}>{money(x.ventaNeta)}</td>
              <td className={cx(s.num, s.mono)}>{money(x.costo)}</td>
              <td className={cx(s.num, s.mono)} style={{ color: x.margen < 0 ? 'var(--crm-color-danger)' : undefined }}>{money(x.margen)}</td>
              <td className={s.num}><strong style={{ color: x.margenPct != null && x.margenPct < 0 ? 'var(--crm-color-danger)' : undefined }}>{pctTxt(x.margenPct)}</strong></td>
              <td className={s.num}>{pctTxt(x.participacion)}</td>
              {conCompras && <td className={cx(s.num, s.mono)}>{x.comprasNeto == null ? '—' : money(x.comprasNeto)}</td>}
            </tr>
          );
        })}
      </Table>
    </>
  );
}

function TilesMargen({ t, anterior }) {
  return (
    <Tiles>
      <Tile label="Venta neta" valor={money(t.ventaNeta)} variacion={t.variacionVenta} />
      <Tile label="Costo de lo vendido" valor={money(t.costo)} detalle="El costo congelado en cada venta" />
      <Tile label="Margen (ganancia bruta)" valor={money(t.margen)} variacion={t.variacionMargen} detalle={`Anterior: ${money(anterior.margen)}`} />
      <Tile label="Margen %" valor={pctTxt(t.margenPct)} detalle={`Anterior: ${pctTxt(anterior.margenPct)}`} />
      <Tile label="IVA absorbido" valor={money(t.ivaAbsorbido)} detalle="Por mercadería comprada sin factura" alerta={t.ivaAbsorbido > 0} />
    </Tiles>
  );
}

function AvisoCobertura({ t }) {
  if (!(t.ventaSinCosto > 0.5)) return null;
  return (
    <Aviso tono="warn">
      {money(t.ventaSinCosto)} de venta ({num(t.renglones - t.conCosto, 0)} renglón/es) no tiene costo cargado al momento de vender:
      no entra al margen, para no inventar un número. Se ve en la tabla, producto por producto.
    </Aviso>
  );
}

const TIPOS_RENT = [['', 'Todo'], ['granel', 'Solo granel'], ['entero', 'Solo enteros']];

function PestanaRentabilidad({ qs, paso, version, tipo, setTipo }) {
  const [lente, setLente] = useState('producto');
  const qt = `${qs}&lente=${lente}${tipo ? `&tipo=${tipo}` : ''}`;
  const { data: d, loading, error } = useResource(`metricas:margenes:${qt}:${version}`, () => httpClient.get(`/metricas/margenes?${qt}`));
  if (error) return <Aviso tono="warn">{error}</Aviso>;
  if (!d) return <Cargando />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: loading ? 0.6 : 1 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {TIPOS_RENT.map(([k, l]) => (
          <Btn key={k || 'todo'} small variant={tipo === k ? 'btn-primary' : 'btn-ghost'} onClick={() => setTipo(k)}>{l}</Btn>
        ))}
        {tipo && <span className={s.hint} style={{ margin: 0 }}>Todos los números de abajo son solo de {tipo === 'granel' ? 'granel (en paquetes y suelto)' : 'enteros'}.</span>}
      </div>
      <TilesMargen t={d.totales} anterior={d.anterior} />
      <AvisoCobertura t={d.totales} />
      <Grilla>
        <Bloque titulo="Ganancia en el tiempo" sub={`Margen en $ por ${paso === 'dia' ? 'día' : paso}`}>
          <Columnas titulo="Margen en el tiempo" datos={d.serie.map((x) => ({ etiqueta: etiquetaPeriodo(x.periodo, paso), titulo: tituloPeriodo(x.periodo, paso), valor: x.margen, detalle: `Venta ${money(x.ventaNeta)} · margen ${pctTxt(x.margenPct)}` }))} formato={money} />
        </Bloque>
        <Bloque titulo="Margen % en el tiempo" sub="Si baja con la venta estable, algo se está vendiendo más barato o comprando más caro">
          <Columnas titulo="Margen porcentual en el tiempo" datos={d.serie.map((x) => ({ etiqueta: etiquetaPeriodo(x.periodo, paso), titulo: tituloPeriodo(x.periodo, paso), valor: x.margenPct ?? 0, detalle: x.margenPct == null ? 'Sin ventas con costo' : `Margen ${money(x.margen)}` }))} formato={(v) => `${num(v, 1)}%`} eje={(v) => `${num(v, 0)}%`} />
        </Bloque>
      </Grilla>
      <Bloque
        titulo="Qué deja más plata"
        sub="Margen = venta de los renglones con costo − ese costo. Tocá «Ordenar» para ver los de menor margen."
        acciones={(
          <select className={s['select-inline']} value={lente} onChange={(ev) => setLente(ev.target.value)} aria-label="Ver por">
            {['producto', 'categoria', 'marca'].map((k) => <option key={k} value={k}>Por {NOMBRE_LENTE[k].toLowerCase()}</option>)}
          </select>
        )}
      >
        <TablaMargenes d={d} lente={lente} clave="metricas-rentabilidad" />
      </Bloque>
    </div>
  );
}

function PestanaProveedores({ qs, version }) {
  const [lente, setLente] = useState('proveedor');
  const { data: d, loading, error } = useResource(`metricas:margenes:${qs}:${lente}:${version}`, () => httpClient.get(`/metricas/margenes?${qs}&lente=${lente}`));
  if (error) return <Aviso tono="warn">{error}</Aviso>;
  if (!d) return <Cargando />;
  const conVenta = d.filas.filter((x) => x.ventaNeta !== 0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: loading ? 0.6 : 1 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {['proveedor', 'lista', 'sucursal'].map((k) => (
          <Btn key={k} small variant={lente === k ? 'btn-primary' : 'btn-ghost'} onClick={() => setLente(k)}>Por {NOMBRE_LENTE[k].toLowerCase()}</Btn>
        ))}
      </div>
      <TilesMargen t={d.totales} anterior={d.anterior} />
      <AvisoCobertura t={d.totales} />
      {lente === 'proveedor' && (
        <div className={s.hint} style={{ margin: 0 }}>
          Cada producto cuenta para su <strong>proveedor activo</strong> (el que fija el precio). «Compras» es lo que se le
          facturó en el período (neto, la nota de crédito resta): un proveedor al que le comprás mucho y vendés poco es plata que no está rotando.
        </div>
      )}
      {lente === 'lista' && (
        <div className={s.hint} style={{ margin: 0 }}>Cuánto se vendió y cuánto margen dejó cada lista de precios, con la lista con que se cobró cada renglón.</div>
      )}
      {conVenta.length > 0 && conVenta.length <= 12 && (
        <Bloque titulo={`Margen % por ${NOMBRE_LENTE[lente].toLowerCase()}`} sub="Lo que queda de cada $100 vendidos">
          <Barras datos={conVenta.map((x) => ({ clave: x.clave, etiqueta: x.nombre, valor: x.margenPct ?? 0, detalle: `Venta ${money(x.ventaNeta)} · margen ${money(x.margen)}` }))} formato={(v) => `${num(v, 1)}%`} />
        </Bloque>
      )}
      <Bloque titulo={`Por ${NOMBRE_LENTE[lente].toLowerCase()}`}>
        <TablaMargenes d={d} lente={lente} conCompras={lente === 'proveedor'} clave="metricas-proveedores" />
      </Bloque>
    </div>
  );
}

/* ============================================================================
 * STOCK QUE ROTA Y STOCK PARADO
 * ========================================================================== */
const ESTADOS_STOCK = {
  parado: { label: 'Parado', desc: 'Sin ventas en la ventana elegida', color: 'var(--crm-color-danger)' },
  por_agotarse: { label: 'Por agotarse', desc: 'Menos de 7 días de stock al ritmo actual', color: 'var(--crm-color-warning, #b45309)' },
  sobrestock: { label: 'Sobrestock', desc: 'Más de 180 días de stock al ritmo actual', color: 'var(--crm-color-warning, #b45309)' },
  ok: { label: 'Rota bien', desc: 'Entre 7 y 180 días de stock', color: 'var(--crm-color-success)' },
};

function PestanaStock({ sucursalId, version }) {
  const [ventana, setVentana] = useState(60);
  const [filtro, setFiltro] = useState('');
  const [q, setQ] = useState('');
  const qs = `ventana=${ventana}${sucursalId ? `&sucursalId=${sucursalId}` : ''}`;
  const { data: d, loading, error } = useResource(`metricas:stock:${qs}:${version}`, () => httpClient.get(`/metricas/stock?${qs}`));
  const filas = useMemo(() => {
    const txt = q.trim().toLowerCase();
    return (d?.filas ?? []).filter((x) => (!filtro || x.estado === filtro) && (!txt || x.nombre.toLowerCase().includes(txt) || x.categoria.toLowerCase().includes(txt)));
  }, [d, filtro, q]);
  const pag = usePaginado(filas, 'metricas-stock', `${filtro}|${q}|${ventana}|${sucursalId}`);
  const exportar = useCallback(() => descargarCsv(`stock-rotacion-${d?.hoy}.csv`,
    ['Producto', 'Categoría', 'Marca', 'Unidad', 'Stock', 'Costo u.', 'Valor', `Vendido ${ventana} días`, 'Por día', 'Días de stock', 'Última venta', 'Estado', 'De Coffit'],
    filas.map((x) => [x.nombre, x.categoria, x.marca, x.unidad, csvNum(x.stock, 3), csvNum(x.costoUnitario), csvNum(x.valor), csvNum(x.vendido, 3), csvNum(x.promedioPorDia, 3), x.diasDeStock ?? '', x.ultimaVenta ?? '', ESTADOS_STOCK[x.estado]?.label ?? x.estado, x.deCoffit ? 'sí' : ''])), [d, filas, ventana]);
  if (error) return <Aviso tono="warn">{error}</Aviso>;
  if (!d) return <Cargando />;
  const r = d.resumen;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: loading ? 0.6 : 1 }}>
      <Tiles>
        <Tile label="Plata en mercadería" valor={money(r.valorPropio)} detalle={`${num(r.productosConStock, 0)} artículos con stock · a costo de hoy`} />
        <Tile label="Parado (sin ventas)" valor={money(r.valorParado)} detalle={`${num(r.productosParados, 0)} artículos · ${pctTxt(r.porcentajeParado)} del total`} alerta={r.valorParado > 0} />
        <Tile label="En sobrestock" valor={money(r.valorSobrestock)} detalle="Más de 180 días de stock" alerta={r.valorSobrestock > 0} />
        <Tile label="Por agotarse" valor={num(r.productosPorAgotarse, 0)} detalle="Menos de 7 días de stock" alerta={r.productosPorAgotarse > 0} />
        {r.valorCoffit > 0 && <Tile label="Guardado de Coffit" valor={money(r.valorCoffit)} detalle="Ya se le cargó a Coffit: no suma arriba" />}
      </Tiles>
      <div className={s.hint} style={{ margin: 0 }}>
        El ritmo de venta sale de los últimos
        {' '}<select className={s['select-inline']} value={ventana} onChange={(ev) => setVentana(Number(ev.target.value))} aria-label="Ventana de ventas">
          {[30, 60, 90].map((v) => <option key={v} value={v}>{v} días</option>)}
        </select>.
        {' '}Stock y ventas en kg (granel) o unidades; un paquete de 500 g cuenta 0,5 kg. Valuado al costo de hoy, sin IVA.
      </div>
      {d.porSucursal.length > 1 && (
        <Bloque titulo="Plata en mercadería por sucursal">
          <Barras datos={d.porSucursal.map((x) => ({ clave: x.sucursalId, etiqueta: x.nombre, valor: x.valor, detalle: `${num(x.productos, 0)} artículos` }))} formato={compacto} />
        </Bloque>
      )}
      <Bloque titulo="Artículo por artículo" sub="Ordenados por la plata que tienen parada en stock">
        <div className={s.toolbar} style={{ margin: 0 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Btn small variant={!filtro ? 'btn-primary' : 'btn-ghost'} onClick={() => setFiltro('')}>Todos</Btn>
            {Object.entries(ESTADOS_STOCK).map(([k, v]) => (
              <Btn key={k} small variant={filtro === k ? 'btn-primary' : 'btn-ghost'} onClick={() => setFiltro(k)} title={v.desc}>{v.label}</Btn>
            ))}
          </div>
          <input type="search" placeholder="Buscar producto o categoría…" value={q} onChange={(ev) => setQ(ev.target.value)} style={{ minWidth: 200 }} />
          <Btn small onClick={exportar} disabled={!filas.length}>Exportar CSV</Btn>
        </div>
        <Table
          cols={[{ h: 'Producto' }, { h: 'Stock', num: true }, { h: 'Valor', num: true }, { h: `Vendido ${ventana} d`, num: true }, { h: 'Días de stock', num: true }, { h: 'Última venta' }, { h: 'Estado' }]}
          empty="Nada con estos filtros."
          pag={pag}
        >
          {pag.visibles.map((x) => (
            <tr key={x.productoId}>
              <td>
                {x.nombre}
                <div className={s.hint} style={{ margin: 0 }}>{[x.categoria, x.marca].filter(Boolean).join(' · ') || '—'}{x.deCoffit ? ' · de Coffit' : ''}</div>
              </td>
              <td className={cx(s.num, s.mono)}>{num(x.stock, x.unidad === 'kg' ? 2 : 0)} {x.unidad}</td>
              <td className={cx(s.num, s.mono)}>{money(x.valor)}</td>
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
        {d.recortado && <div className={s.hint} style={{ margin: 0 }}>Se muestran los 1.000 artículos con más plata en stock.</div>}
      </Bloque>
    </div>
  );
}
