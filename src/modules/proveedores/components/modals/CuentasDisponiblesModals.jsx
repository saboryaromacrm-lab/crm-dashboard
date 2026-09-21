import { useEffect, useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { esc, imprimirDocumento } from '@core/services/imprimir.js';
import { useProveedores } from '../../context/ProveedoresContext.jsx';
import { useResource } from '../../hooks/useResource.js';
import { errorMsg, provApi } from '../../services/proveedores.api.js';
import { fmt, textoResumenCuenta } from '@modules/ventas/domain/cuentasProveedor.js';
import { Btn, Di, ModalShell, Pill, Table, fmtFecha, fmtFechaHora, money, s } from '../ui.jsx';

const hoyISO = () => {
  const d = new Date(); const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const NUEVA = 'nueva';

/**
 * ALTA / EDICIÓN DE UNA CUENTA DISPONIBLE
 * ============================================================================
 * "A esta cuenta bancaria de este proveedor hay que hacerle llegar $X." Al
 * crearla se elige una cuenta de la ficha del proveedor o se carga una nueva
 * (que queda guardada en la ficha para la próxima). Una vez que recibió
 * transferencias, el titular y el alias quedan congelados: el importe se puede
 * subir (nunca por debajo de lo pagado), y el resto son tildes.
 */
export function CuentaDisponibleModal({ cuenta, onChange }) {
  const { proveedores, act, closeModal, toast } = useProveedores();
  const editando = !!cuenta;
  const congelada = editando && cuenta.historia > 0;

  const [f, setF] = useState({
    proveedorId: cuenta?.proveedorId ?? '',
    bancaria: '',
    titular: cuenta?.titular ?? '',
    cbuAlias: cuenta?.cbuAlias ?? '',
    importe: cuenta ? String(cuenta.importe) : '',
    fecha: cuenta?.fecha ? String(cuenta.fecha).slice(0, 10) : hoyISO(),
    prioritaria: !!cuenta?.prioritaria,
    enviado: !!cuenta?.enviado,
    corte: !!cuenta?.corte,
    observaciones: cuenta?.observaciones ?? '',
  });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const setBool = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.checked }));

  // Las cuentas bancarias de la ficha, apenas hay proveedor.
  const { data: bancarias } = useResource(
    `cta-disp-bancarias:${f.proveedorId}`,
    () => provApi.cuentas(Number(f.proveedorId)),
    { enabled: !editando && !!f.proveedorId },
  );
  // Con una sola en la ficha, queda elegida; sin ninguna, directo a cargar una.
  useEffect(() => {
    if (editando || !bancarias) return;
    setF((x) => ({ ...x, bancaria: bancarias.length === 1 ? String(bancarias[0].id) : bancarias.length ? '' : NUEVA }));
  }, [bancarias, editando]);

  const proveedor = useMemo(() => proveedores.find((p) => p.id === Number(f.proveedorId)), [proveedores, f.proveedorId]);
  const elegidaBancaria = (bancarias ?? []).find((b) => String(b.id) === f.bancaria);

  const guardar = async () => {
    if (!editando && !f.proveedorId) { toast('Elegí el proveedor.', 'err'); return; }
    if (!(Number(f.importe) > 0)) { toast('El importe a cubrir tiene que ser mayor a 0.', 'err'); return; }
    if (!editando) {
      if (!f.bancaria) { toast('Elegí la cuenta bancaria, o cargá una nueva.', 'err'); return; }
      if (f.bancaria === NUEVA && (!f.titular.trim() || !f.cbuAlias.trim())) {
        toast('Poné el titular y el alias o CBU de la cuenta.', 'err'); return;
      }
      if (f.bancaria !== NUEVA && !elegidaBancaria?.titular && !f.titular.trim()) {
        toast('Esa cuenta de la ficha no tiene titular cargado: escribilo abajo.', 'err'); return;
      }
    }
    const comunes = {
      importe: r2(f.importe), fecha: f.fecha || undefined, prioritaria: f.prioritaria,
      observaciones: f.observaciones.trim(),
    };
    const res = await act(
      editando
        ? provApi.editarCuentaDisponible(cuenta.id, {
          ...comunes, enviado: f.enviado, corte: f.corte,
          ...(congelada ? {} : { titular: f.titular.trim(), cbuAlias: f.cbuAlias.trim() }),
        })
        : provApi.crearCuentaDisponible({
          ...comunes, proveedorId: Number(f.proveedorId),
          ...(f.bancaria === NUEVA
            ? { titular: f.titular.trim(), cbuAlias: f.cbuAlias.trim() }
            : { cuentaId: Number(f.bancaria), titular: f.titular.trim() || undefined }),
        }),
      editando ? 'Cuenta actualizada.' : 'Cuenta disponible creada: ya se ofrece en la caja.',
    );
    if (res) onChange?.();
  };

  return (
    <ModalShell
      title={editando ? `Cuenta de ${cuenta.proveedorNombre} · ${cuenta.titular}` : 'Nueva cuenta disponible'}
      subtitle={editando
        ? (congelada ? 'Ya recibió transferencias: el titular y el alias quedan congelados' : 'Todavía sin transferencias')
        : 'A qué cuenta del proveedor hay que hacerle llegar plata, y cuánta'}
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: editando ? 'Guardar' : 'Crear', clase: 'btn-primary', onClick: guardar },
      ]}
    >
      {!editando && (
        <>
          <div className={s.field}>
            <label>Proveedor <span className={s.req}>*</span></label>
            <select value={f.proveedorId} onChange={(e) => setF((x) => ({ ...x, proveedorId: e.target.value, bancaria: '' }))} autoFocus>
              <option value="">Elegí el proveedor</option>
              {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
            {proveedor && Number(proveedor.minimoTransferencia) > 0 && (
              <div className={s.hint} style={{ margin: '4px 0 0' }}>
                Este proveedor no recibe transferencias menores a <strong>{money(proveedor.minimoTransferencia)}</strong> (salvo la que cierra la cuenta).
              </div>
            )}
          </div>
          {!!f.proveedorId && (
            <div className={s.field}>
              <label>Cuenta bancaria <span className={s.req}>*</span></label>
              <select value={f.bancaria} onChange={set('bancaria')}>
                <option value="">Elegí…</option>
                {(bancarias ?? []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.titular ? `${b.titular} · ` : ''}{b.cbuAlias}{b.descripcion ? ` (${b.descripcion})` : ''}
                  </option>
                ))}
                <option value={NUEVA}>+ Otra cuenta (se guarda en la ficha)</option>
              </select>
            </div>
          )}
        </>
      )}

      {(editando || f.bancaria === NUEVA || (elegidaBancaria && !elegidaBancaria.titular)) && (
        <div className={s['form-grid']}>
          <div className={s.field}>
            <label>Titular {!congelada && <span className={s.req}>*</span>}</label>
            <input value={f.titular} onChange={set('titular')} disabled={congelada} placeholder="A nombre de quién está" />
          </div>
          {(editando || f.bancaria === NUEVA) && (
            <div className={s.field}>
              <label>Alias o CBU {!congelada && <span className={s.req}>*</span>}</label>
              <input value={f.cbuAlias} onChange={set('cbuAlias')} disabled={congelada} placeholder="alias.del.proveedor o CBU" />
            </div>
          )}
        </div>
      )}

      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>A cubrir <span className={s.req}>*</span></label>
          <input type="number" min="0" step="0.01" value={f.importe} onChange={set('importe')} />
          {congelada && <div className={s.hint} style={{ margin: '4px 0 0' }}>Ya transferido: {money(cuenta.pagado)} — no se puede bajar de ahí.</div>}
        </div>
        <div className={s.field}>
          <label>Fecha</label>
          <input type="date" value={f.fecha} onChange={set('fecha')} />
        </div>
      </div>
      <div className={s.field}>
        <label>Observaciones</label>
        <input value={f.observaciones} onChange={set('observaciones')} placeholder="Opcional" />
      </div>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={f.prioritaria} onChange={setBool('prioritaria')} /> ★ Prioritaria (se ofrece primero)
        </label>
        {editando && (
          <>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={f.enviado} onChange={setBool('enviado')} /> Resumen enviado al proveedor
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={f.corte} onChange={setBool('corte')} /> Corte (cerrar aunque no esté completa)
            </label>
          </>
        )}
      </div>
    </ModalShell>
  );
}

/* ==================================================================== *
 * El resumen: lo que se le manda al proveedor
 * ==================================================================== */

function cuerpoResumen(cuenta, pagos) {
  const fila = (k, v) => `<tr><td class="chica"><strong>${esc(k)}</strong></td><td>${esc(v)}</td></tr>`;
  const filas = pagos.map((p) => `
    <tr>
      <td>${esc(fmtFecha(p.fecha))}</td>
      <td>${esc(p.clienteNombre || '')}</td>
      <td>${esc(p.documento?.etiqueta || '')}</td>
      <td style="text-align:right"><strong>${esc(money(p.importe))}</strong></td>
      <td>${esc(p.observaciones || '')}</td>
    </tr>`).join('');
  return `
    <h1>Historial de transferencias</h1>
    <div class="sub">${esc(cuenta.proveedorNombre)}</div>
    <table><tbody>
      ${fila('Titular', cuenta.titular)}
      ${fila('Alias / CBU', cuenta.cbuAlias)}
      ${fila('A cubrir', money(cuenta.importe))}
      ${fila('Transferido', `${money(cuenta.pagado)} en ${cuenta.cant} transferencia(s)`)}
      ${fila('Falta', money(cuenta.falta))}
    </tbody></table>
    <table>
      <thead><tr><th>Fecha</th><th>Cliente</th><th>Comprobante</th><th style="text-align:right">Pago</th><th>Obs.</th></tr></thead>
      <tbody>${filas}</tbody>
    </table>`;
}

export function ResumenCuentaModal({ cuentaId, onChange }) {
  const { closeModal, toast } = useProveedores();
  const { data, error, reload } = useResource(`cta-disp-resumen:${cuentaId}`, () => provApi.resumenCuenta(cuentaId));
  const cuenta = data?.cuenta;
  const pagos = data?.pagos ?? [];

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(textoResumenCuenta(cuenta, pagos, fmtFecha));
      toast('Resumen copiado: pegalo en el WhatsApp del proveedor.', 'ok');
    } catch { toast('No se pudo copiar al portapapeles.', 'err'); }
  };
  const imprimir = async () => {
    const ok = await imprimirDocumento('resumenCuentaDisponible', {
      titulo: `Transferencias · ${cuenta.proveedorNombre}`, cuerpo: cuerpoResumen(cuenta, pagos),
    });
    if (!ok) toast('El navegador bloqueó la ventana de impresión.', 'err');
  };
  const marcarEnviado = async () => {
    try {
      await provApi.editarCuentaDisponible(cuenta.id, { enviado: true });
      toast('Marcada como enviada.', 'ok');
      reload(); onChange?.();
    } catch (e) { toast(errorMsg(e), 'err'); }
  };

  return (
    <ModalShell
      title="Resumen para el proveedor"
      subtitle={cuenta ? `${cuenta.proveedorNombre} · ${cuenta.titular}` : ''}
      wide
      onClose={closeModal}
      footer={[
        { texto: 'Cerrar', clase: 'btn-ghost', onClick: closeModal },
        ...(cuenta && !cuenta.enviado ? [{ texto: 'Marcar enviado', clase: 'btn-ghost', onClick: marcarEnviado }] : []),
        { texto: 'Imprimir', clase: 'btn-ghost', onClick: imprimir },
        { texto: 'Copiar para WhatsApp', clase: 'btn-primary', onClick: copiar },
      ]}
    >
      {error && <div className={cx(s.callout, s.warn)}>{error}</div>}
      {cuenta && (
        <>
          <div className={s['detalle-grid']}>
            <Di label="Proveedor">{cuenta.proveedorNombre}</Di>
            <Di label="Titular"><strong>{cuenta.titular}</strong></Di>
            <Di label="Alias / CBU"><span className={s.mono}>{cuenta.cbuAlias}</span></Di>
            <Di label="A cubrir">{money(cuenta.importe)}</Di>
            <Di label="Transferido">{money(cuenta.pagado)} · {cuenta.cant} transf.</Di>
            <Di label="Falta">
              {cuenta.estado === 'cubierta' ? <Pill pill="est-recibida" label="cubierta" /> : <strong>{fmt(cuenta.falta)}</strong>}
            </Di>
          </div>
          <Table cols={[{ h: 'Fecha' }, { h: 'Cliente' }, { h: 'Comprobante' }, { h: 'Pago', num: true }, { h: 'Cajero' }, { h: 'Obs.' }]}
            empty="Todavía no recibió transferencias.">
            {pagos.map((p) => (
              <tr key={p.id}>
                <td>{fmtFechaHora(p.fecha)}</td>
                <td>{p.clienteNombre || '—'}</td>
                <td className={s.mono}>{p.documento?.etiqueta || '—'}</td>
                <td className={s.num}><strong>{money(p.importe)}</strong></td>
                <td>{p.usuarioNombre || '—'}</td>
                <td>{p.observaciones || <span className={s.muted}>—</span>}</td>
              </tr>
            ))}
          </Table>
        </>
      )}
    </ModalShell>
  );
}
