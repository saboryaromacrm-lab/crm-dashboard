import { useState } from 'react';
import { useProveedores } from '../../context/ProveedoresContext.jsx';
import { provApi } from '../../services/proveedores.api.js';
import { ModalShell, money, s } from '../ui.jsx';
import { AvisoSegundaConfirmacion, textoBoton, useSegundaConfirmacion } from '@modules/gastos/components/segundaConfirmacion.jsx';

const hoyISO = () => {
  const d = new Date(); const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/*
 * El ESTADO DE CUENTA ya no vive acá: era un modal y pasó a ser pantalla
 * completa (panels/EdocProveedorPage.jsx). Lo que queda de este
 * archivo es el ajuste manual, que sí es un formulario corto.
 */

/**
 * Ajuste manual DEBE/HABER, con motivo obligatorio: sin explicación no se audita.
 * Mueve deuda SIN mover plata, así que se confirma dos veces (27/9/2026).
 */
export function AjusteModal({ proveedorId, onDone }) {
  const { act, closeModal, toast } = useProveedores();
  const [f, setF] = useState({ tipo: 'debe', monto: '', motivo: '', fecha: '' });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const conf = useSegundaConfirmacion(JSON.stringify(f));
  const monto = Math.round(Number(f.monto) * 100) / 100;

  const guardar = () => conf.clic(() => {
    if (!(Number(f.monto) > 0)) { toast('El monto tiene que ser mayor a 0.', 'err'); return false; }
    if (!f.motivo.trim()) { toast('El motivo es obligatorio.', 'err'); return false; }
    if (f.fecha && f.fecha > hoyISO()) { toast('El ajuste no puede tener fecha futura.', 'err'); return false; }
    return true;
  }, async () => {
    const res = await act(provApi.crearAjuste({
      proveedorId,
      tipo: f.tipo,
      monto: Math.round(Number(f.monto) * 100) / 100,
      motivo: f.motivo.trim(),
      fecha: f.fecha || undefined,
    }), 'Ajuste registrado.');
    if (res) onDone?.();
  });

  return (
    <ModalShell
      title="Ajuste manual"
      subtitle="DEBE suma deuda · HABER la resta — y el motivo queda escrito"
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: textoBoton(conf, 'Registrar…', 'Sí, registrar el ajuste'), clase: 'btn-primary', onClick: guardar },
      ]}
    >
      <AvisoSegundaConfirmacion confirmando={conf.confirmando} gemelo={null}>
        {f.tipo === 'haber'
          ? <>La deuda con este proveedor <strong>baja {money(monto)}</strong> sin que salga plata.</>
          : <>La deuda con este proveedor <strong>sube {money(monto)}</strong>.</>}
        {' '}Queda en Auditoría con tu nombre y el motivo.
      </AvisoSegundaConfirmacion>
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Tipo</label>
          <select value={f.tipo} onChange={set('tipo')}>
            <option value="debe">DEBE (suma deuda)</option>
            <option value="haber">HABER (resta deuda)</option>
          </select>
        </div>
        <div className={s.field}>
          <label>Monto</label>
          <input type="number" min="0" step="0.01" value={f.monto} onChange={set('monto')} autoFocus />
        </div>
        <div className={s.field}>
          <label>Fecha</label>
          <input type="date" value={f.fecha} onChange={set('fecha')} />
        </div>
      </div>
      <div className={s.field}>
        <label>Motivo <span className={s.req}>*</span></label>
        <input value={f.motivo} onChange={set('motivo')} placeholder="Diferencia de flete del reparto del 12/8…" />
      </div>
    </ModalShell>
  );
}

/**
 * BORRAR UN AJUSTE (27/9/2026): antes era una "×" sin pregunta ni rastro.
 * Ahora pide el porqué y una segunda confirmación, y queda en Auditoría con lo
 * que decía el ajuste.
 */
export function BorrarAjusteModal({ ajuste, onDone }) {
  const { act, closeModal, toast } = useProveedores();
  const [motivo, setMotivo] = useState('');
  const conf = useSegundaConfirmacion(motivo);
  const esDebe = ajuste.debe > 0;
  const monto = esDebe ? ajuste.debe : ajuste.haber;

  const borrar = () => conf.clic(() => {
    if (!motivo.trim()) { toast('Escribí por qué se borra el ajuste.', 'err'); return false; }
    return true;
  }, async () => {
    const res = await act(provApi.borrarAjuste(ajuste.id, motivo.trim()), 'Ajuste borrado. Quedó en Auditoría.');
    if (res) onDone?.();
  });

  return (
    <ModalShell
      title="Borrar ajuste"
      subtitle={`${esDebe ? 'DEBE' : 'HABER'} ${money(monto)} · ${ajuste.detalle || ''}`}
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: textoBoton(conf, 'Borrar…', 'Sí, borrar el ajuste'), clase: 'btn-delete', onClick: borrar },
      ]}
    >
      <AvisoSegundaConfirmacion confirmando={conf.confirmando} gemelo={null}>
        La deuda con este proveedor <strong>{esDebe ? 'baja' : 'sube'} {money(monto)}</strong>.
      </AvisoSegundaConfirmacion>
      <div className={s.field}>
        <label>Por qué se borra <span className={s.req}>*</span></label>
        <input value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus placeholder="Se cargó dos veces, el proveedor lo corrigió en su resumen…" />
      </div>
    </ModalShell>
  );
}
