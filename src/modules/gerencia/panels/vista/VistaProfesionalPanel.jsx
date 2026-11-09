/**
 * GERENCIA › VISTA PROFESIONAL (5/11/2026, pedido del dueño): los números que
 * un negocio tiene que mirar, en una pantalla que además enseña a leerlos.
 * Mensual o semanal, la empresa o un local. Cuatro preguntas, en orden:
 *
 *   1. ¿Cómo me fue?         ventas, margen, tickets, ticket promedio y (por
 *                            mes) lo que quedó y el punto de equilibrio.
 *   2. ¿Qué dicen?           lecturas en castellano llano (vista.js).
 *   3. ¿Hacia dónde va?      la evolución, una medida por gráfico.
 *   4. ¿Dónde está la plata? stock, proveedores, clientes y el ciclo de caja.
 *   5. ¿Cómo se vende?       medios de pago, con o sin factura, por local.
 *
 * Los números salen de las mismas cuentas que Resultados, Métricas y
 * Proveedores (ver crm-api/src/gerencia/vista-profesional.module.ts).
 */
import { useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { httpClient } from '@core/services/httpClient.js';
import { useResource } from '@modules/ventas/hooks/useResource.js';
import { money } from '@modules/productos/domain/format.js';
import { PanelHead, s } from '@modules/productos/components/ui.jsx';
import { Aviso, Bloque, Cargando, Grilla, Tile, Tiles } from '../metricas/piezas.jsx';
import { Barras, Columnas } from '../metricas/graficos.jsx';
import { compacto } from '../metricas/formato.js';
import { Linea } from './Linea.jsx';
import { armarVista, pct } from './vista.js';

const pesos = (v) => money(Math.round(v ?? 0)).replace(/,00$/, '');
const pctTxt = (v) => (v == null ? '—' : `${Number(v).toLocaleString('es-AR', { maximumFractionDigits: 1 })} %`);
const ptsTxt = (v) => `${v > 0 ? '+' : ''}${Number(v).toLocaleString('es-AR', { maximumFractionDigits: 1 })} pts`;
const MARCA = { ok: '▲', warn: '⚠', info: '•' };
const COLOR_MARCA = { ok: 'var(--crm-color-success)', warn: 'var(--crm-color-warning, #b45309)', info: 'var(--crm-color-text-secondary)' };

/** El «¿qué es?» de cada número, plegado: está para el que lo quiere leer. */
function QueEs({ children }) {
  return (
    <details style={{ fontSize: 13, color: 'var(--crm-color-text-secondary)' }}>
      <summary style={{ cursor: 'pointer', width: 'fit-content' }}>¿Qué es y cómo se lee?</summary>
      <div style={{ marginTop: 6, maxWidth: '70ch', lineHeight: 1.5 }}>{children}</div>
    </details>
  );
}

export function VistaProfesionalPanel() {
  const [unidad, setUnidad] = useState('mes');
  const [sucursalId, setSucursalId] = useState('');
  const { data, loading, error } = useResource(`vista-profesional:${unidad}`, () => httpClient.get(`/gerencia/vista-profesional?unidad=${unidad}`));
  const v = useMemo(() => (data ? armarVista(data, { sucursalId: sucursalId ? Number(sucursalId) : null }) : null), [data, sucursalId]);
  const mensual = unidad === 'mes';
  const sucs = (data?.sucursales ?? []).filter((x) => x.activa);
  const nombreLocal = sucs.find((x) => String(x.id) === sucursalId)?.nombre;
  const contra = v?.anterior ? `vs ${v.anterior.titulo}` : '';

  const serie = (fn, opts = {}) => (v?.serie ?? []).map((p) => ({
    etiqueta: p.etiqueta,
    titulo: p.enCurso ? `${p.titulo} · en curso (${p.transcurridos} de ${p.dias} días)` : p.titulo,
    valor: fn(p),
    parcial: p.enCurso,
    detalle: opts.detalle?.(p),
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <PanelHead
        title="Vista profesional"
        desc="Los números que hay que mirar para manejar el negocio, explicados. Cada uno sale de la misma cuenta que su pantalla (Resultados, Métricas, Proveedores), así que siempre coinciden."
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div role="group" aria-label="Vista" style={{ display: 'inline-flex', gap: 4 }}>
          {[['mes', 'Mensual'], ['semana', 'Semanal']].map(([k, t]) => (
            <button
              key={k} type="button" onClick={() => setUnidad(k)} aria-pressed={unidad === k}
              className={cx(s.btn, s['btn-sm'], unidad === k ? s['btn-primary'] : s['btn-ghost'])}
            >
              {t}
            </button>
          ))}
        </div>
        <select className={s['select-inline']} value={sucursalId} onChange={(e) => setSucursalId(e.target.value)} aria-label="Local">
          <option value="">Toda la empresa</option>
          {sucs.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
        </select>
        <span className={s.hint} style={{ margin: 0 }}>
          {mensual ? 'Últimos 12 meses · se compara el último mes completo contra el anterior' : 'Últimas 13 semanas, de lunes a domingo · se compara la última semana completa contra la anterior'}
        </span>
      </div>

      {error && <Aviso tono="warn">No se pudo cargar: {String(error.message || error)}</Aviso>}
      {loading && !data && <Cargando />}

      {v && (
        <>
          {/* 1 · ¿Cómo me fue? */}
          <Bloque
            titulo={v.actual ? `¿Cómo me fue? · ${v.actual.titulo}${nombreLocal ? ` · ${nombreLocal}` : ''}` : '¿Cómo me fue?'}
            sub={`${mensual ? 'El último mes completo' : 'La última semana completa'}${v.anterior ? `, contra ${mensual ? '' : 'la '}${v.anterior.titulo}` : ''}. Las ventas son netas: sin el IVA que se paga (el de lo vendido sin factura sí suma, porque queda en la casa).`}
          >
            {v.kpis ? (
              <Tiles>
                <Tile label="Ventas netas" valor={pesos(v.kpis.ventas)} variacion={v.kpis.ventasVar} contra={contra} />
                <Tile
                  label="Venta por día abierto" valor={v.kpis.ventaPorDia == null ? '—' : pesos(v.kpis.ventaPorDia)} variacion={v.kpis.ventaPorDiaVar} contra={contra}
                  detalle={`abrió ${v.actual.abiertos} de ${v.actual.dias} días${v.anterior ? ` (antes ${v.anterior.abiertos})` : ''} · ${v.actual.turnos} turnos de caja`}
                />
                <Tile
                  label="Margen comercial" valor={pctTxt(v.kpis.margenPct)}
                  detalle={`${v.kpis.margenPts != null ? `${ptsTxt(v.kpis.margenPts)} ${contra} · ` : ''}de cada $100, lo que queda después de la mercadería`}
                  alerta={v.kpis.margenPts != null && v.kpis.margenPts <= -1}
                />
                <Tile label="Ventas (tickets)" valor={v.kpis.tickets.toLocaleString('es-AR')} variacion={v.kpis.ticketsVar} contra={contra} />
                <Tile label="Ticket promedio" valor={v.kpis.ticketProm == null ? '—' : pesos(v.kpis.ticketProm)} variacion={v.kpis.ticketPromVar} contra={contra} />
                {mensual && v.kpis.resultado != null && (
                  <Tile
                    label={sucursalId ? 'Resultado antes de Ganancias' : 'Resultado neto (lo que quedó)'} valor={pesos(v.kpis.resultado)}
                    detalle={`${pctTxt(v.kpis.resultadoPct)} de lo vendido`} alerta={v.kpis.resultado < 0}
                  />
                )}
                {mensual && v.kpis.equilibrio?.ventas != null && (
                  <Tile
                    label="Punto de equilibrio" valor={pesos(v.kpis.equilibrio.ventas)}
                    detalle={v.kpis.equilibrio.seguridadPct >= 0 ? `vendiste un ${pctTxt(v.kpis.equilibrio.seguridadPct)} por encima` : 'no se alcanzó'}
                    alerta={v.kpis.equilibrio.seguridadPct < 0}
                  />
                )}
              </Tiles>
            ) : <div className={s.hint}>Todavía no hay un período completo con ventas.</div>}
            <QueEs>
              <p style={{ margin: '0 0 6px' }}><strong>Margen comercial</strong>: ventas menos lo que costó la mercadería vendida (al costo de cuando se vendió). No incluye gastos: es lo que queda para pagarlos.</p>
              <p style={{ margin: '0 0 6px' }}><strong>Venta por día abierto</strong>: las ventas repartidas en los días que se abrió (un día abierto es un día con venta en el mostrador). Un mes con feriados vende menos en total sin haber vendido peor: este número lo muestra parejo.</p>
              <p style={{ margin: '0 0 6px' }}><strong>Ticket promedio</strong>: cuánto gasta cada cliente por compra. Las ventas suben por dos caminos: más clientes (tickets) o clientes que gastan más (ticket promedio). Conviene saber cuál de los dos se movió.</p>
              <p style={{ margin: 0 }}><strong>Punto de equilibrio</strong>: lo que hay que vender en el mes para cubrir los gastos fijos (sueldos, alquileres, servicios) con el margen que se tuvo. Por encima, se gana; por debajo, se pierde.</p>
            </QueEs>
          </Bloque>

          {/* 2 · ¿Qué dicen los números? */}
          <Bloque titulo="Lo que dicen los números" sub="Lecturas automáticas, de la más importante a la menos.">
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {v.lecturas.map((l, i) => (
                <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'baseline', lineHeight: 1.45 }}>
                  <span aria-hidden="true" style={{ color: COLOR_MARCA[l.tono] ?? COLOR_MARCA.info, fontWeight: 700, width: 14, flex: 'none' }}>{MARCA[l.tono] ?? '•'}</span>
                  <span>{l.texto ?? l}</span>
                </li>
              ))}
            </ul>
            {(data.avisos ?? []).map((a) => <Aviso key={a} tono="warn">{a}</Aviso>)}
          </Bloque>

          {/* 3 · ¿Hacia dónde va? */}
          <Grilla>
            <Bloque titulo="Ventas netas" sub={`Por ${mensual ? 'mes' : 'semana'}. La última columna es la del período en curso: todavía no terminó.`}>
              <Columnas datos={serie((p) => p.ventas, { detalle: (p) => `${p.tickets.toLocaleString('es-AR')} tickets · abrió ${p.abiertos} días` })} formato={pesos} titulo="Ventas netas por período" />
            </Bloque>
            <Bloque titulo="Venta por día abierto" sub="Las ventas divididas por los días que se abrió: así los feriados y los días cerrados no hunden el período.">
              <Linea datos={serie((p) => p.ventaPorDia, { detalle: (p) => `abrió ${p.abiertos} de ${p.enCurso ? p.transcurridos : p.dias} días · ${p.turnos} turnos` })} formato={pesos} eje={compacto} titulo="Venta por día abierto por período" />
            </Bloque>
            <Bloque titulo="Margen comercial" sub="De cada $100 vendidos, lo que queda después de la mercadería. Si baja, mirá precios, costos y descuentos.">
              <Linea datos={serie((p) => p.margenPct)} formato={pctTxt} eje={(x) => `${x} %`} titulo="Margen comercial por período" />
            </Bloque>
            <Bloque titulo="Ticket promedio" sub="Cuánto gasta cada cliente por compra. Sube con buenas ofertas por cantidad, combos y góndola bien armada.">
              <Linea datos={serie((p) => p.ticketProm)} formato={pesos} eje={compacto} titulo="Ticket promedio por período" />
            </Bloque>
            <Bloque titulo="Cantidad de ventas" sub="Cuántos tickets se hicieron (sin las devoluciones). Es la gente que entró y compró.">
              <Columnas datos={serie((p) => p.tickets)} formato={(x) => `${Math.round(x).toLocaleString('es-AR')} tickets`} eje={(x) => Math.round(x).toLocaleString('es-AR')} titulo="Tickets por período" />
            </Bloque>
            {mensual ? (
              <Bloque
                titulo={sucursalId ? 'Resultado antes de Ganancias' : 'Resultado neto'}
                sub="Lo que quedó después de mercadería, impuestos, comisiones, gastos y sueldos (de Gerencia › Resultados). En rojo, los meses con pérdida."
              >
                <Columnas datos={serie((p) => p.resultado)} formato={pesos} titulo="Resultado por mes" />
              </Bloque>
            ) : (
              <Bloque titulo="Resultado" sub="Se mira por mes.">
                <div className={s.hint} style={{ margin: 0 }}>
                  Los gastos, los sueldos y los impuestos son de mes: partirlos en semanas sería inventar. Pasá a la vista <strong>Mensual</strong> para ver lo que quedó.
                </div>
              </Bloque>
            )}
          </Grilla>

          {/* 4 · ¿Dónde está la plata? */}
          <Foto foto={data.foto} sucursalId={sucursalId} />

          {/* 5 · ¿Cómo se vende? */}
          {v.actual && (
            <Grilla>
              <Bloque titulo={`Cómo te pagan · ${v.actual.titulo}`} sub="Lo cobrado en la venta, por medio. La cuenta corriente es lo vendido a cobrar después.">
                {v.medios.length
                  ? <Barras datos={v.medios} formato={pesos} sufijo={(d) => pctTxt(pct(d.valor, v.medios.reduce((a, x) => a + x.valor, 0)))} />
                  : <div className={s.hint}>Sin cobros en el período.</div>}
                <QueEs>
                  Cada medio tiene su costo: la tarjeta y Mercado Pago cobran comisión y tardan en acreditar; el efectivo no, pero hay que cuidarlo.
                  Si la tarjeta crece mucho, la comisión se come margen: mirala en Resultados.
                </QueEs>
              </Bloque>
              <Bloque titulo={`Con y sin factura · ${v.actual.titulo}`} sub="Sobre las ventas netas del período.">
                <Barras
                  datos={[
                    { clave: 'f', etiqueta: 'Facturado', valor: Math.round(v.actual.facturado) },
                    { clave: 's', etiqueta: 'Sin factura', valor: Math.round(v.actual.ventas - v.actual.facturado) },
                  ]}
                  formato={pesos} sufijo={(d) => pctTxt(pct(d.valor, v.actual.ventas))}
                />
                <QueEs>
                  Lo facturado paga IVA (débito) y es la base de Ingresos Brutos y de la tasa municipal. En lo vendido sin factura el IVA queda en la casa
                  (por eso suma en las ventas). El detalle está en Gerencia › Resultados › IVA (aparte).
                </QueEs>
              </Bloque>
              {!sucursalId && (
                <Bloque titulo={`Por local · ${v.actual.titulo}`} sub="Cuánto vendió cada uno y qué parte del total es.">
                  <PorLocal datos={data} actual={v.actual} sucs={data.sucursales ?? []} />
                </Bloque>
              )}
            </Grilla>
          )}
        </>
      )}
    </div>
  );
}

function PorLocal({ datos, actual, sucs }) {
  const p = (datos.periodos ?? []).find((x) => x.clave === actual.clave);
  const filas = Object.entries(p?.porLocal ?? {})
    .map(([id, c]) => ({ clave: id, etiqueta: sucs.find((x) => String(x.id) === id)?.nombre ?? (id === '0' ? 'Sin local' : `Local ${id}`), valor: Math.round(c.ventas) }))
    .filter((x) => x.valor !== 0)
    .sort((a, b) => b.valor - a.valor);
  const total = filas.reduce((a, x) => a + x.valor, 0);
  return <Barras datos={filas} formato={pesos} sufijo={(d) => pctTxt(pct(d.valor, total))} />;
}

/** ¿DÓNDE ESTÁ LA PLATA? La foto de hoy: lo que tenés, lo que debés y lo que te deben. */
function Foto({ foto, sucursalId }) {
  if (!foto) return null;
  const stockLocal = sucursalId ? foto.stockPorLocal.find((x) => String(x.sucursalId) === sucursalId) : null;
  const dias = (n) => (n == null ? '' : `${n} ${n === 1 ? 'día' : 'días'}`);
  return (
    <Bloque
      titulo="¿Dónde está la plata? · hoy"
      sub={`La foto de hoy, no del período. Los «días» se miden contra el ritmo de los últimos ${foto.ritmo.dias} días.${sucursalId ? ' Las deudas y los cobros son de la empresa entera.' : ''}`}
    >
      <Tiles>
        <Tile
          label={stockLocal ? `Mercadería en ${stockLocal.nombre} (a costo)` : 'Mercadería en stock (a costo)'}
          valor={pesos(stockLocal ? stockLocal.valor : foto.stockCosto)}
          detalle={stockLocal ? 'a costo de hoy' : `alcanza para ${dias(foto.diasStock)} de venta · ${pesos(foto.stockParado)} sin ventas`}
        />
        <Tile label="Le debés a proveedores" valor={pesos(foto.deudaProveedores)} detalle={`les pagás a ${dias(foto.diasPago)}${foto.aFavorProveedores > 0 ? ` · a favor ${pesos(foto.aFavorProveedores)}` : ''}`} />
        <Tile label="Te deben los clientes" valor={pesos(foto.aCobrarClientes)} detalle={`cobrás a ${dias(foto.diasCobro)} (cuenta corriente)`} />
        <Tile
          label="Ciclo de caja" valor={foto.cicloCaja == null ? '—' : dias(foto.cicloCaja)}
          detalle={foto.cicloCaja == null ? '' : foto.cicloCaja >= 0 ? 'los financiás vos' : 'te financian los proveedores'}
          alerta={foto.cicloCaja != null && foto.cicloCaja > 45}
        />
      </Tiles>
      {foto.cicloCaja != null && (
        <div className={s.hint} style={{ margin: 0, fontVariantNumeric: 'tabular-nums' }}>
          {foto.diasStock} días de stock + {foto.diasCobro} de cobro − {foto.diasPago} de pago = <strong>{foto.cicloCaja} días</strong>
        </div>
      )}
      <QueEs>
        <p style={{ margin: '0 0 6px' }}><strong>Ciclo de caja</strong>: cuántos días pasan desde que pagás la mercadería hasta que la cobrás. Es la plata que tenés «atada» en el negocio: cuanto más corto, menos capital necesitás para funcionar.</p>
        <p style={{ margin: '0 0 6px' }}>Se acorta con <strong>menos stock</strong> (comprar más seguido y en menos cantidad, sacar lo que no rota), <strong>cobrando antes</strong> (cuentas corrientes al día) o <strong>pagando a más días</strong> (negociar plazos con proveedores, sin atrasarse).</p>
        <p style={{ margin: 0 }}><strong>Mercadería sin ventas</strong>: lo que tiene stock y no se vendió en 30 días. Es plata parada: liquidarla con una oferta libera caja.</p>
      </QueEs>
    </Bloque>
  );
}
