/**
 * GERENCIA › MÉTRICAS (0122, 29/9/2026)
 * ============================================================================
 * El tablero del dueño: ventas en el tiempo, rentabilidad de lo vendido,
 * proveedores y listas. Llave `gerencia.metricas`. El stock valorizado se mudó a su
 * propia sección de Gerencia el 17/11/2026 (`panels/stock`).
 *
 * La pantalla no calcula nada pesado: la API lee tablas resumen que se
 * mantienen solas cada 10 minutos (ver `crm-api/src/metricas`). Arriba se ve
 * «Actualizado hace X min» y el botón «Sincronizar» para traer lo último en el
 * momento. Por eso abrir esta pantalla no frena a ninguna caja.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { httpClient } from '@core/services/httpClient.js';
import { useResource } from '@modules/ventas/hooks/useResource.js';
import { cx } from '@shared/utils/classNames.js';
import { descargarCsv, csvNum } from '@shared/utils/csv.js';
import { money, num } from '@modules/productos/domain/format.js';
import { Table, PanelHead, Btn, usePaginado, s } from '@modules/productos/components/ui.jsx';
import { Barras, Columnas, ColumnasMulti } from './graficos.jsx';
import {
  COLOR_A, COLOR_ANTERIOR, DIAS_SEMANA, MEDIOS, PRESETS, compacto, etiquetaPeriodo, fechaLarga, haceCuanto, nombrePaso, parte, pasoPara, pctTxt, rangoAnterior, rangoDe, tituloPeriodo,
} from './formato.js';
import { Aviso, Bloque, Cargando, ConParte, Grilla, Tile, Tiles } from './piezas.jsx';
import { PestanaGranel } from './PestanaGranel.jsx';
import { PestanaComparar } from './PestanaComparar.jsx';
import { PestanaProductos } from './PestanaProductos.jsx';
import { PestanaIva } from './PestanaIva.jsx';
import { PestanaOfertas } from './PestanaOfertas.jsx';
import { PestanaAnterior } from './PestanaAnterior.jsx';
import { PestanaSucursales } from './PestanaSucursales.jsx';
import { DiasAbiertos } from '../DiasAbiertos.jsx';
import { textoDiasContra } from '../actividad.js';

/* ============================================================================
 * EL PANEL
 * ========================================================================== */
/** Las pestañas que se comparan con el período anterior del mismo largo (la línea va debajo de los filtros). */
const CON_ANTERIOR = new Set(['ventas', 'sucursales', 'productos', 'marcas', 'granel']);

const PESTANAS = [
  ['ventas', 'Ventas'], ['sucursales', 'Por días y horas'], ['productos', 'Productos y categorías'], ['marcas', 'Marcas'], ['comparar', 'Comparar fechas'], ['granel', 'Granel y enteros'], ['rentabilidad', 'Rentabilidad'], ['ofertas', 'Ofertas y descuentos'],
  ['proveedores', 'Proveedores y listas'], ['iva', 'Resultados IVA'], ['anterior', 'Sistema anterior'],
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

  /** Sistema anterior va mes a mes: no usa el período ni el agrupado. */
  const sinPeriodo = pestana === 'anterior';
  const qs = `desde=${desde}&hasta=${hasta}${sucursalId ? `&sucursalId=${sucursalId}` : ''}&paso=${paso}`;
  /* El período anterior del mismo largo: lo que la API usa para las variaciones. */
  const [antDesde, antHasta] = rangoAnterior(desde, hasta);
  const qsAnterior = `desde=${antDesde}&hasta=${antHasta}${sucursalId ? `&sucursalId=${sucursalId}` : ''}&paso=${paso}`;
  const e = estado.data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)', minWidth: 0 }}>
      <PanelHead
        title="Métricas"
        desc="Ventas, por días y horas (locales, turnos y horas), productos y categorías, marcas, comparación de fechas, granel y enteros, rentabilidad, ofertas y descuentos, proveedores y el sistema anterior. Se actualiza solo cada 10 minutos; con «Sincronizar» traés lo último en el momento."
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
        {!sinPeriodo && (
          <select className={s['select-inline']} value={preset} onChange={(ev) => { const v = ev.target.value; if (v === 'otro') setManual([desde, hasta]); setPreset(v); }} aria-label={pestana === 'comparar' ? 'Período A' : 'Período'}>
            {PRESETS.map(([k, l]) => <option key={k} value={k}>{pestana === 'comparar' ? `A: ${l}` : l}</option>)}
          </select>
        )}
        {preset === 'otro' && !sinPeriodo && (
          <>
            <input type="date" value={manual[0]} max={manual[1]} onChange={(ev) => setManual([ev.target.value, manual[1]])} aria-label="Desde" />
            <input type="date" value={manual[1]} min={manual[0]} onChange={(ev) => setManual([manual[0], ev.target.value])} aria-label="Hasta" />
          </>
        )}
        <select className={s['select-inline']} value={sucursalId} onChange={(ev) => setSucursalId(ev.target.value)} aria-label="Sucursal">
          <option value="">Todas las sucursales</option>
          {(sucs.data ?? []).map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
        </select>
        {!sinPeriodo && pestana !== 'sucursales' && (
          <select className={s['select-inline']} value={pasoElegido} onChange={(ev) => setPasoElegido(ev.target.value)} aria-label="Agrupar por">
            <option value="">Agrupar: automático ({nombrePaso(paso)})</option>
            <option value="dia">Por día</option>
            <option value="semana">Por semana</option>
            <option value="mes">Por mes</option>
          </select>
        )}
        <span className={s.hint} style={{ margin: 0 }}>{pestana === 'anterior' ? 'Mes a mes' : `${fechaLarga(desde)} → ${fechaLarga(hasta)}`}</span>
      </div>
      {/* Contra qué se compara, DEBAJO DE LOS FILTROS (16/11/2026, pedido del dueño): antes iba entre las tarjetas y los gráficos. */}
      {CON_ANTERIOR.has(pestana) && (
        <div className={s.hint} style={{ margin: '-8px 0 0' }}>
          Se compara con <strong>{fechaLarga(antDesde)} → {fechaLarga(antHasta)}</strong>, el período anterior del mismo largo
          {pestana === 'ventas' ? <> (en los gráficos, <span style={{ color: COLOR_ANTERIOR, fontWeight: 700 }}>en naranja</span>)</> : null}.
        </div>
      )}

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

      {pestana === 'ventas' && <PestanaVentas qs={qs} qsAnterior={qsAnterior} paso={paso} version={version} />}
      {/* Por días y horas (6/11/2026): por local, día por día, por turno y por hora. */}
      {pestana === 'sucursales' && <PestanaSucursales qs={qs} version={version} sucursalId={sucursalId} setSucursalId={setSucursalId} />}
      {pestana === 'productos' && <PestanaProductos key="productos" qs={qs} paso={paso} version={version} />}
      {pestana === 'marcas' && <PestanaProductos key="marcas" qs={qs} paso={paso} version={version} porMarca />}
      {pestana === 'comparar' && <PestanaComparar desde={desde} hasta={hasta} sucursalId={sucursalId} paso={paso} version={version} />}
      {pestana === 'granel' && (
        <PestanaGranel qs={qs} paso={paso} version={version} onVerTodos={(t) => { setTipoRent(t); setPestana('rentabilidad'); }} />
      )}
      {pestana === 'rentabilidad' && <PestanaRentabilidad qs={qs} paso={paso} version={version} tipo={tipoRent} setTipo={setTipoRent} />}
      {/* Ofertas y descuentos (0189): del precio de lista a la venta neta, y si cada oferta es rentable. */}
      {pestana === 'ofertas' && <PestanaOfertas qs={qs} version={version} />}
      {pestana === 'proveedores' && <PestanaProveedores qs={qs} version={version} />}
      {/* Resultados IVA (3/10/2026): con y sin factura, y la posición de IVA mes a mes. */}
      {pestana === 'iva' && <PestanaIva qs={qs} version={version} />}
      {/* Sistema anterior (0213): los meses del sistema viejo contra los del ERP, por local. */}
      {pestana === 'anterior' && <PestanaAnterior sucursalId={sucursalId} sucursales={sucs.data ?? []} version={version} />}
    </div>
  );
}

/* ============================================================================
 * VENTAS EN EL TIEMPO
 * ========================================================================== */
function PestanaVentas({ qs, qsAnterior, paso, version }) {
  const { data: d, loading, error } = useResource(`metricas:ventas:${qs}:${version}`, () => httpClient.get(`/metricas/ventas?${qs}`));
  /*
   * EL PERÍODO ANTERIOR EN LOS GRÁFICOS (16/11/2026, pedido del dueño): el
   * mismo reporte, para las fechas de antes. Va aparte y no frena: si no llega,
   * los gráficos se ven como siempre, sin la barra naranja.
   */
  const { data: ant } = useResource(`metricas:ventas:${qsAnterior}:${version}`, () => httpClient.get(`/metricas/ventas?${qsAnterior}`));
  if (error) return <Aviso tono="warn">{error}</Aviso>;
  if (!d) return <Cargando />;
  const t = d.totales;
  const sinVentas = t.tickets === 0 && t.ventaNeta === 0;
  /* Los % de cada lista se miden contra la suma de esa misma lista: así suman 100. */
  const totalMedios = d.porMedio.reduce((a, x) => a + (Number(x.importe) || 0), 0);
  const totalCajeros = d.porCajero.reduce((a, x) => a + (Number(x.ventaNeta) || 0), 0);
  const totalTicketsHora = d.porHora.reduce((a, x) => a + (Number(x.tickets) || 0), 0);
  const SERIES = [{ nombre: 'Este período', color: COLOR_A }, { nombre: 'Período anterior', color: COLOR_ANTERIOR }];
  const ANTERIOR = ant ? { nombre: 'Período anterior', color: COLOR_ANTERIOR } : undefined;
  const antPor = (lista, clave) => new Map((lista ?? []).map((x) => [x[clave], x]));
  const antSucursal = antPor(ant?.porSucursal, 'sucursalId');
  const antMedio = antPor(ant?.porMedio, 'medio');
  const antHora = antPor(ant?.porHora, 'hora');
  const antDia = antPor(ant?.porDiaSemana, 'dia');
  const antCajero = antPor(ant?.porCajero, 'usuarioId');
  /** «▲ 12,3%» contra el anterior, o «nuevo» si antes no había. */
  const varTxt = (v, a) => {
    if (!ant) return '';
    if (!(Math.abs(Number(a) || 0) > 0.005)) return (Number(v) || 0) > 0 ? 'nuevo' : '—';
    const p = (((Number(v) || 0) - a) / Math.abs(a)) * 100;
    return `${p >= 0 ? '▲' : '▼'} ${num(Math.abs(p), 1)}%`;
  };
  const varColor = (v, a) => (!(Math.abs(Number(a) || 0) > 0.005) ? undefined : (Number(v) || 0) >= a ? 'var(--crm-color-success)' : 'var(--crm-color-danger)');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: loading ? 0.6 : 1 }}>
      <Tiles>
        <Tile label="Venta neta (sin IVA)" valor={money(t.ventaNeta)} variacion={t.variacionVenta} detalle={`Anterior: ${money(d.anterior.ventaNeta)}`} />
        <Tile label="Tickets" valor={num(t.tickets, 0)} variacion={t.variacionTickets} detalle={t.notas ? `${num(t.notas, 0)} nota(s) de crédito o devoluciones` : undefined} />
        <Tile label="Ticket promedio" valor={money(t.ticketPromedio)} detalle={`Anterior: ${money(d.anterior.ticketPromedio)}`} />
        <Tile
          label="Venta por día abierto" valor={money(t.promedioPorDia)} variacion={t.variacionPorDia}
          detalle={[`Anterior: ${money(d.anterior.promedioPorDia)}`, textoDiasContra(t.actividad.abiertos, d.anterior.actividad.abiertos)].filter(Boolean).join(' · ')}
        />
        <Tile label="Total cobrado (con IVA)" valor={money(t.total)} />
      </Tiles>
      <DiasAbiertos a={t.actividad} />
      <div className={s.hint} style={{ margin: 0 }}>
        Las notas de crédito y devoluciones restan; las anuladas y los borradores no cuentan.
      </div>
      {sinVentas ? <Aviso>No hay ventas en este período.</Aviso> : (
        <>
          <Bloque titulo="Venta neta en el tiempo" sub={`Por ${paso === 'dia' ? 'día' : paso}`}>
            {/* Cada barra verde con la naranja del período anterior en la MISMA posición
                (el 1.º día contra el 1.º día de antes, y así). */}
            <ColumnasMulti
              titulo="Venta neta en el tiempo, contra el período anterior"
              series={SERIES} formato={money}
              datos={d.serie.map((x, i) => {
                const a = ant?.serie?.[i];
                return {
                  etiqueta: etiquetaPeriodo(x.periodo, paso), titulo: tituloPeriodo(x.periodo, paso),
                  valores: [x.ventaNeta, a ? a.ventaNeta : null],
                  nombres: [tituloPeriodo(x.periodo, paso), a ? `Antes: ${tituloPeriodo(a.periodo, paso)}` : 'Período anterior'],
                  detalle: `${pctTxt(parte(x.ventaNeta, t.ventaNeta))} del período · ${num(x.tickets, 0)} tickets · promedio ${money(x.ticketPromedio)}${a ? ` · ${varTxt(x.ventaNeta, a.ventaNeta)} vs antes` : ''}`,
                };
              })}
            />
          </Bloque>
          <Grilla>
            <Bloque titulo="Por sucursal" sub="Venta neta y participación">
              <Barras anterior={ANTERIOR} datos={d.porSucursal.map((x) => ({ clave: x.sucursalId, etiqueta: x.nombre, valor: x.ventaNeta, anterior: antSucursal.get(x.sucursalId)?.ventaNeta ?? 0, detalle: `${num(x.tickets, 0)} tickets · promedio ${money(x.ticketPromedio)}${x.diasAbiertos ? ` · abrió ${x.diasAbiertos} días` : ''}`, p: x.participacion }))} formato={compacto} sufijo={(x) => `· ${pctTxt(x.p)}`} />
            </Bloque>
            <Bloque titulo="Cómo se cobra" sub="Por medio de pago">
              <Barras anterior={ANTERIOR} datos={d.porMedio.map((x) => ({ clave: x.medio, etiqueta: MEDIOS[x.medio] ?? x.medio, valor: x.importe, anterior: antMedio.get(x.medio)?.importe ?? 0, p: parte(x.importe, totalMedios), detalle: `${num(x.cantidad, 0)} cobros` }))} formato={compacto} sufijo={(x) => `· ${pctTxt(x.p)}`} />
            </Bloque>
          </Grilla>
          <Grilla>
            <Bloque titulo="A qué hora se vende" sub="Tickets por hora del día (hora argentina)">
              <ColumnasMulti
                titulo="Tickets por hora, contra el período anterior"
                series={SERIES}
                datos={Array.from({ length: 24 }, (_, h) => h).filter((h) => h >= 6 || d.porHora.some((x) => x.hora === h) || antHora.has(h)).map((h) => {
                  const x = d.porHora.find((y) => y.hora === h);
                  const a = antHora.get(h);
                  return {
                    etiqueta: `${h}`, titulo: `${h}:00 a ${h}:59`, valores: [x?.tickets ?? 0, ant ? (a?.tickets ?? 0) : null],
                    detalle: x ? `${pctTxt(parte(x.tickets, totalTicketsHora))} de los tickets · venta ${money(x.ventaNeta)}` : 'Sin ventas',
                  };
                })}
                formato={(v) => `${num(v, 0)} tickets`}
                alto={200}
              />
            </Bloque>
            <Bloque titulo="Qué día de la semana" sub="Venta promedio por día (así no pesa que un mes tenga más lunes)">
              <ColumnasMulti
                titulo="Venta promedio por día de la semana, contra el período anterior"
                series={SERIES}
                datos={[1, 2, 3, 4, 5, 6, 7].map((dw) => {
                  const x = d.porDiaSemana.find((y) => y.dia === dw);
                  const a = antDia.get(dw);
                  return {
                    etiqueta: DIAS_SEMANA[dw], valores: [x?.promedioPorDia ?? 0, ant ? (a?.promedioPorDia ?? 0) : null],
                    detalle: x ? `${num(x.dias, 0)} día(s) · ${num(x.tickets, 0)} tickets` : 'Sin ventas',
                  };
                })}
                formato={money}
                alto={200}
                etiquetaCada={1}
              />
            </Bloque>
          </Grilla>
          <Grilla>
            <Bloque titulo="Mejores clientes" sub="Los 10 que más compraron en el período">
              <Table cols={[{ h: 'Cliente' }, { h: 'Tickets', num: true }, { h: 'Venta neta · %', num: true }]} empty="Sin datos.">
                {d.topClientes.map((x) => (
                  <tr key={x.clienteId}><td>{x.nombre}</td><td className={s.num}>{num(x.tickets, 0)}</td><td className={cx(s.num, s.mono)}><ConParte p={x.participacion}>{money(x.ventaNeta)}</ConParte></td></tr>
                ))}
              </Table>
            </Bloque>
            <Bloque titulo="Quién cobró" sub="Por usuario">
              <Table cols={[{ h: 'Usuario' }, { h: 'Tickets', num: true }, { h: 'Venta neta · %', num: true }, { h: 'Promedio', num: true }, ...(ant ? [{ h: 'Vs anterior', num: true }] : [])]} empty="Sin datos.">
                {d.porCajero.map((x) => {
                  const a = antCajero.get(x.usuarioId)?.ventaNeta ?? 0;
                  return (
                    <tr key={x.usuarioId}>
                      <td>{x.nombre}</td><td className={s.num}>{num(x.tickets, 0)}</td>
                      <td className={cx(s.num, s.mono)}><ConParte p={parte(x.ventaNeta, totalCajeros)}>{money(x.ventaNeta)}</ConParte></td>
                      <td className={cx(s.num, s.mono)}>{money(x.ticketPromedio)}</td>
                      {ant && <td className={cx(s.num, s.mono)} style={{ color: varColor(x.ventaNeta, a) }} title={`Antes: ${money(a)}`}>{varTxt(x.ventaNeta, a)}</td>}
                    </tr>
                  );
                })}
              </Table>
            </Bloque>
          </Grilla>
        </>
      )}
      <RetirosSinCosto qs={qs} version={version} />
    </div>
  );
}

/**
 * RETIROS SIN COSTO (0146): lo que se llevaron los socios, a costo real.
 * APARTE de las ventas: no suma a nada de lo de arriba ni resta de la ganancia.
 * Se lee en vivo de `retiros` (pocos documentos), no de las tablas resumen.
 */
function RetirosSinCosto({ qs, version }) {
  const { data: d, error } = useResource(`metricas:retiros:${qs}:${version}`, () => httpClient.get(`/retiros/resumen?${qs}`));
  if (error) return <Aviso tono="warn">{error}</Aviso>;
  if (!d) return null;
  return (
    <Bloque titulo="Retiros sin costo" sub="Lo que se llevaron los socios, a costo real. No son ventas: no suman arriba ni restan de la ganancia."
      acciones={<strong style={{ fontSize: 20, fontVariantNumeric: 'tabular-nums' }}>{money(d.costo)}</strong>}>
      <Table cols={[{ h: 'Quién' }, { h: 'Retiros', num: true }, { h: 'A costo · %', num: true }]} empty="No hubo retiros en este período.">
        {d.porPersona.map((x) => (
          <tr key={x.clienteId}><td>{x.cliente}</td><td className={s.num}>{num(x.retiros, 0)}</td><td className={cx(s.num, s.mono)}><ConParte p={parte(x.costo, d.costo)}>{money(x.costo)}</ConParte></td></tr>
        ))}
      </Table>
    </Bloque>
  );
}

/* ============================================================================
 * RENTABILIDAD Y PROVEEDORES/LISTAS — una tabla de márgenes con lentes
 * ========================================================================== */
const NOMBRE_LENTE = { producto: 'Producto', categoria: 'Categoría', marca: 'Marca', proveedor: 'Proveedor', lista: 'Lista de precios', modalidad: 'Modalidad', sucursal: 'Sucursal' };
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
          { h: 'Venta neta · %', num: true }, { h: 'Costo', num: true }, { h: 'Margen', num: true }, { h: 'Margen %', num: true },
          ...(conCompras ? [{ h: 'Compras', num: true }] : []),
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
              <td className={cx(s.num, s.mono)}><ConParte p={x.participacion} title="Parte de la venta total del período">{money(x.ventaNeta)}</ConParte></td>
              <td className={cx(s.num, s.mono)}>{money(x.costo)}</td>
              <td className={cx(s.num, s.mono)} style={{ color: x.margen < 0 ? 'var(--crm-color-danger)' : undefined }}>{money(x.margen)}</td>
              <td className={s.num}><strong style={{ color: x.margenPct != null && x.margenPct < 0 ? 'var(--crm-color-danger)' : undefined }}>{pctTxt(x.margenPct)}</strong></td>
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
        {['proveedor', 'lista', 'modalidad', 'sucursal'].map((k) => (
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
