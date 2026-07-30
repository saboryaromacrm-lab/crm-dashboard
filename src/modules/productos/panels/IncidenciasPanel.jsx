import { useState } from 'react';
import { useProductos } from '../context/ProductosContext.jsx';
import { ESTADOS_INCIDENCIA } from '../domain/constants.js';
import { Table, PanelHead, IncidPill, Btn, s } from '../components/ui.jsx';

export function IncidenciasPanel() {
  const { store, isAdmin, can, act, openModal } = useProductos();
  const [estadoF, setEstadoF] = useState('');

  const filas = store.state.incidencias
    .slice()
    .sort((a, b) => b.id - a.id)
    .filter((i) => !estadoF || i.estado === estadoF)
    .map((i) => {
      const p = store.getProducto(i.productoId), su = store.getSucursal(i.sucursalId), r = store.getUsuario(i.responsableId);
      return (
        <tr key={i.id}>
          <td className={s.mono}>{i.codigo}</td>
          <td>{i.tipo}</td>
          <td>{p.nombre}</td>
          <td>{su.nombre}</td>
          <td className={s.num}>{store.fmtCant(p, i.presId, i.cantidad)}</td>
          <td><IncidPill estado={i.estado} /></td>
          <td>{r ? r.nombre : '—'}</td>
          <td className={s['actions-col']}>
            <div className={s['row-actions']}>
              {i.estado === 'pendiente' && (isAdmin || can('incidencia_crear')) && (
                <Btn variant="btn-mov" small onClick={() => act(store.avanzarIncidencia(i.id), 'Incidencia en revisión.')}>A revisión</Btn>
              )}
              <Btn variant="btn-edit" small onClick={() => openModal('detalleIncidencia', { id: i.id })}>Ver</Btn>
              {i.estado !== 'resuelta' && isAdmin && (
                <Btn variant="btn-vender" small onClick={() => openModal('resolverIncidencia', { id: i.id })}>Resolver</Btn>
              )}
            </div>
          </td>
        </tr>
      );
    });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Incidencias"
        desc="Ante cualquier anomalía se crea una incidencia (no se toca el stock directo). La cantidad afectada queda comprometida hasta resolver."
        actions={can('incidencia_crear') && <Btn variant="btn-primary" onClick={() => openModal('incidencia', {})}>+ Nueva incidencia</Btn>}
      />
      <div className={s.toolbar}>
        <select className={s['select-inline']} value={estadoF} onChange={(e) => setEstadoF(e.target.value)}>
          <option value="">Todas</option>
          {Object.keys(ESTADOS_INCIDENCIA).map((k) => <option key={k} value={k}>{ESTADOS_INCIDENCIA[k].label}</option>)}
        </select>
      </div>
      <Table
        cols={[
          { h: 'Código' }, { h: 'Tipo' }, { h: 'Producto' }, { h: 'Sucursal' },
          { h: 'Cant.', num: true }, { h: 'Estado' }, { h: 'Responsable' }, { h: 'Acciones', cls: 'actions-col' },
        ]}
        empty="Sin incidencias."
      >
        {filas}
      </Table>
    </div>
  );
}
