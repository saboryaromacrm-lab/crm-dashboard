/**
 * MÉTRICAS › OFERTAS Y DESCUENTOS (0189, 20/10/2026, pedido del dueño)
 * ============================================================================
 * «Que se mida muy bien, porque hay plata de por medio»: dos lecturas.
 *
 *   1. Del precio de lista a la venta neta, en el período: cuánto se dejó en
 *      cada clase de descuento, renglón por renglón, todo neto (sin IVA).
 *   2. Cada oferta, desde que empezó: con cuánto stock arrancó (la foto que se
 *      toma al empezar), cuánto se vendió con ella, cuánto ganó, cuánto habría
 *      ganado lo mismo a precio normal y si vendió más rápido que antes.
 *
 * La cuenta la hace la API (`metricas/ofertas.ts`): acá solo se muestra.
 */
import { Fragment, useMemo, useState } from 'react';
import { httpClient } from '@core/services/httpClient.js';
import { useResource } from '@modules/ventas/hooks/useResource.js';
import { describirOferta } from '@modules/ventas/domain/ofertas.js';
import { descargarCsv, csvNum } from '@shared/utils/csv.js';
import { money, num } from '@modules/productos/domain/format.js';
import { Table, Btn, Pill, s } from '@modules/productos/components/ui.jsx';
import { fechaLarga, pctTxt } from './formato.js';
import { Aviso, Bloque, Cargando, Tile, Tiles } from './piezas.jsx';

const VEREDICTOS = {
  rentable: { label: 'Rentable', pill: 'est-recibida' },
  al_costo: { label: 'Al costo', pill: 'est-pendiente' },
  pierde: { label: 'Pierde plata', pill: 'est-cancelada' },
  sin_ventas: { label: 'Sin ventas', pill: 'est-revision' },
  sin_costo: { label: 'Sin costo cargado', pill: 'est-revision' },
};
const ESTADOS = {
  vigente: { label: 'Vigente', pill: 'est-recibida' },
  programada: { label: 'Programada', pill: 'est-pendiente' },
  vencida: { label: 'Terminada', pill: 'est-revision' },
  inactiva: { label: 'Apagada', pill: 'est-cancelada' },
};
const FILTROS = [['', 'Todas'], ['rentable', 'Rentables'], ['al_costo', 'Al costo'], ['pierde', 'Pierden plata'], ['sin_ventas', 'Sin ventas']];

/** «28 u.», «3,5 kg» o «28 u. + 3,5 kg»: unidades y kilos no se suman entre sí. */
const cant = (c) => {
  const partes = [c.u ? `${num(c.u)} u.` : '', c.kg ? `${num(c.kg)} kg` : ''].filter(Boolean);
  return partes.length ? partes.join(' + ') : '0';
};
const fecha = (d) => (d ? new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric', year: '2-digit' }) : '—');
/** «−$500,00»: el signo adelante, como se lee. */
const plata = (v) => (v < -0.005 ? `−${money(-v)}` : money(v));
const Plata = ({ v, fuerte, rojo = true }) => {
  const color = rojo && v < -0.005 ? 'var(--crm-color-danger)' : undefined;
  return fuerte ? <strong style={{ color }}>{plata(v)}</strong> : <span style={{ color }}>{plata(v)}</span>;
};
/** `describirOferta` dice «$1234»; en pantalla, con el formato de plata. */
const mecanica = (o) => describirOferta(o).replace(/\$(\d+(?:\.\d+)?)/, (_, n) => money(Number(n)));

export function PestanaOfertas({ qs, version }) {
  const { data: d, loading, error } = useResource(`metricas:ofertas:${qs}:${version}`, () => httpClient.get(`/metricas/ofertas?${qs}`));
  const [filtro, setFiltro] = useState('');
  const [soloVencer, setSoloVencer] = useState(false);
  const [abierta, setAbierta] = useState(null);

  const ofertas = useMemo(() => d?.ofertas ?? [], [d]);
  const visibles = useMemo(
    () => ofertas.filter((o) => (!filtro || o.veredicto === filtro) && (!soloVencer || o.porVencer)),
    [ofertas, filtro, soloVencer],
  );
  const cuenta = (v) => ofertas.filter((o) => o.veredicto === v && (!soloVencer || o.porVencer)).length;

  if (error) return <Aviso tono="warn">{error}</Aviso>;
  if (!d) return <Cargando />;
  const g = d.desglose;

  const exportar = () => descargarCsv(`ofertas-${d.desde}-a-${d.hasta}.csv`,
    ['Oferta', 'Mecánica', 'Estado', 'Empezó', 'Por vencimiento', 'Stock al empezar (u.)', 'Stock al empezar (kg)',
      'Vendido con la oferta (u.)', 'Vendido con la oferta (kg)', '% del stock vendido', 'Stock hoy (u.)', 'Stock hoy (kg)',
      'Venta neta', 'Descuento dado', 'Costo', 'Ganancia', 'Margen %', 'Ganancia a precio normal', 'Renglones sin costo', 'Veredicto'],
    visibles.map((o) => [
      o.nombre, mecanica(o), ESTADOS[o.estado]?.label ?? o.estado, fecha(o.inicio), o.porVencer ? 'sí' : '',
      csvNum(o.stock.inicial.u), csvNum(o.stock.inicial.kg), csvNum(o.vendido.cantidades.u), csvNum(o.vendido.cantidades.kg),
      o.stock.pctVendido == null ? '' : csvNum(o.stock.pctVendido), csvNum(o.stock.hoy.u), csvNum(o.stock.hoy.kg),
      csvNum(o.vendido.neto), csvNum(o.vendido.descuento), csvNum(o.vendido.costo), csvNum(o.vendido.ganancia),
      o.vendido.margen == null ? '' : csvNum(o.vendido.margen), csvNum(o.vendido.gananciaNormal), o.vendido.sinCosto,
      VEREDICTOS[o.veredicto]?.label ?? o.veredicto,
    ]));

  /* El camino de la lista a la venta neta, renglón por renglón del desglose. */
  const pasos = [
    { k: 'lista', label: 'Venta a precio de lista', v: g.lista, fuerte: true },
    { k: 'precio', label: '− Precio cambiado a mano', v: -g.precio, nota: 'Cuando en la caja se cobró otro precio que el de la lista.' },
    { k: 'nombrados', label: '− Descuentos con nombre', v: -g.enNombrados, detalle: g.nombrados },
    { k: 'cliente', label: '− Descuento del cliente, a mano o del barrio', v: -g.cliente },
    { k: 'cupones', label: '− Cupones de la tienda', v: -g.enCupones, detalle: g.cupones },
    { k: 'ofertas', label: '− Ofertas', v: -g.enOfertas, detalle: g.ofertas },
    ...(Math.abs(g.redondeo) >= 0.01 ? [{ k: 'redondeo', label: '± Redondeo al centavo de cada renglón', v: -g.redondeo }] : []),
    { k: 'neto', label: '= Venta neta de productos', v: g.neto, fuerte: true },
    { k: 'extra', label: '+ Cargos aparte (envíos, recargo por cuotas)', v: g.extra },
    { k: 'ventaNeta', label: '= Venta neta (la de la pestaña Ventas)', v: g.ventaNeta, fuerte: true },
    { k: 'costo', label: '− Costo de lo vendido (con costo cargado)', v: -g.costo },
    { k: 'ganancia', label: '= Ganancia', v: g.ganancia, fuerte: true, nota: g.sinCosto > 0.005 ? `Sin contar ${money(g.sinCosto)} vendidos sin costo cargado: de eso no se sabe cuánto se ganó.` : '' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: loading ? 0.6 : 1 }}>
      <div className={s.hint} style={{ margin: 0 }}>
        Todo neto, sin IVA. La ganancia es lo vendido menos el costo congelado al vender, solo en lo que tiene costo cargado
        (igual que Rentabilidad). Las notas de crédito restan; las anuladas no cuentan.
      </div>

      <Tiles>
        <Tile label="Venta a precio de lista" valor={money(g.lista)} detalle="Lo que se hubiera cobrado sin ningún descuento" />
        <Tile label="Descuentos en total" valor={money(g.descuentos)} detalle={`${pctTxt(g.pctDescuentos)} del precio de lista`} />
        <Tile label="De eso, en ofertas" valor={money(g.enOfertas)} detalle={`${g.ofertas.length} oferta(s) con ventas en el período`} />
        <Tile label="Ganancia" valor={money(g.ganancia)} alerta={g.ganancia < 0} detalle={g.sinCosto > 0.005 ? `${money(g.sinCosto)} vendidos sin costo, aparte` : 'Sobre todo lo vendido con costo'} />
      </Tiles>

      <Bloque titulo="Del precio de lista a la venta neta" sub={`${fechaLarga(d.desde)} → ${fechaLarga(d.hasta)}. Cada descuento, en plata y en % del precio de lista.`}>
        <Table cols={[{ h: 'Concepto' }, { h: 'Importe', num: true }, { h: '% de la lista', num: true }]}>
          {pasos.map((p) => (
            <Fragment key={p.k}>
              <tr style={p.fuerte ? { background: 'var(--crm-color-surface-2, transparent)' } : undefined}>
                <td>
                  {p.fuerte ? <strong>{p.label}</strong> : p.label}
                  {p.nota && <div className={s.hint} style={{ margin: 0 }}>{p.nota}</div>}
                </td>
                <td className={s.num}><Plata v={p.v} fuerte={p.fuerte} rojo={p.k === 'ganancia'} /></td>
                <td className={s.num}>{g.lista > 0 ? pctTxt((Math.abs(p.v) / g.lista) * 100) : '—'}</td>
              </tr>
              {p.detalle?.map((x) => (
                <tr key={`${p.k}-${x.id}`}>
                  <td style={{ paddingLeft: 28 }} className={s.muted}>{x.nombre} <span className={s.hint}>· {num(x.renglones, 0)} renglón(es)</span></td>
                  <td className={s.num}><span className={s.muted}>{plata(-x.importe)}</span></td>
                  <td className={s.num}><span className={s.muted}>{g.lista > 0 ? pctTxt((x.importe / g.lista) * 100) : '—'}</span></td>
                </tr>
              ))}
            </Fragment>
          ))}
        </Table>
      </Bloque>

      <Bloque
        titulo="Cada oferta, ¿es rentable?"
        sub="Las ofertas con ventas en el período o que corrieron en él, medidas desde que empezaron (no solo en el período)."
        acciones={<Btn small onClick={exportar} disabled={!visibles.length}>Exportar CSV</Btn>}
      >
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {FILTROS.map(([id, label]) => (
            <button
              key={id || 'todas'} type="button" className={s.badge} onClick={() => setFiltro(id)}
              style={{
                cursor: 'pointer', padding: '5px 12px', fontSize: 12, border: '1px solid var(--crm-color-border)',
                ...(filtro === id ? { background: 'var(--crm-color-primary)', color: 'var(--crm-color-primary-contrast)', borderColor: 'var(--crm-color-primary)' } : {}),
              }}
            >
              {label}{id ? ` (${cuenta(id)})` : ''}
            </button>
          ))}
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
            <input type="checkbox" checked={soloVencer} onChange={(e) => setSoloVencer(e.target.checked)} /> Solo las de vencimiento
          </label>
        </div>
        {d.recortadas && <Aviso>Se muestran las 200 ofertas más nuevas del período: acortá las fechas para ver el resto.</Aviso>}

        <Table
          cols={[
            { h: 'Oferta' }, { h: 'Stock al empezar', num: true }, { h: 'Vendido con la oferta', num: true }, { h: 'Stock hoy', num: true },
            { h: 'Venta neta', num: true }, { h: 'Descuento dado', num: true }, { h: 'Ganancia', num: true },
            { h: 'A precio normal', num: true }, { h: 'Por día: antes → durante' }, { h: 'Veredicto' }, { h: '' },
          ]}
          empty={ofertas.length ? 'Ninguna oferta con ese filtro.' : 'No hubo ofertas en este período.'}
        >
          {visibles.flatMap((o) => {
            const v = o.vendido;
            const st = o.stock;
            const r = o.ritmo;
            const fila = (
              <tr key={o.id}>
                <td style={{ minWidth: 200 }}>
                  <strong>{o.nombre}</strong>
                  <div className={s.hint} style={{ margin: 0 }}>{mecanica(o)} · desde {fecha(o.inicio)}</div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                    <Pill pill={ESTADOS[o.estado]?.pill} label={ESTADOS[o.estado]?.label ?? o.estado} />
                    {o.porVencer && <Pill pill="est-pendiente" label={o.auto ? '⏳ vencimiento · automática' : '⏳ vencimiento'} />}
                  </div>
                </td>
                <td className={s.num}>
                  {!st.conFoto ? <span className={s.muted}>Sin foto</span> : st.fotografiados ? cant(st.inicial) : <span className={s.muted}>0 (sin stock)</span>}
                  {st.conFoto && !st.alEmpezar && <div className={s.hint} style={{ margin: 0 }}>foto del {fecha(st.tomadoEn)}</div>}
                </td>
                <td className={s.num}>
                  <strong>{cant(v.cantidades)}</strong>
                  {st.pctVendido != null && <div className={s.hint} style={{ margin: 0 }}>{pctTxt(st.pctVendido)} del stock</div>}
                </td>
                <td className={s.num}>{st.conFoto ? cant(st.hoy) : '—'}</td>
                <td className={s.num}>{money(v.neto)}</td>
                <td className={s.num}>{money(v.descuento)}</td>
                <td className={s.num}>
                  <Plata v={v.ganancia} fuerte />
                  {v.margen != null && <div className={s.hint} style={{ margin: 0 }}>{pctTxt(v.sobreCosto)} sobre el costo</div>}
                  {v.sinCosto > 0 && <div className={s.hint} style={{ margin: 0, color: 'var(--crm-color-danger)' }}>{v.sinCosto} renglón(es) sin costo, afuera</div>}
                </td>
                <td className={s.num}>{money(v.gananciaNormal)}</td>
                <td style={{ minWidth: 170 }}>
                  {r ? (
                    <>
                      <div>{cant(r.antes)} → <strong>{cant(r.durante)}</strong></div>
                      <div className={s.hint} style={{ margin: 0 }}>
                        ganancia {money(r.antes.ganancia)} → <span style={{ color: r.difGananciaDia < -0.005 ? 'var(--crm-color-danger)' : r.difGananciaDia > 0.005 ? 'var(--crm-color-success)' : undefined }}>{money(r.durante.ganancia)}</span>
                        {r.vecesUnidades != null && ` · ${num(r.vecesUnidades, 1)}× el ritmo`}
                      </div>
                    </>
                  ) : <span className={s.muted}>—</span>}
                </td>
                <td><Pill pill={VEREDICTOS[o.veredicto]?.pill} label={VEREDICTOS[o.veredicto]?.label ?? o.veredicto} /></td>
                <td>{o.articulos.length > 0 && <Btn small onClick={() => setAbierta(abierta === o.id ? null : o.id)}>{abierta === o.id ? 'Ocultar' : 'Detalle'}</Btn>}</td>
              </tr>
            );
            if (abierta !== o.id) return [fila];
            return [fila, (
              <tr key={`${o.id}-detalle`}>
                <td colSpan={11}>
                  <div className={s.hint} style={{ margin: '0 0 6px' }}>
                    {!st.conFoto
                      ? 'Esta oferta empezó antes de que el sistema sacara fotos del stock (20/10/2026): no se sabe con cuánto arrancó.'
                      : !st.fotografiados
                        ? `Cuando se sacó la foto (${fecha(st.tomadoEn)}) no había stock de lo que alcanza en sus sucursales.`
                        : st.alEmpezar
                          ? `El stock al empezar es la foto que el sistema sacó cuando arrancó la oferta (${fecha(st.tomadoEn)}), de las sucursales donde corre.`
                          : `La oferta ya venía corriendo cuando se sacó la foto (${fecha(st.tomadoEn)}): lo vendido antes de esa fecha no está en ese stock.`}
                    {r && ` El ritmo compara ${r.dias} día(s) de oferta (${fechaLarga(r.desde)} → ${fechaLarga(r.hasta)}) con los ${r.diasAntes} anteriores, contando todo lo vendido de estos productos, con o sin oferta.`}
                  </div>
                  <table className={s.table} style={{ width: 'auto' }}>
                    <thead>
                      <tr>
                        <th>Artículo</th><th className={s.num}>Stock al empezar</th><th className={s.num}>Vendido con la oferta</th>
                        <th className={s.num}>Stock hoy</th><th className={s.num}>Venta neta</th><th className={s.num}>Descuento</th><th className={s.num}>Ganancia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {o.articulos.map((a) => (
                        <tr key={`${a.productoId}-${a.presentacionId}`}>
                          <td>{a.nombre}</td>
                          <td className={s.num}>{a.stockInicial == null ? '—' : `${num(a.stockInicial)} ${a.unidad === 'kg' ? 'kg' : 'u.'}`}</td>
                          <td className={s.num}>{num(a.vendido)} {a.unidad === 'kg' ? 'kg' : 'u.'}</td>
                          <td className={s.num}>{num(a.stockHoy)} {a.unidad === 'kg' ? 'kg' : 'u.'}</td>
                          <td className={s.num}>{money(a.neto)}</td>
                          <td className={s.num}>{money(a.descuento)}</td>
                          <td className={s.num}><Plata v={a.ganancia} />{a.sinCosto > 0 && <span className={s.hint}> · {a.sinCosto} sin costo</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </td>
              </tr>
            )];
          })}
        </Table>
      </Bloque>

      <Bloque titulo="Qué significa cada número">
        <div className={s.hint} style={{ margin: 0, display: 'grid', gap: 6 }}>
          <div><strong>Precio de lista:</strong> lo que se habría cobrado con el precio de la lista del renglón, sin ningún descuento.</div>
          <div><strong>Precio cambiado a mano:</strong> la diferencia cuando en la caja se cobró otro precio que el de la lista.</div>
          <div><strong>Descuentos con nombre:</strong> los que se eligen por nombre (Efectivo, Empleados…); <strong>del cliente, a mano o del barrio:</strong> el % que tiene el cliente, que puso quien vendió o el del barrio de un pedido de la tienda.</div>
          <div><strong>Cupones de la tienda:</strong> lo que descontó cada código en los pedidos minoristas cerrados en la caja. El detalle de cada cupón está en Tienda online › Configuración › Cupones.</div>
          <div><strong>Descuento dado (oferta):</strong> lo que la oferta le restó al precio, neto. Es lo que «costó» la oferta.</div>
          <div><strong>Ganancia:</strong> venta neta menos el costo congelado al vender, solo de lo que tiene costo cargado. <strong>Sobre el costo:</strong> cuánto se ganó por cada $100 de mercadería.</div>
          <div><strong>A precio normal:</strong> lo que habrían dejado esas mismas unidades sin la oferta. La diferencia con la ganancia es lo que se resignó para vender más.</div>
          <div><strong>Stock al empezar:</strong> la foto del stock disponible de lo que alcanza la oferta, en sus sucursales, al arrancar. <strong>Stock hoy:</strong> lo que queda de lo mismo.</div>
          <div><strong>Por día, antes → durante:</strong> unidades y ganancia por día de esos productos (con o sin oferta) en la oferta y en la misma cantidad de días antes. Si vendió mucho más rápido y la ganancia por día no bajó, la oferta valió la pena.</div>
          <div><strong>Veredicto:</strong> <em>Rentable</em> si ganó; <em>Al costo</em> si quedó en el costo (±1 %); <em>Pierde plata</em> si vendió debajo del costo.</div>
        </div>
      </Bloque>
    </div>
  );
}
