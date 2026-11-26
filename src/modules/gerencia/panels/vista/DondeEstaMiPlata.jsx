/**
 * VISTA PROFESIONAL › «¿DÓNDE ESTÁ MI PLATA?» (26/11/2026, pedido del dueño:
 * «dónde estoy parado, dónde está mi dinero, tanto físico como digital,
 * porque siento que me falta dinero… todo lo que me ingresa menos todo lo que
 * pago… que no me mienta»).
 *
 * Cuatro preguntas, en orden:
 *   1. ¿Dónde está hoy?        efectivo (caja central, sobres, cajas abiertas),
 *                              cuentas (último saldo cargado + lo que el ERP
 *                              sabe que entró y salió), lo que te deben y debés.
 *   2. ¿Qué entró y qué salió? en el período, cada peso una vez, y lo que NO
 *                              cuenta (pases entre tus cajas, lo que un cliente
 *                              le pagó directo a un proveedor) aparte.
 *   3. ¿Se perdió plata?       el cuadre del efectivo al peso, las diferencias
 *                              de caja, Mercado Pago contra el ERP, el
 *                              historial de saldos de cada cuenta.
 *   4. ¿Qué no sabe?           dicho, para que ningún número se lea de más.
 *
 * Solo el dueño (gerencia.cashflow). Las reglas: crm-api/src/gerencia/plata.ts.
 */
import { useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { httpClient } from '@core/services/httpClient.js';
import { useResource } from '@modules/ventas/hooks/useResource.js';
import { errorMsg } from '@modules/ventas/services/ventas.api.js';
import { money } from '@modules/productos/domain/format.js';
import { Btn, s } from '@modules/productos/components/ui.jsx';
import { ModalShell } from '@modules/productos/components/Modal.jsx';
import { useSegundaConfirmacion, AvisoSegundaConfirmacion, textoBoton } from '@modules/gastos/components/segundaConfirmacion.jsx';
import { Aviso, Bloque, Cargando, Grilla, Tile, Tiles } from '../metricas/piezas.jsx';
import { PRESETS, rangoDe } from '../metricas/formato.js';
import { fechaCorta, fechaHora, fechaIso } from '../cashflow/formato.js';
import { antiguedad, conSigno, estadoCuadre, lecturaDiferencia, saldoViejo } from './plata.js';

const pesos = (v) => money(Math.round((Number(v) || 0) * 100) / 100);
const COLOR = { ok: 'var(--crm-color-success)', warn: 'var(--crm-color-warning, #b45309)', danger: 'var(--crm-color-danger)' };
const PRESETS_PLATA = PRESETS.filter(([k]) => ['semana', 'semana-pasada', 'mes', 'mes-pasado', '30d', 'otro'].includes(k));

function QueEs({ titulo = '¿Qué es y cómo se lee?', children }) {
  return (
    <details style={{ fontSize: 13, color: 'var(--crm-color-text-secondary)' }}>
      <summary style={{ cursor: 'pointer', width: 'fit-content' }}>{titulo}</summary>
      <div style={{ marginTop: 6, maxWidth: '72ch', lineHeight: 1.5 }}>{children}</div>
    </details>
  );
}

/** Un renglón «concepto … importe», con detalle opcional abajo en gris. */
function Fila({ texto, importe, detalle, fuerte, tono, sangria }) {
  return (
    <tr>
      <td style={{ paddingLeft: sangria ? 18 : undefined }}>
        <div style={{ fontWeight: fuerte ? 700 : 400 }}>{texto}</div>
        {detalle && <div className={s.hint} style={{ margin: 0 }}>{detalle}</div>}
      </td>
      <td style={{ textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontWeight: fuerte ? 700 : 400, color: tono ? COLOR[tono] : undefined, verticalAlign: 'top' }}>
        {importe}
      </td>
    </tr>
  );
}
const TablaPlata = ({ children }) => (
  <div style={{ overflowX: 'auto' }}>
    <table className={s.table} style={{ fontSize: 13, width: '100%' }}><tbody>{children}</tbody></table>
  </div>
);

/** Una lista de grupos (Entró o Salió), cada uno plegable con su detalle. */
function Grupos({ grupos, total, titulo, vacio }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontWeight: 700 }}>
        <span>{titulo}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{pesos(total)}</span>
      </div>
      {!grupos.length && <div className={s.hint} style={{ margin: 0 }}>{vacio}</div>}
      {grupos.map((g) => (
        <details key={g.clave} style={{ borderTop: '1px solid var(--crm-color-border)', paddingTop: 6 }}>
          <summary style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <span>{g.texto}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{pesos(g.importe)}</span>
          </summary>
          <TablaPlata>
            {g.detalle.map((d, i) => <Fila key={i} texto={d.texto} importe={pesos(d.importe)} sangria />)}
          </TablaPlata>
        </details>
      ))}
    </div>
  );
}

/* ============================================================================
 * 1 · Hoy
 * ========================================================================== */

function Efectivo({ ef }) {
  return (
    <Bloque titulo="Efectivo" sub="Lo cuenta el sistema: pasa todo por las cajas, los sobres y la caja central.">
      <TablaPlata>
        <Fila
          texto="Caja central (Cash Flow)" importe={ef.central.arranco ? pesos(ef.central.saldo) : '—'}
          detalle={!ef.central.arranco ? 'El Cash Flow no arrancó.' : ef.central.ultimoConteo ? `La contaste ${antiguedad(ef.central.ultimoConteo.fecha)} (${fechaCorta(ef.central.ultimoConteo.fecha)})` : 'Nunca la contaste con «Contar mi caja».'}
        />
        <Fila texto="Sobres sin controlar" importe={pesos(ef.transito.total)} detalle={ef.transito.sobres ? `${ef.transito.sobres} sobre${ef.transito.sobres === 1 ? '' : 's'} cerrados que todavía no contaste` : 'Ninguno'} />
        {ef.cajas.map((c) => (
          <Fila
            key={c.id} texto={`Caja abierta · ${c.sucursal}`} importe={c.sinDato ? '—' : pesos(c.esperado)}
            detalle={`desde ${fechaHora(c.apertura)}${c.ultimoConteo ? ` · último conteo ${fechaHora(c.ultimoConteo.fecha)}: ${pesos(c.ultimoConteo.contado)}` : ''} · lo que tendría que haber`}
          />
        ))}
        <Fila texto="Total en efectivo" importe={pesos(ef.total)} fuerte />
      </TablaPlata>
    </Bloque>
  );
}

function Cuentas({ cuentas, mp, onCargar }) {
  return (
    <Bloque titulo="Cuentas y Mercado Pago" sub="El ERP no ve el saldo de tus cuentas: lo cargás vos mirando la app y el ERP le suma y resta lo que sabe.">
      {!cuentas.length && <Aviso tono="info">No tenés cuentas cargadas. Se agregan en Cash Flow › Configuración › Mis cuentas.</Aviso>}
      {cuentas.map((c) => {
        const viejo = c.ultimo && saldoViejo(c.ultimo.fecha);
        return (
          <div key={c.id} style={{ borderTop: '1px solid var(--crm-color-border)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <strong>{c.nombre}{c.detalle ? <span className={s.hint} style={{ margin: 0, fontWeight: 400 }}> · {c.detalle}</span> : null}{c.esMercadoPago ? <span className={s.hint} style={{ margin: 0, fontWeight: 400 }}> · Mercado Pago conectado</span> : null}</strong>
              <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{c.estimado == null ? 'Sin saldo' : pesos(c.estimado)}</span>
            </div>
            {c.ultimo ? (
              <div className={s.hint} style={{ margin: 0, color: viejo ? COLOR.warn : undefined }}>
                Cargaste {pesos(c.ultimo.saldo)} {antiguedad(c.ultimo.fecha)} ({fechaHora(c.ultimo.fecha)})
                {c.desdeUltimo && (c.desdeUltimo.entro || c.desdeUltimo.salio) ? ` · desde entonces entró ${pesos(c.desdeUltimo.entro)} y se pagó ${pesos(c.desdeUltimo.salio)} desde esta cuenta` : ' · desde entonces el ERP no registró movimientos de esta cuenta'}
                {viejo ? ' · es viejo: cargalo de nuevo para que el número sirva' : ''}
              </div>
            ) : <div className={s.hint} style={{ margin: 0 }}>Todavía no cargaste el saldo: sin eso el ERP no puede decir cuánto hay.</div>}
            {c.historial.filter((h) => h.diferencia != null).slice(0, 3).map((h) => {
              const l = lecturaDiferencia(h.diferencia);
              return (
                <div key={h.id} className={s.hint} style={{ margin: 0 }}>
                  {fechaCorta(h.fecha)}: cargaste {pesos(h.saldo)}, el ERP calculaba {pesos(h.estimado)} →{' '}
                  <strong style={{ color: COLOR[l.tono] }}>{conSigno(h.diferencia, pesos)}</strong>. {l.texto}
                </div>
              );
            })}
            <div><Btn small onClick={() => onCargar(c)}>Cargar el saldo de hoy</Btn></div>
          </div>
        );
      })}
      {mp.conectada ? (
        <div style={{ borderTop: '1px solid var(--crm-color-border)', paddingTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <strong>Mercado Pago · a liberar</strong>
            <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{pesos(mp.aLiberar)}</span>
          </div>
          <div className={s.hint} style={{ margin: 0 }}>
            Cobrado y todavía no disponible ({mp.cobros} cobros, ya sin comisión).
            {mp.porDia.length ? ` Próximas: ${mp.porDia.slice(0, 4).map((x) => `${fechaIso(x.dia)} ${pesos(x.neto)}`).join(' · ')}` : ''}
          </div>
        </div>
      ) : cuentas.length > 0 && (
        <div className={s.hint} style={{ margin: 0 }}>
          Ninguna cuenta está marcada como la de Mercado Pago conectada: al cargar el saldo de esa cuenta, tildá «Es la de Mercado Pago» y el ERP le va a sumar los cobros solo.
        </div>
      )}
    </Bloque>
  );
}

function Deudas({ debes, teDeben }) {
  return (
    <Bloque titulo="Lo que debés y lo que te deben" sub="Plata que todavía no es tuya, o que todavía no te llegó.">
      <TablaPlata>
        <Fila texto="Le debés a proveedores" importe={pesos(debes.proveedores)} detalle={debes.aFavor > 0 ? `y tenés ${pesos(debes.aFavor)} a favor con otros` : 'según el estado de cuenta de cada uno'} />
        {debes.deudores.slice(0, 5).map((d) => <Fila key={d.nombre} texto={d.nombre} importe={pesos(d.saldo)} sangria detalle={d.estado === 'vencido' ? 'vencido' : ''} />)}
        {debes.echeqs.cantidad > 0 && (
          <Fila
            texto="De esa deuda, en echeqs que se van a debitar" importe={pesos(debes.echeqs.total)} sangria
            detalle={`${debes.echeqs.cantidad} echeq${debes.echeqs.cantidad === 1 ? '' : 's'} · el próximo el ${fechaCorta(debes.echeqs.proximo)} · ya está dentro de lo que debés: no suma aparte`}
          />
        )}
        {debes.gastosSinVitrina > 0 && <Fila texto="Gastos impagos" importe={pesos(debes.gastosSinVitrina)} detalle={`${debes.gastosSinVitrinaN} gasto${debes.gastosSinVitrinaN === 1 ? '' : 's'} sin proveedor de mercadería (los que no están en Proveedores)`} />}
        {debes.echeqsTerceros.total > 0 && <Fila texto="Echeqs a terceros por debitar" importe={pesos(debes.echeqsTerceros.total)} detalle={`${debes.echeqsTerceros.cantidad} echeq${debes.echeqsTerceros.cantidad === 1 ? '' : 's'} a alguien que no es proveedor`} />}
        <Fila texto="Total que debés" importe={pesos(debes.proveedores + debes.gastosSinVitrina + debes.echeqsTerceros.total)} fuerte />
        <Fila texto="Te deben los clientes" importe={pesos(teDeben.clientes)} detalle="ventas en cuenta corriente sin cobrar" fuerte />
      </TablaPlata>
    </Bloque>
  );
}

/* ============================================================================
 * Cargar el saldo de una cuenta
 * ========================================================================== */

function CargarSaldoModal({ cuenta, mpConectada, onCerrar, onHecho }) {
  const [saldo, setSaldo] = useState('');
  const [nota, setNota] = useState('');
  const [esMp, setEsMp] = useState(!!cuenta.esMercadoPago);
  const [error, setError] = useState('');
  const sc = useSegundaConfirmacion(`${saldo}|${nota}|${esMp}`);
  const importe = Number(String(saldo).replace(',', '.'));
  const guardar = () => sc.clic(
    () => {
      setError('');
      if (saldo === '' || !Number.isFinite(importe)) { setError('Escribí el saldo que ves en la app (puede ser 0 o negativo).'); return false; }
      return true;
    },
    async () => {
      try {
        const r = await httpClient.post('/gerencia/plata/saldos', { cuentaPropiaId: cuenta.id, saldo: importe, nota, esMercadoPago: esMp, confirmado: true });
        onHecho(r);
      } catch (e) { setError(errorMsg(e)); }
    },
  );
  return (
    <ModalShell
      title={`Saldo de ${cuenta.nombre}`}
      subtitle="Lo que ves ahora en la app del banco o de Mercado Pago"
      onClose={onCerrar}
      footer={[
        { texto: 'Cancelar', onClick: onCerrar },
        { texto: textoBoton(sc, 'Guardar el saldo', 'Sí, guardar'), clase: 'btn-primary', onClick: guardar },
      ]}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className={s['mini-label']}>Saldo de ahora</span>
          <input id="plata-saldo" type="number" step="0.01" inputMode="decimal" value={saldo} onChange={(e) => setSaldo(e.target.value)} placeholder="0" autoFocus />
        </label>
        {(esMp || !mpConectada) && (
          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <input id="plata-es-mp" type="checkbox" checked={esMp} onChange={(e) => setEsMp(e.target.checked)} />
            <span>Es la de Mercado Pago conectada al ERP (la de los cobros con QR y Point). El ERP le suma solo lo que cobra.</span>
          </label>
        )}
        {esMp && (
          <Aviso tono="info">
            En Mercado Pago cargá el <strong>dinero disponible más lo que tengas apartado en reservas</strong>, <strong>sin</strong> lo que está «a liberar»: eso el ERP lo sabe y lo suma aparte.
          </Aviso>
        )}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className={s['mini-label']}>Nota (opcional)</span>
          <input id="plata-nota" type="text" maxLength={300} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: después de pagar sueldos" />
        </label>
        <AvisoSegundaConfirmacion {...sc}>
          Guardás <strong>{pesos(importe || 0)}</strong> como el saldo de <strong>{cuenta.nombre}</strong> en este momento.
          {cuenta.estimado != null ? <> El ERP calculaba <strong>{pesos(cuenta.estimado)}</strong>: la diferencia ({conSigno((importe || 0) - cuenta.estimado, pesos)}) queda registrada como plata que se movió por fuera del ERP.</> : ' Es el primero: desde acá el ERP empieza a seguir esta cuenta.'}
        </AvisoSegundaConfirmacion>
        {error && <Aviso tono="warn">{error}</Aviso>}
      </div>
    </ModalShell>
  );
}

/* ============================================================================
 * 2 y 3 · El período y los controles
 * ========================================================================== */

function Periodo({ p }) {
  return (
    <>
      <Tiles>
        <Tile label="Entró" valor={pesos(p.totalEntro)} detalle="lo cobrado y los ingresos cargados" marca="var(--crm-color-success)" />
        <Tile label="Salió" valor={pesos(p.totalSalio)} detalle="pagos, gastos, sueldos, retiros, comisiones" marca="var(--crm-color-danger)" />
        <Tile label="Quedó (entró − salió)" valor={pesos(p.quedo)} alerta={p.quedo < 0} />
        <Tile label="Diferencias de efectivo" valor={conSigno(p.diferenciasMedidas, pesos)} detalle="faltantes y sobrantes ya medidos en cajas y sobres" alerta={p.diferenciasMedidas < -1} />
        <Tile label="Quedó de verdad" valor={pesos(p.quedoDeVerdad)} detalle={`en efectivo ${pesos(p.enEfectivo)} · en lo digital ${pesos(p.enLoDigital)}`} alerta={p.quedoDeVerdad < 0} />
      </Tiles>
      <Grilla>
        <Grupos titulo="Entró" grupos={p.entro} total={p.totalEntro} vacio="No entró nada en el período." />
        <Grupos titulo="Salió" grupos={p.salio} total={p.totalSalio} vacio="No salió nada en el período." />
      </Grilla>
      {p.neutros.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div className={s['mini-label']}>No cuenta ni como entrada ni como salida</div>
          <TablaPlata>
            {p.neutros.flatMap((g) => g.detalle.map((d, i) => (
              <Fila key={`${g.clave}-${i}`} texto={d.texto} importe={pesos(d.importe)}
                detalle={g.clave === 'directo' ? 'El cliente transfirió directo a la cuenta del proveedor: la venta y el pago se cancelan, la plata nunca pasó por tus manos.' : 'La plata cambió de lugar (de la caja a una cuenta), no se fue del negocio.'} />
            )))}
          </TablaPlata>
        </div>
      )}
      <Aviso tono="info">
        <strong>¿Dónde tendría que estar lo que quedó?</strong> En efectivo, {pesos(p.enEfectivo)} (lo controla el cuadre de abajo).
        En tus cuentas, {pesos(p.enLoDigital)}: entró {pesos(p.digital.entro)} cobrado sin efectivo, se depositaron {pesos(p.digital.depositado)} de efectivo
        y se pagaron {pesos(p.digital.salio)} desde las cuentas. <strong>Si tus cuentas no subieron eso en el período</strong>, la diferencia se fue en pagos,
        retiros o débitos que no están cargados en el ERP.
      </Aviso>
    </>
  );
}

function Controles({ p }) {
  const c = p.cuadre;
  const est = c.posible ? estadoCuadre(c.sinExplicar) : null;
  const f = p.fugas;
  return (
    <Grilla>
      <Bloque titulo="Cuadre del efectivo" sub="Lo que había + lo que entró − lo que salió tiene que dar lo que hay. Lo que no da, no se sabe adónde fue.">
        {!c.posible ? <Aviso tono="info">{c.motivo}</Aviso> : (
          <>
            <Aviso tono={est.tono === 'ok' ? 'ok' : 'warn'}>
              <strong style={{ color: COLOR[est.tono] }}>{est.texto}</strong>{est.tono !== 'ok' ? ` Sin explicar: ${conSigno(c.sinExplicar, pesos)}.` : ''}
            </Aviso>
            <TablaPlata>
              <Fila texto="Había al empezar" importe={pesos(c.inicio.total)} detalle={`caja central ${pesos(c.inicio.central)} · sobres ${pesos(c.inicio.transito)} · cajas abiertas ${pesos(c.inicio.cajas)} · fondos guardados ${pesos(c.inicio.fondos)}`} />
              <Fila texto="+ Entró en efectivo" importe={pesos(c.entro)} sangria />
              <Fila texto="− Salió en efectivo" importe={pesos(c.salio)} sangria />
              <Fila texto="− Pasó a tus cuentas (depósitos, cambio a tu cuenta)" importe={pesos(c.aCuentas)} sangria />
              <Fila texto="± Diferencias ya medidas" importe={conSigno(c.diferencias.total, pesos)} sangria
                detalle={`cierres ${conSigno(c.diferencias.cierres, pesos)} · sobres ${conSigno(c.diferencias.sobres, pesos)} · conteos de la caja central ${conSigno(c.diferencias.conteos, pesos)}${c.diferencias.descartados ? ` · sobres «no corresponde» ${conSigno(c.diferencias.descartados, pesos)}` : ''}${c.diferencias.aperturas ? ` · aperturas con otro monto ${conSigno(c.diferencias.aperturas, pesos)}` : ''}`} />
              <Fila texto="= Tendría que haber" importe={pesos(c.inicio.total + c.esperado)} fuerte />
              <Fila texto="Hay" importe={pesos(c.fin.total)} fuerte detalle={`caja central ${pesos(c.fin.central)} · sobres ${pesos(c.fin.transito)} · cajas abiertas ${pesos(c.fin.cajas)} · fondos guardados ${pesos(c.fin.fondos)}`} />
              <Fila texto="Sin explicar" importe={conSigno(c.sinExplicar, pesos)} fuerte tono={est.tono} />
            </TablaPlata>
            {(c.fueraDeCaja.cobros > 0 || c.fueraDeCaja.pagos > 0) && (
              <Aviso tono="warn">
                Efectivo que no pasó por ninguna caja del sistema: {c.fueraDeCaja.cobros > 0 ? `cobros por ${pesos(c.fueraDeCaja.cobros)}` : ''}{c.fueraDeCaja.cobros > 0 && c.fueraDeCaja.pagos > 0 ? ' y ' : ''}{c.fueraDeCaja.pagos > 0 ? `pagos por ${pesos(c.fueraDeCaja.pagos)}` : ''}.
                Están en «Entró» y «Salió», pero no en el cuadre: esa plata salió o entró de un bolsillo que el ERP no cuenta.
              </Aviso>
            )}
          </>
        )}
      </Bloque>

      <Bloque titulo="Diferencias de caja del período" sub="Lo que ya se midió que faltó o sobró al contar.">
        <TablaPlata>
          <Fila texto="Cierres de caja" importe={conSigno(f.cierres.faltantes + f.cierres.sobrantes, pesos)} tono={f.cierres.faltantes + f.cierres.sobrantes < -1 ? 'danger' : undefined}
            detalle={`${f.cierres.n} cierre${f.cierres.n === 1 ? '' : 's'} con diferencia · faltó ${pesos(-f.cierres.faltantes)} · sobró ${pesos(f.cierres.sobrantes)}`} />
          {f.cierres.peores.map((x) => (
            <Fila key={x.id} sangria texto={`${x.sucursal} · ${fechaCorta(x.fecha)}${x.cajero ? ` · ${x.cajero}` : ''}`} importe={conSigno(x.diferencia, pesos)} tono={x.diferencia < -1 ? 'danger' : undefined} />
          ))}
          <Fila texto="Sobres contados distinto" importe={conSigno(f.sobres.faltantes + f.sobres.sobrantes, pesos)} detalle={`${f.sobres.n} sobre${f.sobres.n === 1 ? '' : 's'}`} />
          <Fila texto="Ajustes al contar la caja central" importe={conSigno(f.conteos.faltantes + f.conteos.sobrantes, pesos)} tono={f.conteos.faltantes + f.conteos.sobrantes < -1 ? 'danger' : undefined} />
          {f.descartados.n > 0 && <Fila texto="Sobres marcados «no corresponde»" importe={pesos(f.descartados.total)} detalle="no entraron a la caja central" />}
        </TablaPlata>
        <QueEs titulo="Si una diferencia ya se aclaró">
          Si después apareció la plata (como el cierre del Express 1 del 25/11, que se rindió aparte) y la cargaste en el Cash Flow como ingreso,
          ese ingreso está en «Entró» y el faltante sigue acá: los dos juntos dan lo real.
        </QueEs>
      </Bloque>

      <Bloque titulo="Mercado Pago contra el ERP" sub="Lo cobrado con QR y Point en el ERP tendría que haber entrado a Mercado Pago.">
        {!p.mp ? <Aviso tono="info">Los cobros de Mercado Pago se bajan desde el 1/11/2026: elegí un período desde ahí.</Aviso> : (
          <>
            {p.mp.recortado && <div className={s.hint} style={{ margin: 0 }}>Se compara desde el {fechaIso(p.mp.desde)} (antes no se bajaban los cobros).</div>}
            <TablaPlata>
              <Fila texto="QR y tarjetas · ERP" importe={pesos(p.mp.qrTarjeta.erp)} />
              <Fila texto="QR y tarjetas · Mercado Pago" importe={pesos(p.mp.qrTarjeta.mp)} />
              <Fila texto="Diferencia" importe={conSigno(p.mp.qrTarjeta.diferencia, pesos)} fuerte tono={Math.abs(p.mp.qrTarjeta.diferencia) > Math.max(1000, p.mp.qrTarjeta.erp * 0.01) ? 'warn' : 'ok'}
                detalle="negativa: se cargó en el ERP como QR/tarjeta algo que no entró a MP (o fue a otro posnet). Se revisa en Ventas › Conciliación MP." />
              <Fila texto="Transferencias · ERP" importe={pesos(p.mp.transferencia.erp)} />
              <Fila texto="Transferencias recibidas en MP" importe={pesos(p.mp.transferencia.mp)} detalle="incluye transferencias que no son ventas (pases tuyos, devoluciones)" />
              <Fila texto="Comisiones y retenciones que se quedó MP" importe={pesos(p.mp.comision)} detalle="ya están en «Salió»" />
            </TablaPlata>
          </>
        )}
      </Bloque>
    </Grilla>
  );
}

const NO_SABE = [
  'El saldo de tus cuentas: lo cargás vos. Sin saldo cargado, esa plata no está en «Tenés».',
  'Lo que sale de tus cuentas sin cargarlo en el ERP: transferencias, débitos automáticos, impuestos y comisiones del banco, compras con la tarjeta de Mercado Pago, pases a otra cuenta. Aparece como diferencia la próxima vez que cargues el saldo.',
  'Adónde fue el efectivo depositado en el banco: el ERP sabe que salió de la caja central, no a qué cuenta entró (salvo el «Cambio a mi cuenta», que se busca por el nombre de la cuenta).',
  'Los sueldos, impuestos o gastos pagados por fuera del ERP.',
  'Mercado Pago antes del 1/11/2026, y sus reservas (por eso se cargan junto con el disponible).',
];

/* ============================================================================
 * La sección
 * ========================================================================== */

export function DondeEstaMiPlata() {
  const [preset, setPreset] = useState('mes');
  const [rango, setRango] = useState(() => rangoDe('mes'));
  const [cargando, setCargando] = useState(null);
  const [aviso, setAviso] = useState('');
  const [desde, hasta] = rango;
  const { data, loading, error, reload } = useResource(`plata:${desde}:${hasta}`, () => httpClient.get(`/gerencia/plata?desde=${desde}&hasta=${hasta}`));
  const elegir = (k) => { setPreset(k); if (k !== 'otro') setRango(rangoDe(k)); };
  const f = data?.foto;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Bloque
        titulo="¿Dónde estoy parado? · ahora"
        sub="Toda tu plata, física y digital, lo que debés y lo que te deben. Cada número dice de dónde sale y qué no sabe."
        acciones={<Btn small onClick={reload} disabled={loading}>{loading ? 'Actualizando…' : 'Actualizar'}</Btn>}
      >
        {error && <Aviso tono="warn">No se pudo cargar: {String(error)}</Aviso>}
        {loading && !data && <Cargando />}
        {aviso && <Aviso tono="ok">{aviso}</Aviso>}
        {f && (
          <>
            <Tiles>
              <Tile label="Tenés" valor={pesos(f.tenes)} detalle={`efectivo ${pesos(f.efectivo.total)} · cuentas ${pesos(f.enCuentas)}${f.mp.conectada ? ` · MP a liberar ${pesos(f.mp.aLiberar)}` : ''}`} />
              <Tile label="Te deben" valor={pesos(f.teDeben.clientes)} detalle="clientes en cuenta corriente" />
              <Tile label="Debés" valor={pesos(f.debesTotal)} detalle="proveedores, gastos impagos y echeqs a terceros" />
              <Tile label="Posición" valor={pesos(f.posicion)} detalle={`tenés + te deben − debés${f.completa ? '' : ' · incompleta: faltan saldos'}`} alerta={f.posicion < 0 || !f.completa} />
            </Tiles>
            {data.avisos.map((a, i) => <Aviso key={i} tono="warn">{a}</Aviso>)}
            <QueEs>
              <p style={{ margin: '0 0 6px' }}><strong>Posición</strong>: si hoy cobraras todo lo que te deben y pagaras todo lo que debés, la plata que te quedaría. La mercadería en stock no está (es plata, pero hay que venderla: la ves arriba, en «¿Dónde está la plata?»).</p>
              <p style={{ margin: 0 }}>Que la posición dé negativa no es que te falte plata: es que el stock (y lo que se vende cada día) está financiando la deuda. Lo que dice si falta plata es el cuadre de abajo y la diferencia de cada cuenta al cargar su saldo.</p>
            </QueEs>
          </>
        )}
      </Bloque>

      {f && (
        <Grilla>
          <Efectivo ef={f.efectivo} />
          <Cuentas cuentas={f.cuentas} mp={f.mp} onCargar={(c) => { setAviso(''); setCargando(c); }} />
          <Deudas debes={f.debes} teDeben={f.teDeben} />
        </Grilla>
      )}

      <Bloque
        titulo="Lo que entró y lo que salió"
        sub="Cada peso una vez, en el período elegido: lo cobrado (no lo vendido en cuenta corriente) y lo pagado (no lo que se debe)."
        acciones={(
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <select id="plata-periodo" className={s['select-inline']} value={preset} onChange={(e) => elegir(e.target.value)} aria-label="Período">
              {PRESETS_PLATA.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
            </select>
            {preset === 'otro' && (
              <>
                <input id="plata-desde" type="date" value={desde} max={hasta} onChange={(e) => setRango([e.target.value, hasta])} aria-label="Desde" />
                <input id="plata-hasta" type="date" value={hasta} min={desde} onChange={(e) => setRango([desde, e.target.value])} aria-label="Hasta" />
              </>
            )}
          </div>
        )}
      >
        {data?.periodo ? <Periodo p={data.periodo} /> : loading ? <Cargando /> : null}
      </Bloque>

      {data?.periodo && (
        <>
          <div className={cx(s['card-title'])} style={{ margin: '4px 0 -6px' }}>¿Se perdió plata?</div>
          <Controles p={data.periodo} />
        </>
      )}

      {data && (
        <Bloque titulo="Lo que este resumen no sabe" sub="Para que ningún número se lea de más.">
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, lineHeight: 1.45 }}>
            {NO_SABE.map((t) => <li key={t}>{t}</li>)}
          </ul>
        </Bloque>
      )}

      {cargando && (
        <CargarSaldoModal
          cuenta={cargando}
          mpConectada={!!f?.mp.conectada}
          onCerrar={() => setCargando(null)}
          onHecho={(r) => {
            setCargando(null);
            setAviso(r.diferencia == null
              ? `Saldo guardado: ${pesos(r.saldo)}. Desde ahora el ERP sigue esta cuenta.`
              : `Saldo guardado: ${pesos(r.saldo)}. El ERP calculaba ${pesos(r.estimado)}: diferencia ${conSigno(r.diferencia, pesos)}.`);
            reload();
          }}
        />
      )}
    </div>
  );
}
