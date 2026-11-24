import { useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { TIPOS_COMPROBANTE } from '@modules/productos/domain/constants.js';
import { useGastos } from '../context/GastosContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { gastosApi } from '../services/gastos.api.js';
import { inicioDeMes, hoyISO } from '../domain/constants.js';
import { etiquetaPapel, lecturaFlete, textoEnCosto } from '../domain/fletes.js';
import { Table, PanelHead, Stat, Btn, Pill, money, fmtFecha, s } from '../components/ui.jsx';

const pct = (n) => (n == null ? '—' : `${Number(n).toLocaleString('es-AR', { maximumFractionDigits: 1 })} %`);

/**
 * GASTOS › FLETES (0244, pedido del dueño): lo que cuesta TRAER la mercadería de cada
 * proveedor. Sale de las facturas de los transportes (proveedores con «trae mercadería»),
 * donde cada renglón dice de quién trajo. Se compara con lo que se le compró al
 * proveedor en el mismo período y con el flete % que cargan sus formatos de compra —el
 * que ya está en el costo y en el precio—: si el real es más, se está vendiendo con un
 * costo más bajo que el de verdad.
 *
 * Abajo, las cargas de antes de la regla (sin decir de quién trajo) con la sugerencia
 * sacada de lo que se escribió en el renglón, para asignarlas de una.
 */
export function FletesPanel() {
  const { openModal, act, recargar } = useGastos();
  const [desde, setDesde] = useState(inicioDeMes());
  const [hasta, setHasta] = useState(hoyISO());
  const [foco, setFoco] = useState(null);
  const { data, loading, error, reload } = useResource(`fletes:${desde}:${hasta}`, () => gastosApi.fletes({ desde, hasta }));
  const [descartadas, setDescartadas] = useState(() => new Set());

  const proveedores = data?.proveedores ?? [];
  const detalle = useMemo(
    () => (data?.detalle ?? []).filter((d) => !foco || (foco === 'otro' ? d.origen === 'otro' : d.proveedorId === foco)),
    [data, foco],
  );
  const sinAsignar = data?.sinAsignar ?? [];
  const sugeridas = sinAsignar.filter((x) => x.sugerido && !descartadas.has(x.itemId));
  const totalFlete = proveedores.reduce((a, p) => a + p.flete, 0);
  const sinPapel = proveedores.reduce((a, p) => a + p.sinPapel, 0);

  const abrirGasto = (gastoId) => openModal('detalleGasto', { gastoId, onChange: reload });
  const elegir = (gastoId) => openModal('fletesGasto', { gastoId, onChange: reload });
  const aceptarSugeridas = async () => {
    const ok = await act(
      gastosApi.asignarFletes({
        renglones: sugeridas.map((x) => ({
          itemId: x.itemId, fleteOrigen: 'proveedor', fleteProveedorId: x.sugerido.id, fleteComprobanteId: x.papelSugerido?.id ?? null,
        })),
      }),
      `${sugeridas.length} renglón(es) asignados.`,
    );
    if (ok) reload();
  };
  const marcarTransporte = async (p) => {
    const ok = await act(gastosApi.editarProveedor(p.id, { nombre: p.nombre, traeMercaderia: true }), `${p.nombre} quedó marcado como transporte.`);
    if (ok) { reload(); recargar(); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Fletes"
        desc="Lo que cuesta traer la mercadería de cada proveedor, sacado de las facturas de los transportes, contra lo que se le compró y el flete % que ya está en su costo."
      />

      {data && !data.transportes.length && (
        <div className={cx(s.callout, s.warn)}>
          Ningún proveedor está marcado como transporte todavía. Se marca en su ficha (Gastos › Proveedores › Editar ›
          «Es un transporte: trae mercadería de otros proveedores»); desde ahí, al cargar su factura cada renglón pide de quién trajo.
        </div>
      )}
      {data?.sinMarcar?.length > 0 && (
        <div className={s.callout}>
          <strong>¿Son transportes?</strong> Facturan en un rubro de fletes y no están marcados:
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {data.sinMarcar.map((p) => (
              <Btn key={p.id} small onClick={() => marcarTransporte(p)}>Marcar {p.nombre} ({p.gastos})</Btn>
            ))}
          </div>
        </div>
      )}

      <div className={s.stats}>
        <Stat label="Flete de mercadería" value={money(totalFlete)} nota="sin IVA, en el período" />
        <Stat label="Otra cosa" value={money(data?.otros?.neto ?? 0)} nota={`${data?.otros?.renglones ?? 0} renglón(es)`} />
        <Stat label="Esperan su factura o remito" value={sinPapel} accent={sinPapel ? 'accent-amber' : undefined} nota="se vinculan al cargarlo en Compras" />
        <Stat label="Cargas viejas sin asignar" value={sinAsignar.length} accent={sinAsignar.length ? 'accent-amber' : undefined} />
      </div>

      <div className={s.toolbar}>
        <label className={s.hint} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          Desde <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label className={s.hint} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          Hasta <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </label>
        {foco && <Btn small onClick={() => setFoco(null)}>Ver todos los renglones</Btn>}
      </div>
      {error && <div className={cx(s.callout, s.warn)}>{error}</div>}

      <Table
        cols={[
          { h: 'Proveedor' }, { h: 'Fletes', num: true }, { h: 'Flete pagado', num: true }, { h: 'Compras', num: true },
          { h: 'Flete real', num: true }, { h: 'En el costo', num: true }, { h: 'Lectura' },
        ]}
        empty={loading ? 'Cargando…' : 'Ningún flete de mercadería en el período.'}
      >
        {proveedores.map((p) => {
          const l = lecturaFlete(p);
          return (
            <tr key={p.id} className={s.clickable} onClick={() => setFoco(foco === p.id ? null : p.id)} aria-selected={foco === p.id}>
              <td><strong>{p.nombre}</strong></td>
              <td className={s.num}>
                {p.renglones}
                {p.sinPapel > 0 && <div className={s.hint} style={{ margin: 0 }}>{p.sinPapel} sin su papel</div>}
              </td>
              <td className={s.num}>{money(p.flete)}</td>
              <td className={s.num}>
                {p.compras ? money(p.compras) : <span className={s.muted}>—</span>}
                <div className={s.hint} style={{ margin: 0 }}>
                  {p.base === 'papeles' ? `${p.entregas} entrega(s) vinculada(s)` : 'comprado en el período (aprox.)'}
                </div>
              </td>
              <td className={s.num}><strong>{pct(p.pctReal)}</strong></td>
              <td className={s.num}>{textoEnCosto(p.enCosto) || <span className={s.muted}>—</span>}</td>
              <td><Pill pill={l.pill} label={l.label} /></td>
            </tr>
          );
        })}
        {data?.otros?.renglones > 0 && (
          <tr className={s.clickable} onClick={() => setFoco(foco === 'otro' ? null : 'otro')}>
            <td><span className={s.muted}>Otra cosa (no es de un proveedor)</span></td>
            <td className={s.num}>{data.otros.renglones}</td>
            <td className={s.num}>{money(data.otros.neto)}</td>
            <td /><td /><td /><td />
          </tr>
        )}
      </Table>
      <div className={s.hint}>
        «Flete real» = lo pagado al transporte por traer su mercadería ÷ el neto de esa entrega (los dos sin IVA). La entrega es
        el papel vinculado y los otros del proveedor de ese día: el mitad y mitad manda la factura A y la liquidación juntas. Si ningún flete está vinculado a su papel, se compara con lo comprado en el período: es una aproximación.
        «En el costo» es el flete % de sus formatos de compra: si el real es más, sus productos se venden con un costo más bajo que el de
        verdad. Clic en un proveedor para ver sus renglones.
      </div>

      <div className={s['section-title']}>
        Renglones{foco === 'otro' ? ' · otra cosa' : foco ? ` · ${proveedores.find((p) => p.id === foco)?.nombre ?? ''}` : ''}
      </div>
      <Table
        cols={[{ h: 'Fecha' }, { h: 'Transporte' }, { h: 'Renglón' }, { h: 'De' }, { h: 'Su factura o remito' }, { h: 'Sin IVA', num: true }]}
        empty={loading ? 'Cargando…' : 'Sin renglones.'}
      >
        {detalle.map((d) => (
          <tr key={d.itemId} className={s.clickable} onClick={() => abrirGasto(d.gastoId)}>
            <td style={{ whiteSpace: 'nowrap' }}>{fmtFecha(d.fecha)}</td>
            <td>{d.transporte}{d.numero && <div className={s.hint} style={{ margin: 0 }}>{d.numero}</div>}</td>
            <td>{d.concepto}</td>
            <td>{d.origen === 'otro' ? <span className={s.muted}>Otra cosa</span> : d.proveedor}</td>
            <td>
              {d.papel
                ? (
                  <>
                    {etiquetaPapel(d.papel, TIPOS_COMPROBANTE)}
                    {d.papel.pct != null && (
                      <div className={s.hint} style={{ margin: 0 }}>
                        {pct(d.papel.pct)} de {d.papel.papelesEntrega > 1 ? `la entrega (${d.papel.papelesEntrega} papeles del día)` : 'su neto'}
                      </div>
                    )}
                  </>
                )
                : d.origen === 'proveedor'
                  ? <span style={{ color: 'var(--crm-color-warning)' }}>Sin cargar todavía{d.referencia ? ` (nº ${d.referencia})` : ''}</span>
                  : <span className={s.muted}>—</span>}
            </td>
            <td className={s.num}>{money(d.neto)}</td>
          </tr>
        ))}
      </Table>

      {sinAsignar.length > 0 && (
        <>
          <div className={s['section-title']}>Cargas de antes, sin decir de quién trajo</div>
          <div className={s.callout}>
            Son facturas de transportes cargadas antes de la regla. El proveedor sale de lo que se escribió en el renglón, y su
            factura o remito, del que tiene la fecha más cercana (hasta 15 días antes del flete). Revisalas, destildá las que no
            van y aceptá el resto de una. Las que no tienen sugerencia se eligen una por una.
            {sugeridas.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <Btn variant="btn-primary" small onClick={aceptarSugeridas}>Aceptar {sugeridas.length} sugerencia(s)</Btn>
              </div>
            )}
          </div>
          <Table
            cols={[{ h: 'Fecha' }, { h: 'Transporte' }, { h: 'Renglón' }, { h: 'Sin IVA', num: true }, { h: 'Sugerido' }, { h: '', cls: 'actions-col' }]}
            empty=""
          >
            {sinAsignar.map((x) => {
              const fuera = descartadas.has(x.itemId);
              return (
                <tr key={x.itemId}>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtFecha(x.fecha)}</td>
                  <td>{x.transporte}{x.numero && <div className={s.hint} style={{ margin: 0 }}>{x.numero}</div>}</td>
                  <td>{x.concepto}</td>
                  <td className={s.num}>{money(x.neto)}</td>
                  <td>
                    {x.sugerido ? (
                      <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input
                          type="checkbox" checked={!fuera}
                          onChange={() => setDescartadas((d) => { const n = new Set(d); if (fuera) n.delete(x.itemId); else n.add(x.itemId); return n; })}
                        />
                        <span className={fuera ? s.muted : undefined}>
                          {x.sugerido.nombre}
                          {x.papelSugerido && (
                            <div className={s.hint} style={{ margin: 0 }}>
                              {etiquetaPapel(x.papelSugerido, TIPOS_COMPROBANTE)} · {fmtFecha(x.papelSugerido.fecha)}
                            </div>
                          )}
                        </span>
                      </label>
                    ) : <span className={s.muted}>Sin sugerencia</span>}
                  </td>
                  <td className={s['actions-col']}>
                    <div className={s['row-actions']}>
                      <Btn small onClick={() => elegir(x.gastoId)}>Elegir…</Btn>
                    </div>
                  </td>
                </tr>
              );
            })}
          </Table>
        </>
      )}
    </div>
  );
}
