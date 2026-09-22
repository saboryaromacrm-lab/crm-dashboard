/**
 * FRACCIONAMIENTO — dos cosas que pasan juntas pero NO son la misma
 * ============================================================================
 *   Fraccionar → mueve stock: descuenta granel y crea paquetes.
 *   Etiquetas  → NO mueve NADA: es una impresora, y por eso vive aparte.
 *
 * Están separadas a pedido del dueño y por el error humano que evita: si sacar
 * etiquetas descontara stock, cada etiqueta arruinada, cada prueba de impresión
 * y cada rollo mal cargado dejaría el inventario mintiendo. Acá se imprime lo
 * que se quiera, todas las veces que se quiera, y el stock lo sigue moviendo
 * únicamente quien fracciona.
 */
import { useEffect, useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { analizarCodigo } from '@core/services/barcode.js';
import { httpClient } from '@core/services/httpClient.js';
import {
  MAX_ETIQUETAS, configImpresion, cuerpoEtiquetas, formatoPorDefecto,
  htmlDocumento, imprimirDocumento, invalidarConfigImpresion, medidaEtiqueta,
  plantillaFraccionadoGuardada,
} from '@core/services/imprimir.js';
import { useProductos } from '../context/ProductosContext.jsx';
import { useSeccion } from '../hooks/useSeccion.js';
import { money, num, fmtFechaHora, fmtFechaVenc, fmtTam } from '../domain/format.js';
import { Table, PanelHead, Stat, Btn, usePaginado, s } from '../components/ui.jsx';
import { DisenadorEtiquetaFraccionado } from '../components/DisenadorEtiquetaFraccionado.jsx';
import { AyudaEncabezadoNavegador } from '../components/AyudaEncabezado.jsx';

/** Texto comparable: sin mayúsculas ni acentos. */
const norm = (v) => (v || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

const PESTANAS = [
  { id: 'fraccionar', label: 'Fraccionar' },
  { id: 'catalogo', label: 'Por categoría y gramaje' },
  { id: 'etiquetas', label: 'Etiquetas' },
];

/** Módulo (barra fina) mínimo para que una térmica de 203 dpi lea seguro. */
const MODULO_MIN_MM = 0.25;

export function FraccionamientoPanel() {
  const { store, can, openModal } = useProductos();
  useSeccion('movimientos');
  const puede = can('fraccionar');
  const [pestana, setPestana] = useState('fraccionar');

  /*
   * LOS PAQUETES SIN PRECIO. El formato de venta del paquete arrancó en blanco
   * (decisión del dueño al separarlo de la madre), así que el sistema tiene que
   * decir cuántos faltan: un paquete sin precio no lo vende la caja y sale con la
   * etiqueta en blanco. Sin este contador, uno se entera porque un cliente no
   * pudo comprar.
   */
  const sinPrecio = store.state.productos.flatMap((p) => (p.presentaciones || [])
    .filter((pr) => pr.precioFinal == null)
    .map((pr) => ({ p, pr })));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Fraccionamiento"
        desc="Convertí granel en paquetes en la misma sucursal, y sacá las etiquetas de los paquetes. Fraccionar mueve stock; imprimir etiquetas no toca nada."
      />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {PESTANAS.map((v) => (
          <button
            key={v.id}
            type="button"
            className={cx(s.badge)}
            style={{
              cursor: 'pointer', padding: '7px 14px', fontSize: 13, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--crm-color-border)',
              ...(pestana === v.id
                ? { background: 'var(--crm-color-primary)', color: 'var(--crm-color-primary-contrast)', borderColor: 'var(--crm-color-primary)' }
                : {}),
            }}
            onClick={() => setPestana(v.id)}
          >
            {v.label}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        {sinPrecio.length > 0 && (
          <button
            type="button"
            className={cx(s.badge)}
            title="Ver los paquetes que todavía no tienen formato de venta"
            style={{
              cursor: 'pointer', padding: '7px 14px', fontSize: 13, borderWidth: 1, borderStyle: 'solid',
              borderColor: 'var(--crm-color-danger)', color: 'var(--crm-color-danger)', fontWeight: 700,
              ...(pestana === 'sinPrecio'
                ? { background: 'var(--crm-color-danger)', color: '#fff' }
                : {}),
            }}
            onClick={() => setPestana('sinPrecio')}
          >
            {sinPrecio.length} sin precio
          </button>
        )}
      </div>

      {pestana === 'fraccionar' && <TabFraccionar puede={puede} />}
      {pestana === 'catalogo' && <TabPorCategoria />}
      {pestana === 'etiquetas' && <TabEtiquetas puede={puede} />}
      {pestana === 'sinPrecio' && <TabSinPrecio filas={sinPrecio} store={store} openModal={openModal} />}
    </div>
  );
}

/* ====================== POR CATEGORÍA Y GRAMAJE ====================== *
 *
 * La otra forma de mirar los fraccionados: no producto por producto, sino
 * agrupados. Son dos preguntas distintas que se hacen todo el tiempo y que la
 * lista plana no contesta:
 *
 *   · "de yerba, ¿cuántos paquetes tengo y de qué tamaños?"  → categoría › gramaje
 *   · "de medio kilo, ¿cuánto hay en total?"                 → gramaje › categoría
 *
 * Por eso el orden se da vuelta en vez de elegir uno: la misma información
 * contestando dos preguntas, sin tener que armar una segunda pantalla.
 *
 * EL STOCK POR SUCURSAL ES OPCIONAL y arranca apagado. Con cinco sucursales la
 * tabla se va de ancho, y la pregunta más común —cuánto hay en total— se
 * responde peor con cinco columnas que con una.
 *
 * Todo sale del snapshot que ya está en memoria: esta pestaña no le pide nada
 * al servidor.
 */
function TabPorCategoria() {
  const { store, openModal } = useProductos();
  const sucursales = store.state.sucursales;

  const [q, setQ] = useState('');
  const [orden, setOrden] = useState('categoria');   // 'categoria' | 'gramaje'
  const [porSucursal, setPorSucursal] = useState(false);
  const [ocultarCeros, setOcultarCeros] = useState(false);
  const [cerrados, setCerrados] = useState(() => new Set());

  const version = store.getVersion?.() ?? 0;

  /* Un renglón por paquete, ya valuado. Agrupar y sumar después es sobre esto. */
  const paquetes = useMemo(() => {
    const ql = norm(q);
    const filas = [];
    for (const p of store.state.productos) {
      if (p.tipo !== 'granel' || !(p.presentaciones || []).length) continue;
      if ((p.estado || 'activo') === 'archivado') continue;
      if (ql && !norm(p.nombre).includes(ql) && !norm(p.marca).includes(ql)
        && !norm(p.categoria).includes(ql)) continue;
      for (const pr of p.presentaciones) {
        const porSuc = sucursales.map((su) => store.cant(p.id, su.id, pr.id, 'disponible'));
        const total = porSuc.reduce((a, x) => a + x, 0);
        if (ocultarCeros && total <= 1e-9) continue;
        filas.push({
          p,
          pr,
          porSuc,
          total,
          categoria: p.categoria || 'Sin categoría',
          /* La clave del gramaje son los KILOS, no la etiqueta: "500 g" y
             "0,5 kg" son el mismo tamaño y tienen que caer en el mismo grupo. */
          tamKg: Number(pr.tamKg) || 0,
        });
      }
    }
    return filas;
  }, [store, version, q, ocultarCeros, sucursales]);

  /* Los dos niveles, en el orden elegido. */
  const grupos = useMemo(() => {
    const porCat = orden === 'categoria';
    const claveN1 = porCat ? (f) => f.categoria : (f) => fmtTam(f.tamKg);
    const claveN2 = porCat ? (f) => fmtTam(f.tamKg) : (f) => f.categoria;
    /* Los gramajes ordenan por TAMAÑO, de mayor a menor, como se apila en el
       depósito. Ordenar "1 kg, 250 g, 500 g" por texto es exactamente lo que
       vuelve inútil una lista de tamaños. Las categorías, alfabético. */
    const ordN1 = porCat ? (a, b) => a.nombre.localeCompare(b.nombre) : (a, b) => b.orden - a.orden;
    const ordN2 = porCat ? (a, b) => b.orden - a.orden : (a, b) => a.nombre.localeCompare(b.nombre);

    const mapa = new Map();
    for (const f of paquetes) {
      const n1 = claveN1(f);
      if (!mapa.has(n1)) {
        mapa.set(n1, { nombre: n1, orden: porCat ? 0 : f.tamKg, total: 0, distintos: 0, porSuc: sucursales.map(() => 0), hijos: new Map() });
      }
      const g1 = mapa.get(n1);
      g1.total += f.total;
      g1.distintos += 1;
      f.porSuc.forEach((n, i) => { g1.porSuc[i] += n; });

      const n2 = claveN2(f);
      if (!g1.hijos.has(n2)) {
        g1.hijos.set(n2, { nombre: n2, orden: porCat ? f.tamKg : 0, total: 0, porSuc: sucursales.map(() => 0), filas: [] });
      }
      const g2 = g1.hijos.get(n2);
      g2.total += f.total;
      f.porSuc.forEach((n, i) => { g2.porSuc[i] += n; });
      g2.filas.push(f);
    }
    const lista = [...mapa.values()].sort(ordN1);
    for (const g1 of lista) {
      g1.hijos = [...g1.hijos.values()].sort(ordN2);
      for (const g2 of g1.hijos) g2.filas.sort((a, b) => a.p.nombre.localeCompare(b.p.nombre));
    }
    return lista;
  }, [paquetes, orden, sucursales]);

  const totales = useMemo(() => ({
    distintos: paquetes.length,
    enStock: paquetes.reduce((a, f) => a + f.total, 0),
    gramajes: new Set(paquetes.map((f) => f.tamKg)).size,
    categorias: new Set(paquetes.map((f) => f.categoria)).size,
  }), [paquetes]);

  const alternar = (nombre) => setCerrados((c) => {
    const n = new Set(c);
    if (n.has(nombre)) n.delete(nombre); else n.add(nombre);
    return n;
  });

  const cols = [
    { h: orden === 'categoria' ? 'Categoría · gramaje · producto' : 'Gramaje · categoría · producto' },
    { h: 'Código' },
    ...(porSucursal ? sucursales.map((su) => ({ h: su.nombre, num: true })) : []),
    { h: 'Total', num: true },
  ];

  /* El cero se atenúa: lo que HAY tiene que saltar a la vista. */
  const celda = (n, clave, peso) => (
    <td key={clave} className={cx(s.num, s.mono)} style={{ opacity: n > 1e-9 ? 1 : 0.3, fontWeight: peso }}>
      {num(n, 0)}
    </td>
  );

  const filas = [];
  for (const g1 of grupos) {
    const plegado = cerrados.has(g1.nombre);
    filas.push(
      <tr
        key={'g1-' + g1.nombre}
        className={s.clickable}
        onClick={() => alternar(g1.nombre)}
        style={{ background: 'rgba(127,127,127,.07)' }}
      >
        <td colSpan={2} style={{ fontWeight: 700 }}>
          <span style={{ display: 'inline-block', width: 15, color: 'var(--crm-color-text-muted)' }}>
            {plegado ? '▸' : '▾'}
          </span>
          {g1.nombre}
          <span className={s.muted} style={{ fontWeight: 400, marginLeft: 8, fontSize: 12 }}>
            {g1.distintos} paquete{g1.distintos === 1 ? '' : 's'} distinto{g1.distintos === 1 ? '' : 's'}
          </span>
        </td>
        {porSucursal && g1.porSuc.map((n, i) => celda(n, 'g1s' + i, 700))}
        {celda(g1.total, 'g1t', 700)}
      </tr>,
    );
    if (plegado) continue;

    for (const g2 of g1.hijos) {
      filas.push(
        <tr key={'g2-' + g1.nombre + '-' + g2.nombre}>
          <td colSpan={2} style={{ paddingLeft: 32, color: 'var(--crm-color-text-secondary)', fontWeight: 600 }}>
            {g2.nombre}
          </td>
          {porSucursal && g2.porSuc.map((n, i) => celda(n, 'g2s' + i, 600))}
          {celda(g2.total, 'g2t', 600)}
        </tr>,
      );
      for (const f of g2.filas) {
        filas.push(
          <tr
            key={'f-' + f.p.id + '-' + f.pr.id}
            className={s.clickable}
            onClick={() => openModal('productoDetalle', { prodId: f.p.id })}
          >
            <td style={{ paddingLeft: 50 }}>
              <div>{f.p.nombre}</div>
              <div className={s.muted} style={{ fontSize: 12 }}>
                {f.p.marca || 'Sin marca'}{orden === 'categoria' ? '' : ' · ' + f.categoria}
              </div>
            </td>
            <td className={s.mono} style={{ fontSize: 12 }}>{f.pr.codigoBarras || '—'}</td>
            {porSucursal && f.porSuc.map((n, i) => celda(n, 'fs' + i))}
            {celda(f.total, 'ft')}
          </tr>,
        );
      }
    }
  }

  const botonOrden = (id, texto) => (
    <button
      type="button"
      className={cx(s.badge)}
      style={{
        cursor: 'pointer', padding: '6px 12px', fontSize: 12.5,
        borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--crm-color-border)',
        ...(orden === id
          ? { background: 'var(--crm-color-primary)', color: 'var(--crm-color-primary-contrast)', borderColor: 'var(--crm-color-primary)' }
          : {}),
      }}
      onClick={() => { setOrden(id); setCerrados(new Set()); }}
    >
      {texto}
    </button>
  );

  return (
    <>
      <div className={s.stats}>
        <Stat label="Paquetes distintos" value={num(totales.distintos, 0)} />
        <Stat label="Paquetes en stock" value={num(totales.enStock, 0)} />
        <Stat label="Gramajes distintos" value={num(totales.gramajes, 0)} />
        <Stat label="Categorías" value={num(totales.categorias, 0)} />
      </div>

      <div className={s.toolbar}>
        <input
          type="search"
          value={q}
          placeholder="Buscar por producto, marca o categoría…"
          onChange={(e) => setQ(e.target.value)}
          style={{ minWidth: 230, flex: 1 }}
        />
        <span className={s.hint} style={{ margin: 0 }}>Agrupar por</span>
        {botonOrden('categoria', 'Categoría › gramaje')}
        {botonOrden('gramaje', 'Gramaje › categoría')}
        <label className={s.hint} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={porSucursal} onChange={(e) => setPorSucursal(e.target.checked)} />
          Ver stock por sucursal
        </label>
        <label className={s.hint} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={ocultarCeros} onChange={(e) => setOcultarCeros(e.target.checked)} />
          Ocultar los que están en cero
        </label>
      </div>

      <Table
        grupos={porSucursal
          ? [{ h: '', span: 2 }, { h: 'Stock por sucursal (paquetes)', span: sucursales.length + 1 }]
          : undefined}
        cols={cols}
        empty={q || ocultarCeros
          ? 'Nada coincide con el filtro.'
          : 'No hay fraccionados en el catálogo: primero cargale presentaciones al producto a granel.'}
      >
        {filas}
      </Table>

      <div className={s.hint}>
        Cuenta <strong>paquetes</strong>, no kilos: es la unidad con la que se vende y con la que
        se cuenta la góndola. El gramaje agrupa por <strong>tamaño real</strong>, así que “500 g”
        y “0,5 kg” caen juntos aunque cada producto lo escriba a su manera. Clic en un grupo para
        plegarlo; clic en un producto para abrir su ficha.
      </div>
    </>
  );
}

/* ============================== SIN PRECIO ============================== *
 * La lista de lo que falta cargar. No es un error del sistema: es trabajo
 * pendiente, y por eso lleva el atajo a la ficha donde se resuelve.
 */
function TabSinPrecio({ filas, store, openModal }) {
  const pag = usePaginado(filas, 'paquetesSinPrecio', '');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-3)' }}>
      <div className={cx(s.callout, s.warn)}>
        Estos <strong>{filas.length}</strong> paquete(s) todavía <strong>no tienen formato de venta</strong>,
        así que no tienen precio: la caja no los puede vender y la etiqueta sale sin precio. Cada paquete
        se cotiza solo — entrá a su ficha y cargale la lista con la que se vende.
      </div>
      <Table
        cols={[{ h: 'Producto' }, { h: 'Paquete' }, { h: 'Código' }, { h: 'En stock', num: true }, { h: '', cls: 'actions-col' }]}
        empty="No queda ningún paquete sin precio."
        pag={pag}
      >
        {pag.visibles.map(({ p, pr }) => (
          <tr key={`${p.id}-${pr.id}`}>
            <td>{p.nombre}{p.marca ? <span className={s.muted}> · {p.marca}</span> : null}</td>
            <td>{store.presLabel(p, pr.id)}</td>
            <td className={s.mono}>{pr.codigoBarras || <span className={s.muted}>sin código</span>}</td>
            <td className={s.num}>{num(store.suma({ productoId: p.id, presentacionId: pr.id, estado: 'disponible' }), 0)} paq.</td>
            <td className={s['actions-col']}>
              <Btn small variant="btn-primary" onClick={() => openModal('fraccionado', { prodId: p.id, presId: pr.id })}>
                Cargar precio
              </Btn>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

/* ============================== FRACCIONAR ============================== */
function TabFraccionar({ puede }) {
  const { store, openModal } = useProductos();
  const [q, setQ] = useState('');

  const ql = norm(q);
  const granel = store.state.stock
    .filter((st) => !st.presentacionId && st.estado === 'disponible' && st.cantidad > 1e-9 && store.getProducto(st.productoId).tipo === 'granel')
    .filter((st) => {
      if (!ql) return true;
      const p = store.getProducto(st.productoId);
      return norm(p.nombre).includes(ql) || norm(p.marca).includes(ql);
    });

  const pag = usePaginado(granel, 'fraccionamiento', q);

  const filas = pag.visibles.map((st) => {
      const p = store.getProducto(st.productoId), su = store.getSucursal(st.sucursalId);
      /*
       * UN GRANEL SIN TAMAÑOS NO SE PUEDE FRACCIONAR, y son muchos (62 de 164
       * al 15/8/2026): el sistema no sabe de cuántos kilos es cada paquete. Se
       * dice EN LA FILA y no recién adentro del modal, que era donde el usuario
       * se enteraba —con la sección de paquetes vacía y un botón que no hacía
       * nada—. El botón sigue estando y lleva a la explicación de qué falta y
       * dónde se carga: esconderlo dejaría el producto sin ninguna pista.
       */
      const sinTamanos = !(p.presentaciones || []).length;
      return (
        <tr key={st.id}>
          <td>
            {p.nombre}
            {sinTamanos && (
              <div className={s.hint} style={{ margin: 0, color: 'var(--crm-color-accent-2)' }}>
                sin tamaños de paquete definidos
              </div>
            )}
          </td>
          <td>{su.nombre}</td>
          <td className={s.num}>{num(st.cantidad, 3)} kg</td>
          <td className={s['actions-col']}>
            {puede
              ? (
                <Btn
                  variant={sinTamanos ? undefined : 'btn-fracc'}
                  small
                  onClick={() => openModal('fraccionar', { prodId: p.id, sucId: st.sucursalId })}
                >
                  Fraccionar
                </Btn>
              )
              : <span className={s.muted}>sin permiso</span>}
          </td>
        </tr>
      );
    });

  const hist = store.state.movimientos
    .filter((m) => m.tipo === 'fraccionamiento')
    .sort((a, b) => b.id - a.id)
    .slice(0, 8)
    .map((m) => (
      <tr key={m.id}>
        <td>{fmtFechaHora(m.fecha)}</td>
        <td>{m.productoNombre}</td>
        <td>{m.sucursalNombre}</td>
        <td>{m.descripcion}</td>
      </tr>
    ));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <div className={s.toolbar}>
        <input
          type="search"
          placeholder="Buscar por nombre o marca (filtra el granel y sus paquetes)..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <h3 className={s['card-title']}>Granel disponible para fraccionar</h3>
      <Table
        cols={[{ h: 'Producto' }, { h: 'Sucursal' }, { h: 'Granel', num: true }, { h: '', cls: 'actions-col' }]}
        empty="No hay stock a granel disponible."
        pag={pag}
      >
        {filas}
      </Table>

      <TablaPaquetes q={q} puede={puede} />

      <h3 className={s['card-title']} style={{ marginTop: 12 }}>Fraccionamientos recientes</h3>
      <Table cols={[{ h: 'Fecha' }, { h: 'Producto' }, { h: 'Sucursal' }, { h: 'Detalle' }]} empty="Sin fraccionamientos aún.">
        {hist}
      </Table>
    </div>
  );
}

/* ===================== LOS PAQUETES Y SU STOCK ===================== *
 *
 * Debajo del granel, lo que salió de él: SOLO los fraccionados, con una columna
 * por sucursal. La madre ya está arriba y su kilaje suelto no se repite acá — lo
 * que se lee en esta tabla es "cuántos paquetes hay y dónde".
 *
 * Desde acá se corrige una tanda mal cargada, que es el único lugar donde tiene
 * sentido: se ve el número que está mal.
 */
function TablaPaquetes({ q, puede }) {
  const { store, openModal } = useProductos();
  const sucursales = store.state.sucursales;

  const ql = norm(q);
  const paquetes = [];
  for (const p of store.state.productos) {
    if (p.tipo !== 'granel' || !(p.presentaciones || []).length) continue;
    if (ql && !norm(p.nombre).includes(ql) && !norm(p.marca).includes(ql)) continue;
    for (const pr of p.presentaciones) paquetes.push({ p, pr });
  }
  paquetes.sort((a, b) => a.p.nombre.localeCompare(b.p.nombre) || b.pr.tamKg - a.pr.tamKg);

  const pag = usePaginado(paquetes, 'paquetesFraccionados', q);

  return (
    <>
      <h3 className={s['card-title']} style={{ marginTop: 12 }}>Paquetes fraccionados y su stock</h3>
      <Table
        grupos={[
          { h: 'Paquete', span: 2 },
          { h: 'Stock por sucursal (paquetes)', span: sucursales.length + 1 },
          { h: '', span: 1 },
        ]}
        cols={[
          { h: 'Código' }, { h: 'Producto' },
          ...sucursales.map((su) => ({ h: su.nombre, num: true })),
          { h: 'Total', num: true },
          { h: '', cls: 'actions-col' },
        ]}
        empty="No hay fraccionados en el catálogo: primero cargale presentaciones al producto a granel."
        pag={pag}
      >
        {pag.visibles.map(({ p, pr }) => {
          const porSuc = sucursales.map((su) => store.cant(p.id, su.id, pr.id, 'disponible'));
          const total = porSuc.reduce((a, x) => a + x, 0);
          return (
            <tr key={`${p.id}-${pr.id}`}>
              <td className={s.mono} style={{ fontSize: 12 }}>{pr.codigoBarras || '—'}</td>
              <td>
                <div>{p.nombre}</div>
                <div className={s.muted} style={{ fontSize: 12 }}>
                  {store.presLabel(p, pr.id)} · {p.marca || 'Sin marca'}
                </div>
              </td>
              {porSuc.map((cantidad, i) => (
                // El cero se atenúa: lo que HAY tiene que saltar a la vista.
                <td
                  key={sucursales[i].id}
                  className={cx(s.num, s.mono)}
                  style={cantidad > 1e-9 ? undefined : { opacity: 0.35 }}
                >
                  {num(cantidad, 0)}
                </td>
              ))}
              <td className={cx(s.num, s.mono)}><strong>{num(total, 0)}</strong></td>
              <td className={s['actions-col']}>
                {puede
                  ? (
                    <Btn
                      small
                      title="Corregir una tanda mal cargada: ajusta los paquetes y devuelve los kilos al granel"
                      onClick={() => openModal('corregirFraccionado', { prodId: p.id, presId: pr.id })}
                    >
                      Corregir
                    </Btn>
                  )
                  : <span className={s.muted}>sin permiso</span>}
              </td>
            </tr>
          );
        })}
      </Table>
    </>
  );
}

/* ============================== ETIQUETAS ============================== */
/**
 * La etiqueta del paquete: nombre, peso, precio, código de barras y
 * vencimiento. Se elige el FRACCIONADO (no el producto: el peso, el precio y el
 * código son de la presentación), cuántas etiquetas y con qué fecha.
 *
 * El precio NO se tipea: sale del catálogo (lista base, IVA incluido), igual que
 * en la caja. Una etiqueta con un precio escrito a mano es un precio que en dos
 * semanas no coincide con el POS y discute con el cliente.
 */
function TabEtiquetas({ puede }) {
  const { store, toast } = useProductos();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);      // { prodId, presId }
  const [cant, setCant] = useState('1');
  const [venc, setVenc] = useState('');
  const [cfg, setCfg] = useState(null);      // config de impresión (el tamaño de la etiqueta)

  useEffect(() => { configImpresion().then(setCfg).catch(() => { /* el shell ya avisa la falta de conexión */ }); }, []);

  /* EL DISEÑADOR (25/8, "hacelo igual" que el cartel): la plantilla en mm por
   * formato, armada arrastrando. Null = diseño flexible de siempre. */
  const formatoEt = cfg?.impresion?.etiquetaFraccionado || formatoPorDefecto('etiquetaFraccionado');
  const plantilla = plantillaFraccionadoGuardada(cfg?.impresion, formatoEt);
  const [disenando, setDisenando] = useState(false);
  const [guardandoDiseno, setGuardandoDiseno] = useState(false);

  const guardarPlantilla = async (nueva) => {
    setGuardandoDiseno(true);
    try {
      let todas = {};
      try { todas = JSON.parse(cfg?.impresion?.plantillaFraccionado || '') || {}; } catch { todas = {}; }
      if (nueva) todas[formatoEt] = nueva; else delete todas[formatoEt];
      const impresion = await httpClient.put('/configuracion/impresion', {
        plantillaFraccionado: Object.keys(todas).length ? JSON.stringify(todas) : '',
      });
      invalidarConfigImpresion();
      setCfg((c) => ({ ...c, impresion }));
      setDisenando(false);
      toast(nueva
        ? 'Diseño guardado: todas las etiquetas de este tamaño salen así.'
        : 'Se volvió al diseño estándar.', 'ok');
    } catch (e) {
      toast(e?.data?.message || 'No se pudo guardar el diseño (hace falta el permiso de Impresión de Sistema).', 'err');
    } finally { setGuardandoDiseno(false); }
  };

  /* Los FRACCIONADOS del catálogo: cada presentación de un granel activo. Un
   * producto sin presentaciones no aparece — no hay etiqueta que sacarle. */
  const fraccionados = [];
  for (const p of store.state.productos) {
    if (p.tipo !== 'granel' || (p.estado || 'activo') !== 'activo') continue;
    for (const pr of p.presentaciones || []) fraccionados.push({ p, pr });
  }

  const ql = norm(q);
  const encontrados = ql
    ? fraccionados.filter(({ p, pr }) => norm(p.nombre).includes(ql) || norm(p.marca).includes(ql)
      || (pr.codigoBarras || '').includes(q.trim()))
    : fraccionados;
  const pag = usePaginado(encontrados, 'etiquetas', q);

  const elegido = sel ? fraccionados.find(({ p, pr }) => p.id === sel.prodId && pr.id === sel.presId) : null;

  const filas = pag.visibles.map(({ p, pr }) => {
    const activa = sel && sel.prodId === p.id && sel.presId === pr.id;
    return (
      <tr key={`${p.id}-${pr.id}`} style={activa ? { background: 'var(--crm-color-primary-soft, rgba(22,101,52,.08))' } : undefined}>
        <td>{p.nombre}{p.marca ? <span className={s.muted}> · {p.marca}</span> : null}</td>
        <td>{store.presLabel(p, pr.id)}</td>
        <td className={cx(s.num, s.mono)}>
          {pr.precioFinal != null
            ? money(pr.precioFinal)
            : <span style={{ color: 'var(--crm-color-danger)', fontWeight: 600 }}>sin precio</span>}
        </td>
        <td className={s.mono}>{pr.codigoBarras || <span className={s.muted}>sin código</span>}</td>
        <td className={s['actions-col']}>
          <Btn small variant={activa ? 'btn-primary' : undefined} onClick={() => setSel({ prodId: p.id, presId: pr.id })}>
            {activa ? 'Elegido' : 'Elegir'}
          </Btn>
        </td>
      </tr>
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <div className={cx(s.callout, s.info)} style={{ margin: 0 }}>
        <strong>Imprimir etiquetas no mueve stock.</strong> Sacá las que necesites, y las que salgan
        mal tiralas sin miedo: el inventario lo cambia solamente la pestaña <strong>Fraccionar</strong>.
      </div>

      <div className={s.toolbar}>
        <input
          type="search"
          placeholder="Buscar el fraccionado por nombre, marca o código de barras..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Btn onClick={() => setDisenando(true)} title="Acomodar dónde va cada elemento en la etiqueta">
          Diseñar la etiqueta
        </Btn>
      </div>
      <Table
        cols={[{ h: 'Producto' }, { h: 'Tamaño' }, { h: 'Precio', num: true }, { h: 'Código de barras' }, { h: '', cls: 'actions-col' }]}
        empty="No hay fraccionados en el catálogo: primero cargale presentaciones al producto a granel."
        pag={pag}
      >
        {filas}
      </Table>

      {elegido && (
        <FormEtiqueta
          p={elegido.p}
          pr={elegido.pr}
          store={store}
          toast={toast}
          puede={puede}
          cfg={cfg}
          cant={cant}
          setCant={setCant}
          venc={venc}
          setVenc={setVenc}
          plantilla={plantilla}
        />
      )}

      {/* ---- El diseñador: arrastrar cada elemento en la etiqueta real ---- */}
      {disenando && cfg && (
        <DisenadorEtiquetaFraccionado
          formato={formatoEt}
          inicial={plantilla}
          empresa={cfg.empresa}
          guardando={guardandoDiseno}
          muestra={elegido ? {
            nombre: elegido.p.nombre,
            peso: store.presLabel(elegido.p, elegido.pr.id),
            precio: elegido.pr.precioFinal != null ? money(elegido.pr.precioFinal) : '',
            codigo: analizarCodigo(elegido.pr.codigoBarras).codigo,
            vencimiento: venc ? fmtFechaVenc(venc) : '',
          } : null}
          onGuardar={guardarPlantilla}
          onRestaurar={() => guardarPlantilla(null)}
          onCerrar={() => setDisenando(false)}
        />
      )}
    </div>
  );
}

/** Lo que se imprime, y el aviso de por qué podría no leerse. */
function FormEtiqueta({ p, pr, store, toast, puede, cfg, cant, setCant, venc, setVenc, plantilla }) {
  const formato = cfg?.impresion?.etiquetaFraccionado || formatoPorDefecto('etiquetaFraccionado');
  const medida = medidaEtiqueta(formato);
  const info = analizarCodigo(pr.codigoBarras);
  /* El precio es del PAQUETE (su formato de venta, 0053). Si no tiene ninguno
   * cargado no hay precio que imprimir: la etiqueta sale sin él y se avisa. */
  const sinPrecio = pr.precioFinal == null;
  const precio = sinPrecio ? '' : money(pr.precioFinal);
  const peso = store.presLabel(p, pr.id);
  const n = Math.round(Number(cant) || 0);
  const cantOk = n >= 1 && n <= MAX_ETIQUETAS;

  /* Cuánto mide cada barra fina en ESTA etiqueta. Un código largo en una
   * etiqueta angosta se imprime igual de lindo y el lector no lo lee nunca. */
  const moduloMm = medida && info.modulos ? medida.anchoUtilMm / info.modulos : null;
  const finito = moduloMm != null && moduloMm < MODULO_MIN_MM;

  const datos = {
    nombre: p.nombre, peso, precio, codigo: info.codigo,
    vencimiento: venc ? fmtFechaVenc(venc) : '',
  };

  /* La MISMA función para la vista previa y para la impresora. */
  const previa = cfg
    ? htmlDocumento({ empresa: cfg.empresa, formato, titulo: 'Etiqueta', cuerpo: cuerpoEtiquetas({ ...datos, cantidad: 1, plantilla }) })
    : '';

  const imprimir = async () => {
    if (!cantOk) { toast(`Poné una cantidad de etiquetas entre 1 y ${MAX_ETIQUETAS}.`, 'err'); return; }
    const ok = await imprimirDocumento('etiquetaFraccionado', {
      titulo: `Etiquetas ${p.nombre} ${peso}`,
      cuerpo: cuerpoEtiquetas({ ...datos, cantidad: n, plantilla }),
    });
    if (!ok) { toast('El navegador bloqueó la ventana de impresión: permitile abrir ventanas emergentes.', 'err'); return; }
    toast(`${n} ${n === 1 ? 'etiqueta' : 'etiquetas'} a la impresora. El stock no se tocó.`, 'ok');
  };

  return (
    <div className={cx(s.card, s.cardPad)}>
      <h3 className={s['card-title']} style={{ marginTop: 0 }}>
        Etiquetas de {p.nombre} · {peso}
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, alignItems: 'end' }}>
        <div className={s.field} style={{ marginBottom: 0 }}>
          <label>Cantidad de etiquetas</label>
          <input
            type="number" min="1" max={MAX_ETIQUETAS} step="1" value={cant}
            onChange={(e) => setCant(e.target.value)}
          />
          <div className={s.hint} style={{ margin: '4px 0 0' }}>Una por paquete armado. Hasta {MAX_ETIQUETAS} por impresión.</div>
        </div>
        <div className={s.field} style={{ marginBottom: 0 }}>
          <label>Fecha de vencimiento</label>
          <input type="date" value={venc} onChange={(e) => setVenc(e.target.value)} />
          <div className={s.hint} style={{ margin: '4px 0 0' }}>
            {venc ? `Sale impresa: Vto ${fmtFechaVenc(venc)}` : 'Vacía: la etiqueta sale SIN fecha.'}
          </div>
        </div>
        <div className={s.field} style={{ marginBottom: 0 }}>
          <label>Precio que se imprime</label>
          {sinPrecio
            ? <strong style={{ fontSize: 15, color: 'var(--crm-color-danger)' }}>sin precio</strong>
            : <strong className={s.mono} style={{ fontSize: 16 }}>{precio}</strong>}
          <div className={s.hint} style={{ margin: '4px 0 0' }}>
            {sinPrecio
              ? 'Este paquete no tiene formato de venta: la etiqueta va a salir sin precio.'
              : <>Del formato de venta del paquete, IVA incluido{nombreListaBase(store) ? ` (lista ${nombreListaBase(store)})` : ''}. Se cambia en su ficha.</>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {puede
            ? (
              <Btn variant="btn-primary" onClick={imprimir} disabled={!cfg || !cantOk}>
                {cantOk ? `Imprimir ${n} ${n === 1 ? 'etiqueta' : 'etiquetas'}` : 'Imprimir etiquetas'}
              </Btn>
            )
            : <span className={s.muted}>sin permiso para imprimir</span>}
        </div>
      </div>

      {sinPrecio && (
        <div className={cx(s.callout, s.warn)} style={{ marginTop: 12 }}>
          <strong>Este paquete todavía no tiene precio.</strong> Se puede imprimir igual (la etiqueta sale
          con nombre, peso y código), pero va <strong>sin precio</strong> y la caja tampoco lo puede vender.
          El precio se carga en la ficha del fraccionado, pestaña <strong>Formato de venta</strong>.
        </div>
      )}
      {info.aviso && (
        <div className={cx(s.callout, info.tipo === 'ean13' ? s.ok : s.warn)} style={{ marginTop: 12 }}>
          {info.aviso}
        </div>
      )}
      {finito && (
        <div className={cx(s.callout, s.warn)} style={{ marginTop: 8 }}>
          <strong>El código puede no leerse en esta etiqueta.</strong> Ocupa {info.modulos} barras en los{' '}
          {num(medida.anchoUtilMm, 1)} mm útiles de la etiqueta de {medida.anchoMm} × {medida.altoMm} mm: cada barra
          queda en {num(moduloMm, 2)} mm y una térmica necesita {num(MODULO_MIN_MM, 2)} mm.
          Elegí una etiqueta más ancha en <strong>Sistema › Impresión</strong> o pasá el código a EAN-13.
        </div>
      )}

      <div style={{ display: 'flex', gap: 16, marginTop: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <div className={s['mini-label']}>
            Vista previa {medida ? `· etiqueta de ${medida.anchoMm} × ${medida.altoMm} mm` : ''}
          </div>
          {/* El MISMO HTML que va a la impresora, en TAMAÑO REAL: lo que se ve
              es lo que sale. `scrolling=no` y los 2 px de más son para que el
              marco del iframe no le ponga barras de scroll encima. */}
          <iframe
            title="Vista previa de la etiqueta"
            srcDoc={previa}
            scrolling="no"
            style={{
              width: medida ? `${Math.ceil(medida.anchoMm * 3.7795) + 2}px` : 200,
              height: medida ? `${Math.ceil(medida.altoMm * 3.7795) + 2}px` : 120,
              border: '1px dashed var(--crm-color-border)', background: '#fff',
            }}
          />
        </div>
        <div className={s.hint} style={{ maxWidth: 380, margin: 0 }}>
          El tamaño de la etiqueta se configura una vez en <strong>Sistema › Impresión</strong> (hoy:{' '}
          {medida ? `${medida.anchoMm} × ${medida.altoMm} mm` : 'sin definir'}), y la impresora física la
          elige cada puesto en el diálogo de impresión. Antes de tirar una tanda larga, pasale el lector
          a UNA etiqueta.
        </div>
      </div>
      <AyudaEncabezadoNavegador />
    </div>
  );
}

/** Nombre de la lista base (la del precio de mostrador), si se puede saber. */
function nombreListaBase(store) {
  const baseId = store.state.configVentas?.listaBaseId;
  const lista = (store.state.listasCatalogo?.listas ?? []).find((l) => l.id === baseId);
  return lista?.nombre || '';
}
