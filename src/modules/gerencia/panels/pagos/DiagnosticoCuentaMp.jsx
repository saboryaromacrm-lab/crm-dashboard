/**
 * DIAGNÓSTICO DE LA CUENTA DE MERCADO PAGO (13/11/2026, pedido del dueño)
 * ============================================================================
 * Paso previo a «Mi Mercado Pago» (una caja como el Cash Flow que se llena sola
 * desde la cuenta). SOLO LECTURA: muestra qué devuelve Mercado Pago para esta
 * cuenta —cobros por tipo y origen, comisiones, lo que falta liberar por día,
 * cuánto entró por cada caja— y el reporte de liberaciones (retiros,
 * transferencias que mandás, devoluciones). No guarda ni mueve nada.
 *
 * Vive en Gerencia › Pagos electrónicos (llave `gerencia.pagos_electronicos`),
 * donde va a ir todo lo de la plata que entra por Mercado Pago. Las cajas y el
 * QR de cada computadora siguen en Ventas › Configuración › Mercado Pago.
 * «Pedir reporte» es lo único que crea algo: un archivo de reporte en tu
 * cuenta de Mercado Pago, el mismo que se pide desde su web.
 */
import { useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { httpClient } from '@core/services/httpClient.js';
import { fmtFecha, fmtFechaHora, fmtFechaVenc, money } from '@modules/productos/domain/format.js';
import { Btn, Table, s } from '@modules/productos/components/ui.jsx';

/* Nombres legibles de lo que contesta Mercado Pago (lo desconocido se muestra tal cual). */
const TIPO = { account_money: 'Dinero en cuenta', credit_card: 'Tarjeta de crédito', debit_card: 'Tarjeta de débito', prepaid_card: 'Tarjeta prepaga', bank_transfer: 'Transferencia', ticket: 'Efectivo (cupón)', atm: 'Cajero', digital_currency: 'Crédito de Mercado Pago', digital_wallet: 'Billetera digital' };
const OPERACION = { regular_payment: 'Cobro', money_transfer: 'Transferencia', pos_payment: 'Cobro en local', account_fund: 'Ingreso de dinero', recurring_payment: 'Débito automático', payment_addition: 'Agregado' };
const ESTADO = { approved: 'Aprobado', rejected: 'Rechazado', refunded: 'Devuelto', cancelled: 'Cancelado', pending: 'Pendiente', in_process: 'En proceso', charged_back: 'Contracargo', in_mediation: 'En reclamo' };
const nombre = (dic, k) => (k ? dic[k] ?? k : '—');
const errorMsg = (e) => e?.data?.message || e?.message || 'No se pudo consultar a Mercado Pago.';

export function DiagnosticoCuentaMp() {
  const [dias, setDias] = useState('7');
  const [datos, setDatos] = useState(null);
  const [reporte, setReporte] = useState(null);
  const [ocupado, setOcupado] = useState('');
  const [aviso, setAviso] = useState(null); // { tono, texto }
  const [abierto, setAbierto] = useState(null); // clave del grupo con ejemplos a la vista

  const correr = async (que, fn) => {
    if (ocupado) return;
    setOcupado(que); setAviso(null);
    try { await fn(); } catch (e) { setAviso({ tono: 'warn', texto: errorMsg(e) }); } finally { setOcupado(''); }
  };
  const consultar = () => correr('pagos', async () => setDatos(await httpClient.get(`/mercadopago/cuenta/diagnostico?dias=${dias}`)));
  const pedir = () => correr('pedir', async () => {
    const r = await httpClient.post('/mercadopago/cuenta/reporte', { dias: Number(dias) });
    setAviso({ tono: 'ok', texto: `Reporte pedido (${fmtFecha(r.desde)} al ${fmtFecha(r.hasta)}). Mercado Pago tarda unos minutos en generarlo: después tocá «Leer el último reporte».` });
  });
  const leer = () => correr('leer', async () => setReporte(await httpClient.get('/mercadopago/cuenta/reporte')));

  const p = datos?.pagos;
  return (
    <div style={{ display: 'grid', gap: 'var(--crm-space-3)' }}>
      <div>
        <div className={s['card-title']}>Diagnóstico de la cuenta (solo lectura)</div>
        <div className={s.hint} style={{ marginBottom: 6 }}>
          Lo que Mercado Pago informa de tu cuenta: cobros por tipo y origen, comisiones, lo que falta liberar y por qué caja
          entró. No guarda ni mueve nada. Sirve para armar «Mi Mercado Pago»: comparalo con lo que ves en la app.
        </div>
        <div className={s.toolbar}>
          <select className={s['select-inline']} value={dias} onChange={(e) => setDias(e.target.value)} aria-label="Días hacia atrás">
            {['1', '3', '7', '15', '31'].map((d) => <option key={d} value={d}>Últimos {d} {d === '1' ? 'día' : 'días'}</option>)}
          </select>
          <Btn small variant="btn-primary" disabled={!!ocupado} onClick={consultar}>{ocupado === 'pagos' ? 'Consultando…' : 'Consultar cobros'}</Btn>
          <Btn small disabled={!!ocupado} onClick={pedir} title="Crea en tu cuenta de Mercado Pago el reporte de liberaciones de esos días">{ocupado === 'pedir' ? 'Pidiendo…' : 'Pedir reporte de liberaciones'}</Btn>
          <Btn small disabled={!!ocupado} onClick={leer}>{ocupado === 'leer' ? 'Leyendo…' : 'Leer el último reporte'}</Btn>
        </div>
      </div>
      {aviso && <div className={cx(s.callout, aviso.tono === 'ok' ? s.ok : s.warn)}>{aviso.texto}</div>}

      {p && (
        <>
          <div className={s.hint} style={{ margin: 0 }}>
            Cuenta {datos.cuenta?.nombre} ({datos.cuenta?.id}) · últimos {datos.dias} días · {p.total} movimientos ({p.aprobados} aprobados)
            {datos.truncado && <strong> · Mercado Pago tiene {datos.totalEnMp}: se trajeron los primeros {p.total}.</strong>}
          </div>
          <Table cols={[{ h: 'Medio' }, { h: 'Operación' }, { h: 'Origen' }, { h: 'Estado' }, { h: 'Cant.', num: true }, { h: 'Bruto', num: true }, { h: 'Comisión', num: true }, { h: 'Impuestos', num: true }, { h: 'Neto', num: true }]} empty="Mercado Pago no informa movimientos en esos días.">
            {p.grupos.map((g) => (
              <tr key={g.clave} className={s.clickable} onClick={() => setAbierto(abierto === g.clave ? null : g.clave)} title="Ver ejemplos">
                <td><strong>{nombre(TIPO, g.tipo)}</strong></td>
                <td>{nombre(OPERACION, g.operacion)}</td>
                <td className={s.mono}>{g.origen || '—'}</td>
                <td>{nombre(ESTADO, g.estado)}</td>
                <td className={s.num}>{g.n}</td>
                <td className={s.num}>{money(g.bruto)}</td>
                <td className={s.num}>{money(g.comision)}</td>
                <td className={s.num}>{money(g.impuestos)}</td>
                <td className={s.num}>{money(g.neto)}</td>
              </tr>
            ))}
          </Table>
          {abierto && (
            <Table cols={[{ h: 'Fecha' }, { h: 'Medio' }, { h: 'Caja' }, { h: 'Del ERP' }, { h: 'Bruto', num: true }, { h: 'Neto', num: true }, { h: 'Se libera' }, { h: 'Descripción' }]}>
              {(p.grupos.find((g) => g.clave === abierto)?.ejemplos ?? []).map((e) => (
                <tr key={e.id}>
                  <td>{e.fecha ? fmtFechaHora(e.fecha) : '—'}</td>
                  <td>{e.metodo}{e.cuotas > 1 ? ` · ${e.cuotas} cuotas` : ''}</td>
                  <td>{e.caja ? `${e.caja}${e.sucursal ? ` (${e.sucursal})` : ''}` : '—'}</td>
                  <td>{e.deErp ? 'Sí' : 'No'}</td>
                  <td className={s.num}>{money(e.bruto)}</td>
                  <td className={s.num}>{money(e.neto)}</td>
                  <td>{e.liberacion ? `${fmtFecha(e.liberacion)}${e.liberado ? ` · ${e.liberado}` : ''}` : '—'}</td>
                  <td>{e.descripcion || '—'}</td>
                </tr>
              ))}
            </Table>
          )}
          <div style={{ display: 'grid', gap: 'var(--crm-space-3)', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            <div>
              <div className={s['card-title']}>Lo que falta liberar, por día</div>
              <Table cols={[{ h: 'Día' }, { h: 'Cobros', num: true }, { h: 'Neto', num: true }]} empty="Nada pendiente de liberar en lo consultado.">
                {p.aLiberar.map((d) => <tr key={d.dia}><td>{fmtFechaVenc(d.dia)}</td><td className={s.num}>{d.n}</td><td className={s.num}>{money(d.neto)}</td></tr>)}
              </Table>
            </div>
            <div>
              <div className={s['card-title']}>Aprobado por caja</div>
              <Table cols={[{ h: 'Caja' }, { h: 'Cobros', num: true }, { h: 'Bruto', num: true }]} empty="—">
                {p.porCaja.map((c) => <tr key={c.caja}><td>{c.caja}{c.sucursal ? ` (${c.sucursal})` : ''}</td><td className={s.num}>{c.n}</td><td className={s.num}>{money(c.bruto)}</td></tr>)}
              </Table>
            </div>
          </div>
          <div className={s.hint} style={{ margin: 0 }}>
            Reporte de liberaciones: {datos.reporte.error ? <span>{datos.reporte.error}</span> : datos.reporte.config ? 'configurado' : 'sin configurar'}
            {datos.reporte.lista.length > 0 && <> · {datos.reporte.lista.length} reportes generados (el último: {datos.reporte.lista[0].nombre})</>}
          </div>
        </>
      )}

      {reporte && (
        <div>
          <div className={s['card-title']}>Reporte {reporte.nombre} · {reporte.renglones} renglones</div>
          <div className={s.hint} style={{ marginBottom: 6 }}>Columnas: <span className={s.mono}>{reporte.columnas.join(', ') || '—'}</span></div>
          <Table cols={[{ h: 'Tipo de movimiento' }, { h: 'Renglones', num: true }, { h: 'Entró', num: true }, { h: 'Salió', num: true }]} empty="No se reconoció la columna del tipo de movimiento: mirá las columnas.">
            {reporte.porTipo.map((t) => (
              <tr key={t.tipo}><td className={s.mono}>{t.tipo}</td><td className={s.num}>{t.n}</td><td className={s.num}>{money(t.credito)}</td><td className={s.num}>{money(t.debito)}</td></tr>
            ))}
          </Table>
        </div>
      )}
    </div>
  );
}
