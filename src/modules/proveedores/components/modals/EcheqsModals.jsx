import { useState } from 'react';
import { useProveedores } from '../../context/ProveedoresContext.jsx';
import { provApi } from '../../services/proveedores.api.js';
import { ModalShell, s } from '../ui.jsx';

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Alta manual / edición de un echeq propio. El que nace de una factura llega
 * con número "PEND-…" y banco "A definir": este modal es donde se completan
 * los datos reales cuando el echeq se emite. El importe del que tiene
 * compromiso NO se toca acá — es el de su factura.
 *
 * A UN NO PROVEEDOR (0201, 26/10/2026, pedido del dueño): el echeq puede ir a
 * cualquiera, con el nombre escrito a mano. Al debitarse solo queda cobrado:
 * no hay cuenta corriente donde imputarlo.
 */
export function EcheqModal({ echeq, onChange }) {
  const { proveedores, act, closeModal, toast } = useProveedores();
  const editando = !!echeq;
  const conCompromiso = !!echeq?.compromisoId;
  const [aProveedor, setAProveedor] = useState(!echeq || !!echeq.proveedorId);
  const [f, setF] = useState({
    proveedorId: echeq?.proveedorId ?? '',
    destinatario: echeq && !echeq.proveedorId ? echeq.aNombreDe : '',
    numero: echeq?.numero?.startsWith('PEND-') ? '' : (echeq?.numero ?? ''),
    banco: echeq?.banco === 'A definir' ? '' : (echeq?.banco ?? ''),
    importe: echeq ? String(echeq.importe) : '',
    fechaEmision: echeq?.fechaEmision ? String(echeq.fechaEmision).slice(0, 10) : '',
    fechaVenc: echeq?.fechaVenc ? String(echeq.fechaVenc).slice(0, 10) : '',
    obs: echeq?.obs ?? '',
  });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const guardar = async () => {
    if (!editando && aProveedor && !f.proveedorId) { toast('Elegí el proveedor.', 'err'); return; }
    if (!aProveedor && !f.destinatario.trim()) { toast('Escribí a nombre de quién va el echeq.', 'err'); return; }
    if (!editando && !(Number(f.importe) > 0)) { toast('El importe tiene que ser mayor a 0.', 'err'); return; }
    if (!editando && !f.fechaVenc) { toast('El echeq necesita su fecha de cobro.', 'err'); return; }
    const body = {
      numero: f.numero.trim(), banco: f.banco.trim(),
      fechaEmision: f.fechaEmision || undefined, fechaVenc: f.fechaVenc || undefined,
      obs: f.obs.trim(),
    };
    if (!conCompromiso && f.importe !== '') body.importe = r2(f.importe);
    if (!aProveedor) body.destinatario = f.destinatario.trim();
    else if (!editando) body.proveedorId = Number(f.proveedorId);
    const res = await act(
      editando ? provApi.editarEcheq(echeq.id, body) : provApi.crearEcheq(body),
      editando ? 'Echeq actualizado.' : 'Echeq registrado.',
    );
    if (res) onChange?.();
  };

  return (
    <ModalShell
      title={editando ? `Echeq ${echeq.numero}` : 'Nuevo echeq'}
      subtitle={conCompromiso
        ? 'Nació de una factura: completá el número y banco reales del papel emitido'
        : aProveedor
          ? 'Echeq propio suelto — al cobrarse genera un pago a cuenta del proveedor'
          : 'Echeq a quien no es proveedor — al cobrarse solo queda como cobrado'}
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Guardar', clase: 'btn-primary', onClick: guardar },
      ]}
    >
      {!editando && (
        <div className={s.field}>
          <label>¿A quién va?</label>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {[[true, 'A un proveedor'], [false, 'A otra persona o empresa']].map(([v, l]) => (
              <label key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                <input type="radio" name="echeq-a-quien" checked={aProveedor === v} onChange={() => setAProveedor(v)} /> {l}
              </label>
            ))}
          </div>
        </div>
      )}
      {!editando && aProveedor && (
        <div className={s.field}>
          <label>Proveedor</label>
          <select value={f.proveedorId} onChange={set('proveedorId')} autoFocus>
            <option value="">Elegí el proveedor</option>
            {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
      )}
      {!aProveedor && (
        <div className={s.field}>
          <label>A nombre de</label>
          <input value={f.destinatario} onChange={set('destinatario')} maxLength={120} placeholder="Ej.: Juan Pérez (alquiler)" autoFocus />
        </div>
      )}
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Número</label>
          <input value={f.numero} onChange={set('numero')} placeholder="Del papel emitido" />
        </div>
        <div className={s.field}>
          <label>Banco</label>
          <input value={f.banco} onChange={set('banco')} placeholder="Galicia, Nación…" />
        </div>
        <div className={s.field}>
          <label>Importe</label>
          <input
            type="number" min="0" step="0.01" value={f.importe} onChange={set('importe')}
            disabled={conCompromiso}
          />
          {conCompromiso && (
            <div className={s.hint} style={{ margin: '6px 0 0' }}>
              Es el de su compromiso: se corrige desde la factura, no desde el papel.
            </div>
          )}
        </div>
      </div>
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Emisión</label>
          <input type="date" value={f.fechaEmision} onChange={set('fechaEmision')} />
        </div>
        <div className={s.field}>
          <label>Fecha de cobro</label>
          <input type="date" value={f.fechaVenc} onChange={set('fechaVenc')} />
        </div>
      </div>
      <div className={s.field}>
        <label>Observaciones</label>
        <input value={f.obs} onChange={set('obs')} placeholder="Opcional" />
      </div>
    </ModalShell>
  );
}
