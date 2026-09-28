import { useMemo, useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useVentas } from '../context/VentasContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { ventasApi, errorMsg } from '../services/ventas.api.js';
import { arcaPendientes } from '../services/arcaPendientes.js';
import { imprimirVenta } from '@core/services/imprimir.js';
import { nroComprobante, esNotaCredito } from '../domain/constants.js';
import {
  Table, PanelHead, Stat, Btn, Pill, VentaTag, money, fmtFechaHora, s,
} from '../components/ui.jsx';

/**
 * CAÍDAS POR ARCA (26/9/2026, pedido del dueño).
 * ============================================================================
 * Las ventas que se COBRARON pero no se pudieron facturar: el cliente pidió
 * factura, ARCA no respondió (o no la aceptó) y se llevó un ticket provisorio
 * con la leyenda. La plata y el stock ya están en regla; lo único que falta es
 * el papel fiscal, y esta sección existe para no olvidarlo.
 *
 * "FACTURAR TODAS" VA DE A UNA Y DE LA MÁS VIEJA A LA MÁS NUEVA, a propósito:
 *   - de a una, porque cada factura pide su número a ARCA y el correlativo no
 *     admite saltos; además se ve el avance y se puede detener;
 *   - la más vieja primero, porque ARCA acepta la factura con pocos días de
 *     atraso: la de hace tres días es la urgente.
 * Si ARCA sigue caído, la tanda SE CORTA en la primera (las demás fallarían
 * igual y no tiene sentido golpear el servicio cincuenta veces). Si ARCA
 * RECHAZA una venta puntual (un dato del cliente), se anota y se sigue.
 *
 * Reintentar no rompe nada: la API tiene una emisión por venta a la vez y
 * recupera el número reservado, así que un corte en el medio no duplica.
 */
export function ArcaCaidasPanel() {
  const { openModal, esJefe, toast } = useVentas();
  const { data, loading, error, reload } = useResource(
    'arca-caidas',
    () => ventasApi.listadoVentas({ sinFacturar: 'true', limit: 200 }),
  );

  /* La más vieja primero: es la que corre riesgo de quedar afuera de ARCA. */
  const filas = useMemo(
    () => [...(data?.filas ?? [])].sort((a, b) => new Date(a.fecha) - new Date(b.fecha) || a.id - b.id),
    [data],
  );
  const facturables = filas.filter((v) => !esNotaCredito(v.tipo));
  const notas = filas.filter((v) => esNotaCredito(v.tipo));
  const totalPlata = facturables.reduce((a, v) => a + (Number(v.total) || 0), 0);
  const ocultas = Math.max(0, (data?.total ?? 0) - filas.length);

  /* Lo que pasó con cada venta en esta pantalla: id → { ok, texto, venta }. */
  const [resultado, setResultado] = useState(() => new Map());
  const anotar = (id, r) => setResultado((prev) => new Map(prev).set(id, r));
  const [tanda, setTanda] = useState(null); // { hechas, total, actual }
  const [resumen, setResumen] = useState(null);
  const [facturando, setFacturando] = useState(null);
  const detener = useRef(false);
  const ocupado = useRef(false);

  /** Una venta. Devuelve la causa si falló ('caido' | 'config' | 'rechazo' | 'otro'). */
  const intentar = async (v) => {
    try {
      const venta = await ventasApi.facturarVenta(v.id);
      anotar(v.id, { ok: true, texto: `Facturada: ${nroComprobante(venta)}`, venta });
      return null;
    } catch (e) {
      const causa = e?.data?.causa ?? (e?.status ? 'otro' : 'caido');
      anotar(v.id, { ok: false, causa, texto: errorMsg(e) });
      return causa;
    }
  };

  const terminar = () => { reload(); arcaPendientes.refrescar(); };

  const facturarUna = async (v) => {
    if (ocupado.current) return;
    ocupado.current = true;
    setFacturando(v.id);
    const causa = await intentar(v);
    setFacturando(null);
    ocupado.current = false;
    if (!causa) toast(`Venta facturada: ${nroComprobante(v)} ya tiene su factura.`, 'ok');
    else toast(causa === 'caido' ? 'ARCA sigue sin responder: la venta queda acá para más tarde.' : 'No se pudo facturar: mirá el motivo en la fila.', 'err');
    terminar();
  };

  const facturarTodas = async () => {
    if (ocupado.current || !facturables.length) return;
    ocupado.current = true;
    detener.current = false;
    setResumen(null);
    const lista = facturables.slice();
    let ok = 0; const rechazadas = []; let corte = null;
    for (let i = 0; i < lista.length; i += 1) {
      if (detener.current) { corte = 'detenida'; break; }
      setTanda({ hechas: i, total: lista.length, actual: lista[i] });
      const causa = await intentar(lista[i]);
      if (!causa) { ok += 1; continue; }
      if (causa === 'caido' || causa === 'config') { corte = causa; break; }
      rechazadas.push(lista[i]);
    }
    setTanda(null);
    ocupado.current = false;
    const quedan = lista.length - ok;
    setResumen({ ok, quedan, rechazadas: rechazadas.length, corte });
    if (corte === 'caido') toast(`ARCA sigue sin responder. Se facturaron ${ok}; quedan ${quedan}. Probá de nuevo en unos minutos.`, 'err');
    else if (corte === 'config') toast('La facturación electrónica no está lista: revisá Ventas › Configuración › ARCA.', 'err');
    else if (!quedan) toast(`Listo: se facturaron las ${ok}. Todo en regla.`, 'ok');
    else toast(`Se facturaron ${ok}. ${quedan} no se pudieron: mirá el motivo en cada fila.`, 'err');
    terminar();
  };

  const reimprimir = async (venta) => {
    try {
      const salio = await imprimirVenta(venta, { moneda: money, fechaHora: fmtFechaHora });
      if (!salio) toast('El navegador bloqueó la ventana de impresión. Permitile las ventanas emergentes a este sitio.', 'err');
    } catch (e) { toast(`No se pudo imprimir: ${errorMsg(e)}`, 'err'); }
  };

  const causaDe = (v) => {
    const r = resultado.get(v.id);
    if (r && !r.ok && r.causa === 'rechazo') return { pill: 'est-cancelada', label: 'ARCA la rechazó', hint: r.texto };
    return v.facturarPorCaida === false
      ? { pill: 'est-cancelada', label: 'ARCA la rechazó', hint: v.facturarMotivo }
      : { pill: 'est-pendiente', label: 'ARCA caído', hint: v.facturarMotivo };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Caídas por ARCA"
        desc="Ventas cobradas que no se pudieron facturar. El cliente se llevó un ticket provisorio que lo aclara. Cuando ARCA vuelva, facturalas todas de una."
        actions={(
          <>
            <Btn small onClick={terminar} disabled={loading || !!tanda}>{loading ? 'Cargando…' : 'Actualizar'}</Btn>
            {tanda ? (
              <Btn variant="btn-delete" onClick={() => { detener.current = true; }}>Detener</Btn>
            ) : (
              <Btn variant="btn-primary" onClick={facturarTodas} disabled={!facturables.length || !!facturando}>
                Facturar todas ({facturables.length})
              </Btn>
            )}
          </>
        )}
      />

      <div className={s.stats}>
        <Stat label="Sin facturar" value={facturables.length} accent={facturables.length ? 'accent-amber' : 'accent-green'} />
        <Stat label="Total a facturar" value={money(totalPlata)} />
        <Stat label="La más vieja" value={facturables[0] ? fmtFechaHora(facturables[0].fecha) : '—'} />
      </div>

      {tanda && (
        <div className={cx(s.callout, s.info)}>
          Facturando <strong>{tanda.hechas + 1} de {tanda.total}</strong>: {nroComprobante(tanda.actual)} · {tanda.actual.clienteNombre} · {money(tanda.actual.total)}.
          {' '}No cierres esta pantalla; si hace falta, apretá <strong>Detener</strong> y lo que ya salió queda facturado.
        </div>
      )}

      {resumen && !tanda && (
        <div className={cx(s.callout, resumen.quedan ? s.warn : s.ok)}>
          <strong>Se facturaron {resumen.ok}.</strong>{' '}
          {resumen.corte === 'caido' && `ARCA sigue sin responder: la tanda se cortó para no insistir. Quedan ${resumen.quedan}; probá de nuevo en unos minutos.`}
          {resumen.corte === 'config' && 'La facturación electrónica no está lista (certificado o configuración): revisá Ventas › Configuración › ARCA.'}
          {resumen.corte === 'detenida' && `Detenida a pedido. Quedan ${resumen.quedan}.`}
          {!resumen.corte && (resumen.quedan
            ? `${resumen.rechazadas} no se pudieron porque ARCA rechazó un dato: el motivo está en cada fila. Corregí el dato del cliente y facturala de nuevo.`
            : 'Todo en regla.')}
        </div>
      )}

      {error && <div className={cx(s.callout, s.warn)}>No se pudo cargar la lista: <strong>{error}</strong></div>}

      {!loading && !error && !filas.length && (
        <div className={cx(s.callout, s.ok)}>No hay ventas sin facturar. Todo en regla.</div>
      )}

      {facturables.length > 0 && (
        <Table
          cols={[
            { h: 'Ticket provisorio' }, { h: 'Fecha' }, ...(esJefe ? [{ h: 'Sucursal' }] : []),
            { h: 'Cliente' }, { h: 'Total', num: true }, { h: 'Por qué quedó' }, { h: 'Resultado' },
            { h: 'Acciones', cls: 'actions-col' },
          ]}
        >
          {facturables.map((v) => {
            const r = resultado.get(v.id);
            const c = causaDe(v);
            const enCurso = tanda?.actual?.id === v.id || facturando === v.id;
            return (
              <tr key={v.id} style={r?.ok ? { opacity: 0.6 } : undefined}>
                <td><VentaTag tipo={v.tipo} /> <span className={s.mono}>{nroComprobante(v)}</span></td>
                <td>{fmtFechaHora(v.fecha)}</td>
                {esJefe && <td>{v.sucursalNombre}</td>}
                <td>{v.clienteNombre}</td>
                <td className={s.num}><strong>{money(v.total)}</strong></td>
                <td>
                  <Pill pill={c.pill} label={c.label} />
                  {c.hint && <div className={s.hint} style={{ margin: 0, maxWidth: 320 }}>{c.hint}</div>}
                </td>
                <td>
                  {enCurso && <span className={s.hint} style={{ margin: 0 }}>Facturando…</span>}
                  {!enCurso && r?.ok && <strong style={{ color: 'var(--crm-color-success)' }}>{r.texto}</strong>}
                  {!enCurso && r && !r.ok && <span style={{ color: 'var(--crm-color-danger)' }}>{r.texto}</span>}
                  {!enCurso && !r && <span className={s.muted}>—</span>}
                </td>
                <td className={s['actions-col']}>
                  <div className={s['row-actions']}>
                    {!r?.ok && (
                      <Btn variant="btn-ingreso" small disabled={!!tanda || !!facturando} onClick={() => facturarUna(v)}>
                        {facturando === v.id ? 'Facturando…' : 'Facturar'}
                      </Btn>
                    )}
                    {r?.ok && <Btn small onClick={() => reimprimir(r.venta)}>Imprimir factura</Btn>}
                    <Btn small onClick={() => openModal('detalleVenta', { ventaId: v.id, onCambio: terminar })}>Ver</Btn>
                  </div>
                </td>
              </tr>
            );
          })}
        </Table>
      )}

      {ocultas > 0 && (
        <div className={s.hint}>Se muestran las {filas.length} más viejas; hay {ocultas} más. Facturá estas y aparecen las siguientes.</div>
      )}

      {notas.length > 0 && (
        <div className={cx(s.callout, s.warn)}>
          <strong>{notas.length} nota{notas.length > 1 ? 's' : ''} de crédito sin CAE</strong>
          {' '}({notas.map((n) => nroComprobante(n)).join(', ')}): no se emiten desde acá. Una nota se emite contra una
          factura con CAE; si la factura original está en esta lista, facturala primero.
        </div>
      )}
    </div>
  );
}
