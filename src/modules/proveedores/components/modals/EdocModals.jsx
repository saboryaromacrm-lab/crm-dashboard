import { useState } from 'react';
import { useProveedores } from '../../context/ProveedoresContext.jsx';
import { provApi } from '../../services/proveedores.api.js';
import { ModalShell, s } from '../ui.jsx';

/*
 * El ESTADO DE CUENTA ya no vive acá: era un modal y pasó a ser pantalla
 * completa (panels/EdocProveedorPage.jsx). Lo que queda de este
 * archivo es el ajuste manual, que sí es un formulario corto.
 */

/** Ajuste manual DEBE/HABER, con motivo obligatorio: sin explicación no se audita. */
export function AjusteModal({ proveedorId, onDone }) {
  const { act, closeModal, toast } = useProveedores();
  const [f, setF] = useState({ tipo: 'debe', monto: '', motivo: '', fecha: '' });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const guardar = async () => {
    if (!(Number(f.monto) > 0)) { toast('El monto tiene que ser mayor a 0.', 'err'); return; }
    if (!f.motivo.trim()) { toast('El motivo es obligatorio.', 'err'); return; }
    const res = await act(provApi.crearAjuste({
      proveedorId,
      tipo: f.tipo,
      monto: Math.round(Number(f.monto) * 100) / 100,
      motivo: f.motivo.trim(),
      fecha: f.fecha || undefined,
    }), 'Ajuste registrado.');
    if (res) onDone?.();
  };

  return (
    <ModalShell
      title="Ajuste manual"
      subtitle="DEBE suma deuda · HABER la resta — y el motivo queda escrito"
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Registrar', clase: 'btn-primary', onClick: guardar },
      ]}
    >
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
