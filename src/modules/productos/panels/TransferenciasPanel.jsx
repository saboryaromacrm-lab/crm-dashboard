import { useProductos } from '../context/ProductosContext.jsx';
import { fmtFecha } from '../domain/format.js';
import { Table, PanelHead, TransferPill, Btn, s } from '../components/ui.jsx';

export function TransferenciasPanel() {
  const { store, isAdmin, act, openModal } = useProductos();

  const filas = store.state.transferencias.slice().sort((a, b) => b.id - a.id).map((t) => {
    const o = store.getSucursal(t.origenId), d = store.getSucursal(t.destinoId), u = store.getUsuario(t.usuarioId);
    const finalizada = t.estado === 'recibida' || t.estado === 'cancelada';
    return (
      <tr key={t.id}>
        <td className={s.mono}>{t.codigo}</td>
        <td>{o.nombre} → {d.nombre}</td>
        <td>{fmtFecha(t.fecha)}</td>
        <td><TransferPill estado={t.estado} /></td>
        <td className={s.num}>{t.items.length}</td>
        <td>{u ? u.nombre : '—'}</td>
        <td className={s['actions-col']}>
          <div className={s['row-actions']}>
            {isAdmin && !finalizada && (
              <Btn variant="btn-vender" small onClick={() => act(store.avanzarTransferencia(t.id), 'Transferencia actualizada.')}>Avanzar →</Btn>
            )}
            <Btn variant="btn-edit" small onClick={() => openModal('detalleTransfer', { id: t.id })}>Ver</Btn>
            {isAdmin && (t.estado === 'pendiente' || t.estado === 'preparada') && (
              <Btn variant="btn-delete" small onClick={() => openModal('confirm', {
                title: 'Cancelar transferencia',
                texto: 'Se liberará el stock reservado en origen. ¿Confirmás?',
                claseOk: 'btn-delete',
                onOk: () => act(store.cancelarTransferencia(t.id), 'Transferencia cancelada.'),
              })}>Cancelar</Btn>
            )}
          </div>
        </td>
      </tr>
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Transferencias entre sucursales"
        desc="Estados: Pendiente → Preparada → En tránsito → Recibida. Reserva stock en origen y lo acredita en destino al recibir."
        actions={isAdmin && <Btn variant="btn-primary" onClick={() => openModal('transferencia', {})}>+ Nueva transferencia</Btn>}
      />
      <Table
        cols={[{ h: 'Código' }, { h: 'Ruta' }, { h: 'Fecha' }, { h: 'Estado' }, { h: 'Ítems', num: true }, { h: 'Responsable' }, { h: 'Acciones', cls: 'actions-col' }]}
        empty="No hay transferencias."
      >
        {filas}
      </Table>
    </div>
  );
}
