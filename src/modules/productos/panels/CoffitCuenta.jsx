/**
 * COFFIT · LA CUENTA CORRIENTE ENTRE LOS DOS NEGOCIOS (0120, 29/9/2026)
 * ============================================================================
 * Nació de la conciliación entre el dueño de Sabor y Aroma y el de Coffit: el
 * saldo era del período elegido, no arrastraba y no había dónde anotar un
 * pago. Acá está quién le debe a quién HOY, y renglón por renglón por qué.
 *
 * Los renglones los arma la API (`cafeteria/cuenta.ts`) con la misma regla que
 * el resumen y Gerencia; esta pantalla solo los muestra, suma el saldo
 * acumulado que ya viene hecho y ofrece lo que se carga a mano: pagos,
 * compensaciones, ajustes, saldo inicial y el cierre del mes.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { descargarCsv, csvNum } from '@shared/utils/csv.js';
import { useProductos } from '../context/ProductosContext.jsx';
import { money, num, fmtFecha, fmtFechaVenc } from '../domain/format.js';
import { Table, Stat, Btn, usePaginado, s } from '../components/ui.jsx';
import { textoSaldo } from '../domain/cuentaCoffit.js';

/** Cómo se llama cada renglón para el que lo lee. */
const CONCEPTO = {
  compra: 'Compra para Coffit',
  envio: 'Envío a Coffit',
  dif_envio: 'Faltante al recibir (envío)',
  entrada: 'Mandado por Coffit',
  dif_entrada: 'Faltante al recibir (de Coffit)',
  gasto: 'Gasto de Coffit',
  pago: 'Pago',
  compensacion: 'Compensación',
  ajuste: 'Ajuste',
  saldo_inicial: 'Saldo inicial',
  marca_exclusivo: 'Stock pasado a Coffit',
};
const MANUALES = new Set(['pago', 'compensacion', 'ajuste', 'saldo_inicial', 'marca_exclusivo']);
const FILTROS = [
  { id: '', label: 'Todo' },
  { id: 'compras', label: 'Compras', tipos: ['compra'] },
  { id: 'envios', label: 'Envíos', tipos: ['envio', 'dif_envio'] },
  { id: 'entradas', label: 'Lo que mandó Coffit', tipos: ['entrada', 'dif_entrada'] },
  { id: 'gastos', label: 'Gastos', tipos: ['gasto'] },
  { id: 'manuales', label: 'Pagos y ajustes', tipos: [...MANUALES] },
];

export function CoffitCuenta({ desde, hasta, setDesde, setHasta }) {
  const { store, openModal, toast } = useProductos();
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState('');
  const [vuelta, setVuelta] = useState(0);
  const recargar = useCallback(() => setVuelta((v) => v + 1), []);
  const version = store.getVersion?.() ?? 0;

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    store.cuentaCoffit({ desde: desde || undefined, hasta: hasta || undefined })
      .then((d) => { if (vivo) setDatos(d); })
      .catch((e) => { if (vivo) toast(e?.data?.message || 'No se pudo leer la cuenta con Coffit.', 'err'); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [store, desde, hasta, version, vuelta, toast]);

  const tipos = FILTROS.find((f) => f.id === filtro)?.tipos;
  const lineas = useMemo(
    () => (datos?.lineas ?? []).filter((l) => !tipos || tipos.includes(l.tipo)),
    [datos, tipos],
  );
  const pag = usePaginado(lineas, 'coffit-cuenta', `${desde}|${hasta}|${filtro}`);
  const cierre = datos?.ultimoCierre ?? null;
  const cerrado = (fecha) => cierre && new Date(fecha).getTime() <= new Date(`${cierre.hasta}T23:59:59.999`).getTime();

  const abrirRenglon = (l) => {
    if (l.tipo === 'compra') openModal('comprobanteDetalle', { id: l.ref });
    else if (['envio', 'dif_envio', 'entrada', 'dif_entrada'].includes(l.tipo)) openModal('envioCafeteriaDetalle', { id: l.ref });
  };
  const anular = (l) => openModal('motivoCoffit', {
    titulo: 'Anular movimiento',
    detalle: `${CONCEPTO[l.tipo]} del ${fmtFecha(l.fecha)} por ${money(Math.abs(l.importe))}: deja de contar en la cuenta.`,
    accion: 'Anular',
    onConfirmar: (motivo) => store.anularMovimientoCoffit(l.ref, motivo),
    onHecho: recargar,
  });
  const reabrir = (c) => openModal('motivoCoffit', {
    titulo: 'Reabrir el último cierre',
    detalle: `El cierre al ${fmtFechaVenc(c.hasta)} deja de valer: ese período vuelve a estar abierto y se puede corregir.`,
    accion: 'Reabrir',
    onConfirmar: (motivo) => store.reabrirCierreCoffit(c.id, motivo),
    onHecho: recargar,
  });

  const exportar = () => descargarCsv(
    `cuenta-coffit-${datos?.desde}-${datos?.hasta}.csv`,
    ['Fecha', 'Concepto', 'Documento', 'Detalle', 'Debe Coffit', 'A favor de Coffit', 'Saldo'],
    [
      ['', 'Saldo anterior', '', '', '', '', csvNum(datos?.saldoAnterior ?? 0)],
      ...lineas.map((l) => [
        fmtFecha(l.fecha), CONCEPTO[l.tipo] || l.tipo, l.documento, l.detalle,
        l.importe > 0 ? csvNum(l.importe) : '', l.importe < 0 ? csvNum(-l.importe) : '', csvNum(l.saldo),
      ]),
    ],
  );

  const t = datos?.totales;
  const saldoHoy = datos?.saldoHoy ?? 0;
  return (
    <>
      {/* LO PRIMERO: quién le debe a quién, hoy. */}
      <div
        className={cx(s.callout, Math.abs(saldoHoy) < 0.005 ? s.ok : s.info)}
        style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}
      >
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className={s.hint} style={{ margin: 0 }}>Hoy, {fmtFechaVenc(datos?.hoy)}</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{datos ? textoSaldo(saldoHoy) : 'Cargando…'}</div>
          {cierre && (
            <div className={s.hint} style={{ margin: 0 }}>
              Cerrada hasta el {fmtFechaVenc(cierre.hasta)} ({textoSaldo(cierre.saldoFinal).toLowerCase()} a esa fecha).
            </div>
          )}
        </div>
        <Btn variant="btn-primary" onClick={() => openModal('movimientoCoffit', { tipoInicial: 'pago', onHecho: recargar })}>
          Registrar pago
        </Btn>
        <Btn onClick={() => openModal('movimientoCoffit', { tipoInicial: 'ajuste', onHecho: recargar })}>Ajuste / compensación</Btn>
        <Btn onClick={() => openModal('cierreCoffit', { ultimoCierre: cierre, onHecho: recargar })}>Cerrar el mes…</Btn>
      </div>

      <div className={s.toolbar}>
        <label className={s.hint} style={{ margin: 0 }}>
          Desde <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label className={s.hint} style={{ margin: 0 }}>
          Hasta <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </label>
        <select className={s['select-inline']} value={filtro} onChange={(e) => setFiltro(e.target.value)}>
          {FILTROS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
        <Btn small onClick={exportar} disabled={!datos}>Exportar CSV</Btn>
      </div>

      {t && (
        <div className={s.stats}>
          <Stat label={`Saldo al ${fmtFechaVenc(sumarDia(datos.desde, -1))}`} value={money(datos.saldoAnterior)} />
          <Stat label="Compras para Coffit" value={money(t.compras)} />
          <Stat label="Envíos desde el stock" value={money(t.envios)} />
          <Stat label="Lo que mandó Coffit" value={money(-t.entradas)} />
          <Stat label="Gastos de Coffit (neto)" value={money(t.gastos)} />
          <Stat label="Pagos y ajustes" value={money(t.manuales)} />
          <Stat label={`Saldo al ${fmtFechaVenc(datos.hasta)}`} value={money(datos.saldoFinal)} accent="accent-amber" />
        </div>
      )}

      <Table
        cols={[
          { h: 'Fecha' }, { h: 'Concepto' }, { h: 'Documento' }, { h: 'Detalle' },
          { h: 'Debe Coffit', num: true }, { h: 'A favor de Coffit', num: true }, { h: 'Saldo', num: true }, { h: '' },
        ]}
        empty={cargando ? 'Cargando…' : 'Sin movimientos en el período.'}
        pag={pag}
      >
        {pag.visibles.map((l) => {
          const clic = ['compra', 'envio', 'dif_envio', 'entrada', 'dif_entrada'].includes(l.tipo);
          return (
            <tr key={`${l.tipo}-${l.ref}`} className={clic ? s.clickable : undefined} onClick={clic ? () => abrirRenglon(l) : undefined}>
              <td>{fmtFecha(l.fecha)}</td>
              <td>{CONCEPTO[l.tipo] || l.tipo}</td>
              <td className={s.mono} style={{ fontSize: 12 }}>{l.documento || '—'}</td>
              <td className={s.muted}>{l.detalle || '—'}</td>
              <td className={cx(s.num, s.mono)}>{l.importe > 0 ? money(l.importe) : ''}</td>
              <td className={cx(s.num, s.mono)}>{l.importe < 0 ? money(-l.importe) : ''}</td>
              <td className={cx(s.num, s.mono)} style={{ fontWeight: 600 }}>{money(l.saldo)}</td>
              <td className={s.num}>
                {MANUALES.has(l.tipo) && !cerrado(l.fecha) && (
                  <Btn small onClick={(e) => { e.stopPropagation(); anular(l); }}>Anular</Btn>
                )}
              </td>
            </tr>
          );
        })}
      </Table>

      <div className={s.hint}>
        <strong>Debe Coffit</strong> suma a lo que Coffit le debe a Sabor y Aroma; <strong>A favor de Coffit</strong>
        {' '}lo resta. Entran solos: la parte de Coffit de cada factura de compra (neto, sin IVA), lo que se le
        manda desde el stock al <strong>costo de la última factura</strong> (sin lo que ya había pagado), lo que
        ella manda a las sucursales, los faltantes al recibir (los pierde el que mandó, en la fecha en que se
        recibió) y los gastos de Coffit sin IVA ni percepciones. Los pagos, compensaciones y ajustes se cargan acá.
      </div>

      {(datos?.cierres?.length ?? 0) > 0 && (
        <>
          <div className={s['section-title']}>Cierres</div>
          <Table cols={[{ h: 'Período' }, { h: 'Saldo final', num: true }, { h: 'Quién' }, { h: 'Estado' }, { h: '' }]}>
            {datos.cierres.map((c) => (
              <tr key={c.id} style={{ opacity: c.anulado ? 0.55 : 1 }}>
                <td>{c.desde ? `${fmtFechaVenc(c.desde)} → ` : 'Hasta '}{fmtFechaVenc(c.hasta)}</td>
                <td className={cx(s.num, s.mono)}>{money(c.saldoFinal)}</td>
                <td className={s.muted}>{c.usuario || '—'} · {fmtFecha(c.creadoEn)}</td>
                <td>{c.anulado ? <span className={s.muted}>Reabierto: {c.motivoAnulacion}</span> : 'Cerrado'}</td>
                <td className={s.num}>
                  {!c.anulado && cierre?.id === c.id && <Btn small onClick={() => reabrir(c)}>Reabrir</Btn>}
                </td>
              </tr>
            ))}
          </Table>
        </>
      )}
      {datos && !datos.cierres?.length && (
        <div className={s.hint}>
          Todavía no hay cierres. Si entre los dos negocios ya había una deuda de antes de empezar a usar el
          sistema, cargala como <strong>saldo inicial</strong> (Ajuste / compensación → tipo «Saldo inicial»).
          {' '}Movimientos en el período: {num(lineas.length, 0)}.
        </div>
      )}
    </>
  );
}

function sumarDia(iso, n) {
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString('sv-SE');
}
