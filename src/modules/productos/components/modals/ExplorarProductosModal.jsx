/**
 * EXPLORAR EL CATÁLOGO PARA ARMAR UN PEDIDO
 * ============================================================================
 * El buscador de la pestaña sirve cuando ya sabés qué querés: tipeás y agregás.
 * Esto es para la otra mitad del trabajo — **recorrer** el catálogo por
 * proveedor, categoría o marca y elegir de una lista, que es como se arma el
 * pedido semanal mirando la góndola.
 *
 * Es el mismo lenguaje que la consulta de Existencias (Alt+F3) del POS, pero
 * recortado a lo que el pedido necesita:
 *
 *   * SIN precios: un pedido entre sucursales no mueve plata (la transferencia
 *     se valúa a costo cuando se despacha, y eso no lo decide el que pide).
 *   * de las cinco sucursales, SOLO las dos de este pedido: la columna de
 *     Express 1 no ayuda a decidir cuánto le pido a la Distribuidora, y llena
 *     la fila de números que hay que saltear.
 *   * cada TAMAÑO es una fila propia, igual que en el listado de Productos:
 *     así se pide "Ajo en Polvo · 500 g" derecho, sin agregar la madre y
 *     después cambiar el selector.
 *
 * Los datos salen del snapshot que el módulo ya tiene en memoria: no hay red.
 */
import { useMemo, useState } from 'react';
import { useProductos } from '../../context/ProductosContext.jsx';
import { cx } from '@shared/utils/classNames.js';
import { ModalShell } from '../Modal.jsx';
import { Table, Btn, usePaginado, s } from '../ui.jsx';
import { listaDeProducto, puedeMandar } from '../../domain/pedido.js';

/** Texto comparable: sin mayúsculas ni acentos. */
const norm = (v) => (v || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

export function ExplorarProductosModal({ grupo, origenId, destinoId, yaEnPedido, onAgregar, onClose }) {
  const { store } = useProductos();
  const [q, setQ] = useState('');
  const [proveedorId, setProveedorId] = useState('');
  const [categoria, setCategoria] = useState('');
  const [marca, setMarca] = useState('');
  const [soloConStock, setSoloConStock] = useState(false);

  const origen = store.getSucursal(origenId);
  const destino = store.getSucursal(destinoId);
  const esGranel = grupo === 'granel';

  /** Opciones de los filtros, derivadas del catálogo ya cargado (sin red). */
  const opciones = useMemo(() => {
    const marcas = new Set();
    const categorias = new Set();
    for (const p of store.state.productos) {
      if (listaDeProducto(p) !== grupo) continue;
      if (p.marca) marcas.add(p.marca);
      if (p.categoria) categorias.add(p.categoria);
    }
    return { marcas: [...marcas].sort(), categorias: [...categorias].sort() };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.state.productos, grupo]);

  /**
   * Una fila por ARTÍCULO PEDIBLE: el producto tal cual y, si es a granel, cada
   * uno de sus tamaños. El archivado queda afuera: ya no se compra ni se mueve,
   * y pedirlo es trabajo al aire.
   */
  const filas = useMemo(() => {
    const ql = norm(q);
    const provId = proveedorId ? Number(proveedorId) : null;
    const out = [];
    for (const p of store.state.productos) {
      // El explorador vive DENTRO de una pestaña: ofrece solo lo suyo, igual
      // que el buscador de al lado.
      if (listaDeProducto(p) !== grupo) continue;
      if ((p.estado || 'activo') === 'archivado') continue;
      if (marca && p.marca !== marca) continue;
      if (categoria && p.categoria !== categoria) continue;
      if (provId && !(p.formatosCompra || []).some((e) => e.proveedorId === provId)) continue;
      if (ql && !(norm(p.nombre).includes(ql) || norm(p.marca).includes(ql)
        || norm(p.categoria).includes(ql) || (p.codigoBarras || '').includes(q.trim())
        || (p.presentaciones || []).some((pr) => (pr.codigoBarras || '').includes(q.trim())))) continue;

      // El filtro de stock mira el ORIGEN: es lo que decide si el pedido tiene
      // con qué cumplirse. (Lo que ME falta a mí lo cubre el otro tilde, el del
      // buscador de la pestaña.)
      if (soloConStock && !(puedeMandar(store, p, origenId) > 1e-9)) continue;

      out.push({ clave: `p${p.id}`, p, pres: null });
      if (p.tipo === 'granel') {
        for (const pr of (p.presentaciones || [])) out.push({ clave: `f${pr.id}`, p, pres: pr });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.state.productos, store.state.stock, grupo, q, proveedorId, categoria, marca, soloConStock, origenId]);

  const hayFiltro = !!(q || proveedorId || categoria || marca || soloConStock);
  const limpiar = () => {
    setQ(''); setProveedorId(''); setCategoria(''); setMarca(''); setSoloConStock(false);
  };
  const pag = usePaginado(filas, 'explorarPedido', `${grupo}|${q}|${proveedorId}|${categoria}|${marca}|${soloConStock}`);

  return (
    <ModalShell
      title="Buscar en el catálogo"
      subtitle={`${esGranel ? 'Productos a granel' : 'Productos enteros'} · le pido a ${origen?.nombre ?? 'origen'} para ${destino?.nombre ?? 'destino'}`}
      size="xl"
      onClose={onClose}
      footer={[{ texto: 'Listo', clase: 'btn-primary', onClick: onClose }]}
    >
      <div className={s['form-grid']} style={{ gridTemplateColumns: '2fr 1.2fr 1.2fr 1.2fr', alignItems: 'end' }}>
        <div className={s.field}>
          <label>Buscar producto o código</label>
          <input
            autoFocus
            type="search"
            value={q}
            placeholder="Escaneá un código o escribí el nombre…"
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className={s.field}>
          <label>Proveedor</label>
          <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
            <option value="">Todos</option>
            {store.state.proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
        <div className={s.field}>
          <label>Categoría</label>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="">Todas</option>
            {opciones.categorias.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>
        <div className={s.field}>
          <label>Marca</label>
          <select value={marca} onChange={(e) => setMarca(e.target.value)}>
            <option value="">Todas</option>
            {opciones.marcas.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      <div className={s.toolbar} style={{ marginTop: 4 }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={soloConStock} onChange={(e) => setSoloConStock(e.target.checked)} />
          Solo lo que <strong style={{ margin: '0 3px' }}>{origen?.nombre ?? 'el origen'}</strong> puede mandar hoy
        </label>
        <span style={{ flex: 1 }} />
        <span className={s.muted} style={{ fontSize: 13 }}>
          <strong>{filas.length}</strong> artículo(s){hayFiltro ? ' con esos filtros' : ''}
        </span>
        {hayFiltro && <Btn small variant="btn-ghost" onClick={limpiar}>Limpiar filtros</Btn>}
      </div>

      <Table
        grupos={[
          { h: 'Producto', span: 2 },
          { h: 'Stock de este pedido', span: 2 },
          { h: '', span: 1 },
        ]}
        cols={[
          { h: 'Código' }, { h: 'Producto' },
          { h: `En ${origen?.nombre ?? 'origen'}`, num: true },
          { h: `En ${destino?.nombre ?? 'destino'}`, num: true },
          { h: '', cls: 'actions-col' },
        ]}
        empty={hayFiltro
          ? 'Nada coincide con esos filtros.'
          : `No hay productos ${esGranel ? 'a granel' : 'enteros'} en el catálogo.`}
        pag={pag}
      >
        {pag.visibles.map(({ clave, p, pres }) => {
          // ORIGEN: lo que puede MANDAR. En un granel es siempre el granel
          // suelto, también en la fila de un tamaño: el paquete se fracciona
          // del madre al preparar.
          const enOrigen = puedeMandar(store, p, origenId);
          // DESTINO: lo que TIENE en esa forma — los paquetes de ese tamaño, o
          // el suelto en la fila de la madre.
          const aca = destinoId ? store.cant(p.id, destinoId, pres ? pres.id : null, 'disponible') : 0;
          const codigo = (pres ? pres.codigoBarras : (p.codigoBarras || p.codigoPropio)) || '—';
          const veces = yaEnPedido(p.id, pres ? pres.id : null);
          return (
            <tr key={clave}>
              <td className={s.mono} style={{ fontSize: 12 }}>{codigo}</td>
              <td>
                <strong>{p.nombre}</strong>
                <div className={s.hint} style={{ margin: 0 }}>
                  {store.presLabel(p, pres ? pres.id : null)} · {p.marca || 'Sin marca'}
                </div>
              </td>
              <td className={cx(s.num, s.mono)} style={enOrigen > 0 ? undefined : { color: 'var(--crm-color-accent-2)', fontWeight: 700 }}>
                {store.fmtCant(p, null, enOrigen)}
              </td>
              <td className={cx(s.num, s.mono)} style={aca > 0 ? undefined : { color: 'var(--crm-color-text-secondary)' }}>
                {store.fmtCant(p, pres ? pres.id : null, aca)}
              </td>
              <td className={s['actions-col']}>
                {/* Se puede agregar de nuevo: el clic suma 1 al renglón que ya
                    está. El contador dice cuánto lleva pedido, así no hay que
                    cerrar el explorador para saberlo. */}
                <Btn small variant="btn-primary" onClick={() => onAgregar(p, pres ? pres.id : '')}>
                  {veces > 0 ? `+ 1 (lleva ${veces})` : '+ Agregar'}
                </Btn>
              </td>
            </tr>
          );
        })}
      </Table>

      <div className={s.hint}>
        Cada tamaño de un producto a granel es una fila propia: se pide directo, sin elegir la
        presentación después. Lo que agregás se guarda solo en el pedido — podés cerrar esto y seguir
        buscando cuando quieras.
      </div>
    </ModalShell>
  );
}
