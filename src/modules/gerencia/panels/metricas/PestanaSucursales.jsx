/**
 * MÉTRICAS › POR DÍAS Y HORAS (6/11/2026, pedido del dueño; antes «Sucursales»)
 * ============================================================================
 * Lo que vende cada local: venta, tickets y ticket promedio contra el período
 * anterior; por TURNO (mañana antes de las 14 h, tarde desde las 14 h) con el
 * promedio por turno trabajado; DÍA POR DÍA del 1 al último día del mes; y por
 * HORA, en una tabla de calor (cada local
 * con su propia escala, así se ve la FORMA del día de cada uno) y un gráfico.
 *
 * El filtro de sucursal de arriba vale acá; además, clic en el nombre de un
 * local lo filtra (y «Ver todas» vuelve). Los datos: `GET /metricas/locales`.
 */
import { useState } from 'react';
import { httpClient } from '@core/services/httpClient.js';
import { useResource } from '@modules/ventas/hooks/useResource.js';
import { cx } from '@shared/utils/classNames.js';
import { money, num } from '@modules/productos/domain/format.js';
import { Table, Btn, s } from '@modules/productos/components/ui.jsx';
import { Columnas } from './graficos.jsx';
import { DIAS_SEMANA, fechaLarga, parte, pctTxt } from './formato.js';
import { Aviso, Bloque, Cargando, ConParte, Tile, Tiles, Variacion } from './piezas.jsx';

const TURNO = { manana: 'Mañana', tarde: 'Tarde' };

/** Lo que se puede mirar por hora: cada una con su formato. */
const MEDIDAS = {
  tickets: { label: 'Tickets', v: (c) => c.tickets, fmt: (v) => num(v, 0) },
  ticketsPorDia: { label: 'Tickets por día', v: (c) => c.ticketsPorDia, fmt: (v) => num(v, 1) },
  ventaNeta: { label: 'Venta neta', v: (c) => c.ventaNeta, fmt: money },
  ticketPromedio: { label: 'Ticket promedio', v: (c) => c.ticketPromedio, fmt: money },
};

/** Lo que se puede mirar por día. */
const MEDIDAS_DIA = {
  ventaNeta: { label: 'Venta neta', v: (c) => c.ventaNeta, fmt: money },
  tickets: { label: 'Tickets', v: (c) => c.tickets, fmt: (v) => num(v, 0) },
  ticketPromedio: { label: 'Ticket promedio', v: (c) => c.ticketPromedio, fmt: money },
};
/** «Lun 3»: el día de la semana va primero porque es lo que explica el número. */
const diaSemana = (f) => DIAS_SEMANA[((new Date(`${f}T12:00:00`).getDay() + 6) % 7) + 1];
const etiquetaDia = (f) => `${diaSemana(f)} ${Number(f.slice(8, 10))}`;
const esLunes = (f) => new Date(`${f}T12:00:00`).getDay() === 1;

function BotonLocal({ x, onFiltrar, filtrado }) {
  if (filtrado || !onFiltrar || !x.sucursalId) return <strong>{x.nombre}</strong>;
  return (
    <button
      type="button" onClick={() => onFiltrar(String(x.sucursalId))} title={`Ver solo ${x.nombre}`}
      style={{ background: 'none', border: 0, padding: 0, font: 'inherit', fontWeight: 700, color: 'var(--crm-color-primary)', cursor: 'pointer', textAlign: 'left' }}
    >
      {x.nombre}
    </button>
  );
}

export function PestanaSucursales({ qs, version, sucursalId, setSucursalId }) {
  const { data: d, loading, error } = useResource(`metricas:locales:${qs}:${version}`, () => httpClient.get(`/metricas/locales?${qs}`));
  const [medida, setMedida] = useState('tickets');
  const [medidaDia, setMedidaDia] = useState('ventaNeta');
  const [localGrafico, setLocalGrafico] = useState('');
  if (error) return <Aviso tono="warn">{error}</Aviso>;
  if (!d) return <Cargando />;

  const locs = d.sucursales;
  const t = d.total;
  const filtrado = !!sucursalId;
  const varios = locs.length > 1;
  if (!locs.length) return <Aviso>No hay ventas en este período{filtrado ? ' en esta sucursal' : ''}.</Aviso>;

  const ventaTurnos = (t.turnos.manana.ventaNeta + t.turnos.tarde.ventaNeta) || 0;
  const m = MEDIDAS[medida];
  /* El gráfico: el local elegido, o el total; con el filtro de arriba, ese local. */
  const fuenteGrafico = filtrado ? locs[0] : (locs.find((x) => String(x.sucursalId) === localGrafico) ?? null);
  const horasGrafico = (fuenteGrafico ?? t).horas;
  const filas = varios ? [...locs, { ...t, sucursalId: null, nombre: 'Total', esTotal: true }] : locs;
  const md = MEDIDAS_DIA[medidaDia];
  const diasGrafico = (fuenteGrafico ?? t).dias;
  const selectorLocal = !filtrado && varios ? (
    <select className={s['select-inline']} value={localGrafico} onChange={(e) => setLocalGrafico(e.target.value)} aria-label="Sucursal del gráfico">
      <option value="">Todas las sucursales</option>
      {locs.map((x) => <option key={x.sucursalId} value={x.sucursalId}>{x.nombre}</option>)}
    </select>
  ) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: loading ? 0.6 : 1 }}>
      <Tiles>
        <Tile label="Venta neta (sin IVA)" valor={money(t.ventaNeta)} variacion={t.variacionVenta} detalle={`Anterior: ${money(t.anterior.ventaNeta)}`} />
        <Tile label="Tickets" valor={num(t.tickets, 0)} variacion={t.variacionTickets} detalle={`Anterior: ${num(t.anterior.tickets, 0)}`} />
        <Tile label="Ticket promedio" valor={money(t.ticketPromedio)} variacion={t.variacionPromedio} detalle={`Anterior: ${money(t.anterior.ticketPromedio)}`} />
        <Tile
          label="Mañana / tarde" valor={`${pctTxt(parte(t.turnos.manana.ventaNeta, ventaTurnos))} / ${pctTxt(parte(t.turnos.tarde.ventaNeta, ventaTurnos))}`}
          detalle={`De la venta. Promedio por turno: ${money(t.turnos.manana.ventaPorDia)} a la mañana, ${money(t.turnos.tarde.ventaPorDia)} a la tarde`}
        />
      </Tiles>
      <div className={s.hint} style={{ margin: 0 }}>
        Se compara con {fechaLarga(d.anteriorDesde)} → {fechaLarga(d.anteriorHasta)}, el período anterior del mismo largo.
        {' '}Mañana es hasta las {d.tardeDesde - 1}:59; tarde, desde las {d.tardeDesde}:00 (la misma regla del resto del ERP).
        {filtrado ? (
          <> {' '}<Btn small onClick={() => setSucursalId('')}>Ver todas las sucursales</Btn></>
        ) : varios ? ' Clic en una sucursal para ver solo esa.' : ''}
      </div>

      <Bloque titulo="Por sucursal" sub="Venta neta, tickets y ticket promedio, contra el período anterior">
        <Table
          cols={[
            { h: 'Sucursal' }, { h: 'Venta neta · %', num: true }, { h: 'Tickets', num: true }, { h: 'Ticket promedio', num: true },
            { h: 'Días con venta', num: true }, { h: 'Venta por día', num: true },
          ]}
          empty="Sin ventas."
        >
          {filas.map((x) => (
            <tr key={x.sucursalId ?? 'total'} style={x.esTotal ? { fontWeight: 700, background: 'var(--crm-color-surface-2, transparent)' } : undefined}>
              <td>{x.esTotal ? 'Total' : <BotonLocal x={x} onFiltrar={setSucursalId} filtrado={filtrado} />}</td>
              <td className={cx(s.num, s.mono)}>
                {x.esTotal ? money(x.ventaNeta) : <ConParte p={x.participacion}>{money(x.ventaNeta)}</ConParte>}
                <div><Variacion valor={x.variacionVenta} contra="" /></div>
              </td>
              <td className={cx(s.num, s.mono)}>{num(x.tickets, 0)}<div><Variacion valor={x.variacionTickets} contra="" /></div></td>
              <td className={cx(s.num, s.mono)}>{money(x.ticketPromedio)}<div><Variacion valor={x.variacionPromedio} contra="" /></div></td>
              <td className={s.num}>{x.esTotal ? '—' : num(x.diasConVenta, 0)}</td>
              <td className={cx(s.num, s.mono)}>{x.esTotal ? '—' : money(x.ventaPorDia)}</td>
            </tr>
          ))}
        </Table>
      </Bloque>

      <Bloque
        titulo="Por día"
        sub="Del 1 al último día del mes (los que todavía no llegaron, vacíos). Cada columna con su escala: lo más oscuro es el mejor día de ESE local"
        acciones={(
          <select className={s['select-inline']} value={medidaDia} onChange={(e) => setMedidaDia(e.target.value)} aria-label="Qué mirar por día">
            {Object.entries(MEDIDAS_DIA).map(([k, x]) => <option key={k} value={k}>{x.label}</option>)}
          </select>
        )}
      >
        <TablaCalor
          filas={filas} medida={md} renglones={(x) => x.dias} cabecera="Día"
          clave={(c) => c.dia}
          etiqueta={(c) => <>{etiquetaDia(c.dia)}</>}
          corte={(c) => esLunes(c.dia)}
          apagado={(c) => c.futuro}
          titulo={(x, c) => `${x.nombre} · ${fechaLarga(c.dia)} — ${num(c.tickets, 0)} tickets, venta ${money(c.ventaNeta)}, promedio ${money(c.ticketPromedio)}`}
        />
      </Bloque>

      <Bloque titulo={`${md.label} por día`} sub={fuenteGrafico ? fuenteGrafico.nombre : 'Todas las sucursales'} acciones={selectorLocal}>
        <Columnas
          titulo={`${md.label} por día`}
          datos={diasGrafico.map((c) => ({
            etiqueta: `${Number(c.dia.slice(8, 10))}`, titulo: `${diaSemana(c.dia)} ${fechaLarga(c.dia)}`, valor: c.futuro ? 0 : md.v(c),
            detalle: c.futuro ? 'Todavía no llegó' : `${num(c.tickets, 0)} tickets · venta ${money(c.ventaNeta)} · promedio ${money(c.ticketPromedio)}`,
          }))}
          formato={md.fmt}
          alto={220}
        />
      </Bloque>

      <Bloque
        titulo="Por turno"
        sub="«Por turno» es el promedio de cada turno trabajado (los días que ese local vendió en esa franja): así se comparan mañana y tarde aunque un local abra más tardes que mañanas"
      >
        <Table
          grupos={[{ h: '', span: 1 }, { h: 'Mañana', span: 4 }, { h: 'Tarde', span: 4 }]}
          cols={[
            { h: 'Sucursal' },
            ...['manana', 'tarde'].flatMap((k) => [
              { h: 'Venta · %', num: true }, { h: 'Tickets', num: true }, { h: 'Promedio', num: true }, { h: `Por turno (${k === 'manana' ? 'mañ.' : 'tar.'})`, num: true },
            ]),
          ]}
          empty="Sin ventas."
        >
          {filas.map((x) => {
            const tot = (x.turnos.manana.ventaNeta + x.turnos.tarde.ventaNeta) || 0;
            return (
              <tr key={x.sucursalId ?? 'total'} style={x.esTotal ? { fontWeight: 700 } : undefined}>
                <td>{x.esTotal ? 'Total' : <BotonLocal x={x} onFiltrar={setSucursalId} filtrado={filtrado} />}</td>
                {['manana', 'tarde'].map((k) => {
                  const c = x.turnos[k];
                  return [
                    <td key={`${k}v`} className={cx(s.num, s.mono)}><ConParte p={parte(c.ventaNeta, tot)} title={`Parte de la venta de ${x.nombre} que fue a la ${TURNO[k].toLowerCase()}`}>{money(c.ventaNeta)}</ConParte></td>,
                    <td key={`${k}t`} className={cx(s.num, s.mono)}>{num(c.tickets, 0)}</td>,
                    <td key={`${k}p`} className={cx(s.num, s.mono)}>{money(c.ticketPromedio)}</td>,
                    <td key={`${k}d`} className={cx(s.num, s.mono)} title={`${num(c.dias, 0)} turno(s) con venta · ${num(c.ticketsPorDia, 1)} tickets por turno`}>
                      {money(c.ventaPorDia)}
                      <div className={s.hint} style={{ margin: 0 }}>{num(c.ticketsPorDia, 1)} tk · {num(c.dias, 0)} {x.esTotal ? 'días' : 'turnos'}</div>
                    </td>,
                  ];
                })}
              </tr>
            );
          })}
        </Table>
      </Bloque>

      <Bloque
        titulo="Por hora"
        sub="Hora argentina. Cada columna tiene su propia escala: lo más oscuro es la hora más fuerte de ESE local"
        acciones={(
          <select className={s['select-inline']} value={medida} onChange={(e) => setMedida(e.target.value)} aria-label="Qué mirar por hora">
            {Object.entries(MEDIDAS).map(([k, x]) => <option key={k} value={k}>{x.label}</option>)}
          </select>
        )}
      >
        <TablaCalor
          filas={filas} medida={m} renglones={(x) => x.horas} cabecera="Hora"
          clave={(h) => h.hora}
          etiqueta={(h) => <>{h.hora}:00 <span className={s.hint} style={{ margin: 0, display: 'inline' }}>{TURNO[h.turno].toLowerCase()}</span></>}
          corte={(h, prev) => !!prev && prev.turno !== h.turno}
          titulo={(x, c) => `${x.nombre} · ${c.hora}:00 — ${num(c.tickets, 0)} tickets, venta ${money(c.ventaNeta)}, promedio ${money(c.ticketPromedio)}, ${num(c.ticketsPorDia, 1)} tickets por día`}
        />
      </Bloque>

      <Bloque
        titulo={`${m.label} por hora`}
        sub={fuenteGrafico ? fuenteGrafico.nombre : 'Todas las sucursales'}
        acciones={selectorLocal}
      >
        <Columnas
          titulo={`${m.label} por hora`}
          datos={horasGrafico.map((h) => ({
            etiqueta: `${h.hora}`, titulo: `${h.hora}:00 a ${h.hora}:59 · ${TURNO[h.turno].toLowerCase()}`, valor: m.v(h),
            detalle: `${num(h.tickets, 0)} tickets · venta ${money(h.ventaNeta)} · promedio ${money(h.ticketPromedio)} · ${num(h.ticketsPorDia, 1)} tickets por día`,
          }))}
          formato={m.fmt}
          alto={220}
          etiquetaCada={1}
        />
      </Bloque>

      <div className={s.hint} style={{ margin: 0 }}>
        «Por sucursal» y «Por día» restan las devoluciones y notas de crédito; turno y hora cuentan solo las ventas (una devolución no tiene hora de venta).
        Para ver QUÉ se vende en cada local, usá «Productos y categorías» con la sucursal elegida arriba.
      </div>
    </div>
  );
}

/**
 * Renglones (días u horas) × locales, con el fondo según el valor dentro de cada
 * columna: un solo tono, de claro a oscuro, y el texto siempre oscuro para que
 * se lea en todas las celdas. `corte` dibuja una raya arriba (cambio de semana
 * o de turno); `apagado` deja el renglón vacío (un día que todavía no llegó).
 */
function TablaCalor({ filas, medida, renglones, cabecera, clave, etiqueta, corte, apagado = () => false, titulo }) {
  const lista = renglones(filas[filas.length - 1]) ?? [];
  const maximos = filas.map((x) => Math.max(0, ...renglones(x).map((c) => Number(medida.v(c)) || 0)));
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className={s.table} style={{ minWidth: 0 }}>
        <thead>
          <tr>
            <th>{cabecera}</th>
            {filas.map((x) => <th key={x.sucursalId ?? 'total'} className={s.num}>{x.esTotal ? 'Total' : x.nombre}</th>)}
          </tr>
        </thead>
        <tbody>
          {lista.map((r, i) => {
            const off = apagado(r);
            return (
              <tr
                key={clave(r)}
                style={{
                  ...(i > 0 && corte(r, lista[i - 1]) ? { borderTop: '2px solid var(--crm-color-border-strong, var(--crm-color-border))' } : {}),
                  ...(off ? { color: 'var(--crm-color-text-muted, var(--crm-color-text-secondary))' } : {}),
                }}
              >
                <td style={{ whiteSpace: 'nowrap' }}>{etiqueta(r)}</td>
                {filas.map((x, j) => {
                  const c = renglones(x)[i];
                  const v = Number(medida.v(c)) || 0;
                  const k = maximos[j] > 0 ? v / maximos[j] : 0;
                  return (
                    <td
                      key={x.sucursalId ?? 'total'} className={cx(s.num, s.mono)}
                      title={off ? 'Todavía no llegó' : titulo(x, c)}
                      style={{
                        background: !off && v > 0 ? `color-mix(in srgb, var(--crm-color-primary) ${Math.round(6 + k * 38)}%, transparent)` : undefined,
                        fontWeight: x.esTotal ? 700 : undefined,
                      }}
                    >
                      {!off && v !== 0 ? medida.fmt(v) : '—'}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
