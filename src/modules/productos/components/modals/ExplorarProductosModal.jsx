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
 *   * en granel se ofrecen los TAMAÑOS y no el producto madre: lo que viaja a
 *     una sucursal son paquetes, así que la madre en la lista solo daba una
 *     fila más para elegir mal. Cada tamaño lleva su código y se agrega con la
 *     presentación ya elegida, sin tocar el selector después. El granel suelto
 *     no se pierde de vista: va como info debajo del stock del destino.
 *
 * Los datos salen del snapshot que el módulo ya tiene en memoria: no hay red.
 */
import { useMemo, useState } from 'react';
import { useProductos } from '../../context/ProductosContext.jsx';
import { cx } from '@shared/utils/classNames.js';
import { ModalShell } from '../Modal.jsx';
import { Table, Btn, Paginador, usePaginado, s } from '../ui.jsx';
import { listaDeProducto, puedeMandar } from '../../domain/pedido.js';
import c from '../../styles/Explorar.module.css';

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

      if (p.tipo !== 'granel') {
        out.push({ clave: `p${p.id}`, p, pres: null });
        continue;
      }
      /*
       * EN GRANEL SE OFRECEN LOS TAMAÑOS, NO LA MADRE (decisión del dueño):
       * lo que viaja a una sucursal son paquetes, así que la madre en la lista
       * solo daba una fila más para elegir mal. El granel suelto no se pierde
       * de vista: va como info debajo del stock del destino.
       *
       * La excepción: un granel SIN tamaños definidos no tiene paquetes que
       * ofrecer, y esconderlo sería no poder pedirlo nunca. Ahí va su fila
       * suelta, que es lo único que existe.
       */
      const tamanos = p.presentaciones || [];
      if (!tamanos.length) {
        out.push({ clave: `p${p.id}`, p, pres: null });
        continue;
      }
      for (const pr of tamanos) out.push({ clave: `f${pr.id}`, p, pres: pr });
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
      subtitle={esGranel
        ? `Le pido a ${origen?.nombre ?? 'origen'} para ${destino?.nombre ?? 'destino'} · se piden los TAMAÑOS, y debajo del stock del destino dice cuánto tiene sin envasar`
        : `Productos enteros · le pido a ${origen?.nombre ?? 'origen'} para ${destino?.nombre ?? 'destino'}`}
      size="xl"
      onClose={onClose}
      footer={[{ texto: 'Listo', clase: 'btn-primary', onClick: onClose }]}
    >
      {/*
       * TRES ZONAS, Y SOLO LA DEL MEDIO SCROLLEA.
       * El modal `xl` se fija al alto de la ventana y recorta lo que sobra (para
       * que la cabecera con los filtros no se vaya de vista). Sin un contenedor
       * propio con scroll, la tabla larga quedaba cortada y el paginador
       * directamente abajo del corte: se veía como que no había más productos.
       * Los filtros arriba y el paginador abajo quedan quietos; la lista corre.
       */}
      <div className={c.marco}>
        {/* Los filtros en UNA fila, como en la consulta de Existencias: cada
            renglón fijo que se agrega arriba es un producto menos que se ve en
            la lista, y la lista es para lo que se vino. */}
        <div className={c.filtros}>
          <div className={c.campo}>
            <label htmlFor="expl-q">Buscar producto o código</label>
            <input
              id="expl-q"
              autoFocus
              type="search"
              value={q}
              placeholder="Escaneá un código o escribí el nombre…"
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className={c.campo}>
            <label htmlFor="expl-prov">Proveedor</label>
            <select id="expl-prov" value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
              <option value="">Todos</option>
              {store.state.proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div className={c.campo}>
            <label htmlFor="expl-cat">Categoría</label>
            <select id="expl-cat" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="">Todas</option>
              {opciones.categorias.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
          <div className={c.campo}>
            <label htmlFor="expl-marca">Marca</label>
            <select id="expl-marca" value={marca} onChange={(e) => setMarca(e.target.value)}>
              <option value="">Todas</option>
              {opciones.marcas.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className={c.campo}>
            <label>Stock</label>
            <label className={c.tilde}>
              <input type="checkbox" checked={soloConStock} onChange={(e) => setSoloConStock(e.target.checked)} />
              Solo lo que <strong>{origen?.nombre ?? 'el origen'}</strong> puede mandar
            </label>
          </div>
        </div>

        <div className={c.lista}>
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
          >
            {pag.visibles.map(({ clave, p, pres }) => {
              // ORIGEN: lo que puede MANDAR. En un granel es siempre el granel
              // suelto, también en la fila de un tamaño: el paquete se fracciona
              // del madre al preparar.
              const enOrigen = puedeMandar(store, p, origenId);
              // DESTINO: lo que TIENE en esa forma — los paquetes de ese tamaño.
              const aca = destinoId ? store.cant(p.id, destinoId, pres ? pres.id : null, 'disponible') : 0;
              /*
               * El granel SUELTO que tiene el destino. Va como info debajo de su
               * stock porque la fila de la madre ya no está para decirlo: sin
               * esto, "2 paq. de 500 g" esconde que el local además tiene 123 kg
               * sin envasar, y se pide de más.
               */
              const sueltoDestino = pres && destinoId ? store.cant(p.id, destinoId, null, 'disponible') : 0;
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
                    {sueltoDestino > 1e-9 && (
                      <div className={c.suelto}>(hay {store.fmtCant(p, null, sueltoDestino)} a granel)</div>
                    )}
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
        </div>

        {/* El paginador va FUERA del scroll: si viaja con la lista hay que
            llegar al final de la página para enterarse de que hay 14 más. El
            contador y el "limpiar" van acá y no arriba, por la misma razón que
            los filtros van en una fila — cada línea fija le come alto a la
            lista. */}
        <div className={c.pie}>
          <span className={s.muted} style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
            <strong>{filas.length}</strong> artículo(s){hayFiltro ? ' con esos filtros' : ''}
          </span>
          {hayFiltro && <Btn small variant="btn-ghost" onClick={limpiar}>Limpiar filtros</Btn>}
          <span className={c.espacio} />
          <Paginador pag={pag} />
        </div>
      </div>
    </ModalShell>
  );
}
