/**
 * VENTAS › CONFIGURACIÓN › MERCADO PAGO (0126, 30/9/2026)
 * ============================================================================
 * El estado de la conexión y las CAJAS: cada computadora que cobra (registrada
 * en Sistema › Este equipo) tiene su caja en Mercado Pago con un QR fijo para
 * imprimir y pegar en el mostrador. Acá se crea y se imprime.
 *
 * Las credenciales NO se cargan acá: viven en el servidor (Dokploy), como las
 * de ARCA y Google. Esta pantalla solo dice si están y si funcionan.
 */
import { useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useResource } from '../hooks/useResource.js';
import { ventasApi } from '../services/ventas.api.js';
import { useVentas } from '../context/VentasContext.jsx';
import { Btn, Table, s } from './ui.jsx';

export function MercadoPagoPanel() {
  const { toast } = useVentas();
  const { data: est, loading, error, reload } = useResource('mp-estado', ventasApi.mpEstado);
  const [creando, setCreando] = useState(null);
  const [confirmar, setConfirmar] = useState(null);
  const enVuelo = useRef(false);

  const crear = async (equipo) => {
    if (enVuelo.current) return;
    enVuelo.current = true; setCreando(equipo.id);
    try {
      await ventasApi.mpCrearCaja(equipo.id);
      toast(`Caja de Mercado Pago creada para «${equipo.nombre}». Imprimí su QR y pegalo en el mostrador.`, 'ok');
      reload();
    } catch (e) {
      toast(e?.data?.message || 'No se pudo crear la caja.', 'err');
    } finally {
      enVuelo.current = false; setCreando(null); setConfirmar(null);
    }
  };

  if (loading && !est) return <div className={s.hint}>Consultando Mercado Pago…</div>;
  if (error && !est) return <div className={cx(s.callout, s.warn)}>No se pudo leer el estado de Mercado Pago: {error}</div>;
  const cajaDe = (eqId) => (est?.cajas ?? []).find((c) => c.terminalId === eqId && c.activa);

  return (
    <div style={{ display: 'grid', gap: 'var(--crm-space-3)' }}>
      {!est.configurado ? (
        <div className={cx(s.callout, s.warn)}>
          <strong>Mercado Pago no está configurado.</strong> Falta cargar <span className={s.mono}>MP_ACCESS_TOKEN</span> (el Access
          Token de producción de tu aplicación) en el servidor y hacer Redeploy.
        </div>
      ) : est.error ? (
        <div className={cx(s.callout, s.warn)}><strong>Mercado Pago no acepta la credencial:</strong> {est.error}</div>
      ) : (
        <div className={cx(s.callout, s.ok)}>
          <strong>Conectado a Mercado Pago</strong>{est.cuenta?.nombre ? ` · cuenta ${est.cuenta.nombre}` : ''}{est.cuenta?.id ? ` (${est.cuenta.id})` : ''}.
        </div>
      )}
      {est.configurado && !est.avisosConFirma && (
        <div className={cx(s.callout, s.warn)}>
          Falta <span className={s.mono}>MP_WEBHOOK_SECRET</span> (la clave secreta de los avisos). Sin ella los avisos de pago no
          se pueden verificar y se ignoran: la venta igual se cierra, pero tarda unos segundos más (el sistema le pregunta a Mercado Pago).
        </div>
      )}

      <div>
        <div className={s['card-title']}>Cajas (un QR por computadora que cobra)</div>
        <div className={s.hint} style={{ marginBottom: 6 }}>
          Cada equipo registrado en <strong>Sistema › Este equipo</strong> puede tener su caja. Creala, imprimí el QR y pegalo
          en ese mostrador: cuando el cajero cobra con «QR Mercado Pago», el monto le aparece al cliente al escanear ESE QR.
        </div>
        <Table cols={[{ h: 'Sucursal' }, { h: 'Equipo' }, { h: 'Caja de Mercado Pago' }, { h: '', cls: 'actions-col' }]} empty="No hay equipos registrados (Sistema › Este equipo).">
          {(est.equipos ?? []).filter((e) => e.activa).map((e) => {
            const caja = cajaDe(e.id);
            return (
              <tr key={e.id}>
                <td>{e.sucursal}</td>
                <td><strong>{e.nombre}</strong></td>
                <td>
                  {caja
                    ? <span><strong style={{ color: 'var(--crm-color-success)' }}>✔ Creada</strong> <span className={s.hint}>({caja.externalPosId})</span></span>
                    : <span className={s.muted}>Sin caja</span>}
                </td>
                <td className={s['actions-col']}>
                  {caja ? (
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      {caja.qrPdf && <a className={s.btn} href={caja.qrPdf} target="_blank" rel="noopener noreferrer">Imprimir QR (PDF)</a>}
                      {caja.qrImagen && <a className={s.btn} href={caja.qrImagen} target="_blank" rel="noopener noreferrer">Ver QR</a>}
                    </div>
                  ) : confirmar === e.id ? (
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className={s.hint} style={{ margin: 0 }}>¿Crear la caja de «{e.nombre}» en Mercado Pago?</span>
                      <Btn small variant="btn-primary" disabled={creando === e.id} onClick={() => crear(e)}>{creando === e.id ? 'Creando…' : 'Sí, crear'}</Btn>
                      <Btn small disabled={creando === e.id} onClick={() => setConfirmar(null)}>No</Btn>
                    </div>
                  ) : (
                    <Btn small disabled={!est.configurado || !!est.error} onClick={() => setConfirmar(e.id)}>Crear caja</Btn>
                  )}
                </td>
              </tr>
            );
          })}
        </Table>
        <div className={s.hint}>
          La primera caja de cada sucursal da de alta también la sucursal en Mercado Pago, con el domicilio de Gerencia › Sucursales.
        </div>
      </div>
    </div>
  );
}
