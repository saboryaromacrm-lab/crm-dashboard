/**
 * MÉTRICAS › COMPARAR FECHAS (0123, 29/9/2026)
 * ============================================================================
 * Dos períodos lado a lado. A es el período de arriba (el filtro de siempre);
 * B se elige acá: el anterior del mismo largo, hace un año con los mismos días
 * de la semana, las mismas fechas del año pasado, o a mano.
 *
 * Además de los totales, lo que EXPLICA la diferencia: qué sucursal, qué
 * categoría y qué productos subieron o bajaron (por la plata, no por el %).
 * Los gráficos van alineados por posición: el día 1 de A contra el día 1 de B.
 */
import { useMemo, useState } from 'react';
import { httpClient } from '@core/services/httpClient.js';
import { useResource } from '@modules/ventas/hooks/useResource.js';
import { cx } from '@shared/utils/classNames.js';
import { descargarCsv, csvNum } from '@shared/utils/csv.js';
import { money, num } from '@modules/productos/domain/format.js';
import { Table, Btn, usePaginado, s } from '@modules/productos/components/ui.jsx';
import { ColumnasMulti } from './graficos.jsx';
import {
  COLOR_A, COLOR_B, CONTRA, DIAS_SEMANA, MEDIOS, diasDe, etiquetaPeriodo, fechaLarga, nombrePaso, pctTxt, puntosTxt, rangoContra, tituloPeriodo,
} from './formato.js';
import { Aviso, Bloque, Cargando, Grilla, Tile, Tiles } from './piezas.jsx';

const Chip = ({ color, letra }) => (
  <span aria-hidden="true" style={{ display: 'inline-grid', placeItems: 'center', width: 18, height: 18, borderRadius: 4, background: color, color: '#fff', fontSize: 11, fontWeight: 700, marginRight: 6, flex: 'none' }}>{letra}</span>
);

/** Diferencia en $ con flecha, signo y % (nunca el color solo). */
function Dif({ valor, pct }) {
  const sube = valor > 0.005; const baja = valor < -0.005;
  return (
    <span style={{ color: sube ? 'var(--crm-color-success)' : baja ? 'var(--crm-color-danger)' : 'var(--crm-color-text-secondary)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
      {sube ? '▲ +' : baja ? '▼ −' : '= '}{money(Math.abs(valor))}
      {pct != null && <span style={{ color: 'var(--crm-color-text-secondary)' }}> ({pct > 0 ? '+' : ''}{num(pct, 1)}%)</span>}
    </span>
  );
}

export function PestanaComparar({ desde, hasta, sucursalId, paso, version }) {
  const [contra, setContra] = useState('anterior');
  const [manualB, setManualB] = useState(() => rangoContra('anterior', desde, hasta));
  const [bDesde, bHasta] = contra === 'otro' ? manualB : rangoContra(contra, desde, hasta);
  const qs = `desde=${desde}&hasta=${hasta}&bDesde=${bDesde}&bHasta=${bHasta}${sucursalId ? `&sucursalId=${sucursalId}` : ''}&paso=${paso}`;
  const { data: d, loading, error } = useResource(`metricas:comparar:${qs}:${version}`, () => httpClient.get(`/metricas/comparar?${qs}`));
  const nA = diasDe(desde, hasta); const nB = diasDe(bDesde, bHasta);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: loading ? 0.6 : 1 }}>
      <div className={cx(s.card, s.cardPad)} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Chip color={COLOR_A} letra="A" />
          <strong>{fechaLarga(desde)} → {fechaLarga(hasta)}</strong>
          <span className={s.hint} style={{ margin: 0 }}>{num(nA, 0)} día(s) · se cambia con el período de arriba</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Chip color={COLOR_B} letra="B" />
          <select
            className={s['select-inline']} value={contra} aria-label="Comparar contra"
            onChange={(ev) => { const v = ev.target.value; if (v === 'otro') setManualB([bDesde, bHasta]); setContra(v); }}
          >
            {CONTRA.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          {contra === 'otro' ? (
            <>
              <input type="date" value={manualB[0]} max={manualB[1]} onChange={(ev) => ev.target.value && setManualB([ev.target.value, manualB[1]])} aria-label="B desde" />
              <input type="date" value={manualB[1]} min={manualB[0]} onChange={(ev) => ev.target.value && setManualB([manualB[0], ev.target.value])} aria-label="B hasta" />
            </>
          ) : <strong>{fechaLarga(bDesde)} → {fechaLarga(bHasta)}</strong>}
          <span className={s.hint} style={{ margin: 0 }}>{num(nB, 0)} día(s)</span>
        </div>
        {nA !== nB && (
          <div className={s.hint} style={{ margin: 0 }}>
            Los períodos no tienen la misma cantidad de días: para comparar parejo, mirá el <strong>promedio por día</strong> más que los totales.
          </div>
        )}
      </div>

      {error && <Aviso tono="warn">{error}</Aviso>}
      {!d && !error && <Cargando />}
      {d && <Resultado d={d} paso={paso} />}
    </div>
  );
}

function Resultado({ d, paso }) {
  const { a, b, diferencias: df } = d;
  if (!a.tickets && !b.tickets && !a.ventaNeta && !b.ventaNeta) return <Aviso>No hay ventas en ninguno de los dos períodos.</Aviso>;
  const contra = 'vs B';
  return (
    <>
      <Tiles>
        <Tile label="Venta neta" valor={money(a.ventaNeta)} variacion={df.ventaNeta.variacion} contra={contra} detalle={<>B: {money(b.ventaNeta)} · <Dif valor={df.ventaNeta.diferencia} /></>} />
        <Tile label="Tickets" valor={num(a.tickets, 0)} variacion={df.tickets.variacion} contra={contra} detalle={`B: ${num(b.tickets, 0)}`} />
        <Tile label="Ticket promedio" valor={money(a.ticketPromedio)} variacion={df.ticketPromedio.variacion} contra={contra} detalle={`B: ${money(b.ticketPromedio)}`} />
        <Tile label="Promedio por día con venta" valor={money(a.promedioPorDia)} variacion={df.promedioPorDia.variacion} contra={contra} detalle={`B: ${money(b.promedioPorDia)} · ${num(a.diasConVenta, 0)} y ${num(b.diasConVenta, 0)} días`} />
      </Tiles>
      <Tiles>
        <Tile label="Margen (ganancia bruta)" valor={money(a.margen)} variacion={df.margen.variacion} contra={contra} detalle={`B: ${money(b.margen)}`} />
        <Tile label="Margen %" valor={pctTxt(a.margenPct)} detalle={<>B: {pctTxt(b.margenPct)} · {puntosTxt(df.margenPctPuntos)}</>} />
        <Tile label="Granel en el total" valor={pctTxt(a.pctGranel)} detalle={<>B: {pctTxt(b.pctGranel)} · {puntosTxt(df.pctGranelPuntos)}</>} />
        <Tile label="Total cobrado (con IVA)" valor={money(a.total)} variacion={df.total.variacion} contra={contra} detalle={`B: ${money(b.total)}`} />
      </Tiles>
      {(a.ventaSinCosto > 0.5 || b.ventaSinCosto > 0.5) && (
        <div className={s.hint} style={{ margin: 0 }}>
          Hay venta sin costo cargado (A {money(a.ventaSinCosto)} · B {money(b.ventaSinCosto)}): no entra al margen, para no inventar un número.
        </div>
      )}

      <Bloque titulo="Venta neta, A contra B" sub={`Por ${nombrePaso(paso)}, uno al lado del otro: el 1.° de A con el 1.° de B`}>
        <ColumnasMulti
          modo="agrupado"
          titulo="Venta neta del período A contra el B"
          series={[{ nombre: `A · ${fechaLarga(a.desde)} → ${fechaLarga(a.hasta)}`, color: COLOR_A }, { nombre: `B · ${fechaLarga(b.desde)} → ${fechaLarga(b.hasta)}`, color: COLOR_B }]}
          datos={d.serie.map((x) => ({
            etiqueta: x.periodoA ? etiquetaPeriodo(x.periodoA, paso) : `B ${etiquetaPeriodo(x.periodoB, paso)}`,
            titulo: `${paso === 'dia' ? 'Día' : paso === 'semana' ? 'Semana' : 'Mes'} ${x.i + 1}`,
            valores: [x.a, x.b],
            nombres: [`A · ${x.periodoA ? tituloPeriodo(x.periodoA, paso) : '—'}`, `B · ${x.periodoB ? tituloPeriodo(x.periodoB, paso) : '—'}`],
            detalle: x.a != null && x.b != null ? `Diferencia ${x.a - x.b >= 0 ? '+' : '−'}${money(Math.abs(x.a - x.b))}` : undefined,
          }))}
          formato={money}
        />
      </Bloque>

      <Grilla>
        <Bloque titulo="Por sucursal">
          <Table
            cols={[{ h: 'Sucursal' }, { h: 'A', num: true }, { h: 'B', num: true }, { h: 'Diferencia', num: true }]}
            empty="Sin ventas."
          >
            {d.porSucursal.map((x) => (
              <tr key={x.sucursalId}>
                <td>{x.nombre}<div className={s.hint} style={{ margin: 0 }}>{num(x.ticketsA, 0)} y {num(x.ticketsB, 0)} tickets</div></td>
                <td className={cx(s.num, s.mono)}>{money(x.a)}</td>
                <td className={cx(s.num, s.mono)}>{money(x.b)}</td>
                <td className={s.num}><Dif valor={x.diferencia} pct={x.variacion} /></td>
              </tr>
            ))}
          </Table>
        </Bloque>
        <Bloque titulo="Qué día de la semana" sub="Venta promedio por día (así no pesa que un período tenga más sábados)">
          <ColumnasMulti
            modo="agrupado"
            titulo="Venta promedio por día de la semana, A contra B"
            series={[{ nombre: 'A', color: COLOR_A }, { nombre: 'B', color: COLOR_B }]}
            datos={d.porDiaSemana.map((x) => ({
              etiqueta: DIAS_SEMANA[x.dia], valores: [x.a, x.b],
              detalle: `${num(x.diasA, 0)} y ${num(x.diasB, 0)} día(s) con venta${x.variacion != null ? ` · ${x.variacion > 0 ? '+' : ''}${num(x.variacion, 1)}%` : ''}`,
            }))}
            formato={money}
            alto={200}
            etiquetaCada={1}
          />
        </Bloque>
      </Grilla>

      <PorCategoria d={d} />

      <Grilla>
        <Movimientos titulo="Los que más subieron" sub="Productos que más venta sumaron en A" filas={d.productos.suben} />
        <Movimientos titulo="Los que más bajaron" sub="Productos que más venta perdieron en A" filas={d.productos.bajan} />
      </Grilla>

      <Bloque titulo="Cómo se cobra" sub="Por medio de pago, con IVA">
        <Table cols={[{ h: 'Medio' }, { h: 'A', num: true }, { h: 'B', num: true }, { h: 'Diferencia', num: true }]} empty="Sin cobros.">
          {d.porMedio.map((x) => (
            <tr key={x.medio}>
              <td>{MEDIOS[x.medio] ?? x.medio}</td>
              <td className={cx(s.num, s.mono)}>{money(x.a)}</td>
              <td className={cx(s.num, s.mono)}>{money(x.b)}</td>
              <td className={s.num}><Dif valor={x.diferencia} pct={x.variacion} /></td>
            </tr>
          ))}
        </Table>
      </Bloque>
    </>
  );
}

function PorCategoria({ d }) {
  const [q, setQ] = useState('');
  const filas = useMemo(() => {
    const txt = q.trim().toLowerCase();
    return d.porCategoria.filter((x) => !txt || x.nombre.toLowerCase().includes(txt));
  }, [d, q]);
  const pag = usePaginado(filas, 'metricas-comparar-categorias', `${q}|${d.a.desde}|${d.b.desde}`);
  const exportar = () => descargarCsv(`comparar-categorias-A-${d.a.desde}-${d.a.hasta}-B-${d.b.desde}-${d.b.hasta}.csv`,
    ['Categoría', 'Venta A', 'Venta B', 'Diferencia', 'Diferencia %', 'Margen % A', 'Margen % B'],
    filas.map((x) => [x.nombre, csvNum(x.a), csvNum(x.b), csvNum(x.diferencia), x.variacion == null ? '' : csvNum(x.variacion, 1),
      x.margenPctA == null ? '' : csvNum(x.margenPctA, 1), x.margenPctB == null ? '' : csvNum(x.margenPctB, 1)]));
  return (
    <Bloque titulo="Por categoría" sub="Ordenadas por la diferencia más grande: arriba está lo que más explica el cambio">
      <div className={s.toolbar} style={{ margin: 0 }}>
        <input type="search" placeholder="Buscar categoría…" value={q} onChange={(ev) => setQ(ev.target.value)} style={{ minWidth: 200 }} />
        <Btn small onClick={exportar} disabled={!filas.length}>Exportar CSV</Btn>
      </div>
      <Table
        grupos={[{ h: '', span: 1 }, { h: 'Venta neta', span: 3 }, { h: 'Margen %', span: 2 }]}
        cols={[{ h: 'Categoría' }, { h: 'A', num: true }, { h: 'B', num: true }, { h: 'Diferencia', num: true }, { h: 'A', num: true }, { h: 'B', num: true }]}
        empty="Sin ventas."
        pag={pag}
      >
        {pag.visibles.map((x) => (
          <tr key={x.clave}>
            <td>{x.nombre}</td>
            <td className={cx(s.num, s.mono)}>{money(x.a)}</td>
            <td className={cx(s.num, s.mono)}>{money(x.b)}</td>
            <td className={s.num}><Dif valor={x.diferencia} pct={x.variacion} /></td>
            <td className={s.num}>{pctTxt(x.margenPctA)}</td>
            <td className={s.num}>{pctTxt(x.margenPctB)}</td>
          </tr>
        ))}
      </Table>
    </Bloque>
  );
}

function Movimientos({ titulo, sub, filas }) {
  return (
    <Bloque titulo={titulo} sub={sub}>
      <Table cols={[{ h: 'Producto' }, { h: 'A', num: true }, { h: 'B', num: true }, { h: 'Diferencia', num: true }]} empty="Ninguno.">
        {filas.map((x) => (
          <tr key={x.productoId}>
            <td>
              {x.nombre}
              <div className={s.hint} style={{ margin: 0 }}>
                {x.granel ? `${num(x.cantidadA, 2)} kg y ${num(x.cantidadB, 2)} kg` : `${num(x.cantidadA, 0)} u. y ${num(x.cantidadB, 0)} u.`}
              </div>
            </td>
            <td className={cx(s.num, s.mono)}>{money(x.a)}</td>
            <td className={cx(s.num, s.mono)}>{money(x.b)}</td>
            <td className={s.num}><Dif valor={x.diferencia} pct={x.variacion} /></td>
          </tr>
        ))}
      </Table>
    </Bloque>
  );
}
