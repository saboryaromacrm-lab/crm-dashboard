/**
 * VENTAS › NOTAS DE CRÉDITO (19/11/2026, pedido del dueño: «todas las NC
 * creadas, bien detalladas»). Las notas fiscales (A, B, C) y las devoluciones
 * de ticket, con lo que hizo cada una: a qué venta ajusta y cómo se había
 * cobrado, el motivo, qué artículos volvieron y si la mercadería reingresó al
 * stock, qué pasó con la plata (efectivo del cajón, cuenta corriente o sin
 * efectivo) y cómo quedó ante ARCA. Clic en una fila abre la nota; en la venta
 * original, la original. Ver crm-api/src/ventas/notas-credito.ts.
 */
import { useDeferredValue, useState } from 'react';
import { csvNum, descargarCsv } from '@shared/utils/csv.js';
import { useVentas } from '../context/VentasContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { ventasApi } from '../services/ventas.api.js';
import { ARCA_NC, PLATA_NC, alcanceNota, comprobante, mediosDe } from '../domain/notasCredito.js';
import { nroComprobante } from '../domain/constants.js';
import { Btn, PanelHead, Pill, Stat, Table, VentaTag, fmtFecha, fmtFechaHora, isoDate, money, s, usePaginado } from '../components/ui.jsx';

const primeroDelMes = () => { const d = new Date(); return isoDate(new Date(d.getFullYear(), d.getMonth(), 1)); };
const LIMITE = 200;

export function NotasCreditoPanel() {
  const { sucursales = [], esJefe, openModal } = useVentas();
  /* Arranca con TODAS (el pedido fue «todas las NC creadas»); los atajos acotan. */
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [sucursalId, setSucursalId] = useState('');
  const [clase, setClase] = useState('');
  const [plata, setPlata] = useState('');
  const [arca, setArca] = useState('');
  const [buscar, setBuscar] = useState('');
  const q = useDeferredValue(buscar.trim());

  const filtros = {
    desde: desde || undefined, hasta: hasta || undefined, sucursalId: sucursalId || undefined,
    clase: clase || undefined, plata: plata || undefined, arca: arca || undefined, q: q || undefined, limit: LIMITE,
  };
  const fechasOk = !desde || !hasta || hasta >= desde;
  const { data, loading, error, reload } = useResource(
    `ventas-notas-credito:${JSON.stringify(filtros)}`,
    () => (fechasOk ? ventasApi.notasCredito(filtros) : Promise.resolve(null)),
  );
  const filas = data?.filas ?? [];
  const t = data?.totales;
  const pag = usePaginado(filas, 'ventas-notas-credito', JSON.stringify(filtros));
  const hayFiltros = desde || hasta || sucursalId || clase || plata || arca || q;

  const abrir = (id) => openModal('detalleVenta', { ventaId: id, onCambio: reload });
  const exportar = () => descargarCsv(
    `notas-de-credito${desde ? `-${desde}` : ''}${hasta ? `-a-${hasta}` : ''}.csv`,
    ['Fecha', 'Nota', 'Estado', 'Venta original', 'Fecha original', 'Total original', 'Cobrada con', 'Cliente', 'Local', 'Hecha por',
      'Motivo', 'Artículos', 'Volvió la mercadería', 'Plata', 'ARCA', 'CAE', 'Neto', 'IVA', 'Total'],
    filas.map((n) => [
      fmtFechaHora(n.fecha), comprobante(n), n.estado, comprobante(n.original), n.original ? fmtFecha(n.original.fecha) : '',
      n.original ? csvNum(n.original.total) : '', mediosDe(n.original?.medios), n.cliente, n.sucursal, n.usuario,
      n.motivo, n.articulos, n.volvioMercaderia ? 'Sí' : 'No', PLATA_NC[n.plata]?.corto ?? n.plata, ARCA_NC[n.arca]?.label ?? n.arca,
      n.cae, csvNum(n.neto), csvNum(n.iva), csvNum(n.total),
    ]),
  );
  const parar = (e) => e.stopPropagation();

  return (
    <div>
      <PanelHead
        title="Notas de crédito"
        desc="Todas las notas de crédito y devoluciones de ticket: a qué venta corresponden, por qué se hicieron, qué volvió, qué pasó con la plata y cómo quedaron ante ARCA. Clic en una para verla completa o reimprimirla."
        actions={filas.length > 0 && <Btn onClick={exportar}>Exportar CSV</Btn>}
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <Btn small variant={!desde && !hasta ? 'btn-primary' : 'btn-ghost'} onClick={() => { setDesde(''); setHasta(''); }}>Todas</Btn>
        <Btn small variant={desde === primeroDelMes() && !hasta ? 'btn-primary' : 'btn-ghost'} onClick={() => { setDesde(primeroDelMes()); setHasta(''); }}>Este mes</Btn>
        <label htmlFor="nc-desde" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          Desde <input id="nc-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label htmlFor="nc-hasta" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          Hasta <input id="nc-hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </label>
        {esJefe && (
          <select className={s['select-inline']} value={sucursalId} onChange={(e) => setSucursalId(e.target.value)} aria-label="Local">
            <option value="">Todos los locales</option>
            {sucursales.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
          </select>
        )}
        <select className={s['select-inline']} value={clase} onChange={(e) => setClase(e.target.value)} aria-label="Tipo">
          <option value="">Notas de crédito y devoluciones</option>
          <option value="fiscal">Solo notas de crédito (A, B, C)</option>
          <option value="devolucion">Solo devoluciones de ticket</option>
        </select>
        <select className={s['select-inline']} value={plata} onChange={(e) => setPlata(e.target.value)} aria-label="Plata">
          <option value="">Cualquier devolución de plata</option>
          {Object.entries(PLATA_NC).map(([k, v]) => <option key={k} value={k}>{v.corto}</option>)}
        </select>
        <select className={s['select-inline']} value={arca} onChange={(e) => setArca(e.target.value)} aria-label="ARCA">
          <option value="">Cualquier estado en ARCA</option>
          {Object.entries(ARCA_NC).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <input
          type="search" placeholder="Cliente, motivo o número…" value={buscar} onChange={(e) => setBuscar(e.target.value)}
          aria-label="Buscar nota de crédito" style={{ width: 220 }}
        />
        {hayFiltros && (
          <Btn small onClick={() => { setDesde(''); setHasta(''); setSucursalId(''); setClase(''); setPlata(''); setArca(''); setBuscar(''); }}>
            Limpiar filtros
          </Btn>
        )}
      </div>

      {!fechasOk && <div className={s.hint}>Elegí un período válido: «hasta» no puede ser antes que «desde».</div>}
      {error && <div className={s.hint} style={{ color: 'var(--crm-color-danger)' }}>{String(error.message || error)}</div>}

      {t && t.total != null && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <Stat label="Notas" value={String(t.cantidad)} nota={t.devoluciones ? `${t.devoluciones} devoluciones de ticket` : undefined} />
          <Stat label="Total acreditado" value={money(t.total)} />
          <Stat label="Efectivo devuelto del cajón" value={money(t.efectivo)} accent={t.efectivo > 0.009 ? 'accent-amber' : undefined} />
          <Stat label="Descontado de cuentas corrientes" value={money(t.ctacte)} />
          <Stat label="Sin efectivo del cajón" value={money(t.medio)} />
          {t.pendientes > 0 && <Stat label="Pendientes de ARCA" value={String(t.pendientes)} accent="accent-red" />}
        </div>
      )}
      {t && t.cantidad > filas.length && (
        <div className={s.hint}>Se muestran las {filas.length} más recientes de {t.cantidad}: acotá las fechas para ver el resto.</div>
      )}

      <Table
        cols={[
          { h: 'Fecha' }, { h: 'Nota' }, { h: 'Venta original' }, { h: 'Cliente y motivo' },
          { h: 'Qué volvió' }, { h: 'Plata y ARCA' }, { h: 'Total', num: true },
        ]}
        empty={loading ? 'Cargando…' : hayFiltros ? 'Ninguna nota de crédito con esos filtros.' : 'Todavía no se hizo ninguna nota de crédito.'}
        pag={pag}
      >
        {pag.visibles.map((n) => (
          <tr key={n.id} className={s.clickable} onClick={() => abrir(n.id)} style={{ cursor: 'pointer', opacity: n.estado === 'anulada' ? 0.6 : 1 }}>
            <td style={{ whiteSpace: 'nowrap' }}>
              {fmtFechaHora(n.fecha)}
              <div className={s.hint} style={{ margin: 0 }}>{n.sucursal || '—'}{n.usuario ? ` · ${n.usuario}` : ''}</div>
            </td>
            <td style={{ whiteSpace: 'nowrap' }}>
              <VentaTag tipo={n.tipo} />
              <div><strong>{nroComprobante(n)}</strong></div>
              {n.estado === 'anulada' && <Pill pill="est-cancelada" label="Anulada" />}
              {alcanceNota(n) && <div className={s.hint} style={{ margin: 0 }}>{alcanceNota(n)}</div>}
            </td>
            <td>
              {n.original ? (
                <div onClick={parar} onKeyDown={parar} role="presentation">
                  <button
                    type="button" onClick={() => abrir(n.original.id)}
                    style={{ background: 'none', border: 0, padding: 0, color: 'var(--crm-color-primary, inherit)', textDecoration: 'underline', cursor: 'pointer', font: 'inherit', whiteSpace: 'nowrap' }}
                    title="Abrir la venta original"
                  >
                    {comprobante(n.original)}
                  </button>
                  <div className={s.hint} style={{ margin: 0 }}>
                    {fmtFecha(n.original.fecha)} · {money(n.original.total)}
                    {n.original.medios.length > 0 && <> · cobrada con {mediosDe(n.original.medios)}</>}
                  </div>
                </div>
              ) : <span className={s.muted}>—</span>}
            </td>
            <td style={{ minWidth: 160, maxWidth: 240 }}>
              <strong>{n.cliente || '—'}</strong>
              <div style={{ fontSize: 13 }}>{n.motivo ? `«${n.motivo}»` : <span className={s.muted}>Sin motivo</span>}</div>
            </td>
            <td style={{ minWidth: 180, maxWidth: 280 }}>
              <div style={{ fontSize: 13 }}>{n.articulos || '—'}{n.renglones > 6 ? ` · y ${n.renglones - 6} más` : ''}</div>
              <div className={s.hint} style={{ margin: 0, color: n.volvioMercaderia ? undefined : 'var(--crm-color-warning)' }}>
                {n.volvioMercaderia ? 'La mercadería volvió al stock' : 'No volvió mercadería (no tocó el stock)'}
              </div>
            </td>
            <td style={{ minWidth: 170 }} title={PLATA_NC[n.plata]?.label}>
              <Pill pill={PLATA_NC[n.plata]?.pill} label={PLATA_NC[n.plata]?.corto ?? n.plata} />
              {n.plata === 'efectivo' && <div className={s.hint} style={{ margin: 0 }}>Salieron {money(n.total)} del turno</div>}
              <div style={{ marginTop: 4 }}><Pill pill={ARCA_NC[n.arca]?.pill} label={ARCA_NC[n.arca]?.label ?? n.arca} /></div>
              {n.arca === 'cae' && <div className={s.hint} style={{ margin: 0, fontFamily: 'monospace' }}>CAE {n.cae}</div>}
              {n.arca === 'pendiente' && n.facturarMotivo && <div className={s.hint} style={{ margin: 0 }}>{n.facturarMotivo}</div>}
            </td>
            <td className={s.num}>
              <strong>{money(n.total)}</strong>
              <div className={s.hint} style={{ margin: 0 }}>{money(n.neto)} + IVA {money(n.iva)}</div>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
