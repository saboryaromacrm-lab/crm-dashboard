import { useMemo, useState } from 'react';
import { useProductos } from '../context/ProductosContext.jsx';
import { ESTADOS_INCIDENCIA, ETIQUETA_TIPO_INCIDENCIA, TIPO_VENTA_SIN_STOCK } from '../domain/constants.js';
import { Table, PanelHead, IncidPill, Btn, usePaginado, s } from '../components/ui.jsx';

/**
 * DOS FAMILIAS, EN PESTANAS.
 *
 * Las que alguien REPORTA (una bolsa rota, un faltante de transferencia) y las
 * que escribe sola la caja al vender algo que el sistema daba por agotado.
 * Comparten tabla, estados y contador, pero se miran por separado: son dos
 * trabajos distintos, y de la segunda hay muchas mas.
 */
const VISTAS = [
  ['sinstock', 'Ventas sin stock'],
  ['otras', 'Reportadas'],
  ['todas', 'Todas'],
];

export function IncidenciasPanel() {
  const { store, isAdmin, can, act, openModal } = useProductos();
  const [estadoF, setEstadoF] = useState('');
  const [vista, setVista] = useState('sinstock');

  const todas = store.state.incidencias;
  const abiertasSinStock = useMemo(
    () => todas.filter((i) => i.tipo === TIPO_VENTA_SIN_STOCK && i.estado !== 'resuelta').length,
    [todas],
  );
  const esSinStock = vista === 'sinstock';

  const incidencias = todas
    .slice()
    .sort((a, b) => b.id - a.id)
    .filter((i) => (vista === 'todas' ? true
      : vista === 'sinstock' ? i.tipo === TIPO_VENTA_SIN_STOCK
        : i.tipo !== TIPO_VENTA_SIN_STOCK))
    .filter((i) => !estadoF || i.estado === estadoF);

  const pag = usePaginado(incidencias, 'incidencias', vista + ':' + estadoF);

  const filas = pag.visibles.map((i) => {
      const p = store.getProducto(i.productoId), su = store.getSucursal(i.sucursalId), r = store.getUsuario(i.responsableId);
      const sinStock = i.tipo === TIPO_VENTA_SIN_STOCK;
      return (
        <tr key={i.id}>
          <td className={s.mono}>{i.codigo}</td>
          {!esSinStock && <td>{ETIQUETA_TIPO_INCIDENCIA[i.tipo] || i.tipo}</td>}
          <td>{p.nombre}</td>
          <td>{su.nombre}</td>
          {/* Las tres columnas que EXPLICAN el numero: el sistema tenia X, se
              vendieron Y, faltan Z. Con la diferencia sola no se investiga nada. */}
          {esSinStock && <td className={s.num}>{sinStock ? store.fmtCant(p, i.presId, i.disponibleAntes) : '—'}</td>}
          {esSinStock && <td className={s.num}>{sinStock ? store.fmtCant(p, i.presId, i.vendido) : '—'}</td>}
          <td className={s.num}><strong>{store.fmtCant(p, i.presId, i.cantidad)}</strong></td>
          {esSinStock && (
            <td>
              <div className={s.mono}>{i.comprobante || '—'}</div>
              {i.clienteNombre && <div className={s.hint} style={{ margin: 0 }}>{i.clienteNombre}</div>}
            </td>
          )}
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
        desc={esSinStock
          ? 'La caja vendió algo que el sistema daba por agotado. No es un error del sistema: vendió lo que se le pidió. Lo que dice cada fila es que el inventario tenía MENOS de lo que había en la góndola — hay que contar y ajustar.'
          : 'Ante cualquier anomalía se crea una incidencia (no se toca el stock directo). La cantidad afectada queda comprometida hasta resolver.'}
        actions={can('incidencia_crear') && <Btn variant="btn-primary" onClick={() => openModal('incidencia', {})}>+ Nueva incidencia</Btn>}
      />
      <div className={s.toolbar}>
        {VISTAS.map(([k, v]) => (
          <Btn key={k} small variant={vista === k ? 'btn-primary' : undefined} onClick={() => setVista(k)}>
            {v}{k === 'sinstock' && abiertasSinStock > 0 ? ' (' + abiertasSinStock + ')' : ''}
          </Btn>
        ))}
        <select className={s['select-inline']} value={estadoF} onChange={(e) => setEstadoF(e.target.value)}>
          <option value="">Todas</option>
          {Object.keys(ESTADOS_INCIDENCIA).map((k) => <option key={k} value={k}>{ESTADOS_INCIDENCIA[k].label}</option>)}
        </select>
      </div>
      <Table
        cols={[
          { h: 'Código' },
          ...(esSinStock ? [] : [{ h: 'Tipo' }]),
          { h: 'Producto' }, { h: 'Sucursal' },
          ...(esSinStock ? [{ h: 'Tenía', num: true }, { h: 'Se vendió', num: true }] : []),
          { h: esSinStock ? 'Faltan' : 'Cant.', num: true },
          ...(esSinStock ? [{ h: 'Comprobante' }] : []),
          { h: 'Estado' }, { h: 'Responsable' }, { h: 'Acciones', cls: 'actions-col' },
        ]}
        empty={esSinStock ? 'Ninguna venta salió sin stock. Así tiene que estar.' : 'Sin incidencias.'}
        pag={pag}
      >
        {filas}
      </Table>
      {estadoF === 'resuelta' && (
        <div className={s.hint}>
          Se muestran las últimas 300 resueltas. La historia completa queda en la base y en los reportes.
        </div>
      )}
    </div>
  );
}
