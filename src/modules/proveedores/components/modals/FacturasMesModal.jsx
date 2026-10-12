import { useEffect, useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { usePermissions } from '@core/permissions/PermissionContext.jsx';
import { useProveedores } from '../../context/ProveedoresContext.jsx';
import { provApi } from '../../services/proveedores.api.js';
import { Btn, Di, ModalShell, Pill, Table, fmtFecha, money, num, s } from '../ui.jsx';
import { AvisoSegundaConfirmacion, textoBoton, useSegundaConfirmacion } from '@modules/gastos/components/segundaConfirmacion.jsx';

/*
 * FACTURAS DEL MES (0158). El proveedor entrega con remitos SIN IVA (lo que se
 * le paga) y a fin de mes factura todo junto; por cada factura cobra aparte una
 * comisión sin factura. Acá se cargan esas facturas: entran SOLO al IVA (por su
 * fecha); las entregas del mes quedan como la deuda sin IVA y la comisión como
 * deuda aparte. El stock no se toca.
 */

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
/** Lo que se copia del papel: «6.621.656,88», «6621656,88» o «6621656.88». */
const aNum = (v) => {
  const t = String(v ?? '').trim().replace(/[\s$]/g, '');
  if (!t) return NaN;
  if (t.includes(',')) return Number(t.replace(/\./g, '').replace(',', '.'));
  return Number(/^\d{1,3}(\.\d{3})+$/.test(t) ? t.replace(/\./g, '') : t);
};
const val = (v) => (Number.isFinite(aNum(v)) ? aNum(v) : 0);
const FACTURA_VACIA = (letra) => ({
  letra, puntoVenta: '', numero: '', fecha: '', neto: '', iva: '', percIva: '', percIibb: '', percOtras: '', total: '', comision: '',
});

/** Las cuentas de una factura cargada en pantalla. */
function cuentas(f) {
  const neto = val(f.neto);
  const iva = f.letra === 'A' ? val(f.iva) : 0;
  const perc = val(f.percIva) + val(f.percIibb) + val(f.percOtras);
  const calculado = r2(neto + iva + perc);
  const papel = aNum(f.total);
  return { neto, iva, perc, calculado, papel, cierra: Number.isFinite(papel) && Math.abs(papel - calculado) <= 0.05, comision: val(f.comision) };
}

export function FacturasMesModal({ proveedorId, onDone }) {
  const { act, closeModal, toast } = useProveedores();
  const { esAdmin } = usePermissions();
  const [mes, setMes] = useState('');
  const [d, setD] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [facturas, setFacturas] = useState([]);
  const [observaciones, setObservaciones] = useState('');
  const [motivo, setMotivo] = useState('');
  const [anulando, setAnulando] = useState(false);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    provApi.facturasMes(proveedorId, mes || undefined)
      .then((r) => {
        if (!vivo) return;
        setD(r);
        if (!mes) setMes(r.mes);
        setFacturas([FACTURA_VACIA(r.proveedor.letras?.[0] ?? 'A')]);
        setAnulando(false); setMotivo('');
      })
      .catch((e) => { if (vivo) toast(e?.data?.message || 'No se pudieron leer las facturas del mes.', 'err'); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [proveedorId, mes, toast]);

  const filas = useMemo(() => facturas.map(cuentas), [facturas]);
  const tot = useMemo(() => ({
    neto: r2(filas.reduce((a, x) => a + x.neto, 0)),
    iva: r2(filas.reduce((a, x) => a + x.iva, 0)),
    perc: r2(filas.reduce((a, x) => a + x.perc, 0)),
    total: r2(filas.reduce((a, x) => a + x.calculado, 0)),
    comision: r2(filas.reduce((a, x) => a + x.comision, 0)),
  }), [filas]);

  const cargar = useSegundaConfirmacion(JSON.stringify({ mes, facturas, observaciones }));
  const anular = useSegundaConfirmacion(`${d?.facturacion?.id}|${motivo}`);

  if (cargando && !d) {
    return (
      <ModalShell title="Facturas del mes" onClose={closeModal} size="lg">
        <div className={s['empty-state']}>Cargando…</div>
      </ModalShell>
    );
  }
  if (!d) return null;

  const p = d.proveedor;
  const hecha = d.facturacion;
  const entregas = d.entregas ?? [];
  const remitos = entregas.filter((e) => e.tipo === 'remito');
  const sugerida = Number(d.comisionSugerida) || 0;
  const diferencia = r2(tot.neto - d.netoEntregas);
  const pctDif = d.netoEntregas > 0 ? (diferencia / d.netoEntregas) * 100 : 0;
  const pctComision = tot.neto > 0 ? (tot.comision / tot.neto) * 100 : 0;
  const puedeCargar = esAdmin && p.facturaMensual && !hecha && entregas.length > 0;

  const setF = (i, k) => (e) => setFacturas((xs) => xs.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)));
  /* Como se escribe acá: con coma decimal (`aNum` la lee igual). */
  const llenar = (i, k, v) => setFacturas((xs) => xs.map((x, j) => (j === i ? { ...x, [k]: String(r2(v)).replace('.', ',') } : x)));

  const validar = () => {
    for (const [i, f] of facturas.entries()) {
      const c = filas[i];
      const n = `Factura ${i + 1}`;
      if (!(Number(f.numero) > 0) || !Number.isInteger(Number(f.numero))) { toast(`${n}: poné su número.`, 'err'); return false; }
      if (!f.fecha) { toast(`${n}: poné su fecha.`, 'err'); return false; }
      if (!(c.neto > 0)) { toast(`${n}: poné su neto.`, 'err'); return false; }
      if (f.letra === 'A' && String(f.iva).trim() === '') { toast(`${n}: poné su IVA (0 si no tiene).`, 'err'); return false; }
      if (!Number.isFinite(c.papel)) { toast(`${n}: poné el total del papel, para controlar que cierre.`, 'err'); return false; }
      if (!c.cierra) { toast(`${n}: no cierra — neto + IVA + percepciones da ${money(c.calculado)} y el papel dice ${money(c.papel)}.`, 'err'); return false; }
    }
    return true;
  };

  const confirmarCarga = () => cargar.clic(validar, async () => {
    const res = await act(provApi.cargarFacturasMes(proveedorId, {
      mes: d.mes,
      observaciones: observaciones.trim() || undefined,
      facturas: facturas.map((f, i) => ({
        letra: f.letra, puntoVenta: f.puntoVenta || '1', numero: Number(f.numero), fecha: f.fecha,
        neto: filas[i].neto, iva: filas[i].iva, percIva: val(f.percIva), percIibb: val(f.percIibb), percOtras: val(f.percOtras),
        total: filas[i].papel, comision: filas[i].comision,
      })),
    }), `Facturas de ${d.nombreMes} cargadas.`);
    if (res) onDone?.();
  });

  const confirmarAnulacion = () => anular.clic(() => {
    if (motivo.trim().length < 3) { toast('Escribí el motivo de la anulación.', 'err'); return false; }
    return true;
  }, async () => {
    const res = await act(provApi.anularFacturasMes(hecha.id, motivo.trim()), `Facturas de ${d.nombreMes} anuladas.`);
    if (res) onDone?.();
  });

  const pendientes = (d.meses ?? []).filter((m) => m.pendientes > 0 && m.mes !== d.mes);
  const footer = [{ texto: hecha || !puedeCargar ? 'Cerrar' : 'Cancelar', clase: 'btn-ghost', onClick: closeModal }];
  if (puedeCargar) footer.push({ texto: textoBoton(cargar, 'Cargar facturas…', 'Sí, cargar las facturas'), clase: 'btn-primary', onClick: confirmarCarga });
  if (hecha && esAdmin && anulando) footer.push({ texto: textoBoton(anular, 'Anular…', 'Sí, anular'), clase: 'btn-delete', onClick: confirmarAnulacion });

  return (
    <ModalShell
      title={`Facturas del mes · ${p.nombre}`}
      subtitle="Junta las entregas sin IVA y factura a fin de mes: las facturas van al IVA, se paga lo de las entregas y la comisión"
      onClose={closeModal}
      size="lg"
      footer={footer}
    >
      {!p.facturaMensual && (
        <div className={cx(s.callout, s.warn)}>
          Este proveedor no está marcado como «Junta los remitos y factura a fin de mes». Tildalo en su ficha para cargar sus facturas del mes.
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 12 }}>
        <div className={s.field} style={{ margin: 0 }}>
          <label htmlFor="facturas-mes-mes">Mes de las entregas</label>
          <input id="facturas-mes-mes" type="month" value={mes} max={d.mesActual} onChange={(e) => e.target.value && setMes(e.target.value)} />
        </div>
        {pendientes.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className={s.hint} style={{ margin: 0 }}>Sin sus facturas:</span>
            {pendientes.map((m) => (
              <Btn key={m.mes} small onClick={() => setMes(m.mes)}>{m.nombre} ({m.pendientes})</Btn>
            ))}
          </div>
        )}
      </div>

      {hecha ? (
        <>
          <div className={cx(s.callout, s.info)}>
            Las facturas de <strong>{d.nombreMes}</strong> ya están cargadas{hecha.usuario ? ` (${hecha.usuario}, ${fmtFecha(hecha.creadoEn)})` : ''}.
            Cubren {hecha.entregas.length} entrega(s) por {money(hecha.netoDocumentos)} sin IVA.
            {entregas.length > 0 && <> <strong>Ojo:</strong> hay {entregas.length} entrega(s) de este mes cargadas después, que no están cubiertas: anulá estas facturas y volvé a cargarlas.</>}
          </div>
          <div className={s['section-title']}>Facturas</div>
          <Table cols={[{ h: 'Factura' }, { h: 'Fecha' }, { h: 'Neto', num: true }, { h: 'IVA', num: true }, { h: 'Percepciones', num: true }, { h: 'Total', num: true }, { h: 'Comisión', num: true }]}>
            {hecha.facturas.map((f) => (
              <tr key={f.id}>
                <td>{f.etiqueta}</td>
                <td>{fmtFecha(f.fecha)}</td>
                <td className={s.num}>{money(f.neto)}</td>
                <td className={s.num}>{money(f.iva)}</td>
                <td className={s.num}>{money(f.percIva + f.percIibb + f.percOtras)}</td>
                <td className={s.num}>{money(f.total)}</td>
                <td className={s.num}>
                  {f.comision > 0 ? money(f.comision) : '—'}
                  {f.comisionDoc && (
                    <div>
                      <Pill
                        pill={f.comisionDoc.pagado >= f.comision - 0.009 ? 'est-recibida' : 'est-pendiente'}
                        label={f.comisionDoc.pagado >= f.comision - 0.009 ? 'pagada' : (f.comisionDoc.pagado > 0 ? `pagado ${money(f.comisionDoc.pagado)}` : 'a pagar')}
                      />
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </Table>
          <div className={s['detalle-grid']} style={{ marginTop: 10 }}>
            <Di label="IVA crédito (por la fecha de cada factura)">{money(hecha.totales.iva)}</Di>
            <Di label="Comisión (deuda aparte, sin factura)">{money(hecha.totales.comision)}</Di>
            <Di label="Lo que se paga de las entregas (sin IVA)">{money(hecha.netoDocumentos)}</Di>
          </div>
          {esAdmin && !anulando && (
            <div style={{ marginTop: 12 }}>
              <Btn small onClick={() => setAnulando(true)}>Anular estas facturas…</Btn>
            </div>
          )}
          {anulando && (
            <div style={{ marginTop: 12 }}>
              <AvisoSegundaConfirmacion confirmando={anular.confirmando} gemelo={null}>
                Su IVA deja de contar y la comisión se anula (si tiene pagos, primero desaplicalos en Pagos). Las entregas
                siguen como liquidaciones —se deben igual— y quedan esperando sus facturas.
              </AvisoSegundaConfirmacion>
              <div className={s.field}>
                <label htmlFor="facturas-mes-motivo">Por qué se anulan <span className={s.req}>*</span></label>
                <input id="facturas-mes-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Se cargó mal un importe, faltaba una entrega…" />
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className={s['section-title']}>Entregas de {d.nombreMes} sin sus facturas</div>
          {entregas.length === 0 ? (
            <div className={s['empty-state']}>No hay entregas de {d.nombreMes} esperando sus facturas.</div>
          ) : (
            <Table cols={[{ h: 'Entrega' }, { h: 'Fecha' }, { h: 'Sin IVA (lo que se paga)', num: true }, { h: 'Pagado', num: true }]}>
              {entregas.map((e) => (
                <tr key={e.id}>
                  <td>{e.etiqueta}</td>
                  <td>{fmtFecha(e.fecha)}</td>
                  <td className={s.num}>{money(e.neto)}</td>
                  <td className={s.num}>{e.pagado > 0 ? money(e.pagado) : '—'}</td>
                </tr>
              ))}
            </Table>
          )}

          {puedeCargar && (
            <>
              <div className={s['section-title']} style={{ marginTop: 14 }}>Las facturas que hizo (como dice cada papel)</div>
              {facturas.map((f, i) => {
                const c = filas[i];
                return (
                  <div key={i} style={{ border: '1px solid var(--crm-color-border)', borderRadius: 8, padding: 12, marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <strong>Factura {i + 1}</strong>
                      {facturas.length > 1 && <Btn small onClick={() => setFacturas((xs) => xs.filter((_, j) => j !== i))}>Quitar</Btn>}
                    </div>
                    <div className={s['form-grid']} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
                      <Campo id={`fm-letra-${i}`} label="Letra">
                        <select id={`fm-letra-${i}`} value={f.letra} onChange={setF(i, 'letra')}>
                          {(p.letras ?? ['A']).map((l) => <option key={l} value={l}>{l}</option>)}
                        </select>
                      </Campo>
                      <Campo id={`fm-pv-${i}`} label="Punto de venta">
                        <input id={`fm-pv-${i}`} inputMode="numeric" value={f.puntoVenta} onChange={setF(i, 'puntoVenta')} placeholder="0003" />
                      </Campo>
                      <Campo id={`fm-numero-${i}`} label="Número" req>
                        <input id={`fm-numero-${i}`} inputMode="numeric" value={f.numero} onChange={setF(i, 'numero')} placeholder="1234" />
                      </Campo>
                      <Campo id={`fm-fecha-${i}`} label="Fecha" req>
                        <input id={`fm-fecha-${i}`} type="date" value={f.fecha} onChange={setF(i, 'fecha')} />
                      </Campo>
                      <Campo id={`fm-neto-${i}`} label={f.letra === 'A' ? 'Neto gravado' : 'Importe (sin percepciones)'} req>
                        <input id={`fm-neto-${i}`} inputMode="decimal" value={f.neto} onChange={setF(i, 'neto')} placeholder="0,00" />
                      </Campo>
                      {f.letra === 'A' && (
                        <Campo
                          id={`fm-iva-${i}`} label="IVA" req
                          extra={c.neto > 0 && <button type="button" className={s.hint} style={{ border: 0, background: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }} onClick={() => llenar(i, 'iva', c.neto * 0.21)}>= 21 %</button>}
                        >
                          <input id={`fm-iva-${i}`} inputMode="decimal" value={f.iva} onChange={setF(i, 'iva')} placeholder="0,00" />
                        </Campo>
                      )}
                      <Campo id={`fm-perc-iva-${i}`} label="Percepción IVA">
                        <input id={`fm-perc-iva-${i}`} inputMode="decimal" value={f.percIva} onChange={setF(i, 'percIva')} placeholder="0" />
                      </Campo>
                      <Campo id={`fm-perc-iibb-${i}`} label="Percepción IIBB">
                        <input id={`fm-perc-iibb-${i}`} inputMode="decimal" value={f.percIibb} onChange={setF(i, 'percIibb')} placeholder="0" />
                      </Campo>
                      <Campo id={`fm-perc-otras-${i}`} label="Otras percepciones">
                        <input id={`fm-perc-otras-${i}`} inputMode="decimal" value={f.percOtras} onChange={setF(i, 'percOtras')} placeholder="0" />
                      </Campo>
                      <Campo id={`fm-total-${i}`} label="Total del papel" req>
                        <input id={`fm-total-${i}`} inputMode="decimal" value={f.total} onChange={setF(i, 'total')} placeholder="0,00" />
                      </Campo>
                      <Campo
                        id={`fm-comision-${i}`} label="Comisión que te cobra"
                        extra={sugerida > 0 && c.neto > 0 && <button type="button" className={s.hint} style={{ border: 0, background: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }} onClick={() => llenar(i, 'comision', c.neto * sugerida / 100)}>= {num(sugerida, 2)} %</button>}
                      >
                        <input id={`fm-comision-${i}`} inputMode="decimal" value={f.comision} onChange={setF(i, 'comision')} placeholder="0,00" />
                      </Campo>
                    </div>
                    {c.neto > 0 && (
                      <div className={s.hint} style={{ margin: '4px 0 0', color: Number.isFinite(c.papel) && !c.cierra ? 'var(--crm-color-danger)' : undefined }}>
                        Neto + IVA + percepciones = <strong>{money(c.calculado)}</strong>
                        {Number.isFinite(c.papel) ? (c.cierra ? ' ✓ cierra con el papel.' : ` ✗ el papel dice ${money(c.papel)}: revisá.`) : ' — poné el total del papel para controlarlo.'}
                        {c.comision > 0 && ` Comisión: ${num((c.comision / c.neto) * 100, 2)} % del neto.`}
                      </div>
                    )}
                  </div>
                );
              })}
              <Btn small onClick={() => setFacturas((xs) => [...xs, FACTURA_VACIA(xs[xs.length - 1]?.letra ?? 'A')])}>+ Otra factura</Btn>

              <div className={s['section-title']} style={{ marginTop: 14 }}>Cómo queda {d.nombreMes}</div>
              <div className={s['detalle-grid']}>
                <Di label="Entregas (sin IVA): lo que le pagás">{money(d.netoEntregas)}</Di>
                <Di label="Facturas: neto">{money(tot.neto)}</Di>
                <Di label="IVA crédito (por la fecha de cada factura)">{money(tot.iva)}</Di>
                <Di label="Percepciones">{tot.perc > 0 ? money(tot.perc) : '—'}</Di>
                <Di label="Comisión (deuda aparte, sin factura)">{tot.comision > 0 ? `${money(tot.comision)} · ${num(pctComision, 2)} %` : '—'}</Di>
                <Di label="Diferencia facturas − entregas">{tot.neto > 0 ? `${diferencia < 0 ? '−' : ''}${money(Math.abs(diferencia))} (${num(pctDif, 2)} %)` : '—'}</Di>
              </div>
              {tot.neto > 0 && Math.abs(pctDif) > 1 && (
                <div className={cx(s.callout, s.warn)} style={{ marginTop: 8 }}>
                  {diferencia > 0
                    ? <>Las facturas son por <strong>más</strong> de lo que entregó: el IVA de esa diferencia sería crédito de mercadería que no entró. Revisalo con tu contadora antes de cargarlas.</>
                    : <>Las facturas cubren <strong>menos</strong> de lo que entregó: el IVA que recuperás es solo el de los papeles. Si falta una factura, agregala.</>}
                </div>
              )}
              {tot.comision > 0 && sugerida > 0 && Math.abs(pctComision - sugerida) > 0.05 && (
                <div className={cx(s.callout, s.info)} style={{ marginTop: 8 }}>
                  Sus productos tienen <strong>{num(sugerida, 2)} %</strong> de comisión en el costo y esta es de <strong>{num(pctComision, 2)} %</strong>.
                  Si va a seguir así, actualizala en su ficha (Comisión % a todos sus productos).
                </div>
              )}
              {tot.comision > 0 && sugerida === 0 && (
                <div className={cx(s.callout, s.info)} style={{ marginTop: 8 }}>
                  Sus productos no tienen comisión en el costo: cargá la de {num(pctComision, 2)} % en su ficha (Comisión % a todos sus productos) para que la góndola la cubra.
                </div>
              )}
              <div className={s.hint} style={{ marginTop: 8 }}>
                Al cargarlas: el IVA de las facturas entra como crédito en Resultados IVA (confirmalo con tu contadora:
                las entregas se pagan sin IVA){remitos.length > 0 && <>; los <strong>{remitos.length} remito(s)</strong> pasan a liquidación y empiezan a deber su valor sin IVA</>};
                la comisión queda como deuda aparte, para pagar desde Pagos. El stock no se mueve. La comisión <strong>no</strong> se carga como gasto: ya está en el costo de los productos.
              </div>
              <div className={s.field} style={{ marginTop: 10 }}>
                <label htmlFor="facturas-mes-obs">Observaciones</label>
                <input id="facturas-mes-obs" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Opcional" />
              </div>
              <AvisoSegundaConfirmacion confirmando={cargar.confirmando} gemelo={null}>
                Se cargan {facturas.length} factura(s) de {d.nombreMes} con <strong>{money(tot.iva)}</strong> de IVA crédito.
                {remitos.length > 0 && <> {remitos.length} remito(s) empiezan a deber {money(remitos.reduce((a, e) => a + e.neto, 0))} (sin IVA).</>}
                {tot.comision > 0 && <> La comisión ({money(tot.comision)}) queda como deuda aparte.</>}
              </AvisoSegundaConfirmacion>
            </>
          )}
          {!esAdmin && entregas.length > 0 && <div className={s.hint}>Las facturas del mes las carga un administrador.</div>}
        </>
      )}
    </ModalShell>
  );
}

/** Un campo de la factura; `extra` (el atajo «= 21 %») va debajo, para no desalinear la fila. */
function Campo({ id, label, req, extra, children }) {
  return (
    <div className={s.field}>
      <label htmlFor={id}>{label}{req && <span className={s.req}> *</span>}</label>
      {children}
      {extra && <div style={{ textAlign: 'right', marginTop: 2 }}>{extra}</div>}
    </div>
  );
}

