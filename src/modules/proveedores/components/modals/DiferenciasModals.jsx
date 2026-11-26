import { useRef, useState } from 'react';
import { useProveedores } from '../../context/ProveedoresContext.jsx';
import { errorMsg, provApi } from '../../services/proveedores.api.js';
import { accionDe, cantTxt, queTxt } from '../../domain/diferencias.js';
import { ModalShell, money, s } from '../ui.jsx';

/**
 * RESOLVER UNA DIFERENCIA DE ENTREGA A MANO (0248): llegó lo que faltaba, se
 * da por perdido, se devolvió lo que vino de más o quedó sin cargo. Todo o una
 * parte; lo que quede sigue pendiente. Dos clics: el segundo confirma.
 */
export function ResolverDiferenciaModal({ diferencia: d, como, onChange }) {
  const { closeModal, toast } = useProveedores();
  const accion = accionDe(d.tipo, como);
  const [cantidad, setCantidad] = useState(String(d.pendiente));
  const [nota, setNota] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const enVuelo = useRef(false);
  const c = Number(String(cantidad).replace(',', '.'));
  const valida = c > 0 && c <= d.pendiente + 1e-6;

  const guardar = async () => {
    if (!valida) { toast(`La cantidad va de más de 0 a ${d.pendiente}.`, 'err'); return; }
    if (!confirmando) { setConfirmando(true); return; }
    if (enVuelo.current) return;
    enVuelo.current = true;
    try {
      await provApi.resolverDiferencia(d.id, { como, cantidad: c, nota: nota.trim() || undefined });
      toast(c < d.pendiente - 1e-6 ? `${accion.titulo}: quedan ${cantTxt(d.pendiente - c, d.tipoProducto)} pendientes.` : `${accion.titulo}: la diferencia quedó resuelta.`, 'ok');
      onChange?.();
      closeModal();
    } catch (e) {
      toast(errorMsg(e), 'err');
      setConfirmando(false);
    } finally {
      enVuelo.current = false;
    }
  };

  return (
    <ModalShell
      title={`${accion.titulo} · ${d.producto}`}
      subtitle={`${queTxt(d)} con ${d.papel} de ${d.proveedor} (${d.sucursal}). Pendiente: ${cantTxt(d.pendiente, d.tipoProducto)}, ${money(d.valorPendiente)} a costo.`}
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: confirmando ? 'Sí, confirmar' : accion.boton, clase: 'btn-primary', onClick: guardar },
      ]}
    >
      <div style={{ display: 'grid', gap: 10 }}>
        <div className={s.hint} style={{ margin: 0 }}>{accion.ayuda}</div>
        <label style={{ display: 'grid', gap: 4 }}>
          <span className={s['mini-label']}>Cantidad ({d.tipoProducto === 'granel' ? 'kg' : 'unidades'})</span>
          <input id="dif-cantidad" type="number" min="0" step="any" value={cantidad} onChange={(e) => { setCantidad(e.target.value); setConfirmando(false); }} />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span className={s['mini-label']}>Nota (opcional)</span>
          <input id="dif-nota" type="text" maxLength={300} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: vino en el pedido del lunes" />
        </label>
        {confirmando && (
          <div className={s.callout} style={{ margin: 0 }}>
            ¿Confirmás? {accion.titulo}: {cantTxt(c, d.tipoProducto)} de {d.producto}.
            {c < d.pendiente - 1e-6 ? ` Quedan ${cantTxt(d.pendiente - c, d.tipoProducto)} pendientes.` : ' La diferencia queda resuelta.'}
          </div>
        )}
      </div>
    </ModalShell>
  );
}
