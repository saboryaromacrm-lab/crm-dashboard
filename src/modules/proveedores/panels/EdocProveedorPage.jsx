import { useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useProveedores } from '../context/ProveedoresContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { provApi, CONDICIONES_COMPRA, MEDIOS_HABITUALES, MEDIOS_PAGO_REAL } from '../services/proveedores.api.js';
import {
  Btn, Di, PanelHead, Pill, Saldo, Stat, Table, VencePill,
  fmtFecha, money, s, usePaginado,
} from '../components/ui.jsx';

const EPS = 0.009;
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** El día CALENDARIO de un movimiento, en hora local. Cortar el ISO
 *  (`slice(0, 10)`) daría el día en UTC: un pago hecho a las 22 h figuraría
 *  mañana y se escaparía del filtro "hasta hoy". */
const diaLocal = (v) => {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const KIND = {
  comprobante: { label: 'Factura', pill: 'est-pendiente' },
  nc: { label: 'NC', pill: 'est-recibida' },
  gasto: { label: 'Gasto', pill: 'est-pendiente' },
  pago: { label: 'Pago', pill: 'est-recibida' },
  ajuste_debe: { label: 'Ajuste DEBE', pill: 'est-pendiente' },
  ajuste_haber: { label: 'Ajuste HABER', pill: 'est-recibida' },
};

/**
 * La etiqueta que manda la API ya empieza con el tipo del documento ("Factura A
 * 9999-00099001", "Gasto #1 · …", "Pago (efectivo)"). Se la parte en dos: la
 * primera palabra va al pill y el resto al texto, así la fila no dice "Factura
 * Factura A …". Sale del DATO y no de una tabla nuestra, así que una
 * liquidación dice "Liquidación" y no "Factura".
 */
const partirEtiqueta = (etiqueta) => {
  const e = String(etiqueta ?? '').trim();
  const i = e.indexOf(' ');
  return i < 0 ? [e, ''] : [e.slice(0, i), e.slice(i + 1)];
};

/** Los grupos del filtro, en palabras del negocio y no del esquema. */
const FILTROS = [
  ['', 'Todos los movimientos'],
  ['deuda', 'Lo que SUMA deuda'],
  ['haber', 'Lo que la RESTA (pagos, NC, ajustes)'],
  ['comprobante', 'Facturas y liquidaciones'],
  ['nc', 'Notas de crédito'],
  ['gasto', 'Gastos'],
  ['pago', 'Pagos'],
  ['ajuste', 'Ajustes manuales'],
];

/*
 * EL ORDEN DEL MAYOR, definido acá y usado para las dos cosas: calcular el
 * saldo acumulado y mostrar las filas (al revés). Tienen que ser EL MISMO
 * orden: si el acumulado se calcula con un criterio y la tabla se dibuja con
 * otro, la columna Saldo deja de cerrar leída de abajo hacia arriba. Pasaba de
 * verdad — una factura y un pago del mismo día con el mismo id (son tablas
 * distintas, los id se repiten) se desempataban al revés en cada lado.
 *
 * Dentro del mismo día primero lo que genera la deuda y después lo que la
 * cancela, que es como sucede: se factura y luego se paga.
 */
const ORDEN_KIND = {
  comprobante: 0, gasto: 1, ajuste_debe: 2, nc: 3, ajuste_haber: 4, pago: 5,
};
/*
 * Se compara por DÍA y no por la hora del timestamp, a propósito: la hora que
 * queda grabada es incidental —el pago se guarda a medianoche del día elegido y
 * la factura con la hora en que se cargó—, así que ordenar por timestamp ponía
 * el pago ANTES de la factura que estaba pagando y el mayor arrancaba con el
 * saldo en negativo. En este sistema la fecha de un comprobante y de un pago es
 * un día de calendario; el orden dentro del día lo pone ORDEN_KIND.
 */
const cmpCronologico = (a, b) => (
  diaLocal(a.fecha).localeCompare(diaLocal(b.fecha))
  || (ORDEN_KIND[a.kind] ?? 9) - (ORDEN_KIND[b.kind] ?? 9)
  || a.id - b.id
);

const pasaFiltroTipo = (m, f) => {
  if (!f) return true;
  if (f === 'deuda') return m.debe > EPS;
  if (f === 'haber') return m.haber > EPS;
  if (f === 'ajuste') return m.kind === 'ajuste_debe' || m.kind === 'ajuste_haber';
  return m.kind === f;
};

/**
 * EL ESTADO DE CUENTA DEL PROVEEDOR — pantalla completa, no modal.
 * ============================================================================
 * Es la hoja que se mira cuando el proveedor llama a reclamar: de qué está
 * hecho el saldo, qué le queda impago documento por documento, qué se le
 * prometió, y el mayor entero con su saldo acumulado renglón por renglón.
 *
 * Y es desde acá que se le PAGA: el botón registra el pago de siempre del
 * sistema (con su egreso de caja y el puente que cierra compromisos) y, si se
 * tildan documentos, lo aplica en el mismo acto.
 *
 * El saldo acumulado se calcula sobre TODOS los movimientos en orden
 * cronológico y después se filtra para mostrar: calcularlo sobre lo filtrado
 * daría una columna que miente en cuanto alguien elige un rango de fechas.
 */
export function EdocProveedorPage({ proveedorId, onVolver, onCambio }) {
  const { act, openModal, esJefe } = useProveedores();
  const { data: d, loading, error, reload } = useResource(
    `edoc:${proveedorId}`,
    () => provApi.edocProveedor(proveedorId),
  );

  const [tipo, setTipo] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [buscar, setBuscar] = useState('');

  /** Recargar la página Y el listado de atrás: los dos leen el mismo saldo. */
  const refrescar = () => { reload(); onCambio?.(); };

  const conAcumulado = useMemo(() => {
    const cron = [...(d?.movs ?? [])].sort(cmpCronologico);
    let acc = 0;
    const conSaldo = cron.map((m) => {
      acc = r2(acc + m.debe - m.haber);
      return { ...m, acumulado: acc };
    });
    // Del más nuevo al más viejo: el inverso EXACTO del orden con el que se
    // acumuló, así la columna Saldo cierra renglón a renglón.
    return conSaldo.reverse();
  }, [d]);

  const filtrados = useMemo(() => {
    const t = buscar.trim().toLowerCase();
    return conAcumulado.filter((m) => {
      if (!pasaFiltroTipo(m, tipo)) return false;
      const dia = diaLocal(m.fecha);
      if (desde && dia < desde) return false;
      if (hasta && dia > hasta) return false;
      if (t) {
        const texto = `${KIND[m.kind]?.label ?? m.kind} ${m.etiqueta} ${m.detalle ?? ''} `
          + `${m.usuarioNombre ?? ''} ${m.referencia ?? ''}`;
        if (!texto.toLowerCase().includes(t)) return false;
      }
      return true;
    });
  }, [conAcumulado, tipo, desde, hasta, buscar]);

  const totFiltro = useMemo(() => ({
    debe: r2(filtrados.reduce((a, m) => a + m.debe, 0)),
    haber: r2(filtrados.reduce((a, m) => a + m.haber, 0)),
  }), [filtrados]);

  const pag = usePaginado(filtrados, 'edoc-movs', `${tipo}|${desde}|${hasta}|${buscar}`);
  const hayFiltro = !!(tipo || desde || hasta || buscar.trim());
  const limpiar = () => { setTipo(''); setDesde(''); setHasta(''); setBuscar(''); };

  const conciliar = () => act(provApi.conciliar(proveedorId), 'Conciliado hasta hoy.').then(refrescar);
  const desconciliar = () => act(provApi.desconciliar(proveedorId), 'Marca de conciliación quitada.').then(refrescar);
  const borrarAjuste = async (id) => {
    const ok = await act(provApi.borrarAjuste(id), 'Ajuste eliminado.');
    if (ok) refrescar();
  };

  const volver = <Btn small onClick={onVolver}>← Estados de cuenta</Btn>;

  if (loading || error || !d) {
    return (
      <div>
        <div style={{ marginBottom: 10 }}>{volver}</div>
        {loading
          ? <div className={s['empty-state']}>Cargando el estado de cuenta…</div>
          : <div className={cx(s.callout, s.warn)}>{error || 'No se encontró el proveedor.'}</div>}
      </div>
    );
  }

  const p = d.proveedor;
  const comprometido = r2((d.compromisos ?? []).reduce((a, k) => a + k.importe, 0));
  const docs = d.docsPendientes ?? [];
  const abrirPago = (preseleccion = []) => openModal('pagoProveedor', {
    proveedor: p, docs, preseleccion, onChange: refrescar,
  });

  return (
    <div>
      <div style={{ marginBottom: 10 }}>{volver}</div>

      <PanelHead
        title={p.nombre}
        desc={[
          p.modoCuenta === 'libre' ? 'Cuenta libre (pagos a cuenta)' : 'Cuenta por facturas',
          CONDICIONES_COMPRA[p.condicionCompra] ? `emite ${CONDICIONES_COMPRA[p.condicionCompra]}` : null,
          p.medioHabitual ? `cobra por ${MEDIOS_HABITUALES[p.medioHabitual] ?? p.medioHabitual}` : null,
          p.diasPago ? `a ${p.diasPago} días` : null,
          p.cuit ? `CUIT ${p.cuit}` : 'sin CUIT cargado',
        ].filter(Boolean).join(' · ')}
        actions={(
          <>
            <Btn variant="btn-primary" onClick={() => abrirPago()}>Registrar un pago</Btn>
            <Btn onClick={() => openModal('ajuste', { proveedorId, onDone: refrescar })}>+ Ajuste</Btn>
            <Btn onClick={() => openModal('ficha', { proveedorId })}>Ver ficha</Btn>
            {p.conciliadoHasta
              ? <Btn onClick={desconciliar}>Quitar conciliación</Btn>
              : <Btn onClick={conciliar}>Concilié con su resumen</Btn>}
          </>
        )}
      />

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <Stat label="Saldo" value={money(d.saldo)} accent={d.saldo > EPS ? 'accent-red' : undefined} />
        <Stat label="Comprometido" value={comprometido > 0 ? money(comprometido) : '—'} />
        <Stat label="Proyectado (saldo − compromisos)" value={money(r2(d.saldo - comprometido))} />
        <Stat
          label="Pagos sin aplicar"
          value={d.pagosSinAplicar > EPS ? money(d.pagosSinAplicar) : '—'}
          accent={d.pagosSinAplicar > EPS ? 'accent-amber' : undefined}
        />
        <Stat label="Arrastra deuda desde" value={d.deudaDesde ? fmtFecha(d.deudaDesde) : '—'} />
        <Stat label="Conciliado hasta" value={p.conciliadoHasta ? fmtFecha(p.conciliadoHasta) : 'Sin conciliar'} />
      </div>

      <div className={s['section-title']}>De qué está hecho el saldo</div>
      <div className={s['detalle-grid']}>
        <Di label="Mercadería (facturas y ND)">{money(d.totales.mercaderia)}</Di>
        <Di label="Notas de crédito">{d.totales.notasCredito > 0 ? `− ${money(d.totales.notasCredito)}` : '—'}</Di>
        <Di label="Gastos">{d.totales.gastos > 0 ? money(d.totales.gastos) : '—'}</Di>
        <Di label="Ajustes">
          {d.totales.ajustesDebe > 0 || d.totales.ajustesHaber > 0
            ? `${money(d.totales.ajustesDebe)} al debe · ${money(d.totales.ajustesHaber)} al haber`
            : '—'}
        </Di>
        <Di label="Pagado">{d.totales.pagos > EPS ? `− ${money(d.totales.pagos)}` : '—'}</Di>
        <Di label="Saldo"><Saldo valor={d.saldo}><strong>{money(d.saldo)}</strong></Saldo></Di>
      </div>
      {d.totales.gastos > EPS && (
        <div className={s.hint}>
          Este proveedor también factura <strong>gastos</strong>, y el saldo los incluye: la cuenta
          es <strong>una sola, la del proveedor</strong>. El detalle de esos gastos vive en el módulo Gastos.
        </div>
      )}

      {p.modoCuenta === 'libre' && d.deudaDesde && (
        <div className={cx(s.callout, s.info)}>
          Cuenta libre: los pagos no van a facturas puntuales. La antigüedad se calcula por FIFO
          —lo pagado cancela primero lo más viejo— y la deuda actual arrastra desde
          el <strong>{fmtFecha(d.deudaDesde)}</strong>.
        </div>
      )}

      <div className={s['section-title']}>Lo que le queda impago</div>
      <Table
        cols={[
          { h: 'Documento' }, { h: 'Fecha' }, { h: 'Vence' },
          { h: 'Total', num: true }, { h: 'Pagado', num: true }, { h: 'Saldo', num: true }, { h: '' },
        ]}
        empty="No le queda nada impago."
      >
        {docs.map((doc) => (
          <tr key={`${doc.tipo}-${doc.docId}`}>
            <td>
              {doc.etiqueta}
              {doc.detalle && <div className={s.hint} style={{ margin: 0 }}>{doc.detalle}</div>}
              {!!doc.ajuste && (
                <div className={s.hint} style={{ margin: 0 }}>
                  {doc.ajuste > 0 ? 'Una ND le sumó ' : 'Una NC le restó '}
                  {money(Math.abs(doc.ajuste))}
                </div>
              )}
            </td>
            <td>{fmtFecha(doc.fecha)}</td>
            <td>{doc.vencimiento ? fmtFecha(doc.vencimiento) : <span className={s.muted}>—</span>}</td>
            <td className={s.num}>{money(doc.total)}</td>
            <td className={s.num}>{doc.pagado > EPS ? money(doc.pagado) : '—'}</td>
            <td className={s.num}><strong>{money(doc.saldo)}</strong></td>
            <td>
              <Btn small variant="btn-primary" onClick={() => abrirPago([`${doc.tipo}-${doc.docId}`])}>
                Pagar
              </Btn>
            </td>
          </tr>
        ))}
      </Table>

      {(d.compromisos?.length ?? 0) > 0 && (
        <>
          <div className={s['section-title']}>Compromisos pendientes</div>
          <Table cols={[{ h: 'Vence' }, { h: 'Detalle' }, { h: 'Importe', num: true }]}>
            {d.compromisos.map((k) => (
              <tr key={k.id}>
                <td>{fmtFecha(k.fechaVenc)} <VencePill dias={k.diasRest} /></td>
                <td>
                  {k.esEcheq ? 'Echeq' : 'Cta cte'}
                  {k.comprobanteEtiqueta ? ` · ${k.comprobanteEtiqueta}` : ''}
                  {k.cuota ? ` · cuota ${k.cuota}/${k.cuotas}` : ''}
                  {k.obs && <div className={s.hint} style={{ margin: 0 }}>{k.obs}</div>}
                </td>
                <td className={s.num}>{money(k.importe)}</td>
              </tr>
            ))}
          </Table>
          <div className={s.hint}>
            El compromiso se paga desde <strong>Cuentas corrientes</strong>, que es donde vive su
            vencimiento; el pago que se registre acá igual los cierra si deja la factura saldada.
          </div>
        </>
      )}

      <div className={s['section-title']}>Movimientos ({d.movs.length})</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={{ width: 260 }}>
          {FILTROS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          Desde
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} style={{ width: 150 }} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          Hasta
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} style={{ width: 150 }} />
        </label>
        <input
          type="search" placeholder="Buscar en el detalle…" value={buscar}
          onChange={(e) => setBuscar(e.target.value)} style={{ width: 220 }}
        />
        {hayFiltro && <Btn small onClick={limpiar}>Limpiar filtros</Btn>}
      </div>

      <Table
        cols={[
          { h: 'Fecha' }, { h: 'Movimiento' }, { h: 'Debe', num: true },
          { h: 'Haber', num: true }, { h: 'Saldo', num: true }, { h: '' },
        ]}
        empty={hayFiltro ? 'Ningún movimiento con esos filtros.' : 'Todavía no hay movimientos.'}
        pag={pag}
      >
        {pag.visibles.map((m) => {
          const k = KIND[m.kind] ?? { label: m.kind, pill: null };
          const esAjuste = m.kind === 'ajuste_debe' || m.kind === 'ajuste_haber';
          const [tag, resto] = partirEtiqueta(m.etiqueta);
          return (
            <tr key={`${m.kind}-${m.id}`}>
              {/* Solo el día, también en los pagos: el formulario manda la FECHA
                  y la API la guarda a medianoche, así que la hora sería un
                  "12:00 a. m." que no pasó. */}
              <td>{fmtFecha(m.fecha)}</td>
              <td>
                <Pill pill={k.pill} label={tag || k.label} /> {resto}
                {m.detalle && <div className={s.hint} style={{ margin: 0 }}>{m.detalle}</div>}
                {(m.formas?.length ?? 0) > 1 && (
                  <div className={s.hint} style={{ margin: 0 }}>
                    {m.formas.map((f) => `${MEDIOS_PAGO_REAL[f.medio] ?? f.medio} ${money(f.importe)}`).join(' + ')}
                  </div>
                )}
                {m.kind === 'pago' && (
                  <div className={s.hint} style={{ margin: 0 }}>
                    {[
                      m.usuarioNombre ? `lo registró ${m.usuarioNombre}` : null,
                      m.sucursalNombre || null,
                      m.cajaSesionId ? `turno #${m.cajaSesionId}` : 'no salió de caja',
                      m.referencia ? `ref. ${m.referencia}` : null,
                      m.sinAplicar > EPS ? `${money(m.sinAplicar)} sin aplicar` : null,
                    ].filter(Boolean).join(' · ')}
                  </div>
                )}
                {m.saldoDoc > EPS && (
                  <div className={s.hint} style={{ margin: 0 }}>Queda debiendo {money(m.saldoDoc)}</div>
                )}
              </td>
              <td className={s.num}>{m.debe > 0 ? money(m.debe) : ''}</td>
              <td className={s.num}>{m.haber > 0 ? money(m.haber) : ''}</td>
              <td className={s.num}>{money(m.acumulado ?? 0)}</td>
              <td>
                {esAjuste && esJefe && <Btn small onClick={() => borrarAjuste(m.id)}>×</Btn>}
                {/* Anular solo si no tiene NADA aplicado: con imputaciones vivas
                    la API lo rechaza, y ofrecerlo sería un botón roto. */}
                {m.kind === 'pago' && esJefe && m.aplicado <= EPS && (
                  <Btn
                    small
                    onClick={() => openModal('anularPago', { pagoId: m.id, importe: m.haber, onChange: refrescar })}
                  >
                    Anular
                  </Btn>
                )}
              </td>
            </tr>
          );
        })}
      </Table>
      {hayFiltro && (
        <div className={s.hint}>
          Del filtro: <strong>{money(totFiltro.debe)}</strong> al debe y{' '}
          <strong>{money(totFiltro.haber)}</strong> al haber en {filtrados.length} movimiento(s).
          La columna <strong>Saldo</strong> es el acumulado real de la cuenta, no del filtro.
        </div>
      )}

      {(d.cuentas?.length ?? 0) > 0 && (
        <>
          <div className={s['section-title']}>Cuentas bancarias</div>
          {d.cuentas.map((c) => (
            <div key={c.id} className={s.hint} style={{ margin: '2px 0' }}>
              <code>{c.cbuAlias}</code>{c.descripcion ? ` — ${c.descripcion}` : ''}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
