/**
 * LA CUENTA CORRIENTE CON COFFIT — lo que se carga a mano (0120, 29/9/2026)
 * ============================================================================
 * Tres ventanas, las tres mueven la cuenta entre los dos negocios y por eso
 * llevan la segunda confirmación y el candado del doble clic (`useRef`):
 *
 *  · MOVIMIENTO — un pago, una compensación, un ajuste o el saldo inicial.
 *  · CIERRE DEL MES — congela el saldo hasta un día. Muestra antes el saldo
 *    que va a quedar, y la API no cierra si cambió desde que se vio.
 *  · ANULAR / REABRIR — con motivo escrito.
 */
import { useEffect, useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import {
  AvisoSegundaConfirmacion, textoBoton, useSegundaConfirmacion,
} from '@modules/gastos/components/segundaConfirmacion.jsx';
import { useProductos } from '../../context/ProductosContext.jsx';
import { money, num, fmtFechaVenc } from '../../domain/format.js';
import { ModalShell } from '../Modal.jsx';
import { TIPOS_MOV_COFFIT, textoSaldo } from '../../domain/cuentaCoffit.js';
import { s } from '../ui.jsx';

const hoyIso = () => new Date().toLocaleDateString('sv-SE');

/* ==================================================================== *
 * Un movimiento a mano
 * ==================================================================== */
export function MovimientoCoffitModal({ tipoInicial = 'pago', onHecho }) {
  const { store, toast, closeModal } = useProductos();
  const [tipo, setTipo] = useState(tipoInicial);
  const [aFavor, setAFavor] = useState('coffit');
  const [importe, setImporte] = useState('');
  const [fecha, setFecha] = useState(hoyIso());
  const [medio, setMedio] = useState(tipoInicial === 'pago' ? 'transferencia' : '');
  const [referencia, setReferencia] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [guardando, setGuardando] = useState(false);
  const imp = Number(String(importe).replace(',', '.'));
  const firma = `${tipo}|${aFavor}|${imp}|${fecha}|${descripcion.trim()}`;
  const conf = useSegundaConfirmacion(firma);
  const lado = TIPOS_MOV_COFFIT[tipo].lados[aFavor];

  const validar = () => {
    if (!(imp > 0)) { toast('Poné el importe.', 'err'); return false; }
    if (!descripcion.trim()) { toast('Escribí de qué es el movimiento.', 'err'); return false; }
    if (fecha > hoyIso()) { toast('La fecha no puede ser futura.', 'err'); return false; }
    return true;
  };
  const guardar = () => conf.clic(validar, async () => {
    setGuardando(true);
    const res = await store.movimientoCoffit({
      tipo, aFavor, importe: Math.round(imp * 100) / 100, fecha, descripcion: descripcion.trim(),
      medio: medio.trim() || undefined, referencia: referencia.trim() || undefined,
    });
    setGuardando(false);
    if (!res.ok) { toast(res.error || 'No se pudo registrar.', 'err'); return; }
    toast(`${TIPOS_MOV_COFFIT[tipo].label} registrado: ${money(imp)}.`, 'ok');
    onHecho?.();
    closeModal();
  });

  return (
    <ModalShell
      title="Movimiento en la cuenta con Coffit"
      subtitle="Pago, compensación, ajuste o saldo inicial"
      size="sm"
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: guardando ? 'Guardando…' : textoBoton(conf, 'Registrar…', 'Sí, registrar'), clase: 'btn-primary', onClick: guardando ? () => {} : guardar },
      ]}
    >
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label htmlFor="mov-tipo">Tipo</label>
          <select id="mov-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {Object.entries(TIPOS_MOV_COFFIT).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div className={s.field}>
          <label htmlFor="mov-fecha">Fecha</label>
          <input id="mov-fecha" type="date" value={fecha} max={hoyIso()} onChange={(e) => setFecha(e.target.value)} />
        </div>
      </div>
      <div className={s.field}>
        <label htmlFor="mov-lado">Qué pasó</label>
        <select id="mov-lado" value={aFavor} onChange={(e) => setAFavor(e.target.value)}>
          <option value="coffit">{TIPOS_MOV_COFFIT[tipo].lados.coffit}</option>
          <option value="sya">{TIPOS_MOV_COFFIT[tipo].lados.sya}</option>
        </select>
      </div>
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label htmlFor="mov-importe">Importe</label>
          <input id="mov-importe" type="number" min="0" step="0.01" value={importe} onChange={(e) => setImporte(e.target.value)} />
        </div>
        {(tipo === 'pago' || tipo === 'compensacion') && (
          <div className={s.field}>
            <label htmlFor="mov-medio">Medio</label>
            <select id="mov-medio" value={medio} onChange={(e) => setMedio(e.target.value)}>
              <option value="">—</option>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="cheque">Cheque</option>
              <option value="compensacion">Compensación de cuentas</option>
              <option value="otro">Otro</option>
            </select>
          </div>
        )}
      </div>
      {(tipo === 'pago' || tipo === 'compensacion') && (
        <div className={s.field}>
          <label htmlFor="mov-ref">Referencia (opcional)</label>
          <input id="mov-ref" value={referencia} maxLength={80} placeholder="N° de transferencia, recibo…" onChange={(e) => setReferencia(e.target.value)} />
        </div>
      )}
      <div className={s.field}>
        <label htmlFor="mov-desc">Descripción</label>
        <input id="mov-desc" value={descripcion} maxLength={300} placeholder="Ej.: pago del saldo de agosto" onChange={(e) => setDescripcion(e.target.value)} />
      </div>
      <AvisoSegundaConfirmacion confirmando={conf.confirmando} gemelo={null}>
        {TIPOS_MOV_COFFIT[tipo].label} de <strong>{money(imp || 0)}</strong> el {fmtFechaVenc(fecha)}: {lado.toLowerCase()}.
      </AvisoSegundaConfirmacion>
    </ModalShell>
  );
}

/* ==================================================================== *
 * El cierre del mes
 * ==================================================================== */
const ultimoDiaMesAnterior = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 0).toLocaleDateString('sv-SE');
};
const diaSiguiente = (iso) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toLocaleDateString('sv-SE');
};

export function CierreCoffitModal({ ultimoCierre, onHecho }) {
  const { store, toast, closeModal } = useProductos();
  const sugerido = useMemo(() => {
    const u = ultimoDiaMesAnterior();
    return ultimoCierre && ultimoCierre.hasta >= u ? '' : u;
  }, [ultimoCierre]);
  const [hasta, setHasta] = useState(sugerido);
  const [obs, setObs] = useState('');
  const [prev, setPrev] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const desde = hasta ? (ultimoCierre ? diaSiguiente(ultimoCierre.hasta) : `${hasta.slice(0, 8)}01`) : '';
  const valido = !!hasta && hasta < hoyIso() && (!ultimoCierre || hasta > ultimoCierre.hasta);

  useEffect(() => {
    if (!valido) { setPrev(null); return undefined; }
    let vivo = true;
    setCargando(true);
    store.cuentaCoffit({ desde, hasta })
      .then((d) => { if (vivo) setPrev(d); })
      .catch(() => { if (vivo) { setPrev(null); toast('No se pudo calcular el cierre.', 'err'); } })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [store, desde, hasta, valido, toast]);

  const conf = useSegundaConfirmacion(`${hasta}|${prev?.saldoFinal ?? ''}`);
  const cerrar = () => conf.clic(() => !!prev, async () => {
    setGuardando(true);
    const res = await store.cerrarCuentaCoffit({ hasta, saldoEsperado: prev.saldoFinal, observaciones: obs.trim() || undefined });
    setGuardando(false);
    if (!res.ok) { toast(res.error || 'No se pudo cerrar.', 'err'); return; }
    toast(`Cuenta cerrada al ${fmtFechaVenc(hasta)}: ${textoSaldo(res.saldoFinal)}.`, 'ok');
    onHecho?.();
    closeModal();
  });

  const t = prev?.totales;
  return (
    <ModalShell
      title="Cerrar la cuenta con Coffit"
      subtitle={ultimoCierre ? `Último cierre: ${fmtFechaVenc(ultimoCierre.hasta)}` : 'Primer cierre'}
      size="sm"
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: guardando ? 'Cerrando…' : textoBoton(conf, 'Cerrar…', 'Sí, cerrar'), clase: 'btn-primary', onClick: guardando || !prev ? () => {} : cerrar },
      ]}
    >
      <div className={s.hint} style={{ marginTop: 0 }}>
        El cierre <strong>congela el saldo</strong> hasta ese día y pasa al período siguiente. Después, nada con
        fecha de ese período cambia la cuenta: una factura que llegue tarde entra el día que se carga, y
        una anulación deja un ajuste en el mes abierto.
      </div>
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label htmlFor="cierre-hasta">Cerrar hasta el</label>
          <input id="cierre-hasta" type="date" value={hasta} max={hoyIso()} onChange={(e) => setHasta(e.target.value)} />
        </div>
        <div className={s.field}>
          <label>Desde</label>
          <input value={desde ? fmtFechaVenc(desde) : '—'} readOnly tabIndex={-1} />
        </div>
      </div>
      {hasta && !valido && (
        <div className={cx(s.callout, s.warn)}>
          {hasta >= hoyIso()
            ? 'Solo se cierra hasta ayer: hoy todavía puede tener movimientos.'
            : `Tiene que ser posterior al último cierre (${fmtFechaVenc(ultimoCierre?.hasta)}).`}
        </div>
      )}
      {cargando && <div className={s.hint}>Calculando…</div>}
      {prev && !cargando && (
        <div className={cx(s.callout, s.info)}>
          {[
            ['Saldo anterior', prev.saldoAnterior],
            ['Compras para Coffit', t.compras],
            ['Envíos desde el stock', t.envios],
            ['Lo que mandó Coffit', t.entradas],
            ['Gastos de Coffit (neto)', t.gastos],
            ['Pagos y ajustes', t.manuales],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{k}</span><span className={s.mono}>{money(v)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--crm-color-border)', marginTop: 6, paddingTop: 6 }}>
            <strong>Saldo al {fmtFechaVenc(hasta)}</strong><strong className={s.mono}>{money(prev.saldoFinal)}</strong>
          </div>
          <div className={s.hint} style={{ margin: '4px 0 0' }}>
            {textoSaldo(prev.saldoFinal)} · {num(prev.lineas.length, 0)} movimiento(s) en el período.
          </div>
        </div>
      )}
      <div className={s.field}>
        <label htmlFor="cierre-obs">Observaciones (opcional)</label>
        <input id="cierre-obs" value={obs} maxLength={500} onChange={(e) => setObs(e.target.value)} />
      </div>
      <AvisoSegundaConfirmacion confirmando={conf.confirmando} gemelo={null}>
        Se cierra la cuenta al <strong>{fmtFechaVenc(hasta)}</strong> con <strong>{textoSaldo(prev?.saldoFinal ?? 0)}</strong>.
      </AvisoSegundaConfirmacion>
    </ModalShell>
  );
}

/* ==================================================================== *
 * Anular un movimiento o reabrir el último cierre (con motivo)
 * ==================================================================== */
export function MotivoCoffitModal({ titulo, detalle, accion, onConfirmar, onHecho }) {
  const { toast, closeModal } = useProductos();
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const conf = useSegundaConfirmacion(motivo.trim());
  const ok = () => conf.clic(() => {
    if (!motivo.trim()) { toast('Escribí el motivo.', 'err'); return false; }
    return true;
  }, async () => {
    setGuardando(true);
    const res = await onConfirmar(motivo.trim());
    setGuardando(false);
    if (!res.ok) { toast(res.error || 'No se pudo.', 'err'); return; }
    toast(`${accion}: listo.`, 'ok');
    onHecho?.();
    closeModal();
  });
  return (
    <ModalShell
      title={titulo}
      size="sm"
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: guardando ? 'Guardando…' : textoBoton(conf, `${accion}…`, `Sí, ${accion.toLowerCase()}`), clase: 'btn-delete', onClick: guardando ? () => {} : ok },
      ]}
    >
      <div className={s.hint} style={{ marginTop: 0 }}>{detalle}</div>
      <div className={s.field}>
        <label htmlFor="motivo-coffit">Motivo</label>
        <input id="motivo-coffit" value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} />
      </div>
      <AvisoSegundaConfirmacion confirmando={conf.confirmando} gemelo={null}>{detalle}</AvisoSegundaConfirmacion>
    </ModalShell>
  );
}
