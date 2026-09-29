/**
 * MÉTRICAS › GRANEL Y ENTEROS (0123, 29/9/2026)
 * ============================================================================
 * Pedido del dueño: «las ventas de los dos tipos, los fraccionados y los
 * enteros, cada uno con sus métricas, y un total: si un día vendí 100.000 y de
 * granel 60.000, que diga que el 60 % fue de granel».
 *
 *   · Granel  = lo que se fracciona: en paquetes (fraccionado) o suelto al peso.
 *   · Enteros = lo que se vende tal cual entra.
 *
 * Arriba lo que se lee de un vistazo (cuánto y qué parte es cada uno), después
 * el reparto período por período (gráfico + tabla con el % de cada día), el
 * cara a cara con margen, tickets y cantidades, qué lleva cada ticket, las
 * sucursales y los más vendidos de cada lado.
 */
import { useMemo } from 'react';
import { httpClient } from '@core/services/httpClient.js';
import { useResource } from '@modules/ventas/hooks/useResource.js';
import { cx } from '@shared/utils/classNames.js';
import { descargarCsv, csvNum } from '@shared/utils/csv.js';
import { money, num } from '@modules/productos/domain/format.js';
import { Table, Btn, usePaginado, s } from '@modules/productos/components/ui.jsx';
import { ColumnasMulti, Reparto } from './graficos.jsx';
import {
  COLOR_ENTERO, COLOR_GRANEL, etiquetaPeriodo, fechaLarga, nombrePaso, pctTxt, tituloPeriodo,
} from './formato.js';
import { Aviso, Bloque, Cargando, Grilla, Tile, Tiles, Variacion } from './piezas.jsx';

const SERIES = [{ nombre: 'Granel', color: COLOR_GRANEL }, { nombre: 'Enteros', color: COLOR_ENTERO }];
const kg = (v) => `${num(v, v >= 100 ? 0 : 2)} kg`;
const unid = (v) => `${num(v, 0)} u.`;
/** El margen % con su color de alerta si da negativo (se vende por debajo del costo). */
const MargenPct = ({ v }) => <strong style={{ color: v != null && v < 0 ? 'var(--crm-color-danger)' : undefined }}>{pctTxt(v)}</strong>;
const Punto = ({ color }) => <span aria-hidden="true" style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: color, marginRight: 6 }} />;

export function PestanaGranel({ qs, paso, version, onVerTodos }) {
  const { data: d, loading, error } = useResource(`metricas:granel:${qs}:${version}`, () => httpClient.get(`/metricas/granel?${qs}`));
  if (error) return <Aviso tono="warn">{error}</Aviso>;
  if (!d) return <Cargando />;
  const { total: t, granel: g, entero: e } = d;
  if (!t.ventaNeta && !d.tickets) return <Aviso>No hay ventas en este período.</Aviso>;
  const puntos = g.participacion != null && g.anterior.participacion != null ? g.participacion - g.anterior.participacion : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: loading ? 0.6 : 1 }}>
      <div className={s.hint} style={{ margin: 0 }}>
        <strong>Granel</strong> es lo que se fracciona: en paquetes o suelto al peso. <strong>Enteros</strong>, lo que se vende tal cual entra.
        Venta neta, sin IVA; las notas de crédito restan. Se compara con {fechaLarga(d.anterior.desde)} → {fechaLarga(d.anterior.hasta)}.
      </div>

      <Tiles>
        <Tile label="Vendido en total" valor={money(t.ventaNeta)} variacion={t.variacionVenta} detalle={`${num(d.tickets, 0)} tickets`} />
        <Tile
          label="Granel" marca={COLOR_GRANEL} valor={money(g.ventaNeta)} variacion={g.variacionVenta}
          detalle={`${pctTxt(g.participacion)} de lo vendido · margen ${pctTxt(g.margenPct)}`}
        />
        <Tile
          label="Enteros" marca={COLOR_ENTERO} valor={money(e.ventaNeta)} variacion={e.variacionVenta}
          detalle={`${pctTxt(e.participacion)} de lo vendido · margen ${pctTxt(e.margenPct)}`}
        />
        <Tile
          label="Granel en el total" valor={pctTxt(g.participacion)}
          detalle={(
            <>
              Antes {pctTxt(g.anterior.participacion)}{' '}
              {puntos != null && <Variacion valor={puntos} contra="" sufijo=" pts" />}
            </>
          )}
        />
      </Tiles>

      <Bloque titulo="Cómo se reparte lo vendido" sub="De cada $100 vendidos en el período">
        <Reparto alto={18} partes={[{ nombre: 'Granel', valor: g.ventaNeta, color: COLOR_GRANEL }, { nombre: 'Enteros', valor: e.ventaNeta, color: COLOR_ENTERO }]} />
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 13 }}>
          <span><Punto color={COLOR_GRANEL} /><strong>{pctTxt(g.participacion)}</strong> granel · {money(g.ventaNeta)}</span>
          <span><Punto color={COLOR_ENTERO} /><strong>{pctTxt(e.participacion)}</strong> enteros · {money(e.ventaNeta)}</span>
          {g.participacionMargen != null && (
            <span className={s.hint} style={{ margin: 0 }}>
              De la ganancia: granel {pctTxt(g.participacionMargen)}, enteros {pctTxt(e.participacionMargen)}
              {g.participacionMargen > (g.participacion ?? 0) + 1 ? ' — el granel deja más de lo que vende.' : e.participacionMargen > (e.participacion ?? 0) + 1 ? ' — los enteros dejan más de lo que venden.' : '.'}
            </span>
          )}
        </div>
      </Bloque>

      <SerieGranel d={d} paso={paso} />

      <Grilla>
        <Bloque titulo="Cara a cara" sub="Los números de cada lado en el período">
          <CaraACara d={d} />
        </Bloque>
        <Bloque titulo="Qué lleva cada ticket" sub="Un ticket «de los dos» cuenta como que lleva granel y como que lleva enteros">
          <Table cols={[{ h: 'Ticket con…' }, { h: 'Tickets', num: true }, { h: '% tickets', num: true }, { h: 'Promedio', num: true }, { h: 'Antes', num: true }]} empty="Sin tickets.">
            {d.mezcla.map((x) => (
              <tr key={x.mezcla}>
                <td>{x.mezcla === 'entero' ? 'Solo enteros' : x.mezcla === 'granel' ? 'Solo granel' : 'De los dos'}</td>
                <td className={s.num}>{num(x.tickets, 0)}</td>
                <td className={s.num}><strong>{pctTxt(x.participacion)}</strong></td>
                <td className={cx(s.num, s.mono)}>{money(x.ticketPromedio)}</td>
                <td className={s.num}>{pctTxt(x.participacionAnterior)}</td>
              </tr>
            ))}
          </Table>
          <div className={s.hint} style={{ margin: 0 }}>
            {pctTxt(g.participacionTickets)} de los tickets lleva granel; {pctTxt(e.participacionTickets)} lleva enteros.
            «Promedio» es lo que deja el ticket entero.
          </div>
        </Bloque>
      </Grilla>

      {(g.fraccionado.ventaNeta !== 0 || g.suelto.ventaNeta !== 0) && (
        <Bloque titulo="Granel: en paquetes o suelto" sub="Cómo se vende el granel">
          <Table cols={[{ h: 'Se vendió…' }, { h: 'Venta neta', num: true }, { h: '% del granel', num: true }, { h: 'Cantidad', num: true }, { h: '$ por kg', num: true }, { h: 'Margen %', num: true }]} empty="—">
            {[['En paquetes (fraccionado)', g.fraccionado], ['Suelto, al peso', g.suelto]].map(([n, x]) => (
              <tr key={n}>
                <td>{n}{x.productos ? <div className={s.hint} style={{ margin: 0 }}>{num(x.productos, 0)} producto(s)</div> : null}</td>
                <td className={cx(s.num, s.mono)}>{money(x.ventaNeta)}</td>
                <td className={s.num}><strong>{pctTxt(x.participacion)}</strong></td>
                <td className={cx(s.num, s.mono)}>{kg(x.cantidadBase)}</td>
                <td className={cx(s.num, s.mono)}>{x.cantidadBase > 0 ? money(x.ventaNeta / x.cantidadBase) : '—'}</td>
                <td className={s.num}><MargenPct v={x.margenPct} /></td>
              </tr>
            ))}
          </Table>
        </Bloque>
      )}

      {d.porSucursal.length > 1 && <PorSucursal d={d} />}

      <Grilla>
        <TopLado titulo="Lo más vendido de granel" filas={d.top.granel} esGranel onVerTodos={() => onVerTodos('granel')} />
        <TopLado titulo="Lo más vendido de enteros" filas={d.top.entero} onVerTodos={() => onVerTodos('entero')} />
      </Grilla>

      {t.ventaSinCosto > 0.5 && (
        <Aviso tono="warn">
          {money(t.ventaSinCosto)} de venta no tiene costo cargado al momento de vender: no entra al margen de ningún lado, para no inventar un número.
        </Aviso>
      )}
    </div>
  );
}

/* ------------------------------ período por período ------------------------------ */
function SerieGranel({ d, paso }) {
  // La tabla, del más nuevo al más viejo: lo que se busca primero es «ayer» o «este mes».
  const filas = useMemo(() => [...d.serie].reverse(), [d]);
  const pag = usePaginado(filas, 'metricas-granel-serie', `${d.desde}|${d.hasta}|${paso}`);
  const exportar = () => descargarCsv(`granel-y-enteros-por-${paso}-${d.desde}-${d.hasta}.csv`,
    ['Período', 'Total', 'Granel', 'Granel %', 'Enteros', 'Enteros %', 'Margen % granel', 'Margen % enteros'],
    d.serie.map((x) => [tituloPeriodo(x.periodo, paso), csvNum(x.total), csvNum(x.granel), x.pctGranel == null ? '' : csvNum(x.pctGranel, 1),
      csvNum(x.entero), x.pctEntero == null ? '' : csvNum(x.pctEntero, 1), x.margenPctGranel == null ? '' : csvNum(x.margenPctGranel, 1),
      x.margenPctEntero == null ? '' : csvNum(x.margenPctEntero, 1)]));
  return (
    <Bloque
      titulo="Granel y enteros en el tiempo"
      sub={`Lo vendido por ${nombrePaso(paso)}, partido en sus dos lados. Tocá una columna para ver el %.`}
      acciones={<Btn small onClick={exportar}>Exportar CSV</Btn>}
    >
      <ColumnasMulti
        modo="apilado"
        titulo="Venta de granel y de enteros en el tiempo"
        series={SERIES}
        datos={d.serie.map((x) => ({
          etiqueta: etiquetaPeriodo(x.periodo, paso), titulo: tituloPeriodo(x.periodo, paso), valores: [x.granel, x.entero],
          nombres: [`Granel · ${pctTxt(x.pctGranel)}`, `Enteros · ${pctTxt(x.pctEntero)}`], detalle: `Total ${money(x.total)}`,
        }))}
        formato={money}
      />
      <Table
        grupos={[{ h: '', span: 2 }, { h: 'Granel', span: 3 }, { h: 'Enteros', span: 3 }]}
        cols={[
          { h: 'Período' }, { h: 'Total', num: true },
          { h: 'Venta', num: true }, { h: '%', num: true }, { h: 'Margen', num: true },
          { h: 'Venta', num: true }, { h: '%', num: true }, { h: 'Margen', num: true },
        ]}
        empty="Sin ventas."
        pag={pag}
      >
        {pag.visibles.map((x) => (
          <tr key={x.periodo}>
            <td>{tituloPeriodo(x.periodo, paso)}</td>
            <td className={cx(s.num, s.mono)}><strong>{money(x.total)}</strong></td>
            <td className={cx(s.num, s.mono)}>{money(x.granel)}</td>
            <td className={s.num}><strong>{pctTxt(x.pctGranel)}</strong></td>
            <td className={s.num}><MargenPct v={x.margenPctGranel} /></td>
            <td className={cx(s.num, s.mono)}>{money(x.entero)}</td>
            <td className={s.num}><strong>{pctTxt(x.pctEntero)}</strong></td>
            <td className={s.num}><MargenPct v={x.margenPctEntero} /></td>
          </tr>
        ))}
      </Table>
    </Bloque>
  );
}

/* ------------------------------ cara a cara ------------------------------ */
function CaraACara({ d }) {
  const { granel: g, entero: e } = d;
  const filas = [
    ['Venta neta', money(g.ventaNeta), money(e.ventaNeta)],
    ['Parte de lo vendido', pctTxt(g.participacion), pctTxt(e.participacion)],
    ['Contra el período anterior', <Variacion key="g" valor={g.variacionVenta} contra="" />, <Variacion key="e" valor={e.variacionVenta} contra="" />],
    ['Costo de lo vendido', money(g.costo), money(e.costo)],
    ['Margen (ganancia bruta)', money(g.margen), money(e.margen)],
    ['Margen %', <MargenPct key="g" v={g.margenPct} />, <MargenPct key="e" v={e.margenPct} />],
    ['Parte de la ganancia', pctTxt(g.participacionMargen), pctTxt(e.participacionMargen)],
    ['Tickets que lo llevan', `${num(g.tickets, 0)} · ${pctTxt(g.participacionTickets)}`, `${num(e.tickets, 0)} · ${pctTxt(e.participacionTickets)}`],
    ['Cantidad vendida', kg(g.cantidadBase), unid(e.unidades)],
    ['Productos distintos vendidos', num(g.productos, 0), num(e.productos, 0)],
    ['Precio promedio por kg', g.precioPorKg == null ? '—' : money(g.precioPorKg), '—'],
    ['IVA absorbido', money(g.ivaAbsorbido), money(e.ivaAbsorbido)],
  ];
  if (g.ventaSinCosto > 0.5 || e.ventaSinCosto > 0.5) filas.push(['Venta sin costo cargado (fuera del margen)', money(g.ventaSinCosto), money(e.ventaSinCosto)]);
  return (
    <Table cols={[{ h: '' }, { h: <><Punto color={COLOR_GRANEL} />Granel</>, num: true }, { h: <><Punto color={COLOR_ENTERO} />Enteros</>, num: true }]}>
      {filas.map(([n, a, b]) => (
        <tr key={n}><td>{n}</td><td className={cx(s.num, s.mono)}>{a}</td><td className={cx(s.num, s.mono)}>{b}</td></tr>
      ))}
    </Table>
  );
}

/* ------------------------------ por sucursal ------------------------------ */
function PorSucursal({ d }) {
  return (
    <Bloque titulo="Por sucursal" sub="Qué parte de lo que vende cada sucursal es granel">
      <Table
        cols={[{ h: 'Sucursal' }, { h: 'Total', num: true }, { h: 'Reparto' }, { h: 'Granel', num: true }, { h: 'Granel %', num: true }, { h: 'Enteros', num: true }, { h: 'Margen % granel', num: true }, { h: 'Margen % enteros', num: true }]}
        empty="Sin ventas."
      >
        {d.porSucursal.map((x) => (
          <tr key={x.sucursalId}>
            <td>{x.nombre}</td>
            <td className={cx(s.num, s.mono)}><strong>{money(x.total)}</strong></td>
            <td style={{ minWidth: 90 }}>
              <Reparto partes={[{ nombre: 'Granel', valor: x.granel, color: COLOR_GRANEL }, { nombre: 'Enteros', valor: x.entero, color: COLOR_ENTERO }]} />
            </td>
            <td className={cx(s.num, s.mono)}>{money(x.granel)}</td>
            <td className={s.num}><strong>{pctTxt(x.pctGranel)}</strong></td>
            <td className={cx(s.num, s.mono)}>{money(x.entero)}</td>
            <td className={s.num}><MargenPct v={x.margenPctGranel} /></td>
            <td className={s.num}><MargenPct v={x.margenPctEntero} /></td>
          </tr>
        ))}
      </Table>
      <div className={s.hint} style={{ margin: 0 }}>Todas juntas: {pctTxt(d.granel.participacion)} de granel.</div>
    </Bloque>
  );
}

/* ------------------------------ los más vendidos ------------------------------ */
function TopLado({ titulo, filas, esGranel, onVerTodos }) {
  return (
    <Bloque
      titulo={<span style={{ display: 'inline-flex', alignItems: 'center' }}><Punto color={esGranel ? COLOR_GRANEL : COLOR_ENTERO} />{titulo}</span>}
      sub="Los 10 que más vendieron en el período"
      acciones={<Btn small onClick={onVerTodos}>Ver todos en Rentabilidad</Btn>}
    >
      <Table cols={[{ h: 'Producto' }, { h: 'Cantidad', num: true }, { h: 'Venta neta', num: true }, { h: '% del lado', num: true }, { h: 'Margen %', num: true }]} empty="Sin ventas.">
        {filas.map((x) => (
          <tr key={x.productoId}>
            <td>{x.nombre}</td>
            <td className={cx(s.num, s.mono)}>{esGranel ? kg(x.cantidadBase) : unid(x.unidades)}</td>
            <td className={cx(s.num, s.mono)}>{money(x.ventaNeta)}</td>
            <td className={s.num}>{pctTxt(x.participacion)}</td>
            <td className={s.num}><MargenPct v={x.margenPct} /></td>
          </tr>
        ))}
      </Table>
    </Bloque>
  );
}
