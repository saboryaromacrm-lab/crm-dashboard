import { useEffect, useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useVentas } from '../../context/VentasContext.jsx';
import { errorMsg, ventasApi } from '../../services/ventas.api.js';
import { ModalShell, s } from '../ui.jsx';

/**
 * EL RELEVO DE CAJA (0088, pedido del dueño).
 * ============================================================================
 * El caso real: Karen entra con su usuario y vende; se tiene que ausentar y
 * pasa Juan el repositor a cobrar — SIN cambiar de sesión, porque en la
 * práctica no es práctico y Juan ni siquiera tiene el POS habilitado. Sin
 * esto, todo quedaba firmado por Karen y "quién cerró mal esta venta" no se
 * podía contestar.
 *
 * Acá Juan elige su nombre y tipea SU PIN (definido en Gerencia › Usuarios).
 * El PIN es lo que hace que la firma pese: un selector sin PIN deja elegir
 * cualquier nombre y la respuesta vuelve a no valer nada. La sesión no cambia
 * — permisos, caja y pantalla siguen siendo los de Karen; lo que cambia es
 * QUIÉN FIRMA lo que la registradora escribe de acá en más.
 */
export function RelevoModal({ cajaSesionId }) {
  const { ctx, usuarios, operador, setOperador, closeModal, toast } = useVentas();
  const [relevos, setRelevos] = useState(null);
  const [elegido, setElegido] = useState('');
  const [pin, setPin] = useState('');
  const [enviando, setEnviando] = useState(false);
  const pinRef = useRef(null);

  const sesionNombre = usuarios.find((u) => u.id === ctx.usuarioId)?.nombre || 'la sesión';

  useEffect(() => {
    let vivo = true;
    ventasApi.relevos()
      .then((r) => { if (vivo) setRelevos(Array.isArray(r) ? r : []); })
      .catch((e) => { if (vivo) { setRelevos([]); toast(errorMsg(e), 'err'); } });
    return () => { vivo = false; };
  }, [toast]);

  const tomar = async () => {
    const id = Number(elegido);
    if (!id) { toast('Elegí quién toma la caja.', 'err'); return; }
    if (!pin) { toast('Tipeá el PIN.', 'err'); pinRef.current?.focus(); return; }
    setEnviando(true);
    try {
      const r = await ventasApi.verificarRelevo(id, pin, cajaSesionId ?? undefined);
      setOperador(r.usuario);
      toast(`${r.usuario.nombre} está en la caja: lo que se venda y cobre queda a su nombre.`, 'ok');
      closeModal();
    } catch (e) {
      toast(errorMsg(e), 'err');
      setPin('');
      pinRef.current?.focus();
    } finally {
      setEnviando(false);
    }
  };

  const volver = async () => {
    // Sin PIN a propósito: la sesión ES del titular. El rastro queda igual.
    try { await ventasApi.volverRelevo(operador?.nombre ?? '', cajaSesionId ?? undefined); } catch { /* el rastro no bloquea */ }
    setOperador(null);
    toast(`${sesionNombre} de vuelta en la caja.`, 'ok');
    closeModal();
  };

  return (
    <ModalShell
      title="¿Quién está en la caja?"
      subtitle={`La sesión sigue siendo de ${sesionNombre}: el relevo solo cambia quién firma.`}
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        ...(operador ? [{ texto: `Volvió ${sesionNombre}`, clase: 'btn-ghost', onClick: volver }] : []),
        { texto: enviando ? 'Verificando…' : 'Tomar la caja', clase: 'btn-primary', onClick: tomar },
      ]}
    >
      {operador && (
        <div className={cx(s.callout, s.warn)}>
          Ahora mismo está cobrando <strong>{operador.nombre}</strong>.
        </div>
      )}

      {relevos !== null && relevos.length === 0 ? (
        <div className={cx(s.callout, s.info)}>
          No hay usuarios habilitados como relevo. Se habilitan en{' '}
          <strong>Gerencia › Usuarios y roles</strong>: tilde “Puede relevar en caja” + su PIN.
        </div>
      ) : (
        <>
          <div className={s.field}>
            <label>Quién toma la caja</label>
            <select value={elegido} onChange={(e) => { setElegido(e.target.value); setPin(''); pinRef.current?.focus(); }}>
              <option value="" disabled>Elegí el relevo…</option>
              {(relevos ?? [])
                .filter((r) => r.id !== ctx.usuarioId)
                .map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </div>
          <div className={s.field}>
            <label>Su PIN</label>
            <input
              ref={pinRef}
              type="password" inputMode="numeric" maxLength={6}
              value={pin}
              placeholder="4 a 6 dígitos"
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => { if (e.key === 'Enter' && !enviando) { e.preventDefault(); tomar(); } }}
            />
            <div className={s.hint} style={{ margin: '6px 0 0' }}>
              El PIN es personal: es lo que hace que la firma valga. Varios intentos fallidos lo
              bloquean unos minutos.
            </div>
          </div>
        </>
      )}
    </ModalShell>
  );
}
