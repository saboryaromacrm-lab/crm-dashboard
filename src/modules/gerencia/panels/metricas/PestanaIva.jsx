/**
 * GERENCIA › MÉTRICAS › RESULTADOS IVA (3/10/2026, pedido del dueño)
 * ============================================================================
 * «Ver bien dónde estoy parado»: cuánto se compró y vendió CON factura y SIN
 * factura (remito, liquidación, F10), con sus porcentajes, y el resultado de
 * IVA del mes — débito de lo facturado menos crédito de las compras y gastos
 * con factura A, menos percepciones, menos el saldo a favor que viene del mes
 * anterior. El cálculo es del servidor (`crm-api/src/metricas/iva.ts`).
 */
import { useRef, useState } from 'react';
import { httpClient } from '@core/services/httpClient.js';
import { errorMsg } from '@modules/ventas/services/ventas.api.js';
import { useResource } from '@modules/ventas/hooks/useResource.js';
import { descargarCsv, csvNum } from '@shared/utils/csv.js';
import { money, num } from '@modules/productos/domain/format.js';
import { Table, Btn, s } from '@modules/productos/components/ui.jsx';
import { ColumnasMulti, Reparto } from './graficos.jsx';
import { MESES, pctTxt } from './formato.js';
import { Aviso, Bloque, Cargando, Grilla, Tile, Tiles } from './piezas.jsx';

const C_FACT = 'var(--crm-color-primary)';
const C_PEND = '#2563eb';
const C_SIN = '#ea580c';
const C_DEB = '#dc2626';
const C_CRED = 'var(--crm-color-primary)';
const nombreMes = (m) => `${MESES[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

/** Un renglón «nombre · importe · %» con su color. */
function Fila({ color, nombre, importe, pct, detalle }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: '2px 10px', alignItems: 'baseline' }}>
      <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 3, background: color || 'transparent' }} />
      <span>{nombre}{detalle && <span className={s.muted} style={{ fontSize: 12 }}> · {detalle}</span>}</span>
      <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{money(importe)}</strong>
      <span style={{ minWidth: 56, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{pct != null ? pctTxt(pct) : ''}</span>
    </div>
  );
}

/** Un paso de la cuenta del IVA: «− Crédito de compras A … $X». */
function Paso({ signo, nombre, importe, fuerte, ayuda }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '4px 0', borderTop: fuerte ? '2px solid var(--crm-color-border, #e5e7eb)' : undefined, fontWeight: fuerte ? 700 : 400 }}>
      <span title={ayuda}>{signo && <span style={{ display: 'inline-block', width: 16 }}>{signo}</span>}{nombre}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{money(importe)}</span>
    </div>
  );
}

/** El saldo a favor con el que se arranca (el de la última declaración de la contadora). */
function SaldoInicial({ actual, onGuardado }) {
  const [importe, setImporte] = useState(String(actual?.importe ?? 0));
  const [mes, setMes] = useState(actual?.mes ?? '');
  const [msg, setMsg] = useState(null);
  const enVuelo = useRef(false);
  const [guardando, setGuardando] = useState(false);
  /* Sin mes el servidor no usa el saldo: se exige el mes, o se guarda vacío (Quitar). */
  const guardar = async (m = mes, imp = importe) => {
    if (enVuelo.current) return;
    const valor = Math.max(0, Number(imp) || 0);
    if (!/^\d{4}-\d{2}$/.test(m) && (m || valor > 0)) { setMsg({ tono: 'warn', texto: 'Elegí el mes en que arranca ese saldo.' }); return; }
    enVuelo.current = true; setGuardando(true); setMsg(null);
    try {
      await httpClient.put('/configuracion/empresa', { ivaSaldoInicial: m ? valor : 0, ivaSaldoMes: m });
      setMsg({ tono: 'ok', texto: m ? 'Guardado. El resultado ya lo arrastra.' : 'Saldo inicial quitado.' });
      onGuardado?.();
    } catch (e) {
      setMsg({ tono: 'warn', texto: errorMsg(e) || 'No se pudo guardar.' });
    } finally {
      enVuelo.current = false; setGuardando(false);
    }
  };
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div className={s.hint} style={{ margin: 0 }}>
        El saldo a favor de IVA con el que arrancás, el de la última declaración de tu contadora. Desde ese mes, el sistema lo arrastra solo: lo que queda a favor un mes se descuenta en el siguiente.
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label className={s.field} style={{ margin: 0 }}>
          <span>Saldo a favor al comienzo de</span>
          <input id="iva-saldo-mes" type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
        </label>
        <label className={s.field} style={{ margin: 0 }}>
          <span>Importe</span>
          <input id="iva-saldo-importe" type="number" min="0" step="0.01" value={importe} onChange={(e) => setImporte(e.target.value)} />
        </label>
        <Btn variant="btn-primary" onClick={() => guardar()} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar saldo inicial'}</Btn>
        {actual?.mes && <Btn onClick={() => guardar('', 0)} disabled={guardando}>Quitar</Btn>}
      </div>
      {msg && <Aviso tono={msg.tono}>{msg.texto}</Aviso>}
    </div>
  );
}

export function PestanaIva({ qs, version }) {
  const [propia, setPropia] = useState(0);
  const { data: d, loading, error } = useResource(`metricas:iva:${qs}:${version}:${propia}`, () => httpClient.get(`/metricas/iva?${qs}`));
  if (loading && !d) return <Cargando />;
  if (error) return <Aviso tono="warn">{String(error)}</Aviso>;
  if (!d) return null;
  const { ventas: v, compras: c, gastos: g, iva } = d;
  const aPagar = iva.aPagar > 0.009;
  const cm = iva.cuentaMes;
  const exportar = () => descargarCsv(`resultados-iva-${d.periodo.desde}-${d.periodo.hasta}.csv`,
    ['Mes', 'Ventas facturadas', 'Ventas sin factura (F10)', '% ventas facturadas', 'Compras facturadas', 'Compras sin factura', '% compras facturadas',
      'Débito fiscal', 'Crédito fiscal', 'Percepciones IVA', 'Saldo a favor anterior', 'A pagar', 'Saldo a favor que pasa'],
    d.meses.map((m) => [m.mes, csvNum(m.ventasFacturadas), csvNum(m.ventasLiquidadas), csvNum(m.pctVentasFacturadas ?? ''), csvNum(m.comprasFacturadas), csvNum(m.comprasSinFactura),
      csvNum(m.pctComprasFacturadas ?? ''), csvNum(m.debito), csvNum(m.credito), csvNum(m.percepciones), csvNum(m.saldoAnterior), csvNum(m.aPagar), csvNum(m.saldoAFavor)]));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {d.avisos.map((a) => <Aviso key={a} tono="warn">{a}</Aviso>)}

      <Tiles>
        <Tile
          label={aPagar ? 'IVA a pagar (último mes del período)' : 'Saldo a favor (último mes del período)'}
          valor={money(aPagar ? iva.aPagar : iva.saldoAFavor)} alerta={aPagar}
          detalle={d.meses.length > 1 ? `En todo el período: ${money(iva.aPagarPeriodo)} a pagar` : 'Débito − crédito − percepciones − saldo a favor anterior'}
        />
        <Tile label="Débito fiscal (IVA de tus ventas)" valor={money(iva.debito)} marca={C_DEB} detalle={iva.debitoPendiente > 0 ? `incluye ${money(iva.debitoPendiente)} pendiente de CAE` : 'de lo facturado'} />
        <Tile label="Crédito fiscal (IVA de tus compras)" valor={money(iva.credito)} marca={C_CRED} detalle={`mercadería ${money(iva.creditoCompras)} · gastos ${money(iva.creditoGastos)}`} />
        <Tile label="Percepciones de IVA" valor={money(iva.percepciones)} detalle="te las cobraron a cuenta: restan" />
      </Tiles>

      <Grilla>
        <Bloque titulo="Ventas: con factura y sin factura" sub={`Total vendido ${money(v.total)} (con IVA, las notas de crédito restan)`}>
          <Reparto partes={[
            { nombre: 'Facturado', valor: v.facturado.total, color: C_FACT },
            { nombre: 'Pendiente de CAE', valor: v.pendiente.total, color: C_PEND },
            { nombre: 'Sin factura (F10)', valor: v.liquidado.total, color: C_SIN },
          ]} />
          <Fila color={C_FACT} nombre="Facturado (F8)" importe={v.facturado.total} pct={v.pct.facturado} detalle={`${v.facturado.comprobantes} facturas${v.facturado.notas ? ` · ${v.facturado.notas} NC` : ''} · IVA ${money(v.facturado.iva)}`} />
          {v.pendiente.comprobantes > 0 && <Fila color={C_PEND} nombre="Pendiente de CAE (ARCA caída)" importe={v.pendiente.total} pct={v.pct.pendiente} detalle={`${v.pendiente.comprobantes} · IVA ${money(v.pendiente.iva)}`} />}
          <Fila color={C_SIN} nombre="Sin factura (liquidado F10)" importe={v.liquidado.total} pct={v.pct.liquidado} detalle={`${v.liquidado.comprobantes} tickets`} />
        </Bloque>

        <Bloque titulo="Compras: con factura y sin factura" sub={`Mercadería comprada ${money(c.total)} (neto en las A; total en B, C y sin factura)`}>
          <Reparto partes={[
            { nombre: 'Con factura', valor: c.facturado, color: C_FACT },
            { nombre: 'Sin factura', valor: c.sinFactura.total, color: C_SIN },
          ]} />
          <Fila color={C_FACT} nombre="Con factura A (neto)" importe={c.facturaA.neto} detalle={`${c.facturaA.comprobantes} facturas${c.facturaA.notas ? ` · ${c.facturaA.notas} NC` : ''} · IVA ${money(c.facturaA.iva)}`} />
          <Fila color={C_FACT} nombre="Con factura B / C" importe={c.facturaBC.total} detalle={`${c.facturaBC.comprobantes} · su IVA no se descuenta`} />
          <Fila nombre={<strong>Total con factura</strong>} importe={c.facturado} pct={c.pct.facturado} />
          <Fila color={C_SIN} nombre="Sin factura (liquidaciones)" importe={c.sinFactura.total} pct={c.pct.sinFactura} detalle={`${c.sinFactura.comprobantes}`} />
          {c.remitos.comprobantes > 0 && <Fila nombre="Remitos todavía sin facturar (aparte)" importe={c.remitos.total} detalle={`${c.remitos.comprobantes}`} />}
        </Bloque>
      </Grilla>

      <Grilla>
        <Bloque titulo="Cómo se llega al resultado" sub={cm ? `${nombreMes(cm.mes)}, del día 1 al ${Number(d.periodo.hasta.slice(8))}` : ''}>
          {cm && (
            <div style={{ display: 'grid' }}>
              <Paso nombre="Débito fiscal de lo facturado" importe={cm.debitoFacturado} />
              {cm.debitoPendiente > 0 && <Paso signo="+" nombre="Débito de lo pendiente de CAE" importe={cm.debitoPendiente} />}
              <Paso signo="−" nombre="Crédito de compras con factura A" importe={cm.creditoCompras} />
              <Paso signo="−" nombre="Crédito de gastos con factura A" importe={cm.creditoGastos} />
              <Paso signo="−" nombre="Percepciones de IVA de compras" importe={cm.percepcionesCompras} />
              <Paso signo="−" nombre="Percepciones de IVA de gastos" importe={cm.percepcionesGastos} />
              <Paso nombre="Resultado del mes" importe={cm.resultado} fuerte />
              <Paso signo="−" nombre="Saldo a favor que venía del mes anterior" importe={iva.saldoAnterior} />
              <Paso nombre={aPagar ? 'A PAGAR' : 'SALDO A FAVOR que pasa al mes siguiente'} importe={aPagar ? iva.aPagar : iva.saldoAFavor} fuerte />
              {d.meses.length > 1 && <Paso nombre="A pagar en todo el período (suma de los meses, ver Mes a mes)" importe={iva.aPagarPeriodo} />}
            </div>
          )}
          <div className={s.hint} style={{ margin: 0 }}>Es una cuenta de gestión para saber dónde estás parado. La declaración la hace tu contadora (retenciones, saldos de libre disponibilidad, etc.).</div>
        </Bloque>

        <Bloque titulo="Indicadores" sub="Para leer el resultado">
          <div style={{ display: 'grid', gap: 10 }}>
            <div>
              <div className={s['mini-label']}>Balance de lo facturado</div>
              <div style={{ fontSize: 15 }}>
                {d.cobertura == null ? 'No hubo compras con factura en el período.' : <>Por cada <strong>$100</strong> que compraste con factura, vendiste <strong>{money(d.cobertura)}</strong> facturado.</>}
              </div>
              <div className={s.hint} style={{ margin: 0 }}>Si vendés facturado mucho más de lo que comprás facturado, el IVA a pagar sube.</div>
            </div>
            <div>
              <div className={s['mini-label']}>IVA que pagás por comprar sin factura</div>
              <div style={{ fontSize: 15 }}><strong>{money(iva.ivaAbsorbido)}</strong> del débito corresponde a mercadería que entró sin factura: ese IVA no tiene crédito que lo descuente.</div>
            </div>
            {iva.porAlicuota.length > 0 && (
              <div>
                <div className={s['mini-label']}>Débito por alícuota</div>
                {iva.porAlicuota.map((a) => (
                  <div key={a.alicuota} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontVariantNumeric: 'tabular-nums' }}>
                    <span>{num(a.alicuota, 1)} % sobre {money(a.neto)}</span><strong>{money(a.iva)}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Bloque>
      </Grilla>

      <Bloque titulo="Mes a mes" sub="Débito contra crédito y percepciones, y el saldo a favor que se arrastra" acciones={<Btn small onClick={exportar}>Exportar para la contadora</Btn>}>
        {d.meses.length > 1 && (
          <ColumnasMulti
            titulo="Débito y crédito por mes"
            series={[{ nombre: 'Débito fiscal', color: C_DEB }, { nombre: 'Crédito + percepciones', color: C_CRED }]}
            datos={d.meses.map((m) => ({ etiqueta: nombreMes(m.mes).slice(0, 3), titulo: nombreMes(m.mes), valores: [m.debito, m.credito + m.percepciones] }))}
            formato={money}
          />
        )}
        <div style={{ overflowX: 'auto' }}>
          <Table cols={[
            { h: 'Mes' }, { h: 'Ventas facturadas', num: true }, { h: '% fact.', num: true }, { h: 'Compras con factura', num: true }, { h: '% fact.', num: true },
            { h: 'Débito', num: true }, { h: 'Crédito + perc.', num: true }, { h: 'A favor anterior', num: true }, { h: 'A pagar', num: true }, { h: 'Queda a favor', num: true },
          ]}>
            {d.meses.map((m) => (
              <tr key={m.mes}>
                <td>{nombreMes(m.mes)}</td>
                <td className={s.num}>{money(m.ventasFacturadas)}</td>
                <td className={s.num}>{pctTxt(m.pctVentasFacturadas)}</td>
                <td className={s.num}>{money(m.comprasFacturadas)}</td>
                <td className={s.num}>{pctTxt(m.pctComprasFacturadas)}</td>
                <td className={s.num}>{money(m.debito)}</td>
                <td className={s.num}>{money(m.credito + m.percepciones)}</td>
                <td className={s.num}>{money(m.saldoAnterior)}</td>
                <td className={s.num}><strong>{m.aPagar > 0 ? money(m.aPagar) : '—'}</strong></td>
                <td className={s.num}>{m.saldoAFavor > 0 ? money(m.saldoAFavor) : '—'}</td>
              </tr>
            ))}
          </Table>
        </div>
      </Bloque>

      <Grilla>
        <Bloque titulo="Por proveedor: con y sin factura" sub="Del período elegido, los 20 que más se les compró">
          {d.porProveedor.length ? (
            <div style={{ overflowX: 'auto' }}>
              <Table cols={[{ h: 'Proveedor' }, { h: 'Con factura', num: true }, { h: 'Sin factura', num: true }, { h: '% sin factura', num: true }]}>
                {d.porProveedor.map((p) => (
                  <tr key={p.proveedorId}>
                    <td>{p.proveedor}</td>
                    <td className={s.num}>{money(p.facturado)}</td>
                    <td className={s.num}>{money(p.sinFactura)}</td>
                    <td className={s.num}>{pctTxt(p.pctSinFactura)}</td>
                  </tr>
                ))}
              </Table>
            </div>
          ) : <div className={s.hint} style={{ margin: 0 }}>Sin compras en el período.</div>}
        </Bloque>
        <Bloque titulo="Saldo a favor inicial">
          <SaldoInicial key={`${d.saldoInicial.mes}:${d.saldoInicial.importe}`} actual={d.saldoInicial} onGuardado={() => setPropia((x) => x + 1)} />
          <div className={s.hint} style={{ margin: 0 }}>Gastos del período: {money(g.total)} en {g.cantidad} comprobante{g.cantidad === 1 ? '' : 's'}; con factura A, {money(g.netoA)} neto.</div>
        </Bloque>
      </Grilla>
    </div>
  );
}
