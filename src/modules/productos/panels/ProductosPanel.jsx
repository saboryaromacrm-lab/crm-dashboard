import { useEffect, useMemo, useState } from 'react';
import { Tabs, Tab } from '@mui/material';
import { cx } from '@shared/utils/classNames.js';
import { descargarCsv, csvNum } from '@shared/utils/csv.js';
import { useProductos } from '../context/ProductosContext.jsx';
import { FormatosPorProveedorPanel } from './FormatosPorProveedorPanel.jsx';
import { num } from '../domain/format.js';
import { ESTADOS_PRODUCTO } from '../domain/constants.js';
import {
  Table, PanelHead, TipoBadge, EstadoProductoBadge, Btn, Pill, usePaginado, s,
} from '../components/ui.jsx';

/** Texto comparable: sin mayúsculas ni acentos. */
const norm = (v) => (v || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

/**
 * GRANEL SIN FRACCIONADOS (30/9/2026, pedido del dueño): ningún granel se
 * vende suelto — todos se venden en sus paquetes (los hijos, las
 * presentaciones). Una madre sin hijos no se puede fraccionar ni vender: su
 * stock queda trabado. Fuera de la regla: lo archivado (ya no está en juego)
 * y lo exclusivo de Coffit (se consume en la cafetería, no va al mostrador).
 */
const faltanFraccionados = (p) => p.tipo === 'granel' && !p.soloCafeteria
  && (p.estado || 'activo') !== 'archivado' && !(p.presentaciones || []).length;

/**
 * ENTEROS SIN BULTO (1/10/2026): la caja sugiere precio mayorista cuando el
 * ticket lleva la caja cerrada de un producto. El bulto sale de la ficha (el
 * del DUN) o, si no está, de la caja del proveedor que define el costo — la
 * misma cuenta que `bultoCerrado` en el servidor. Sin ninguno de los dos, ese
 * producto no entra por bulto: esta lista dice cuáles son para cargarlos.
 */
function bultoDe(p) {
  if (p.tipo === 'granel') return 0;
  if ((Number(p.unidadesPorBulto) || 0) > 1) return Number(p.unidadesPorBulto);
  const arr = p.formatosCompra || [];
  const activo = arr.find((e) => e.usarParaPrecio) || [...arr].sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0))[0];
  const c = Number(activo?.cantidad) || 0;
  return c > 1 && Number.isInteger(c) ? c : 0;
}
const faltaBulto = (p) => p.tipo !== 'granel' && !p.soloCafeteria && !p.origenCafeteria
  && (p.estado || 'activo') !== 'archivado' && bultoDe(p) === 0;

/**
 * Los kg sueltos disponibles de cada madre (todas las sucursales), en UNA
 * pasada por el stock: `store.suma` por producto recorrería el stock entero
 * cientos de veces.
 */
function kgPorMadre(stock) {
  const m = new Map();
  for (const x of stock) {
    if (x.presentacionId || x.estado !== 'disponible') continue;
    m.set(x.productoId, (m.get(x.productoId) || 0) + (Number(x.cantidad) || 0));
  }
  return m;
}

/**
 * El aviso de arriba: cuántos granel no tienen fraccionados y cuántos kg
 * quedan trabados. Un clic filtra la lista. Se calcula con el catálogo ya
 * cargado (cada producto trae sus presentaciones): no pide nada a la red.
 */
function AvisoSinFraccionados({ activo, onVer, kgDe }) {
  const { store } = useProductos();
  const { cantidad, kg } = useMemo(() => {
    let n = 0; let k = 0;
    for (const p of store.state.productos) {
      if (!faltanFraccionados(p)) continue;
      n += 1; k += kgDe.get(p.id) || 0;
    }
    return { cantidad: n, kg: k };
  }, [store.state.productos, kgDe]);
  if (!cantidad) return null;
  return (
    <div className={cx(s.callout, s.warn)} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', margin: 0 }}>
      <span>
        <strong>
          {cantidad === 1 ? 'Un producto a granel no tiene' : `${num(cantidad, 0)} productos a granel no tienen`} fraccionados
        </strong>{' '}
        (sus paquetes para vender): no se {cantidad === 1 ? 'puede' : 'pueden'} fraccionar ni vender.
        {kg > 0 && <> Hay <strong>{num(kg, 2)} kg</strong> en stock esperando.</>}
      </span>
      {!activo && <Btn small variant="btn-primary" onClick={onVer}>Ver cuáles</Btn>}
    </div>
  );
}

/**
 * Los discontinuados que ya se agotaron: el sistema los DETECTA y los propone,
 * no los archiva solo. Archivar en el acto de vender la última unidad rompería
 * al cajero (el catálogo del POS se carga al abrir la caja) y una devolución o
 * la anulación de ese mismo ticket devolvería el stock. El camino de vuelta sí
 * es automático: si reaparece stock, el producto se reabre solo.
 */
function AvisoParaArchivar() {
  const { store, act } = useProductos();
  const [datos, setDatos] = useState(null);
  const version = store.getVersion?.() ?? 0;

  useEffect(() => {
    let vivo = true;
    store.sugerenciasArchivado()
      .then((r) => { if (vivo) setDatos(r); })
      .catch(() => { if (vivo) setDatos(null); });
    return () => { vivo = false; };
  }, [store, version]);

  const lista = datos?.productos ?? [];
  if (!lista.length) return null;

  const archivar = () => act(
    store.archivarLote(lista.map((p) => p.id)),
    `${lista.length === 1 ? 'Producto archivado' : `${lista.length} productos archivados`}.`,
  );

  return (
    <div className={cx(s.callout, s.info)} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
      <span>
        <strong>
          {lista.length === 1
            ? 'Un producto discontinuado se agotó'
            : `${lista.length} productos discontinuados se agotaron`}
        </strong>{' '}
        y {lista.length === 1 ? 'no tuvo' : 'no tuvieron'} movimiento en {datos.diasGracia} días:{' '}
        {lista.slice(0, 4).map((p) => p.nombre).join(', ')}
        {lista.length > 4 ? ` y ${lista.length - 4} más` : ''}.{' '}
        {lista.length === 1 ? 'Archivarlo lo saca' : 'Archivarlos los saca'} del catálogo
        (se {lista.length === 1 ? 'puede' : 'pueden'} reactivar).
      </span>
      <Btn variant="btn-primary" small onClick={archivar}>
        Archivar {lista.length === 1 ? 'el producto' : `los ${lista.length}`}
      </Btn>
    </div>
  );
}

function CatalogoProductos() {
  const { store, isAdmin, openModal } = useProductos();
  const [q, setQ] = useState('');
  const [tipo, setTipo] = useState('');
  const [marca, setMarca] = useState('');
  const [categoria, setCategoria] = useState('');
  const [proveedorId, setProveedorId] = useState('');
  /**
   * Por defecto el listado muestra lo que ESTÁ EN JUEGO (activo +
   * discontinuado): el archivado ya no se compra ni se vende, y tenerlo
   * mezclado obliga a leer un catálogo lleno de cosas que no existen. Se ve
   * eligiéndolo en el filtro — que es también el camino para reactivarlo.
   */
  const [estadoF, setEstadoF] = useState('vigentes');
  /**
   * CONTROL DE STOCK (0129): 'con' / 'sin' miran el control EFECTIVO —el
   * propio del producto o, si no tiene, la llave general de su tipo—, el mismo
   * que aplica la caja. 'propio' = los que tienen uno elegido a mano.
   */
  const [controlF, setControlF] = useState('');

  /** Opciones de los filtros, derivadas del catálogo ya cargado (sin red). */
  const opciones = useMemo(() => {
    const marcas = new Set();
    const categorias = new Set();
    for (const p of store.state.productos) {
      if (p.marca) marcas.add(p.marca);
      if (p.categoria) categorias.add(p.categoria);
    }
    return { marcas: [...marcas].sort(), categorias: [...categorias].sort() };
  }, [store.state.productos]);

  const kgDe = useMemo(() => kgPorMadre(store.state.stock), [store.state.stock]);
  const sinHijos = tipo === 'sin-hijos';
  const sinBulto = tipo === 'sin-bulto';

  const productos = useMemo(() => {
    const ql = norm(q);
    const provId = proveedorId ? Number(proveedorId) : null;
    const lista = store.state.productos.filter((p) => {
      const est = p.estado || 'activo';
      if (estadoF === 'vigentes' && est === 'archivado') return false;
      if (estadoF !== 'vigentes' && estadoF !== '' && est !== estadoF) return false;
      if (sinHijos ? !faltanFraccionados(p) : sinBulto ? !faltaBulto(p) : tipo && p.tipo !== tipo) return false;
      if (marca && p.marca !== marca) return false;
      if (categoria && p.categoria !== categoria) return false;
      if (provId && !(p.formatosCompra || []).some((e) => e.proveedorId === provId)) return false;
      if (controlF) {
        const c = store.controlDe(p);
        if (controlF === 'con' && !c.controla) return false;
        if (controlF === 'sin' && c.controla) return false;
        if (controlF === 'propio' && c.propio == null) return false;
      }
      if (!ql) return true;
      return norm(p.nombre).includes(ql) || norm(p.marca).includes(ql)
        || norm(p.categoria).includes(ql) || (p.codigoBarras || '').includes(q.trim())
        // También por el código de barras de un fraccionado: cada tamaño lleva
        // etiqueta propia y es lo que la balanza o la caja escanean.
        || (p.presentaciones || []).some((pr) => pr.codigoBarras && pr.codigoBarras.includes(q.trim()));
    });
    // Sin fraccionados: primero lo que más kg tiene trabados, que es lo más urgente.
    return sinHijos
      ? lista.sort((a, b) => (kgDe.get(b.id) || 0) - (kgDe.get(a.id) || 0) || a.nombre.localeCompare(b.nombre, 'es'))
      : lista;
    // `configVentas`: el control efectivo depende de las llaves generales.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.state.productos, store.state.configVentas, q, tipo, sinHijos, sinBulto, kgDe, marca, categoria, proveedorId, estadoF, controlF]);

  /*
   * CADA FRACCIONADO ES UNA FILA PROPIA (decisión del dueño, 9/8/2026): el
   * Ajo X500G se busca y se abre como un producto más, debajo de su madre.
   * El listado pasa de ~94 a ~167 filas — a cambio, lo que se escanea existe.
   */
  const filasLista = useMemo(() => {
    const out = [];
    for (const p of productos) {
      out.push({ clave: `p${p.id}`, p, pr: null });
      if (p.tipo === 'granel') {
        for (const pr of (p.presentaciones || [])) out.push({ clave: `f${pr.id}`, p, pr });
      }
    }
    return out;
  }, [productos]);

  const hayFiltro = !!(q || tipo || marca || categoria || proveedorId || controlF || estadoF !== 'vigentes');
  const stop = (e) => e.stopPropagation();

  /**
   * EXPORTAR A CSV (23/9/2026) — exactamente lo que se está mirando, filtros
   * incluidos: sale de `productos`, la misma lista filtrada que arma la
   * tabla, y no de `filasLista` (esa además desdobla cada fraccionado en su
   * propia fila para escanear, algo que acá no aporta — es un listado de
   * productos, no de códigos de barras).
   *
   * El precio de venta sale de `precioBaseVenta` + `precioFinal`, los mismos
   * dos pasos que ya usan la ficha y el remito para mostrar "el precio": no
   * se reinventa la cuenta acá.
   *
   * Categoría, Subcategoría y Etiquetas son las tres columnas que después
   * lee «Actualizar categoría y etiquetas»: este mismo archivo, editado en
   * la planilla, es el que se vuelve a subir. Las etiquetas van separadas
   * por coma DENTRO de la celda — el delimitador del archivo es `;`, así
   * que no chocan.
   */
  const exportar = () => descargarCsv(
    'productos.csv',
    [
      'Código interno', 'Código de barras', 'Producto', 'Marca', 'Categoría', 'Subcategoría',
      'Etiquetas', 'Tipo', 'Estado', 'IVA %', 'Costo neto', 'Precio de venta', 'Disponible', 'Unidad', 'Publicado',
      'Control de stock',
    ],
    productos.map((p) => {
      const esGranel = p.tipo === 'granel';
      const disponible = esGranel
        ? store.suma({ productoId: p.id, presentacionId: null, estado: 'disponible' })
        : store.suma({ productoId: p.id, estado: 'disponible' });
      return [
        p.codigoPropio || '', p.codigoBarras || '', p.nombre, p.marca || '', p.categoria || '',
        p.subcategoria || '', (p.etiquetasNombres || []).join(', '), esGranel ? 'A granel' : 'Entero',
        ESTADOS_PRODUCTO[p.estado]?.label || 'Activo', csvNum(p.iva ?? 21, 1),
        csvNum(p.costoNeto, 2), csvNum(store.precioGondola(p), 2),
        csvNum(disponible, 2), esGranel ? 'kg' : 'u.', p.publicado ? 'Sí' : 'No',
        textoControl(store.controlDe(p)),
      ];
    }),
  );

  const pag = usePaginado(filasLista, 'productos', `${q}|${tipo}|${marca}|${categoria}|${proveedorId}|${estadoF}|${controlF}`);

  const filas = pag.visibles.map(({ clave, p, pr }) => {
    if (pr) {
      const disp = store.suma({ productoId: p.id, presentacionId: pr.id, estado: 'disponible' });
      return (
        <tr key={clave} className={s.clickable} onClick={() => openModal('fraccionado', { prodId: p.id, presId: pr.id })}>
          <td className={s.muted}>{p.id}</td>
          <td>
            <span className={s.muted}>↳ </span>{p.nombre} · {store.presLabel(p, pr.id)}
          </td>
          <td>{p.marca || '—'}</td>
          <td><span className={cx(s.badge, s['badge-granel'])}>Fraccionado</span></td>
          <td>{p.categoria}</td>
          <td className={s.num}>{num(p.iva ?? 21, 1)}%</td>
          <td className={s.num}>
            {num(disp, 0)} paq.
            <NotaSinControl c={store.controlDe(p)} />
          </td>
          <td className={s['actions-col']}><span className={s.muted}>—</span></td>
        </tr>
      );
    }
    const base = p.tipo === 'granel'
      ? store.suma({ productoId: p.id, presentacionId: null, estado: 'disponible' })
      : store.suma({ productoId: p.id, estado: 'disponible' });
    return (
      <tr key={clave} className={s.clickable} onClick={() => openModal('detalleProducto', { prodId: p.id })}>
        <td>{p.id}</td>
        <td>
          {p.nombre}
          <EstadoProductoBadge estado={p.estado} />
          {faltanFraccionados(p) && <span style={{ marginLeft: 6 }} title="No tiene paquetes para vender: no se puede fraccionar ni vender"><Pill pill="st-defectuoso" label="Sin fraccionados" /></span>}
          <ControlPropioBadge c={store.controlDe(p)} />
        </td>
        <td>{p.marca || '—'}</td>
        <td><TipoBadge prod={p} /></td>
        <td>{p.categoria}</td>
        <td className={s.num}>{num(p.iva ?? 21, 1)}%</td>
        <td className={s.num}>
          {num(base, 2)}{p.tipo === 'granel' ? ' kg' : ' u.'}
          <NotaSinControl c={store.controlDe(p)} />
        </td>
        <td className={s['actions-col']}>
          <div className={s['row-actions']} onClick={stop}>
            {isAdmin ? (
              <>
                {faltanFraccionados(p) && (
                  <Btn variant="btn-primary" small onClick={() => openModal('detalleProducto', { prodId: p.id, pestana: 'Presentaciones' })}>
                    Crear fraccionados
                  </Btn>
                )}
                <Btn variant="btn-edit" small onClick={() => openModal('producto', { prodId: p.id })}>Editar</Btn>
                {(p.estado || 'activo') === 'activo' ? (
                  <Btn small onClick={() => openModal('bajaProducto', { prodId: p.id })}>Dar de baja</Btn>
                ) : (
                  <Btn variant="btn-ingreso" small onClick={() => openModal('bajaProducto', { prodId: p.id })}>
                    Reactivar
                  </Btn>
                )}
              </>
            ) : (
              <span className={s.muted}>—</span>
            )}
          </div>
        </td>
      </tr>
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Productos"
        desc="Catálogo. Clic en una fila para ver el detalle, stock por sucursal y trazabilidad."
        actions={isAdmin && (
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={() => openModal('margenesMasivos', { productos })}>Actualizar márgenes</Btn>
            <Btn onClick={() => openModal('importarCatalogo', {})}>Importar catálogo</Btn>
            <Btn onClick={() => openModal('importarCostos', {})}>Actualizar costos</Btn>
            <Btn onClick={() => openModal('importarFormatosVenta', {})}>Actualizar formatos de venta</Btn>
            <Btn onClick={() => openModal('actualizarClasificacion', {})}>Actualizar categoría y etiquetas</Btn>
            <Btn onClick={exportar} disabled={!productos.length}>Exportar CSV</Btn>
            <Btn variant="btn-primary" onClick={() => openModal('producto', {})}>+ Nuevo producto</Btn>
          </div>
        )}
      />
      {isAdmin && <AvisoParaArchivar />}
      <AvisoSinFraccionados kgDe={kgDe} activo={sinHijos} onVer={() => { setTipo('sin-hijos'); setEstadoF('vigentes'); }} />
      <div className={s.toolbar}>
        <input type="search" placeholder="Buscar por nombre, marca o código..." value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={s['select-inline']} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          <option value="">Todas las categorías</option>
          {opciones.categorias.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className={s['select-inline']} value={marca} onChange={(e) => setMarca(e.target.value)}>
          <option value="">Todas las marcas</option>
          {opciones.marcas.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select className={s['select-inline']} value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
          <option value="">Todos los proveedores</option>
          {store.state.proveedores
            .filter((p) => p.proveeMercaderia !== false)
            .map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        {/* El estado: por defecto lo que está en juego. Acá se llega a los
            archivados, que es el camino para reactivar uno. */}
        <select className={s['select-inline']} value={estadoF} onChange={(e) => setEstadoF(e.target.value)}>
          <option value="vigentes">En juego (activos + discontinuados)</option>
          <option value="activo">Solo activos</option>
          <option value="discontinuado">Solo discontinuados</option>
          <option value="archivado">Solo archivados</option>
          <option value="">Todos, incluso archivados</option>
        </select>
        <select className={s['select-inline']} value={controlF} onChange={(e) => setControlF(e.target.value)} aria-label="Control de stock">
          <option value="">Con y sin control de stock</option>
          <option value="con">Con control de stock</option>
          <option value="sin">Sin control de stock</option>
          <option value="propio">Con control propio (elegido a mano)</option>
        </select>
        <select className={s['select-inline']} value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">Todos los tipos</option>
          <option value="granel">A granel</option>
          <option value="entero">Enteros</option>
          <option value="sin-hijos">A granel sin fraccionados</option>
          <option value="sin-bulto">Enteros sin bulto (no entran al mayorista por bulto)</option>
        </select>
        {/* `estadoF` también se limpia: `hayFiltro` lo cuenta, así que el botón
            APARECÍA cuando lo único cambiado era el estado — y al hacer clic no
            pasaba nada. Un botón que se muestra y no hace nada es peor que no
            tenerlo. Vuelve a 'vigentes', que es el default, no a ''. */}
        {hayFiltro && (
          <Btn
            small
            onClick={() => {
              setQ(''); setTipo(''); setMarca(''); setCategoria(''); setProveedorId('');
              setControlF(''); setEstadoF('vigentes');
            }}
          >
            Limpiar
          </Btn>
        )}
      </div>
      {hayFiltro && (
        <div className={s.hint} style={{ margin: 0 }}>
          {productos.length} de {store.state.productos.length} productos.
          {sinHijos && ' Primero los que más kg tienen en stock esperando. Al guardar sus fraccionados, salen solos de esta lista.'}
          {sinBulto && ' Sin bulto la caja no les sugiere precio mayorista por caja cerrada. Se carga en la ficha («Unidades por bulto») o en la caja del proveedor; al guardar, salen solos de esta lista.'}
          {controlF === 'con' && ' Con control: la caja, el almacén y la tienda frenan si no alcanza el stock.'}
          {controlF === 'sin' && ' Sin control: se venden, fraccionan y mueven aunque no haya stock (el stock se sigue registrando y puede quedar en negativo).'}
          {controlF === 'propio' && ' Tienen el control elegido en su ficha: no siguen a las llaves generales de Ventas › Configuración.'}
          {controlF && ' Se cambia en el detalle de cada producto (pestaña Resumen).'}
          {isAdmin && ' «Actualizar márgenes» y «Exportar CSV» alcanzan solo a los filtrados.'}
        </div>
      )}
      <Table
        cols={[
          { h: 'ID' }, { h: 'Producto' }, { h: 'Marca' }, { h: 'Tipo' }, { h: 'Categoría' },
          { h: 'IVA', num: true }, { h: 'Disp. (base)', num: true },
          { h: 'Acciones', cls: 'actions-col' },
        ]}
        empty="No hay productos."
        pag={pag}
      >
        {filas}
      </Table>
    </div>
  );
}

/*
 * DOS PESTAÑAS (28/9/2026, pedido del dueño): el catálogo de siempre y la guía
 * de formatos de venta por proveedor — importar de a un proveedor, con muchos
 * proveedores, necesitaba una lista de control para no perderse.
 */
const TAB_KEY = 'crm.productos.tab';

/* ---- Control de stock en la lista (0129) ---- */
/** El texto del control efectivo, para el CSV. */
function textoControl(c) {
  return `${c.controla ? 'Con control' : 'Sin control'} (${c.propio == null ? 'configuración general' : 'propio del producto'})`;
}
/** Solo cuando el producto tiene control PROPIO: si sigue a la llave general no hay nada que destacar. */
function ControlPropioBadge({ c }) {
  if (c.propio == null) return null;
  return (
    <span style={{ marginLeft: 6 }} title="Control de stock elegido en la ficha del producto: no sigue a la configuración general">
      <Pill pill={c.propio ? 'st-disponible' : 'st-comprometido'} label={c.propio ? 'Controla stock' : 'Sin control de stock'} />
    </span>
  );
}
/** Debajo del disponible: avisa que ese número no frena nada. */
function NotaSinControl({ c }) {
  if (c.controla) return null;
  return <div className={s.hint} style={{ margin: 0 }} title="Se vende aunque no alcance">sin control</div>;
}

export function ProductosPanel() {
  const { can } = useProductos();
  const veGuia = can('compras.productos');
  const [tab, setTab] = useState(() => {
    try { return sessionStorage.getItem(TAB_KEY) || 'catalogo'; } catch { return 'catalogo'; }
  });
  const elegir = (v) => {
    setTab(v);
    try { sessionStorage.setItem(TAB_KEY, v); } catch { /* sin storage: arranca en el catálogo */ }
  };
  const activa = veGuia ? tab : 'catalogo';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      {veGuia && (
        <Tabs
          value={activa}
          onChange={(e, v) => elegir(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 40 }}
        >
          <Tab value="catalogo" label="Catálogo" sx={{ minHeight: 40, textTransform: 'none', fontWeight: 600 }} />
          <Tab value="formatos" label="Formatos de venta por proveedores" sx={{ minHeight: 40, textTransform: 'none', fontWeight: 600 }} />
        </Tabs>
      )}
      {activa === 'formatos' ? <FormatosPorProveedorPanel /> : <CatalogoProductos />}
    </div>
  );
}
