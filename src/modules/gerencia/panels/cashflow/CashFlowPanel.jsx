/**
 * GERENCIA › CASH FLOW (4/10/2026, pedido del dueño) — PARTE 1
 * ============================================================================
 * La caja central de efectivo físico: lo que llega en los sobres de cada
 * cierre de caja de los locales y lo que se saca con un concepto (retiro,
 * depósito). Todo lo que mueve plata confirma dos veces; nada se borra, se
 * anula con motivo. Las reglas viven en el servidor (crm-api/src/cashflow);
 * acá solo se pide y se muestra.
 *
 * 7/10/2026: las ventanas que mueven plata (contar, sobre, ingreso/egreso,
 * pago, anular, arranque) se exportan y las usa también la versión de celular
 * (CashFlowMovil.jsx, en /cashflow): mismas reglas, misma doble confirmación.
 * Dentro de esa pantalla `useModalModo().movil` es true y se ajustan para el
 * dedo (botones − / + en los billetes, facturas en tarjetas).
 */
import { useEffect, useMemo, useState } from 'react';
import { Tabs, Tab } from '@mui/material';
import { httpClient } from '@core/services/httpClient.js';
import { useResource } from '@modules/ventas/hooks/useResource.js';
import { errorMsg } from '@modules/ventas/services/ventas.api.js';
import { cx } from '@shared/utils/classNames.js';
import { money, num } from '@modules/productos/domain/format.js';
import { Table, PanelHead, Btn, Pill, s } from '@modules/productos/components/ui.jsx';
import { ModalShell } from '@modules/productos/components/Modal.jsx';
import { useModalModo } from '@modules/productos/components/modalModo.js';
import { useSegundaConfirmacion, AvisoSegundaConfirmacion, textoBoton } from '@modules/gastos/components/segundaConfirmacion.jsx';
import { descargarCsv, csvNum } from '@shared/utils/csv.js';
import { imprimirDocumento, esc } from '@core/services/imprimir.js';
import { Aviso, Bloque, Cargando, Grilla, Tile, Tiles } from '../metricas/piezas.jsx';
import { ColumnasMulti } from '../metricas/graficos.jsx';
import { iso } from '../metricas/formato.js';
import { CajasAControlar, TildeControlar } from './CajasAControlar.jsx';
import { useTildeControlar, useUmbralControlar } from './tildeControlar.js';
import { ANULABLES, DENOMINACIONES, MEDIO, ORIGEN, diasDesde, etiquetaPeriodo, fechaCorta, fechaHora, fechaIso, hoy, primerDiaMes, queEs, textoAnular, tituloPeriodo } from './formato.js';

/** La diferencia, con su color: rojo faltó, verde sobró, gris nada. */
export function Diferencia({ v }) {
  if (v == null) return <span className={s.muted}>—</span>;
  const n = Number(v) || 0;
  if (Math.abs(n) < 0.009) return <span style={{ color: 'var(--crm-color-text-muted)' }}>sin diferencia</span>;
  return <strong style={{ color: n < 0 ? 'var(--crm-color-danger)' : 'var(--crm-color-primary)' }}>{n > 0 ? '+' : '−'}{money(Math.abs(n))}</strong>;
}
const Campo = ({ label, hint, children }) => (
  <div className={s.field}><label>{label}</label>{children}{hint && <div className={s.hint} style={{ margin: '6px 0 0' }}>{hint}</div>}</div>
);

/* ==================================================================== *
 * Arranque: desde qué día y con cuánto efectivo en mano
 * ==================================================================== */
export function Arranque({ caja, onHecho, avisar, onCancelar }) {
  const [fecha, setFecha] = useState(caja?.fechaInicio ?? hoy());
  const [saldo, setSaldo] = useState(String(caja?.saldoInicial ?? ''));
  const [error, setError] = useState('');
  const sc = useSegundaConfirmacion(`${fecha}|${saldo}`);
  const importe = Number(saldo);
  const guardar = () => sc.clic(
    () => {
      setError('');
      if (!fecha || fecha > hoy()) { setError('Elegí el día de arranque (hoy o anterior).'); return false; }
      if (!Number.isFinite(importe) || importe < 0) { setError('El saldo inicial tiene que ser un importe (puede ser 0).'); return false; }
      return true;
    },
    async () => {
      try {
        await httpClient.put('/cashflow/inicio', { fechaInicio: fecha, saldoInicial: importe, confirmado: true });
        avisar('ok', `Cash Flow en marcha desde el ${fechaIso(fecha)} con ${money(importe)} en mano.`);
        onHecho();
      } catch (e) { setError(errorMsg(e)); }
    },
  );
  return (
    <Bloque titulo={caja ? 'Cambiar el arranque' : 'Arrancar el Cash Flow'} sub="Contá el efectivo que tenés en la mano hoy: ese es el saldo inicial. Los sobres anteriores a la fecha no se piden controlar.">
      <div className={s['form-grid']}>
        <Campo label="Arranca el día"><input type="date" value={fecha} max={hoy()} onChange={(e) => setFecha(e.target.value)} /></Campo>
        <Campo label="Efectivo en mano ese día" hint="Lo que contaste, con billetes y monedas. Puede ser 0.">
          <input type="number" min="0" step="0.01" inputMode="decimal" value={saldo} onChange={(e) => setSaldo(e.target.value)} placeholder="0" />
        </Campo>
      </div>
      <AvisoSegundaConfirmacion {...sc}>
        El Cash Flow arranca el <strong>{fechaIso(fecha)}</strong> con <strong>{money(importe || 0)}</strong> en mano.
        {caja ? ' Esto reemplaza el arranque anterior.' : ''}
      </AvisoSegundaConfirmacion>
      {error && <Aviso tono="warn">{error}</Aviso>}
      <div style={{ display: 'flex', gap: 8 }}>
        <Btn variant="btn-primary" onClick={guardar}>{textoBoton(sc, caja ? 'Cambiar el arranque' : 'Arrancar', 'Sí, confirmar')}</Btn>
        {onCancelar && <Btn onClick={onCancelar}>Cancelar</Btn>}
      </div>
    </Bloque>
  );
}

/* ==================================================================== *
 * Resumen
 * ==================================================================== */
function Resumen({ d, conceptos, irA, avisar, onHecho }) {
  const [cambiando, setCambiando] = useState(false);
  const negativo = d.saldo < -0.009;
  return (
    <>
      <AccionesCaja saldo={d.saldo} enTransito={d.enTransito} conceptos={conceptos} conConteo onHecho={onHecho} avisar={avisar} />
      <Tiles>
        <Tile label="Efectivo en mano" valor={money(d.saldo)} alerta={negativo} detalle={negativo ? 'El saldo quedó en negativo: revisá los movimientos' : 'Sobres controlados + ingresos − egresos'} />
        <Tile label="En tránsito" valor={money(d.enTransito.total)} marca="#2563eb" detalle={d.enTransito.sobres ? `${d.enTransito.sobres} sobre${d.enTransito.sobres === 1 ? '' : 's'} sin controlar` : 'Ningún sobre pendiente'} />
        <Tile label={`Ingresos de ${d.mes.periodo.slice(5)}/${d.mes.periodo.slice(0, 4)}`} valor={money(d.mes.ingresos)} marca="var(--crm-color-primary)" detalle="sobres y otros ingresos" />
        <Tile label={`Egresos de ${d.mes.periodo.slice(5)}/${d.mes.periodo.slice(0, 4)}`} valor={money(d.mes.egresos)} marca="#dc2626" detalle="lo que salió de tu caja" />
      </Tiles>
      {d.enTransito.sobres > 0 && (
        <Aviso tono="info">
          Tenés <strong>{d.enTransito.sobres}</strong> sobre{d.enTransito.sobres === 1 ? '' : 's'} por <strong>{money(d.enTransito.total)}</strong> esperando que los cuentes.{' '}
          <Btn small variant="btn-primary" onClick={() => irA('sobres')}>Controlar sobres</Btn>
        </Aviso>
      )}
      <Grilla>
        <Bloque titulo="Últimos movimientos" acciones={<Btn small onClick={() => irA('movimientos')}>Ver todos</Btn>}>
          <TablaMovimientos filas={d.ultimos} compacta />
        </Bloque>
        <Bloque titulo="Últimos conteos" sub="Cada vez que contás tu caja queda registrado, con o sin ajuste.">
          <Table cols={[{ h: 'Fecha' }, { h: 'Contado', num: true }, { h: 'Debía haber', num: true }, { h: 'Diferencia', num: true }, { h: 'Ajuste' }]} empty="Todavía no contaste tu caja.">
            {(d.conteos ?? []).map((c) => (
              <tr key={c.id} title={c.motivo || undefined}>
                <td>{fechaHora(c.fecha)}</td>
                <td className={s.num}>{money(c.contado)}</td>
                <td className={s.num}>{money(c.esperado)}</td>
                <td className={s.num}><Diferencia v={c.diferencia} /></td>
                <td>
                  {Math.abs(c.diferencia) < 0.009 ? <span className={s.muted}>no hizo falta</span> : c.ajustado ? 'Ajustado' : <span className={s.muted}>sin ajustar</span>}
                  {c.enTransito > 0 && <div className={s.hint} style={{ margin: 0 }}>había {money(c.enTransito)} en sobres sin controlar</div>}
                </td>
              </tr>
            ))}
          </Table>
        </Bloque>
        <Bloque titulo="Arranque" sub={`Desde el ${fechaIso(d.caja.fechaInicio)} con ${money(d.caja.saldoInicial)} en mano.`}>
          {cambiando
            ? <Arranque caja={d.caja} avisar={avisar} onHecho={() => { setCambiando(false); onHecho(); }} onCancelar={() => setCambiando(false)} />
            : (
              <div style={{ display: 'grid', gap: 8 }}>
                <div className={s.hint} style={{ margin: 0 }}>El arranque solo se cambia mientras no haya movimientos registrados. Después, el efectivo se corrige con un ingreso o un egreso con su motivo.</div>
                <div><Btn small onClick={() => setCambiando(true)}>Cambiar el arranque</Btn></div>
              </div>
            )}
        </Bloque>
      </Grilla>
    </>
  );
}

/* ==================================================================== *
 * Sobres
 * ==================================================================== */
/**
 * EL CONTADOR DE BILLETES (auditoría 5/10): el mismo para «Contar mi caja» y
 * para el control a ciegas de un sobre. Cantidades enteras por denominación +
 * monedas y otros; `payload()` es lo que viaja al servidor (que recalcula).
 */
function useBilletes() {
  const [billetes, setBilletes] = useState({});
  const [otros, setOtros] = useState('');
  const suma = DENOMINACIONES.reduce((a, d) => a + d * (Number(billetes[d]) || 0), 0);
  const contado = Math.round((suma + (Number(otros) || 0)) * 100) / 100;
  const enteros = DENOMINACIONES.every((d) => billetes[d] == null || billetes[d] === '' || (Number.isInteger(Number(billetes[d])) && Number(billetes[d]) >= 0));
  const payload = () => {
    const b = {};
    for (const d of DENOMINACIONES) if (Number(billetes[d]) > 0) b[d] = Number(billetes[d]);
    return { billetes: b, otros: Number(otros) || 0 };
  };
  return { billetes, setBilletes, otros, setOtros, contado, enteros, payload, clave: `${JSON.stringify(billetes)}|${otros}` };
}

/**
 * ENTER PASA AL RENGLÓN SIGUIENTE (8/10/2026, pedido del dueño): se cuenta un
 * billete, se escribe, Enter, el próximo — sin mouse. El número del renglón
 * nuevo queda marcado para escribir encima. Enter nunca confirma nada: en el
 * último renglón no hace nada (confirmar plata es siempre un clic a propósito).
 */
function enterAlSiguiente(e) {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const campos = [...e.currentTarget.closest('[data-contador]').querySelectorAll('input')];
  const siguiente = campos[campos.indexOf(e.currentTarget) + 1];
  if (siguiente) { siguiente.focus(); siguiente.select(); }
}
const marcar = (e) => e.target.select();

function ContadorBilletes({ c }) {
  const { movil } = useModalModo();
  if (movil) return <ContadorBilletesMovil c={c} />;
  return (
    <div data-contador style={{ display: 'grid', gridTemplateColumns: 'auto 90px 1fr', gap: '6px 12px', alignItems: 'center', fontVariantNumeric: 'tabular-nums' }}>
      {DENOMINACIONES.map((d, i) => (
        <span key={d} style={{ display: 'contents' }}>
          <span>{money(d)}</span>
          <input type="number" min="0" step="1" inputMode="numeric" value={c.billetes[d] ?? ''} onChange={(e) => c.setBilletes((b) => ({ ...b, [d]: e.target.value }))}
            onKeyDown={enterAlSiguiente} onFocus={marcar} aria-label={`Billetes de ${money(d)}`} autoFocus={i === 0} />
          <strong style={{ textAlign: 'right' }}>{Number(c.billetes[d]) > 0 ? money(d * Number(c.billetes[d])) : ''}</strong>
        </span>
      ))}
      <span>Monedas y otros</span>
      <input type="number" min="0" step="0.01" value={c.otros} onChange={(e) => c.setOtros(e.target.value)} onKeyDown={enterAlSiguiente} onFocus={marcar} aria-label="Monedas y otros" />
      <strong style={{ textAlign: 'right' }}>{Number(c.otros) > 0 ? money(Number(c.otros)) : ''}</strong>
      <span style={{ fontWeight: 700 }}>Total contado</span><span />
      <strong style={{ textAlign: 'right', fontSize: 18 }}>{money(c.contado)}</strong>
    </div>
  );
}

/**
 * EL CONTADOR EN EL CELULAR: un renglón por billete con − y + grandes (se
 * cuenta tocando, sin abrir el teclado) y el número igual se puede escribir.
 * El total queda fijo abajo de la lista mientras se cuenta.
 */
function ContadorBilletesMovil({ c }) {
  const cant = (d) => Number(c.billetes[d]) || 0;
  const poner = (d, n) => c.setBilletes((b) => ({ ...b, [d]: n > 0 ? String(n) : '' }));
  const boton = { width: 44, height: 44, borderRadius: 12, border: '1px solid var(--crm-color-border)', background: 'var(--crm-color-surface-2)', color: 'var(--crm-color-text)', fontSize: 22, fontWeight: 700, lineHeight: 1, cursor: 'pointer', flex: '0 0 auto', touchAction: 'manipulation' };
  return (
    <div data-contador style={{ display: 'flex', flexDirection: 'column', gap: 4, fontVariantNumeric: 'tabular-nums' }}>
      {DENOMINACIONES.map((d) => (
        <div key={d} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '5px 0', borderBottom: '1px solid var(--crm-color-border)' }}>
          <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <strong style={{ fontSize: 16 }}>{money(d).replace(/,00$/, '')}</strong>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: cant(d) ? 'var(--crm-color-primary)' : 'var(--crm-color-text-muted)', overflowWrap: 'anywhere' }}>{cant(d) ? `= ${money(d * cant(d))}` : 'ninguno'}</span>
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '0 0 auto' }}>
            <button type="button" style={{ ...boton, opacity: cant(d) ? 1 : 0.45 }} onClick={() => poner(d, cant(d) - 1)} disabled={!cant(d)} aria-label={`Un billete menos de ${money(d)}`}>−</button>
            <input type="number" min="0" step="1" inputMode="numeric" value={c.billetes[d] ?? ''} placeholder="0"
              onChange={(e) => c.setBilletes((b) => ({ ...b, [d]: e.target.value }))} onFocus={marcar} onKeyDown={enterAlSiguiente} enterKeyHint="next"
              aria-label={`Billetes de ${money(d)}`} style={{ width: 58, height: 44, textAlign: 'center', fontWeight: 700, padding: 0 }} />
            <button type="button" style={boton} onClick={() => poner(d, cant(d) + 1)} aria-label={`Un billete más de ${money(d)}`}>+</button>
          </div>
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 0' }}>
        <label htmlFor="cf-otros" style={{ fontWeight: 600 }}>Monedas y otros</label>
        <input id="cf-otros" type="number" min="0" step="0.01" inputMode="decimal" value={c.otros} placeholder="$ 0" onChange={(e) => c.setOtros(e.target.value)} onFocus={marcar} onKeyDown={enterAlSiguiente} style={{ width: 120, height: 44, textAlign: 'right', flex: '0 0 auto' }} />
      </div>
      <div style={{ position: 'sticky', bottom: -16, margin: '0 -16px', padding: '12px 16px', gap: 8, flexWrap: 'wrap', background: 'var(--crm-color-primary-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: '1px solid var(--crm-color-border)', zIndex: 1 }}>
        <span style={{ fontWeight: 700 }}>Total contado</span>
        <strong style={{ fontSize: 22 }}>{money(c.contado)}</strong>
      </div>
    </div>
  );
}

/** Lo que puso el cajero contra lo que contó el dueño, billete por billete: muestra DÓNDE está la diferencia. */
function CompararBilletes(props) {
  const { movil } = useModalModo();
  if (movil) return <CompararBilletesMovil {...props} />;
  const { delCajero, contados, otrosContados, enviado, contado } = props;
  const cajero = delCajero || {};
  const yo = contados || {};
  const dens = DENOMINACIONES.filter((d) => Number(cajero[d]) > 0 || Number(yo[d]) > 0);
  const hayDetalle = Object.values(cajero).some((n) => Number(n) > 0);
  return (
    <Table cols={[{ h: 'Billete' }, { h: 'Puso el cajero', num: true }, { h: 'Contaste', num: true }, { h: 'Diferencia', num: true }]} empty="">
      {dens.map((d) => {
        const a = Number(cajero[d]) || 0; const b = Number(yo[d]) || 0;
        return (
          <tr key={d}>
            <td>{money(d)}</td>
            <td className={s.num}>{hayDetalle ? a : '—'}</td>
            <td className={s.num}>{b}</td>
            <td className={s.num}>{hayDetalle ? <Diferencia v={(b - a) * d} /> : '—'}</td>
          </tr>
        );
      })}
      {Number(otrosContados) > 0 && (
        <tr><td>Monedas y otros</td><td className={s.num}>—</td><td className={s.num}>{money(otrosContados)}</td><td className={s.num}>—</td></tr>
      )}
      <tr>
        <td><strong>Total</strong></td>
        <td className={s.num}><strong>{money(enviado)}</strong></td>
        <td className={s.num}><strong>{money(contado)}</strong></td>
        <td className={s.num}><Diferencia v={Math.round((contado - enviado) * 100) / 100} /></td>
      </tr>
    </Table>
  );
}

/** La misma comparación, angosta: cuatro columnas cortas que entran en el teléfono sin correrse. */
function CompararBilletesMovil({ delCajero, contados, otrosContados, enviado, contado }) {
  const cajero = delCajero || {};
  const yo = contados || {};
  const dens = DENOMINACIONES.filter((d) => Number(cajero[d]) > 0 || Number(yo[d]) > 0);
  const hayDetalle = Object.values(cajero).some((n) => Number(n) > 0);
  const fila = { display: 'grid', gridTemplateColumns: '1fr 52px 52px minmax(92px, auto)', gap: 8, alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--crm-color-border)', fontVariantNumeric: 'tabular-nums' };
  const der = { textAlign: 'right' };
  const sinCentavos = (v) => money(v).replace(/,00$/, '');
  return (
    <div style={{ fontSize: 14 }}>
      <div style={{ ...fila, fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--crm-color-text-secondary)', paddingTop: 0 }}>
        <span>Billete</span><span style={der}>Cajero</span><span style={der}>Vos</span><span style={der}>Diferencia</span>
      </div>
      {dens.map((d) => {
        const a = Number(cajero[d]) || 0; const b = Number(yo[d]) || 0;
        return (
          <div key={d} style={{ ...fila, background: hayDetalle && a !== b ? 'color-mix(in srgb, var(--crm-color-danger) 8%, transparent)' : undefined }}>
            <strong>{sinCentavos(d)}</strong>
            <span style={der}>{hayDetalle ? a : '—'}</span>
            <span style={der}>{b}</span>
            <span style={der}>{hayDetalle ? <Diferencia v={(b - a) * d} /> : '—'}</span>
          </div>
        );
      })}
      {Number(otrosContados) > 0 && (
        <div style={fila}><span>Monedas</span><span style={der}>—</span><span style={der} /><span style={der}>{money(otrosContados)}</span></div>
      )}
      <div style={{ display: 'grid', gap: 4, padding: '10px 0 2px' }}>
        <span style={{ display: 'flex', justifyContent: 'space-between' }}><span>Dice el sobre</span><strong>{money(enviado)}</strong></span>
        <span style={{ display: 'flex', justifyContent: 'space-between' }}><span>Contaste</span><strong>{money(contado)}</strong></span>
        <span style={{ display: 'flex', justifyContent: 'space-between' }}><span>Diferencia</span><Diferencia v={Math.round((contado - enviado) * 100) / 100} /></span>
      </div>
    </div>
  );
}

function CierreDelCajero({ sobre }) {
  const pagos = Array.isArray(sobre.pagosLocalDetalle) ? sobre.pagosLocalDetalle : [];
  return (
    <div style={{ display: 'grid', gap: 6, fontSize: 13 }}>
      <div className={s['mini-label']}>El cierre del cajero</div>
      <span>Contó en el cajón: <strong>{money(sobre.contadoCajero)}</strong> · esperado por el sistema: <strong>{money(sobre.esperadoCajero)}</strong> · <Diferencia v={sobre.diferenciaCajero} /></span>
      <span>Quedó de fondo: <strong>{money(sobre.fondoQueda)}</strong></span>
      {pagos.length > 0 && (
        <span>Pagos en efectivo del local en ese turno (informativo, no restan de tu caja): {pagos.map((p, i) => <span key={i}>{i ? ' · ' : ''}{p.motivo || 'Egreso'} <strong>{money(p.importe)}</strong></span>)}</span>
      )}
    </div>
  );
}

/**
 * CONTROLAR UN SOBRE, A CIEGAS (auditoría 5/10): primero se cuenta billete
 * por billete SIN ver lo que dice el sobre (si el número está a la vista, se
 * tiende a confirmarlo sin contar); recién después se compara, denominación
 * por denominación, y la diferencia pide su motivo.
 */
export function SobreModal({ sobre, onCerrar, onHecho, avisar }) {
  const c = useBilletes();
  const [paso, setPaso] = useState('contar');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const diferencia = Math.round((c.contado - sobre.enviado) * 100) / 100;
  const hayDif = Math.abs(diferencia) > 0.009;
  /* Cajas a controlar (0145): la del sobre y la del cierre del cajero; cualquiera de las dos propone el tilde. */
  const tilde = useTildeControlar([diferencia, sobre.diferenciaCajero], useUmbralControlar());
  const sc = useSegundaConfirmacion(`${c.clave}|${motivo}|${paso}|${tilde.marcar}`);
  const comparar = () => {
    setError('');
    if (!c.enteros) { setError('Las cantidades de billetes van enteras.'); return; }
    if (c.contado <= 0) { setError('Cargá los billetes que contaste. Si el sobre no llegó o ya estaba en tu saldo inicial, cerrá esto y usá «No corresponde».'); return; }
    setPaso('comparar');
  };
  const confirmar = () => sc.clic(
    () => {
      setError('');
      if (hayDif && !motivo.trim()) { setError('Contaste distinto de lo enviado: escribí el motivo de la diferencia.'); return false; }
      return true;
    },
    async () => {
      try {
        const r = await httpClient.post(`/cashflow/sobres/${sobre.cajaSesionId}/controlar`, { ...c.payload(), motivo: motivo.trim(), confirmado: true, aControlar: tilde.pedido });
        avisar('ok', `Sobre de ${sobre.sucursal} controlado: ${money(r.contado)} a tu caja. Efectivo en mano: ${money(r.saldo)}.${tilde.marcar ? ' La caja quedó en «Cajas a controlar».' : ''}`);
        onHecho();
      } catch (e) { setError(errorMsg(e)); }
    },
  );
  const subtitulo = `Cierre del ${fechaHora(sobre.cierre)} · armó el sobre: ${sobre.cajero || '—'}`;
  if (paso === 'contar') {
    return (
      <ModalShell title={`Controlar el sobre de ${sobre.sucursal}`} subtitle={subtitulo} onClose={onCerrar} footer={[
        { texto: 'Cancelar', onClick: onCerrar },
        { texto: 'Comparar con el sobre', clase: 'btn-primary', onClick: comparar, disabled: c.contado <= 0 },
      ]}>
        <Aviso tono="info">Abrí el sobre y contá billete por billete. Lo que dice el sobre lo ves <strong>después</strong> de contar: así el control es a ciegas.</Aviso>
        <ContadorBilletes c={c} />
        {error && <Aviso tono="warn">{error}</Aviso>}
      </ModalShell>
    );
  }
  return (
    <ModalShell title={`Controlar el sobre de ${sobre.sucursal}`} subtitle={subtitulo} wide onClose={onCerrar} footer={[
      { texto: 'Volver a contar', onClick: () => setPaso('contar') },
      { texto: textoBoton(sc, 'Controlar sobre', 'Sí, confirmar'), clase: 'btn-primary', onClick: confirmar },
    ]}>
      <CompararBilletes delCajero={sobre.billetesEnvio} contados={c.payload().billetes} otrosContados={c.payload().otros} enviado={sobre.enviado} contado={c.contado} />
      <div className={cx(s.callout, hayDif ? s.warn : s.info)} style={{ margin: 0 }}>
        {hayDif
          ? <>{diferencia < 0 ? 'Falta' : 'Sobra'} <strong>{money(Math.abs(diferencia))}</strong> en el sobre. Queda registrado con el cajero que lo armó. Si te equivocaste al contar, tocá «Volver a contar».</>
          : <>Coincide con lo que mandó el local.</>}
      </div>
      {hayDif && (
        <Campo label="Motivo de la diferencia *">
          <textarea rows={2} maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej: faltaba un billete de $1.000; el cajero avisó por WhatsApp" autoFocus />
        </Campo>
      )}
      <CierreDelCajero sobre={sobre} />
      <TildeControlar t={tilde} />
      <AvisoSegundaConfirmacion {...sc}>
        Entra a tu caja <strong>{money(c.contado)}</strong> del sobre de <strong>{sobre.sucursal}</strong>
        {hayDif ? <> con una diferencia de <Diferencia v={diferencia} /></> : ' sin diferencia'}
        {tilde.marcar ? <> y la caja va a <strong>Cajas a controlar</strong></> : ''}.
      </AvisoSegundaConfirmacion>
      {error && <Aviso tono="warn">{error}</Aviso>}
    </ModalShell>
  );
}

/** Un sobre ya resuelto, para mirar: lo que puso el cajero contra lo que contaste, o por qué no correspondía. */
export function SobreVer({ sobre, onCerrar }) {
  const conDetalle = Object.values(sobre.billetesContados || {}).some((n) => Number(n) > 0) || sobre.otrosContados > 0;
  return (
    <ModalShell title={`Sobre de ${sobre.sucursal}`} subtitle={`Cierre del ${fechaHora(sobre.cierre)} · armó el sobre: ${sobre.cajero || '—'}`} wide onClose={onCerrar} footer={[{ texto: 'Cerrar', onClick: onCerrar }]}>
      {sobre.descartado ? (
        <Aviso tono="info">
          Marcado como <strong>no corresponde</strong>: el sobre decía {money(sobre.enviado)} y no entró a tu caja. Motivo: {sobre.motivo || '—'}.
        </Aviso>
      ) : conDetalle ? (
        <CompararBilletes delCajero={sobre.billetesEnvio} contados={sobre.billetesContados} otrosContados={sobre.otrosContados} enviado={sobre.enviado} contado={sobre.contado} />
      ) : (
        <div className={cx(s.callout, s.info)} style={{ margin: 0 }}>
          El sobre decía <strong>{money(sobre.enviado)}</strong> · contaste <strong>{money(sobre.contado)}</strong> · <Diferencia v={sobre.diferencia} />
          <div className={s.hint} style={{ margin: '4px 0 0' }}>Controlado antes del conteo por billetes: no hay detalle por denominación.</div>
        </div>
      )}
      {!sobre.descartado && sobre.motivo && <div className={s.hint} style={{ margin: 0 }}>Motivo de la diferencia: {sobre.motivo}</div>}
      <CierreDelCajero sobre={sobre} />
      <div className={s.hint} style={{ margin: 0 }}>Resuelto por {sobre.controladoPor || '—'} el {fechaHora(sobre.controladoEn)}.</div>
    </ModalShell>
  );
}

export function AnularModal({ titulo, texto, ruta, onCerrar, onHecho, avisar, exito, boton = 'Anular', extra, aviso = 'Se anula y el efectivo en mano se recalcula.', placeholder }) {
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const sc = useSegundaConfirmacion(motivo);
  const confirmar = () => sc.clic(
    () => { setError(''); if (!motivo.trim()) { setError('Escribí el motivo.'); return false; } return true; },
    async () => {
      try {
        const r = await httpClient.post(ruta, { motivo: motivo.trim(), ...extra });
        avisar('ok', `${exito} Efectivo en mano: ${money(r.saldo)}.`);
        onHecho();
      } catch (e) { setError(errorMsg(e)); }
    },
  );
  return (
    <ModalShell title={titulo} onClose={onCerrar} footer={[
      { texto: 'Cancelar', onClick: onCerrar },
      { texto: textoBoton(sc, boton, `Sí, ${boton.toLowerCase()}`), clase: 'btn-delete', onClick: confirmar },
    ]}>
      <div className={s.desc}>{texto} Queda registrado quién lo anuló, cuándo y por qué; no se borra.</div>
      <Campo label="Motivo *"><textarea rows={2} maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={placeholder} autoFocus /></Campo>
      <AvisoSegundaConfirmacion {...sc}>{aviso}</AvisoSegundaConfirmacion>
      {error && <Aviso tono="warn">{error}</Aviso>}
    </ModalShell>
  );
}

const TOPE_SOBRES = 300;

function Sobres({ version, bump, avisar }) {
  const [estado, setEstado] = useState('pendientes');
  const [sucursalId, setSucursalId] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [modal, setModal] = useState(null);
  const { data: sucursales } = useResource('cashflow:sucursales', () => httpClient.get('/sucursales'));
  const qs = `estado=${estado}${sucursalId ? `&sucursalId=${sucursalId}` : ''}${desde ? `&desde=${desde}` : ''}${hasta ? `&hasta=${hasta}` : ''}`;
  const { data, loading, error } = useResource(`cashflow:sobres:${qs}:${version}`, () => httpClient.get(`/cashflow/sobres?${qs}`));
  const filas = data ?? [];
  const pendientes = estado === 'pendientes';
  const total = filas.reduce((a, x) => a + (pendientes ? x.enviado : x.descartado ? 0 : x.contado), 0);
  const cerrar = () => setModal(null);
  const hecho = () => { setModal(null); bump(); };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className={s.toolbar}>
        <select className={s['select-inline']} value={estado} onChange={(e) => setEstado(e.target.value)} aria-label="Estado">
          <option value="pendientes">Sin controlar</option>
          <option value="controlados">Resueltos</option>
        </select>
        <select className={s['select-inline']} value={sucursalId} onChange={(e) => setSucursalId(e.target.value)} aria-label="Local">
          <option value="">Todos los locales</option>
          {(sucursales ?? []).map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
        </select>
        <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} aria-label="Desde" />
        <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} aria-label="Hasta" />
        {(desde || hasta || sucursalId) && <Btn small onClick={() => { setDesde(''); setHasta(''); setSucursalId(''); }}>Limpiar</Btn>}
        <span className={s.hint} style={{ margin: '0 0 0 auto' }}>{filas.length} sobre{filas.length === 1 ? '' : 's'} · {money(total)}</span>
      </div>
      {filas.length >= TOPE_SOBRES && <Aviso tono="warn">Se muestran los {TOPE_SOBRES} más recientes: elegí un local o acotá las fechas para ver el resto.</Aviso>}
      {error && <Aviso tono="warn">{error}</Aviso>}
      {loading && !data ? <Cargando /> : (
        <Table
          cols={[
            { h: 'Cierre' }, { h: 'Sucursal' }, { h: 'Cajero' }, { h: 'Enviado', num: true }, { h: 'Pagó el local', num: true },
            ...(pendientes ? [{ h: 'Espera' }] : [{ h: 'Contado', num: true }, { h: 'Diferencia', num: true }, { h: 'Resuelto' }]),
            { h: 'Acciones', cls: 'actions-col' },
          ]}
          empty={pendientes ? 'No hay sobres sin controlar.' : 'Todavía no resolviste ningún sobre.'}
        >
          {filas.map((x) => {
            const dias = diasDesde(x.cierre);
            return (
              <tr key={x.cajaSesionId}>
                <td>{fechaHora(x.cierre)}</td>
                <td>{x.sucursal}</td>
                <td>{x.cajero || '—'}</td>
                <td className={s.num}><strong>{money(x.enviado)}</strong></td>
                <td className={s.num}>{x.pagosLocal > 0 ? <span title="Informativo: no resta de tu caja">{money(x.pagosLocal)}</span> : <span className={s.muted}>—</span>}</td>
                {pendientes ? (
                  <td>
                    <span style={dias >= 3 ? { color: 'var(--crm-color-danger)', fontWeight: 700 } : undefined}>
                      {dias === 0 ? 'hoy' : `${dias} día${dias === 1 ? '' : 's'}`}
                    </span>
                  </td>
                ) : (
                  <>
                    <td className={s.num}>{x.descartado ? <Pill pill="st-retenido" label="No corresponde" /> : money(x.contado)}</td>
                    <td className={s.num}>{x.descartado ? <span className={s.muted}>—</span> : <Diferencia v={x.diferencia} />}</td>
                    <td><span title={fechaHora(x.controladoEn)}>{x.controladoPor || '—'}</span><div className={s.hint} style={{ margin: 0 }}>{fechaCorta(x.controladoEn)}</div></td>
                  </>
                )}
                <td className={s['actions-col']}>
                  <div className={s['row-actions']}>
                    {pendientes ? (
                      <>
                        <Btn variant="btn-primary" small onClick={() => setModal({ tipo: 'controlar', sobre: x })}>Controlar</Btn>
                        <Btn small onClick={() => setModal({ tipo: 'descartar', sobre: x })}>No corresponde</Btn>
                      </>
                    ) : (
                      <>
                        <Btn small onClick={() => setModal({ tipo: 'ver', sobre: x })}>Ver</Btn>
                        <Btn small variant="btn-delete" onClick={() => setModal({ tipo: 'deshacer', sobre: x })}>Deshacer</Btn>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </Table>
      )}
      {modal?.tipo === 'controlar' && <SobreModal sobre={modal.sobre} onCerrar={cerrar} onHecho={hecho} avisar={avisar} />}
      {modal?.tipo === 'ver' && <SobreVer sobre={modal.sobre} onCerrar={cerrar} />}
      {modal?.tipo === 'descartar' && (
        <AnularModal
          titulo={`El sobre de ${modal.sobre.sucursal} no corresponde`}
          texto={`El sobre del ${fechaCorta(modal.sobre.cierre)} por ${money(modal.sobre.enviado)} sale de «sin controlar» SIN entrar a tu caja y sin cargarle un faltante a ${modal.sobre.cajero || 'el cajero'}. Usalo si ya estaba en tu saldo inicial, si es un duplicado o si se perdió (con su denuncia). Si fue un error, se deshace desde «Resueltos».`}
          ruta={`/cashflow/sobres/${modal.sobre.cajaSesionId}/descartar`}
          extra={{ confirmado: true }}
          boton="No corresponde"
          aviso={<>El sobre por <strong>{money(modal.sobre.enviado)}</strong> queda resuelto sin plata. Tu efectivo en mano no cambia.</>}
          placeholder="Ej: ya estaba contado en el saldo inicial del arranque"
          exito="Sobre marcado como «no corresponde»."
          onCerrar={cerrar} onHecho={hecho} avisar={avisar}
        />
      )}
      {modal?.tipo === 'deshacer' && (
        <AnularModal
          titulo={`Deshacer el sobre de ${modal.sobre.sucursal}`}
          texto={modal.sobre.descartado
            ? `El sobre del ${fechaCorta(modal.sobre.cierre)} vuelve a «sin controlar».`
            : `El sobre del ${fechaCorta(modal.sobre.cierre)} vuelve a «sin controlar» y los ${money(modal.sobre.contado)} salen de tu efectivo en mano. Si esa plata ya se usó, no se puede: el efectivo quedaría en negativo.`}
          ruta={`/cashflow/sobres/${modal.sobre.sobreId}/anular`}
          boton="Deshacer"
          exito="Listo: el sobre volvió a «sin controlar»."
          onCerrar={cerrar} onHecho={hecho} avisar={avisar}
        />
      )}
    </div>
  );
}

/* ==================================================================== *
 * Movimientos
 * ==================================================================== */
function TablaMovimientos({ filas, compacta, onAnular }) {
  return (
    <Table
      cols={[{ h: 'Fecha' }, { h: 'Qué' }, ...(compacta ? [] : [{ h: 'Detalle' }, { h: 'Quién' }]), { h: 'Importe', num: true }, ...(onAnular ? [{ h: '', cls: 'actions-col' }] : [])]}
      empty="Sin movimientos."
    >
      {(filas ?? []).map((m) => {
        const anulado = !!m.anuladoEn;
        const que = queEs(m);
        return (
          <tr key={m.id} style={anulado ? { opacity: 0.55, textDecoration: 'line-through' } : undefined} title={anulado ? `Anulado por ${m.anuladoPor || '—'}: ${m.anuladoMotivo}` : undefined}>
            <td>{compacta ? fechaCorta(m.fecha) : fechaHora(m.fecha)}</td>
            <td>
              <Pill pill={m.tipo === 'ingreso' ? 'st-disponible' : 'st-comprometido'} label={m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} />{' '}{que}
              {m.origen === 'sobre' && m.sobreDiferencia != null && Math.abs(m.sobreDiferencia) > 0.009 && <> · <Diferencia v={m.sobreDiferencia} /></>}
              {compacta && m.detalle && <div className={s.hint} style={{ margin: 0 }}>{m.detalle}</div>}
            </td>
            {!compacta && <td>{m.detalle || <span className={s.muted}>—</span>}{anulado && <div className={s.hint} style={{ margin: 0, textDecoration: 'none' }}>Anulado: {m.anuladoMotivo}</div>}</td>}
            {!compacta && <td>{m.usuario || '—'}</td>}
            <td className={s.num} style={{ color: m.tipo === 'ingreso' ? 'var(--crm-color-primary)' : 'var(--crm-color-danger)', fontWeight: 700 }}>
              {m.tipo === 'ingreso' ? '+' : '−'}{money(m.importe)}
            </td>
            {onAnular && (
              <td className={s['actions-col']}>
                {!anulado && ANULABLES.includes(m.origen) && <Btn small variant="btn-delete" onClick={() => onAnular(m)}>Anular</Btn>}
              </td>
            )}
          </tr>
        );
      })}
    </Table>
  );
}

/** El efectivo en mano y lo que queda después de sacar `importe` (hoy). Atrasado, el servidor mira ese día. */
function Disponible({ saldo, importe, fecha }) {
  const queda = Math.round((saldo - (importe || 0)) * 100) / 100;
  const noAlcanza = fecha === hoy() && queda < -0.009;
  return (
    <div className={cx(s.callout, noAlcanza ? s.warn : s.info)} style={{ margin: 0 }}>
      Efectivo en mano: <strong>{money(saldo)}</strong>
      {importe > 0 && <> · después de esto: <strong style={noAlcanza ? { color: 'var(--crm-color-danger)' } : undefined}>{money(queda)}</strong></>}
      {noAlcanza && <div className={s.hint} style={{ margin: '4px 0 0' }}>No alcanza: los sobres sin controlar no cuentan hasta que los controles.</div>}
      {fecha !== hoy() && <div className={s.hint} style={{ margin: '4px 0 0' }}>Con fecha anterior se controla el efectivo que había ESE día.</div>}
    </div>
  );
}

export function MovimientoModal({ tipo, conceptos, saldo, onCerrar, onHecho, avisar }) {
  const opciones = conceptos.filter((c) => c.tipo === tipo && c.activo && (c.clase !== 'gasto' || c.gastoCategoriaId));
  const [conceptoId, setConceptoId] = useState(opciones[0]?.id ?? '');
  const [importe, setImporte] = useState('');
  const [fecha, setFecha] = useState(hoy());
  const [detalle, setDetalle] = useState('');
  const [error, setError] = useState('');
  const n = Number(importe);
  const concepto = opciones.find((c) => c.id === Number(conceptoId));
  const sc = useSegundaConfirmacion(`${conceptoId}|${importe}|${fecha}|${detalle}`);
  const confirmar = () => sc.clic(
    () => {
      setError('');
      if (!concepto) { setError('Elegí el concepto.'); return false; }
      if (!Number.isFinite(n) || n <= 0) { setError('Escribí el importe.'); return false; }
      if (!fecha || fecha > hoy()) { setError('La fecha tiene que ser hoy o anterior.'); return false; }
      if (tipo === 'egreso' && fecha === hoy() && n > saldo + 0.009) { setError(`No alcanza: tenés ${money(saldo)} en mano.`); return false; }
      return true;
    },
    async () => {
      try {
        const r = await httpClient.post('/cashflow/movimientos', { tipo, conceptoId: concepto.id, importe: n, fecha, detalle: detalle.trim(), confirmado: true });
        avisar('ok', `${tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} registrado. Efectivo en mano: ${money(r.saldo)}.`);
        onHecho();
      } catch (e) { setError(errorMsg(e)); }
    },
  );
  return (
    <ModalShell title={tipo === 'ingreso' ? 'Registrar un ingreso de efectivo' : 'Sacar efectivo de la caja'} onClose={onCerrar} footer={[
      { texto: 'Cancelar', onClick: onCerrar },
      { texto: textoBoton(sc, tipo === 'ingreso' ? 'Registrar ingreso' : 'Registrar egreso', 'Sí, confirmar'), clase: 'btn-primary', onClick: confirmar },
    ]}>
      {!opciones.length && <Aviso tono="warn">No hay conceptos de {tipo} activos. Crealos en la pestaña «Conceptos».</Aviso>}
      <div className={s['form-grid']}>
        <Campo label="Concepto *">
          <select value={conceptoId} onChange={(e) => setConceptoId(e.target.value)}>
            {opciones.map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.clase === 'gasto' ? ` (gasto · ${c.gastoCategoria})` : ''}</option>)}
          </select>
        </Campo>
        <Campo label="Importe *"><input type="number" min="0" step="0.01" inputMode="decimal" value={importe} onChange={(e) => setImporte(e.target.value)} autoFocus /></Campo>
      </div>
      <div className={s['form-grid']}>
        <Campo label="Fecha"><input type="date" value={fecha} max={hoy()} onChange={(e) => setFecha(e.target.value)} /></Campo>
        <Campo label="Detalle"><input maxLength={300} value={detalle} onChange={(e) => setDetalle(e.target.value)} placeholder="Opcional: para qué, a quién" /></Campo>
      </div>
      {tipo === 'egreso' && <Disponible saldo={saldo} importe={n > 0 ? n : 0} fecha={fecha} />}
      <AvisoSegundaConfirmacion {...sc}>
        {tipo === 'ingreso' ? 'Entra' : 'Sale'} <strong>{money(n || 0)}</strong> {tipo === 'ingreso' ? 'a' : 'de'} tu caja por <strong>{concepto?.nombre ?? '—'}</strong> el {fechaIso(fecha)}.
        {concepto?.clase === 'gasto' && <> Se carga también como <strong>gasto pagado</strong> en Gastos ({concepto.gastoCategoria}).</>}
      </AvisoSegundaConfirmacion>
      {error && <Aviso tono="warn">{error}</Aviso>}
    </ModalShell>
  );
}

/**
 * PAGO A PROVEEDOR DESDE LA CAJA (parte 2): se elige el proveedor, se tildan
 * las facturas (o los gastos cargados) que se pagan y con qué (efectivo o
 * depósito). Es el mismo pago de siempre: queda en la cuenta del proveedor.
 */
export function PagoProveedorModal({ saldo, onCerrar, onHecho, avisar }) {
  const { movil } = useModalModo();
  const { data: provs } = useResource('cashflow:proveedores', () => httpClient.get('/cashflow/proveedores'));
  const [proveedorId, setProveedorId] = useState('');
  const [destino, setDestino] = useState('mercaderia');
  const [medio, setMedio] = useState('efectivo');
  const [referencia, setReferencia] = useState('');
  const [fecha, setFecha] = useState(hoy());
  const [detalle, setDetalle] = useState('');
  const [aCuenta, setACuenta] = useState('');
  const [tildes, setTildes] = useState({}); // docId -> importe (string)
  const [error, setError] = useState('');
  const { data: docs, loading } = useResource(`cashflow:pend:${proveedorId}:${destino}`, () => httpClient.get(`/cashflow/proveedores/${proveedorId}/pendientes?destino=${destino}`), { enabled: !!proveedorId });
  const prov = (provs ?? []).find((p) => p.id === Number(proveedorId));
  const aplicado = Object.values(tildes).reduce((a, v) => a + (Number(v) || 0), 0);
  const extra = Number(aCuenta) || 0;
  const total = Math.round((aplicado + extra) * 100) / 100;
  const tildar = (d, on) => setTildes((t) => { const n = { ...t }; if (on) n[d.docId] = String(d.saldo); else delete n[d.docId]; return n; });
  const sc = useSegundaConfirmacion(`${proveedorId}|${destino}|${medio}|${referencia}|${fecha}|${detalle}|${aCuenta}|${JSON.stringify(tildes)}`);
  const confirmar = () => sc.clic(
    () => {
      setError('');
      if (!prov) { setError('Elegí el proveedor.'); return false; }
      if (total <= 0) { setError('Tildá qué pagás o escribí un importe a cuenta.'); return false; }
      for (const d of docs ?? []) {
        const v = Number(tildes[d.docId]);
        if (tildes[d.docId] != null && (!(v > 0) || v > d.saldo + 0.009)) { setError(`En ${d.etiqueta} el importe tiene que ser mayor a 0 y hasta ${money(d.saldo)}.`); return false; }
      }
      if (medio === 'deposito' && !referencia.trim()) { setError('Para un depósito escribí la referencia (número de depósito o comprobante del banco).'); return false; }
      if (fecha === hoy() && total > saldo + 0.009) { setError(`No alcanza: tenés ${money(saldo)} en mano.`); return false; }
      return true;
    },
    async () => {
      try {
        const imputaciones = (docs ?? []).filter((d) => tildes[d.docId] != null).map((d) => ({ [d.tipo === 'gasto' ? 'gastoId' : 'comprobanteId']: d.docId, importe: Number(tildes[d.docId]) }));
        const r = await httpClient.post('/cashflow/pagos', { proveedorId: prov.id, destino, medio, importe: total, imputaciones, referencia: referencia.trim(), detalle: detalle.trim(), fecha, confirmado: true });
        avisar('ok', `Pago a ${prov.nombre} por ${money(total)} registrado. Efectivo en mano: ${money(r.saldo)}.`);
        onHecho();
      } catch (e) { setError(errorMsg(e)); }
    },
  );
  return (
    <ModalShell title="Pagar a un proveedor desde tu caja" subtitle="Queda en la cuenta del proveedor, aplicado a lo que tildes." wide onClose={onCerrar} footer={[
      { texto: 'Cancelar', onClick: onCerrar },
      { texto: textoBoton(sc, `Pagar ${money(total)}`, 'Sí, confirmar el pago'), clase: 'btn-primary', onClick: confirmar, disabled: !prov },
    ]}>
      <div className={s['form-grid']}>
        <Campo label="Proveedor *">
          <select value={proveedorId} onChange={(e) => { setProveedorId(e.target.value); setTildes({}); }} autoFocus>
            <option value="">— Elegí —</option>
            {(provs ?? []).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </Campo>
        <Campo label="Qué pagás">
          <select value={destino} onChange={(e) => { setDestino(e.target.value); setTildes({}); }}>
            <option value="mercaderia">Facturas de mercadería</option>
            <option value="gastos">Gastos cargados en Gastos</option>
          </select>
        </Campo>
      </div>
      <div className={s['form-grid']}>
        <Campo label="Con qué">
          <select value={medio} onChange={(e) => setMedio(e.target.value)}>
            <option value="efectivo">Efectivo en mano</option>
            <option value="deposito">Depósito en su cuenta (sale efectivo de tu caja)</option>
          </select>
        </Campo>
        <Campo label={medio === 'deposito' ? 'Referencia del depósito *' : 'Referencia'}>
          <input maxLength={200} value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder={medio === 'deposito' ? 'Nº de depósito / comprobante' : 'Opcional'} />
        </Campo>
      </div>
      <div className={s['form-grid']}>
        <Campo label="Fecha"><input type="date" value={fecha} max={hoy()} onChange={(e) => setFecha(e.target.value)} /></Campo>
        <Campo label="Detalle"><input maxLength={300} value={detalle} onChange={(e) => setDetalle(e.target.value)} placeholder="Opcional" /></Campo>
      </div>
      {prov && (
        <div>
          <div className={s['mini-label']}>{destino === 'gastos' ? 'Gastos que le debés' : 'Facturas que le debés'} — tildá las que pagás</div>
          {loading && !docs ? <Cargando /> : !(docs ?? []).length ? <div className={s.hint} style={{ margin: 0 }}>No le debés nada {destino === 'gastos' ? 'en gastos' : 'en facturas'}. Podés pagar a cuenta igual.</div> : movil ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(docs ?? []).map((d) => {
                const on = tildes[d.docId] != null;
                return (
                  <div key={`${d.tipo}${d.docId}`} style={{ border: `1px solid ${on ? 'var(--crm-color-primary)' : 'var(--crm-color-border)'}`, background: on ? 'var(--crm-color-primary-soft)' : 'var(--crm-color-surface)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                      <input type="checkbox" checked={on} onChange={(e) => tildar(d, e.target.checked)} aria-label={`Pagar ${d.etiqueta}`} style={{ width: 22, height: 22, marginTop: 1, flex: '0 0 auto' }} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <strong>{d.etiqueta}</strong>
                        <span className={s.hint} style={{ display: 'block', margin: 0 }}>{fechaCorta(d.fecha)}{d.detalle ? ` · ${d.detalle}` : ''}</span>
                      </span>
                      <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <span className={s.hint} style={{ display: 'block', margin: 0 }}>saldo</span>
                        <strong>{money(d.saldo)}</strong>
                      </span>
                    </label>
                    {on && (
                      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                        <span>Pagás</span>
                        <input type="number" min="0" max={d.saldo} step="0.01" inputMode="decimal" value={tildes[d.docId]} onChange={(e) => setTildes((t) => ({ ...t, [d.docId]: e.target.value }))} style={{ width: 150, textAlign: 'right', height: 44 }} aria-label={`Importe a pagar de ${d.etiqueta}`} />
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <Table cols={[{ h: '' }, { h: 'Documento' }, { h: 'Fecha' }, { h: 'Saldo', num: true }, { h: 'Pagás', num: true }]} empty="">
              {(docs ?? []).map((d) => {
                const on = tildes[d.docId] != null;
                return (
                  <tr key={`${d.tipo}${d.docId}`}>
                    <td><input type="checkbox" checked={on} onChange={(e) => tildar(d, e.target.checked)} aria-label={`Pagar ${d.etiqueta}`} /></td>
                    <td>{d.etiqueta}{d.detalle && <div className={s.hint} style={{ margin: 0 }}>{d.detalle}</div>}</td>
                    <td>{fechaCorta(d.fecha)}</td>
                    <td className={s.num}>{money(d.saldo)}</td>
                    <td className={s.num}>
                      {on && <input type="number" min="0" max={d.saldo} step="0.01" value={tildes[d.docId]} onChange={(e) => setTildes((t) => ({ ...t, [d.docId]: e.target.value }))} style={{ width: 120, textAlign: 'right' }} />}
                    </td>
                  </tr>
                );
              })}
            </Table>
          )}
        </div>
      )}
      <div className={s['form-grid']}>
        <Campo label="Además, a cuenta (sin aplicar a un documento)" hint="Queda como saldo a favor en la cuenta del proveedor; se aplica después desde Proveedores.">
          <input type="number" min="0" step="0.01" inputMode="decimal" value={aCuenta} onChange={(e) => setACuenta(e.target.value)} placeholder="0" />
        </Campo>
        <div>
          <div className={s['mini-label']}>Total del pago</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{money(total)}</div>
          <div className={s.hint} style={{ margin: 0 }}>aplicado {money(aplicado)} · a cuenta {money(extra)}</div>
        </div>
      </div>
      <Disponible saldo={saldo} importe={total} fecha={fecha} />
      <AvisoSegundaConfirmacion {...sc}>
        Sale <strong>{money(total)}</strong> de tu caja para <strong>{prov?.nombre ?? '—'}</strong> ({MEDIO[medio]}), aplicado a {Object.keys(tildes).length} documento{Object.keys(tildes).length === 1 ? '' : 's'}{extra > 0 ? ` y ${money(extra)} a cuenta` : ''}.
      </AvisoSegundaConfirmacion>
      {error && <Aviso tono="warn">{error}</Aviso>}
    </ModalShell>
  );
}

/**
 * LO QUE SE HACE CON LA CAJA (8/10/2026): entró plata, sacar plata, pagar a un
 * proveedor y —en el Resumen— contarla. Antes, en la PC, los ingresos y
 * retiros estaban solo dentro de «Movimientos» y el dueño no los encontraba
 * (en el celular están en la pantalla de entrada). Una sola pieza para las dos
 * pestañas: mismos botones, mismas ventanas, mismas confirmaciones.
 */
function AccionesCaja({ saldo, enTransito, conceptos, conConteo, small, onHecho, avisar }) {
  const [abierta, setAbierta] = useState(null);
  const cerrar = () => setAbierta(null);
  const hecho = () => { setAbierta(null); onHecho(); };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
      <Btn variant="btn-ingreso" small={small} title="Un ingreso de efectivo aparte de los sobres" onClick={() => setAbierta('ingreso')}>+ Entró plata</Btn>
      <Btn variant="btn-delete" small={small} title="Un retiro, un depósito o un gasto" onClick={() => setAbierta('egreso')}>− Sacar plata</Btn>
      <Btn small={small} onClick={() => setAbierta('pago')}>Pagar a un proveedor</Btn>
      {conConteo && <Btn variant="btn-primary" small={small} onClick={() => setAbierta('conteo')}>Contar mi caja</Btn>}
      {(abierta === 'ingreso' || abierta === 'egreso') && (
        <MovimientoModal tipo={abierta} conceptos={conceptos} saldo={saldo} onCerrar={cerrar} onHecho={hecho} avisar={avisar} />
      )}
      {abierta === 'pago' && <PagoProveedorModal saldo={saldo} onCerrar={cerrar} onHecho={hecho} avisar={avisar} />}
      {abierta === 'conteo' && <ConteoModal saldo={saldo} enTransito={enTransito} onCerrar={cerrar} onHecho={hecho} avisar={avisar} />}
    </div>
  );
}

function Movimientos({ version, bump, avisar, conceptos, saldo }) {
  const [tipo, setTipo] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [anulados, setAnulados] = useState(false);
  const [modal, setModal] = useState(null);
  const qs = `${tipo ? `tipo=${tipo}&` : ''}${desde ? `desde=${desde}&` : ''}${hasta ? `hasta=${hasta}&` : ''}${anulados ? 'anulados=1&' : ''}`;
  const { data, loading, error } = useResource(`cashflow:mov:${qs}:${version}`, () => httpClient.get(`/cashflow/movimientos?${qs}`));
  const filas = data ?? [];
  const vivos = filas.filter((m) => !m.anuladoEn);
  const ingresos = vivos.filter((m) => m.tipo === 'ingreso').reduce((a, m) => a + m.importe, 0);
  const egresos = vivos.filter((m) => m.tipo === 'egreso').reduce((a, m) => a + m.importe, 0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className={s.toolbar}>
        <select className={s['select-inline']} value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo">
          <option value="">Ingresos y egresos</option><option value="ingreso">Solo ingresos</option><option value="egreso">Solo egresos</option>
        </select>
        <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} aria-label="Desde" />
        <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} aria-label="Hasta" />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}><input type="checkbox" checked={anulados} onChange={(e) => setAnulados(e.target.checked)} /> Ver anulados</label>
        <div style={{ marginLeft: 'auto' }}>
          <AccionesCaja saldo={saldo} conceptos={conceptos} small onHecho={bump} avisar={avisar} />
        </div>
      </div>
      <div className={s.hint} style={{ margin: 0 }}>
        {vivos.length} movimiento{vivos.length === 1 ? '' : 's'} · ingresos {money(ingresos)} · egresos {money(egresos)} · neto {money(ingresos - egresos)}
        {filas.length >= 500 && ' · se muestran los últimos 500: acotá las fechas para ver más.'}
      </div>
      {error && <Aviso tono="warn">{error}</Aviso>}
      {loading && !data ? <Cargando /> : <TablaMovimientos filas={filas} onAnular={(m) => setModal({ tipo: 'anular', m })} />}
      {modal?.tipo === 'anular' && (
        <AnularModal
          titulo={`Anular ${modal.m.tipo} de ${money(modal.m.importe)}`}
          texto={textoAnular(modal.m)}
          ruta={`/cashflow/movimientos/${modal.m.id}/anular`}
          exito="Movimiento anulado."
          onCerrar={() => setModal(null)} onHecho={() => { setModal(null); bump(); }} avisar={avisar}
        />
      )}
    </div>
  );
}

/* ==================================================================== *
 * Conceptos
 * ==================================================================== */
function Conceptos({ conceptos, bump, avisar }) {
  const { data: rubros } = useResource('cashflow:rubros', () => httpClient.get('/cashflow/gasto-categorias'));
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('egreso');
  const [clase, setClase] = useState('movimiento');
  const [rubro, setRubro] = useState('');
  const [editando, setEditando] = useState(null); // { id, nombre }
  const [error, setError] = useState('');
  const guardar = async (fn, ok) => {
    setError('');
    try { await fn(); avisar('ok', ok); bump(); } catch (e) { setError(errorMsg(e)); }
  };
  const crear = () => {
    if (!nombre.trim()) { setError('Escribí el nombre del concepto.'); return; }
    const esGasto = tipo === 'egreso' && clase === 'gasto';
    if (esGasto && !rubro) { setError('Elegí el rubro de Gastos al que va este concepto.'); return; }
    guardar(() => httpClient.post('/cashflow/conceptos', { nombre: nombre.trim(), tipo, clase: esGasto ? 'gasto' : 'movimiento', gastoCategoriaId: esGasto ? Number(rubro) : null }), `Concepto «${nombre.trim()}» creado.`).then(() => setNombre(''));
  };
  const grupos = [['egreso', 'Egresos (plata que sacás)'], ['ingreso', 'Ingresos (plata que entra, aparte de los sobres)']];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Bloque titulo="Nuevo concepto" sub="Un concepto es el motivo del movimiento. «Movimiento de plata» (retiro, depósito en el banco) no es un gasto del negocio; «Gasto» se carga también en Gastos, en su rubro, y entra en la rentabilidad.">
        <div className={s.toolbar}>
          <input value={nombre} maxLength={60} placeholder="Nombre del concepto" onChange={(e) => setNombre(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && crear()} />
          <select className={s['select-inline']} value={tipo} onChange={(e) => setTipo(e.target.value)}><option value="egreso">Egreso</option><option value="ingreso">Ingreso</option></select>
          {tipo === 'egreso' && (
            <select className={s['select-inline']} value={clase} onChange={(e) => setClase(e.target.value)} aria-label="Clase">
              <option value="movimiento">Movimiento de plata (no es gasto)</option>
              <option value="gasto">Gasto del negocio (se carga en Gastos)</option>
            </select>
          )}
          {tipo === 'egreso' && clase === 'gasto' && (
            <select className={s['select-inline']} value={rubro} onChange={(e) => setRubro(e.target.value)} aria-label="Rubro">
              <option value="">— Rubro de Gastos —</option>
              {(rubros ?? []).map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          )}
          <Btn variant="btn-primary" small onClick={crear}>Agregar</Btn>
        </div>
        {error && <Aviso tono="warn">{error}</Aviso>}
      </Bloque>
      {grupos.map(([t, titulo]) => (
        <Bloque key={t} titulo={titulo}>
          <Table cols={[{ h: 'Concepto' }, { h: 'Qué es' }, { h: 'Usos', num: true }, { h: 'Estado' }, { h: 'Acciones', cls: 'actions-col' }]} empty="Ninguno todavía.">
            {conceptos.filter((c) => c.tipo === t).map((c) => (
              <tr key={c.id} style={c.activo ? undefined : { opacity: 0.6 }}>
                <td>
                  {editando?.id === c.id ? (
                    <span style={{ display: 'inline-flex', gap: 6 }}>
                      <input value={editando.nombre} maxLength={60} onChange={(e) => setEditando({ ...editando, nombre: e.target.value })} autoFocus />
                      <Btn small variant="btn-primary" onClick={() => guardar(() => httpClient.patch(`/cashflow/conceptos/${c.id}`, { nombre: editando.nombre.trim() }), 'Concepto renombrado.').then(() => setEditando(null))}>Guardar</Btn>
                      <Btn small onClick={() => setEditando(null)}>Cancelar</Btn>
                    </span>
                  ) : c.nombre}
                </td>
                <td>
                  {c.clase === 'gasto' ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      Gasto ·
                      <select className={s['select-inline']} value={c.gastoCategoriaId ?? ''} onChange={(e) => guardar(() => httpClient.patch(`/cashflow/conceptos/${c.id}`, { gastoCategoriaId: e.target.value ? Number(e.target.value) : null }), 'Rubro cambiado.')} aria-label="Rubro">
                        <option value="">— sin rubro —</option>
                        {(rubros ?? []).map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                      </select>
                    </span>
                  ) : c.tipo === 'egreso' ? 'Movimiento de plata' : 'Ingreso'}
                </td>
                <td className={s.num}>{num(c.usos, 0)}</td>
                <td><Pill pill={c.activo ? 'st-disponible' : 'st-retenido'} label={c.activo ? 'Activo' : 'Desactivado'} /></td>
                <td className={s['actions-col']}>
                  <div className={s['row-actions']}>
                    <Btn small onClick={() => setEditando({ id: c.id, nombre: c.nombre })}>Renombrar</Btn>
                    <Btn small onClick={() => guardar(() => httpClient.patch(`/cashflow/conceptos/${c.id}`, { activo: !c.activo }), c.activo ? 'Concepto desactivado: no se ofrece más, lo registrado queda.' : 'Concepto activado.')}>
                      {c.activo ? 'Desactivar' : 'Activar'}
                    </Btn>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        </Bloque>
      ))}
    </div>
  );
}

/* ==================================================================== *
 * Contar mi caja
 * ==================================================================== */
/**
 * Auditoría 5/10: el conteo VE los sobres en tránsito. Un sobre sin controlar
 * contado junto con la caja aparecía como «sobrante» y, ajustado, la plata
 * entraba dos veces al controlarlo. Ahora: se avisa antes de contar, se
 * sospecha en voz alta si lo que sobra coincide con un sobre, y para ajustar
 * hay que confirmar que esos sobres NO están en lo contado. «Ajustar» arranca
 * destildado y un conteo vacío no se registra.
 */
export function ConteoModal({ saldo, enTransito, onCerrar, onHecho, avisar }) {
  const c = useBilletes();
  const [ajustar, setAjustar] = useState(false);
  const [aparte, setAparte] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const pend = enTransito?.sobres ?? 0;
  const { data: sobresPend } = useResource(`cashflow:sobres-conteo:${pend}:${enTransito?.total}`, () => httpClient.get('/cashflow/sobres?estado=pendientes'), { enabled: pend > 0 });
  const diferencia = Math.round((c.contado - saldo) * 100) / 100;
  const hayDif = c.contado > 0 && Math.abs(diferencia) > 0.009;
  const quiereAjustar = hayDif && ajustar;
  /* ¿Lo que sobra se explica por un sobre sin controlar? */
  const sospecha = useMemo(() => {
    if (!(diferencia > 0.009) || !pend) return '';
    const igual = (sobresPend ?? []).find((x) => Math.abs(x.enviado - diferencia) < 0.01);
    if (igual) return `Sobran ${money(diferencia)}: justo lo que dice el sobre de ${igual.sucursal} del ${fechaCorta(igual.cierre)}. ¿Lo contaste junto con tu caja?`;
    if (Math.abs(enTransito.total - diferencia) < 0.01) return `Sobran ${money(diferencia)}: justo lo que suman los ${pend} sobres sin controlar. ¿Los contaste junto con tu caja?`;
    if (diferencia <= enTransito.total + 0.009) return `Sobran ${money(diferencia)} y hay ${money(enTransito.total)} en sobres sin controlar: si alguno está en lo que contaste, no ajustes.`;
    return '';
  }, [diferencia, pend, sobresPend, enTransito]);
  const sc = useSegundaConfirmacion(`${c.clave}|${ajustar}|${aparte}|${motivo}`);
  const confirmar = () => sc.clic(
    () => {
      setError('');
      if (!c.enteros) { setError('Las cantidades de billetes van enteras.'); return false; }
      if (c.contado <= 0) { setError('Cargá lo que contaste: billetes y monedas.'); return false; }
      if (quiereAjustar && !motivo.trim()) { setError('Para ajustar el saldo escribí el motivo de la diferencia.'); return false; }
      if (quiereAjustar && pend > 0 && !aparte) { setError(`Confirmá que los ${pend} sobres sin controlar no están en lo que contaste, o controlalos primero.`); return false; }
      return true;
    },
    async () => {
      try {
        const r = await httpClient.post('/cashflow/conteos', { ...c.payload(), ajustar: quiereAjustar, sobresAparte: aparte, motivo: motivo.trim(), confirmado: true });
        avisar('ok', r.ajustado ? `Conteo registrado y saldo ajustado: efectivo en mano ${money(r.saldo)}.` : hayDif ? `Conteo registrado sin ajustar: hay una diferencia de ${money(Math.abs(r.diferencia))}.` : 'Conteo registrado: coincide con el libro.');
        onHecho();
      } catch (e) { setError(errorMsg(e)); }
    },
  );
  return (
    <ModalShell title="Contar mi caja" subtitle={`El libro dice que tenés ${money(saldo)} en mano. Contá y comparemos.`} onClose={onCerrar} footer={[
      { texto: 'Cancelar', onClick: onCerrar },
      { texto: textoBoton(sc, 'Registrar el conteo', 'Sí, confirmar'), clase: 'btn-primary', onClick: confirmar, disabled: c.contado <= 0 },
    ]}>
      {pend > 0 && (
        <Aviso tono="warn">
          Tenés <strong>{pend}</strong> sobre{pend === 1 ? '' : 's'} sin controlar por <strong>{money(enTransito.total)}</strong>: esa plata todavía no está en el libro.
          {' '}Contá tu caja <strong>sin esos sobres</strong> (dejalos aparte) o controlalos primero.
        </Aviso>
      )}
      <ContadorBilletes c={c} />
      {c.contado > 0 && (
        <div className={cx(s.callout, hayDif ? s.warn : s.info)} style={{ margin: 0 }}>
          Contaste <strong>{money(c.contado)}</strong> · el libro dice <strong>{money(saldo)}</strong> · <Diferencia v={diferencia} />
          {hayDif && <div className={s.hint} style={{ margin: '4px 0 0' }}>{diferencia < 0 ? 'Falta plata respecto del libro.' : 'Hay más plata que en el libro.'}</div>}
        </div>
      )}
      {sospecha && <Aviso tono="warn"><strong>Ojo:</strong> {sospecha}</Aviso>}
      {hayDif && (
        <>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, cursor: 'pointer' }}>
            <input type="checkbox" checked={ajustar} onChange={(e) => setAjustar(e.target.checked)} />
            Ajustar el saldo a lo contado ({money(c.contado)})
          </label>
          <div className={s.hint} style={{ margin: 0 }}>Con el ajuste, el libro pasa a decir lo que hay en la mano y queda un movimiento de «ajuste por conteo» con el motivo (se puede anular desde Movimientos). Sin ajuste, el conteo queda registrado y el saldo no cambia.</div>
          {ajustar && pend > 0 && (
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={aparte} onChange={(e) => setAparte(e.target.checked)} style={{ marginTop: 3 }} />
              <span>Confirmo que los <strong>{pend} sobre{pend === 1 ? '' : 's'} sin controlar</strong> ({money(enTransito.total)}) <strong>no</strong> están en lo que conté.</span>
            </label>
          )}
          {ajustar && <Campo label="Motivo de la diferencia *"><textarea rows={2} maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></Campo>}
        </>
      )}
      <AvisoSegundaConfirmacion {...sc}>
        Se registra el conteo de <strong>{money(c.contado)}</strong>{quiereAjustar ? <> y el saldo se ajusta: <Diferencia v={diferencia} /></> : hayDif ? ' sin ajustar el saldo' : ''}.
      </AvisoSegundaConfirmacion>
      {error && <Aviso tono="warn">{error}</Aviso>}
    </ModalShell>
  );
}

/* ==================================================================== *
 * Reportes
 * ==================================================================== */

function Reportes({ version }) {
  const [desde, setDesde] = useState(primerDiaMes());
  const [hasta, setHasta] = useState(hoy());
  const qs = `desde=${desde}&hasta=${hasta}`;
  const { data: d, loading, error } = useResource(`cashflow:reporte:${qs}:${version}`, () => httpClient.get(`/cashflow/reporte?${qs}`));
  /* Con los anulados: el CSV los lista marcados (es la auditoría); la impresión y los totales los dejan afuera. */
  const { data: movs } = useResource(`cashflow:reporte-mov:${qs}:${version}`, () => httpClient.get(`/cashflow/movimientos?${qs}&limite=2000&anulados=1`));
  const preset = (k) => {
    const h = new Date();
    if (k === 'mes') { setDesde(primerDiaMes()); setHasta(hoy()); }
    if (k === 'mes-pasado') { setDesde(iso(new Date(h.getFullYear(), h.getMonth() - 1, 1))); setHasta(iso(new Date(h.getFullYear(), h.getMonth(), 0))); }
    if (k === 'anio') { setDesde(iso(new Date(h.getFullYear(), 0, 1))); setHasta(hoy()); }
  };
  const exportar = () => descargarCsv(`cash-flow-${desde}-${hasta}.csv`,
    ['Fecha', 'Tipo', 'Qué', 'Detalle', 'Quién', 'Ingreso', 'Egreso', 'Anulado', 'Motivo anulación'],
    (movs ?? []).map((m) => [fechaHora(m.fecha), m.tipo, queEs(m), m.detalle || '', m.usuario || '', m.tipo === 'ingreso' ? csvNum(m.importe) : '', m.tipo === 'egreso' ? csvNum(m.importe) : '', m.anuladoEn ? 'Sí' : '', m.anuladoMotivo || '']));
  const imprimir = () => {
    if (!d) return;
    const fila = (cols) => `<tr>${cols.map((c, i) => `<td style="padding:3px 6px;border-bottom:1px solid #ddd;${i > 0 ? 'text-align:right;white-space:nowrap' : ''}">${c}</td>`).join('')}</tr>`;
    const tabla = (titulo, cab, filas) => `<h3 style="margin:14px 0 4px">${esc(titulo)}</h3><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr>${cab.map((c, i) => `<th style="text-align:${i > 0 ? 'right' : 'left'};padding:3px 6px;border-bottom:2px solid #333">${esc(c)}</th>`).join('')}</tr></thead><tbody>${filas.join('')}</tbody></table>`;
    const dif = (v) => (Math.abs(v) < 0.009 ? '—' : `${v > 0 ? '+' : '−'}${money(Math.abs(v))}`);
    const cuerpo = `
      <h2 style="margin:0 0 2px">Cash Flow · ${esc(fechaIso(d.desde))} al ${esc(fechaIso(d.hasta))}</h2>
      <table style="font-size:13px;margin:8px 0"><tbody>
        ${fila(['Efectivo al inicio del período', money(d.saldoInicio)])}${d.saldoInicial > 0 ? fila(['Saldo inicial (arranque)', money(d.saldoInicial)]) : ''}
        ${fila(['Ingresos', money(d.ingresos)])}${fila(['Egresos', money(d.egresos)])}${fila(['<strong>Efectivo al fin del período</strong>', `<strong>${money(d.saldoFin)}</strong>`])}
      </tbody></table>
      ${tabla('Por concepto', ['Concepto', 'Cantidad', 'Importe'], d.porConcepto.map((c) => fila([`${esc(c.tipo === 'ingreso' ? 'Ingreso' : 'Egreso')} · ${esc(c.origen === 'concepto' || c.origen === 'gasto' ? c.concepto : ORIGEN[c.origen] ?? c.origen)}`, c.cantidad, money(c.importe)])))}
      ${tabla('Sobres por sucursal (por fecha de cierre)', ['Sucursal', 'Sobres', 'Controlados', 'No corresponden', 'Enviado', 'Contado', 'Diferencia'], d.sobresPorSucursal.map((x) => fila([esc(x.sucursal), x.sobres, x.controlados, x.descartados || 0, money(x.enviado), money(x.contado), dif(x.diferencia)])))}
      ${tabla('Diferencias por cajero', ['Cajero', 'Sobres', 'Con diferencia', 'Faltantes', 'Sobrantes', 'Neto'], d.porCajero.map((x) => fila([esc(x.cajero), x.sobres, x.conDiferencia, dif(x.faltantes), dif(x.sobrantes), dif(x.diferencia)])))}
      ${tabla('Movimientos', ['Fecha', 'Qué', 'Ingreso', 'Egreso'], (movs ?? []).filter((m) => !m.anuladoEn).map((m) => fila([`${esc(fechaHora(m.fecha))} · ${esc(queEs(m))}${m.detalle ? ` · ${esc(m.detalle)}` : ''}`, m.tipo === 'ingreso' ? money(m.importe) : '', m.tipo === 'egreso' ? money(m.importe) : ''])))}`;
    imprimirDocumento('cashflow', { titulo: `Cash Flow ${d.desde} a ${d.hasta}`, cuerpo });
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className={s.toolbar}>
        <Btn small onClick={() => preset('mes')}>Este mes</Btn>
        <Btn small onClick={() => preset('mes-pasado')}>Mes pasado</Btn>
        <Btn small onClick={() => preset('anio')}>Este año</Btn>
        <input type="date" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} aria-label="Desde" />
        <input type="date" value={hasta} min={desde} max={hoy()} onChange={(e) => setHasta(e.target.value)} aria-label="Hasta" />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Btn small onClick={exportar} disabled={!(movs ?? []).length}>Exportar CSV</Btn>
          <Btn small onClick={imprimir} disabled={!d}>Imprimir</Btn>
        </div>
      </div>
      {error && <Aviso tono="warn">{error}</Aviso>}
      {loading && !d ? <Cargando /> : !d ? null : (
        <>
          <Tiles>
            <Tile label="Efectivo al inicio" valor={money(d.saldoInicio)} detalle={`al ${fechaIso(d.desde)}, antes del primer movimiento`} />
            <Tile label="Ingresos" valor={money(d.ingresos)} marca="var(--crm-color-primary)" detalle={d.saldoInicial > 0 ? `+ ${money(d.saldoInicial)} del arranque` : 'sobres y otros ingresos'} />
            <Tile label="Egresos" valor={money(d.egresos)} marca="#dc2626" detalle={`${d.movimientos} movimiento${d.movimientos === 1 ? '' : 's'} en el período`} />
            <Tile label="Efectivo al fin" valor={money(d.saldoFin)} alerta={d.saldoFin < -0.009} detalle={`al ${fechaIso(d.hasta)}`} />
          </Tiles>
          {d.serie.length > 1 && (
            <ColumnasMulti
              titulo={`Ingresos y egresos por ${d.paso}`}
              series={[{ nombre: 'Ingresos', color: 'var(--crm-color-primary)' }, { nombre: 'Egresos', color: '#dc2626' }]}
              datos={d.serie.map((x) => ({ etiqueta: etiquetaPeriodo(x.periodo, d.paso), titulo: tituloPeriodo(x.periodo, d.paso), valores: [x.ingresos, x.egresos] }))}
              formato={money}
            />
          )}
          <Grilla>
            <Bloque titulo="Por concepto" sub="Qué entró y qué salió, agrupado.">
              <Table cols={[{ h: 'Concepto' }, { h: 'Cant.', num: true }, { h: 'Importe', num: true }]} empty="Sin movimientos en el período.">
                {d.porConcepto.map((c, i) => (
                  <tr key={i}>
                    <td><Pill pill={c.tipo === 'ingreso' ? 'st-disponible' : 'st-comprometido'} label={c.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} /> {c.origen === 'concepto' || c.origen === 'gasto' ? c.concepto : ORIGEN[c.origen] ?? c.origen}</td>
                    <td className={s.num}>{c.cantidad}</td>
                    <td className={s.num}><strong>{money(c.importe)}</strong></td>
                  </tr>
                ))}
              </Table>
            </Bloque>
            <Bloque titulo="Sobres por sucursal" sub="Por fecha de CIERRE del local. En «Ingresos» el sobre cuenta el día que lo controlaste: un sobre del 31 controlado el 1 cae en meses distintos.">
              <Table cols={[{ h: 'Sucursal' }, { h: 'Sobres', num: true }, { h: 'Enviado', num: true }, { h: 'Contado', num: true }, { h: 'Diferencia', num: true }]} empty="Sin sobres en el período.">
                {d.sobresPorSucursal.map((x) => (
                  <tr key={x.sucursalId}>
                    <td>
                      {x.sucursal}
                      {x.controlados < x.sobres && <div className={s.hint} style={{ margin: 0 }}>{x.sobres - x.controlados} sin controlar</div>}
                      {x.descartados > 0 && <div className={s.hint} style={{ margin: 0 }}>{x.descartados} no corresponde{x.descartados === 1 ? '' : 'n'} ({money(x.descartadoImporte)}, fuera de las sumas)</div>}
                    </td>
                    <td className={s.num}>{x.sobres}</td>
                    <td className={s.num}>{money(x.enviado)}</td>
                    <td className={s.num}>{money(x.contado)}</td>
                    <td className={s.num}><Diferencia v={x.diferencia} /></td>
                  </tr>
                ))}
              </Table>
            </Bloque>
          </Grilla>
          <Bloque titulo="Diferencias por cajero" sub="De los sobres controlados en el período: a quién le falta o le sobra plata al armar el sobre.">
            <Table cols={[{ h: 'Cajero' }, { h: 'Sobres', num: true }, { h: 'Con diferencia', num: true }, { h: 'Faltantes', num: true }, { h: 'Sobrantes', num: true }, { h: 'Neto', num: true }]} empty="Sin sobres controlados en el período.">
              {d.porCajero.map((x) => (
                <tr key={x.usuarioId ?? x.cajero}>
                  <td>{x.cajero}</td>
                  <td className={s.num}>{x.sobres}</td>
                  <td className={s.num}>{x.conDiferencia}</td>
                  <td className={s.num}><Diferencia v={x.faltantes} /></td>
                  <td className={s.num}><Diferencia v={x.sobrantes} /></td>
                  <td className={s.num}><Diferencia v={x.diferencia} /></td>
                </tr>
              ))}
            </Table>
          </Bloque>
        </>
      )}
    </div>
  );
}

/* ==================================================================== *
 * El panel
 * ==================================================================== */
const PESTANAS = [['resumen', 'Resumen'], ['sobres', 'Sobres de caja'], ['controlar', 'Cajas a controlar'], ['movimientos', 'Movimientos'], ['conceptos', 'Conceptos'], ['reportes', 'Reportes']];
/** El número entre paréntesis de las pestañas que piden algo. */
const PENDIENTES = { sobres: (d) => d.enTransito.sobres, controlar: (d) => d.aControlar };

export function CashFlowPanel() {
  const [version, setVersion] = useState(0);
  const bump = () => setVersion((v) => v + 1);
  const [pestana, setPestana] = useState('resumen');
  const [msg, setMsg] = useState(null);
  const avisar = (tono, texto) => setMsg({ tono, texto });
  useEffect(() => {
    if (!msg) return undefined;
    const t = setTimeout(() => setMsg(null), 12000);
    return () => clearTimeout(t);
  }, [msg]);
  const { data: d, loading, error } = useResource(`cashflow:resumen:${version}`, () => httpClient.get('/cashflow/resumen'));
  const { data: conceptos } = useResource(`cashflow:conceptos:${version}`, () => httpClient.get('/cashflow/conceptos'));
  const abiertas = useMemo(() => d?.cajasAbiertas ?? [], [d]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead title="Cash Flow" desc="Tu caja central de efectivo: lo que llega en los sobres de los locales y lo que sacás. La suma de todo es lo que tenés en mano." />
      {msg && <Aviso tono={msg.tono === 'ok' ? 'info' : 'warn'}>{msg.texto}</Aviso>}
      {abiertas.length > 0 && (
        <Aviso tono="warn">
          <strong>Caja abierta hace más de 24 horas:</strong>{' '}
          {abiertas.map((c) => `${c.sucursal} (${c.usuario || 'sin usuario'}, desde el ${fechaHora(c.apertura)}, ${c.horas} h)`).join(' · ')}.
          {' '}Hasta que cierren, el sobre no llega. (Este aviso también se ve arriba, en cualquier pantalla.)
        </Aviso>
      )}
      {error && <Aviso tono="warn">{error}</Aviso>}
      {loading && !d ? <Cargando /> : !d ? null : !d.caja ? (
        <Arranque avisar={avisar} onHecho={bump} />
      ) : (
        <>
          <Tabs value={pestana} onChange={(e, v) => setPestana(v)} variant="scrollable" scrollButtons="auto" sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 40 }}>
            {PESTANAS.map(([id, label]) => {
              const n = PENDIENTES[id]?.(d);
              return <Tab key={id} value={id} label={n ? `${label} (${n})` : label} sx={{ minHeight: 40, textTransform: 'none', fontWeight: 600 }} />;
            })}
          </Tabs>
          {pestana === 'resumen' && <Resumen d={d} conceptos={conceptos ?? []} irA={setPestana} avisar={avisar} onHecho={bump} />}
          {pestana === 'sobres' && <Sobres version={version} bump={bump} avisar={avisar} />}
          {pestana === 'controlar' && <CajasAControlar version={version} bump={bump} avisar={avisar} />}
          {pestana === 'movimientos' && <Movimientos version={version} bump={bump} avisar={avisar} conceptos={conceptos ?? []} saldo={d.saldo} />}
          {pestana === 'conceptos' && <Conceptos conceptos={conceptos ?? []} bump={bump} avisar={avisar} />}
          {pestana === 'reportes' && <Reportes version={version} />}
        </>
      )}
    </div>
  );
}
