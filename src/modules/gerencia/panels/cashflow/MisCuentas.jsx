import { useState } from 'react';
import { cuentasPropias } from '@core/services/cuentasPropias.js';
import { useCuentasPropias } from '@shared/components/CuentaPropiaSelect.jsx';
import { errorMsg } from '@modules/ventas/services/ventas.api.js';
import { num } from '@modules/productos/domain/format.js';
import { Table, Btn, Pill, s } from '@modules/productos/components/ui.jsx';
import { Aviso, Bloque } from '../metricas/piezas.jsx';

/**
 * MIS CUENTAS (0207, 28/10/2026, pedido del dueño: «tengo varias cuentas
 * digitales, quiero elegir desde dónde sale el dinero»). Las cuentas propias de
 * las que salen las transferencias. Con al menos una activa, todo pago por
 * transferencia pide de cuál salió. Con pagos detrás no se borra: se desactiva.
 */
export function MisCuentas({ avisar }) {
  const { cuentas, error: errorLista } = useCuentasPropias();
  const [nombre, setNombre] = useState('');
  const [detalle, setDetalle] = useState('');
  const [editando, setEditando] = useState(null); // { id, nombre, detalle }
  const [error, setError] = useState('');

  const guardar = async (fn, ok) => {
    setError('');
    try { await fn(); avisar('ok', ok); return true; } catch (e) { setError(errorMsg(e)); return false; }
  };
  const crear = async () => {
    if (!nombre.trim()) { setError('Escribí el nombre de la cuenta (por ejemplo «Mercado Pago»).'); return; }
    if (await guardar(() => cuentasPropias.crear({ nombre: nombre.trim(), detalle: detalle.trim() }), `Cuenta «${nombre.trim()}» agregada.`)) {
      setNombre('');
      setDetalle('');
    }
  };
  const guardarEdicion = async () => {
    if (await guardar(() => cuentasPropias.editar(editando.id, { nombre: editando.nombre.trim(), detalle: editando.detalle.trim() }), 'Cuenta guardada.')) {
      setEditando(null);
    }
  };

  return (
    <Bloque
      titulo="Mis cuentas"
      sub="Las cuentas de las que salen tus transferencias (Mercado Pago, bancos…). Con al menos una cargada, todo pago por transferencia pide de cuál salió; en el listado de pagos y en el estado de cuenta del proveedor se ve la cuenta y se puede filtrar por ella. Una cuenta con pagos no se borra: se desactiva."
    >
      <div className={s.toolbar}>
        <input value={nombre} maxLength={60} placeholder="Nombre (Mercado Pago, Galicia…)" onChange={(e) => setNombre(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && crear()} />
        <input value={detalle} maxLength={120} placeholder="Alias o CVU (opcional)" onChange={(e) => setDetalle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && crear()} />
        <Btn variant="btn-primary" small onClick={crear}>Agregar</Btn>
      </div>
      {(error || errorLista) && <Aviso tono="warn">{error || errorMsg(errorLista)}</Aviso>}
      <Table cols={[{ h: 'Cuenta' }, { h: 'Alias o CVU' }, { h: 'Pagos', num: true }, { h: 'Estado' }, { h: 'Acciones', cls: 'actions-col' }]} empty={cuentas ? 'Todavía no cargaste ninguna.' : 'Cargando…'}>
        {(cuentas ?? []).map((c) => (editando?.id === c.id ? (
          <tr key={c.id}>
            <td><input value={editando.nombre} maxLength={60} autoFocus onChange={(e) => setEditando({ ...editando, nombre: e.target.value })} /></td>
            <td><input value={editando.detalle} maxLength={120} onChange={(e) => setEditando({ ...editando, detalle: e.target.value })} /></td>
            <td className={s.num}>{num(c.usos, 0)}</td>
            <td />
            <td className={s['actions-col']}>
              <div className={s['row-actions']}>
                <Btn small variant="btn-primary" onClick={guardarEdicion}>Guardar</Btn>
                <Btn small onClick={() => setEditando(null)}>Cancelar</Btn>
              </div>
            </td>
          </tr>
        ) : (
          <tr key={c.id} style={c.activa ? undefined : { opacity: 0.6 }}>
            <td>{c.nombre}</td>
            <td>{c.detalle || <span className={s.muted}>—</span>}</td>
            <td className={s.num}>{num(c.usos, 0)}</td>
            <td><Pill pill={c.activa ? 'st-disponible' : 'st-retenido'} label={c.activa ? 'Activa' : 'Desactivada'} /></td>
            <td className={s['actions-col']}>
              <div className={s['row-actions']}>
                <Btn small onClick={() => setEditando({ id: c.id, nombre: c.nombre, detalle: c.detalle })}>Editar</Btn>
                <Btn small onClick={() => guardar(() => cuentasPropias.editar(c.id, { activa: !c.activa }), c.activa ? 'Cuenta desactivada: no se ofrece más, sus pagos quedan.' : 'Cuenta activada.')}>
                  {c.activa ? 'Desactivar' : 'Activar'}
                </Btn>
              </div>
            </td>
          </tr>
        )))}
      </Table>
    </Bloque>
  );
}
