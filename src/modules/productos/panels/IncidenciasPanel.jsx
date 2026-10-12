import { useMemo, useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { norm } from '../components/CatalogoPicker.jsx';
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
const deVista = (vista, i) => (vista === 'todas' ? true
  : vista === 'sinstock' ? i.tipo === TIPO_VENTA_SIN_STOCK
    : i.tipo !== TIPO_VENTA_SIN_STOCK);
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

export function IncidenciasPanel() {
  const { store, isAdmin, can, act, openModal } = useProductos();
  const [estadoF, setEstadoF] = useState('');
  const [vista, setVista] = useState('sinstock');
  const [sucF, setSucF] = useState('');
  const [q, setQ] = useState('');
  const esSuper = store.rolActual() === 'superadmin';

  const todas = store.state.incidencias;
  const esSinStock = vista === 'sinstock';
  const sucId = sucF ? Number(sucF) : null;

  /* Las sucursales que tienen incidencias, por nombre: el filtro aparece solo si hay más de una. */
  const sucursales = useMemo(
    () => [...new Set(todas.map((i) => i.sucursalId))]
      .map((id) => ({ id, nombre: store.getSucursal(id)?.nombre ?? `#${id}` }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [todas, store],
  );

  /* Lo de la sucursal elegida (o todo): de acá salen el contador, el aviso y la tabla. */
  const deSucursal = useMemo(() => (sucId ? todas.filter((i) => i.sucursalId === sucId) : todas), [todas, sucId]);
  const abiertasSinStock = useMemo(
    () => deSucursal.filter((i) => i.tipo === TIPO_VENTA_SIN_STOCK && i.estado !== 'resuelta').length,
    [deSucursal],
  );
  /* Ventas sin stock abiertas de ANTES del control de su producto (0159): el
   * número del sistema no era real, así que no sirven para investigar. */
  const anteriores = useMemo(() => deSucursal.filter((i) => i.sinControl).length, [deSucursal]);

  const incidencias = useMemo(() => {
    const t = norm(q.trim());
    return deSucursal
      .filter((i) => deVista(vista, i) && (!estadoF || i.estado === estadoF))
      .filter((i) => !t || norm(`${i.codigo} ${store.getProducto(i.productoId)?.nombre ?? ''} ${i.comprobante ?? ''} ${i.clienteNombre ?? ''}`).includes(t))
      .sort((a, b) => b.id - a.id);
  }, [deSucursal, vista, estadoF, q, store]);
  const hayFiltro = !!(estadoF || sucF || q.trim());

  const pag = usePaginado(incidencias, 'incidencias', `${vista}:${estadoF}:${sucF}:${q}`);

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
          <td>
            <IncidPill estado={i.estado} />
            {i.sinControl && <div className={s.hint} style={{ margin: '2px 0 0' }}>anterior al control</div>}
          </td>
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
          ? 'La caja vendió algo que el sistema daba por agotado. Lo que dice cada fila es que el inventario tenía MENOS de lo que había en la góndola — hay que contar y ajustar. Solo se anotan las de productos que ya pasaron por un control o un ajuste de stock en esa sucursal (antes de eso, el número del sistema no es real), y al volver a controlar un producto sus ventas sin stock abiertas se cierran solas.'
          : 'Ante cualquier anomalía se crea una incidencia (no se toca el stock directo). La cantidad afectada queda comprometida hasta resolver.'}
        actions={can('incidencia_crear') && <Btn variant="btn-primary" onClick={() => openModal('incidencia', {})}>+ Nueva incidencia</Btn>}
      />
      <div className={s.toolbar}>
        {VISTAS.map(([k, v]) => (
          <Btn key={k} small variant={vista === k ? 'btn-primary' : undefined} onClick={() => setVista(k)}>
            {v}{k === 'sinstock' && abiertasSinStock > 0 ? ' (' + abiertasSinStock + ')' : ''}
          </Btn>
        ))}
        {sucursales.length > 1 && (
          <select id="incidencias-sucursal" className={s['select-inline']} value={sucF} onChange={(e) => setSucF(e.target.value)} aria-label="Sucursal">
            <option value="">Todas las sucursales</option>
            {sucursales.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
          </select>
        )}
        <select id="incidencias-estado" className={s['select-inline']} value={estadoF} onChange={(e) => setEstadoF(e.target.value)} aria-label="Estado">
          <option value="">Todos los estados</option>
          {Object.keys(ESTADOS_INCIDENCIA).map((k) => <option key={k} value={k}>{ESTADOS_INCIDENCIA[k].label}</option>)}
        </select>
        <input
          id="incidencias-buscar" type="search" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar producto, código, comprobante o cliente…" style={{ minWidth: 260 }}
        />
        {hayFiltro && (
          <>
            <Btn small onClick={() => { setEstadoF(''); setSucF(''); setQ(''); }}>Limpiar filtros</Btn>
            <span className={s.hint} style={{ margin: 0 }}>{plural(incidencias.length, 'incidencia', 'incidencias')}</span>
          </>
        )}
      </div>
      {vista !== 'otras' && anteriores > 0 && (
        <CerrarAnteriores
          key={sucF} n={anteriores} sucursal={sucId ? store.getSucursal(sucId)?.nombre : null} sucId={sucId}
          puede={esSuper} store={store} act={act}
        />
      )}
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
        empty={hayFiltro ? 'Ninguna incidencia con esos filtros.' : esSinStock ? 'Ninguna venta salió sin stock. Así tiene que estar.' : 'Sin incidencias.'}
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

/**
 * EL PUNTO DE PARTIDA DEL STOCK REAL (0159, pedido del dueño).
 *
 * Las ventas sin stock de antes del control de su producto no sirven: el
 * negativo era del número cargado, no de la góndola. No se borran —cada una
 * está atada a su venta—: se cierran en bloque sin tocar el stock y quedan en
 * la historia. Solo el superadmin, con segunda confirmación y candado.
 */
function CerrarAnteriores({ n, sucursal, sucId, puede, store, act }) {
  const [confirmando, setConfirmando] = useState(false);
  const enVuelo = useRef(false);
  const cuantas = plural(n, 'venta sin stock', 'ventas sin stock');
  const donde = sucursal ? ` de ${sucursal}` : '';
  const cerrar = () => {
    if (!confirmando) { setConfirmando(true); return; }
    if (enVuelo.current) return;
    enVuelo.current = true;
    act(
      store.cerrarIncidenciasAnteriores(sucId),
      (r) => `Listo: ${plural(r.cerradas ?? 0, 'venta sin stock cerrada', 'ventas sin stock cerradas')}. El stock no se tocó.`,
    ).finally(() => { enVuelo.current = false; setConfirmando(false); });
  };
  return (
    <div className={cx(s.callout, s.warn)} style={{ display: 'flex', gap: 'var(--crm-space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 320px' }}>
        {confirmando ? (
          <><strong>Segunda confirmación.</strong> Se cierran {cuantas}{donde} como «anterior al control», <strong>sin tocar el stock</strong>.
            No se borran: quedan en la historia, pero salen de la lista y del contador. No se deshace.</>
        ) : (
          <><strong>{cuantas[0].toUpperCase() + cuantas.slice(1)}{donde}</strong> {n === 1 ? 'es' : 'son'} de antes del control de stock de su producto:
            el sistema todavía no tenía el stock real, así que no {n === 1 ? 'sirve' : 'sirven'} para investigar.
            {!puede && ' Las puede cerrar el superadmin.'}</>
        )}
      </div>
      {puede && (
        <div style={{ display: 'flex', gap: 'var(--crm-space-2)' }}>
          {confirmando && <Btn small onClick={() => setConfirmando(false)}>Cancelar</Btn>}
          <Btn small variant="btn-primary" onClick={cerrar}>{confirmando ? `Sí, cerrar ${n}` : `Cerrar ${n === 1 ? 'esa' : `las ${n}`}…`}</Btn>
        </div>
      )}
    </div>
  );
}
