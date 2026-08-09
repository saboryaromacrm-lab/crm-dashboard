import { useEffect, useMemo, useState } from 'react';
import { Tabs, Tab } from '@mui/material';
import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../../context/ProductosContext.jsx';
import { useSeccion } from '../../hooks/useSeccion.js';
import { money, num, fmtFechaHora } from '../../domain/format.js';
import { IVA_OPCIONES, OPCIONES_REDONDEO_PRECIO } from '../../domain/constants.js';
import { ModalShell } from '../Modal.jsx';
import { CatalogoPicker, EtiquetasPicker } from '../CatalogoPicker.jsx';
import { CatalogoAdmin } from '../CatalogoAdmin.jsx';
import { FormatoCompraTab } from './FormatoCompraTab.jsx';
import { Table, TipoBadge, StockPill, MovTag, Btn, s } from '../ui.jsx';

/* ---- Alta / edición de producto ---- */

/** Título de sección dentro del formulario. Agrupa sin costar una pestaña. */
function Seccion({ children }) {
  return <div className={s.seccion}>{children}</div>;
}

export function ProductoFormModal({ prodId }) {
  const { store, act, closeModal, toast } = useProductos();
  const prod = prodId != null ? store.getProducto(prodId) : null;
  const ed = !!prod;
  const cat = store.state.catalogos;

  const [esGranel, setEsGranel] = useState(prod ? prod.tipo === 'granel' : false);
  const [f, setF] = useState(() => ({
    nombre: prod?.nombre || '',
    descripcion: prod?.descripcion || '',
    codigoPropio: prod?.codigoPropio || '',
    codigoBarras: prod?.codigoBarras || '',
    dun: prod?.dun || '',
    unidadesPorBulto: prod?.unidadesPorBulto != null ? String(prod.unidadesPorBulto) : '1',
    marcaId: prod?.marcaId ?? null,
    categoriaId: prod?.categoriaId ?? null,
    subcategoriaId: prod?.subcategoriaId ?? null,
    etiquetas: prod?.etiquetas || [],
    iva: prod?.iva != null ? String(prod.iva) : '21',
    // '' = heredar el redondeo de configuración, que es el caso normal.
    redondeo: prod?.redondeo == null ? '' : String(prod.redondeo),
    idExterno: prod?.idExterno || '',
    // Solo alta: crea la relación producto/proveedor de entrada, así el
    // producto ya aparece al cargar la factura de ese proveedor.
    proveedorId: '',
    costoInicial: '',
  }));
  /** Granel que NO se vende suelto: existe solo para fraccionarse. */
  const [soloFraccionar, setSoloFraccionar] = useState(!!prod?.soloFraccionar);
  /** Catálogo que se está administrando encima del formulario (o null). */
  const [admin, setAdmin] = useState(null);

  const set = (k, v) => setF((prev) => ({ ...prev, [k]: v }));

  // Cascada: al cambiar de categoría, la subcategoría elegida deja de ser
  // válida. Limpiarla acá evita guardar una combinación que el backend rechaza.
  const setCategoria = (id) => setF((prev) => ({ ...prev, categoriaId: id, subcategoriaId: null }));
  const subcategorias = useMemo(
    () => cat.subcategorias.filter((sc) => sc.categoriaId === f.categoriaId),
    [cat.subcategorias, f.categoriaId],
  );

  /**
   * Alta rápida desde el propio desplegable. `_mutate` devuelve `{ok, ...fila}`,
   * así que el `id` viene servido y el picker puede dejarlo seleccionado.
   */
  const crearEn = (tipo, extra) => async (nombre) => {
    const r = await store.crearCatalogo(tipo, { nombre, ...extra });
    if (!r || r.ok === false) { toast(r?.error || 'No se pudo crear.', 'err'); return null; }
    return r;
  };

  const generarCodigo = async () => {
    try {
      const r = await store.siguienteCodigo();
      if (r?.codigo) set('codigoPropio', r.codigo);
    } catch (e) {
      toast('No se pudo generar el código.', 'err');
    }
  };

  const guardar = () => {
    const nombre = f.nombre.trim();
    if (!nombre) { toast('El nombre es obligatorio.', 'err'); return; }
    const o = {
      nombre,
      descripcion: f.descripcion.trim(),
      codigoPropio: f.codigoPropio.trim(),
      codigoBarras: f.codigoBarras.trim(),
      dun: f.dun.trim(),
      unidadesPorBulto: Number(f.unidadesPorBulto) || 1,
      marcaId: f.marcaId,
      categoriaId: f.categoriaId,
      subcategoriaId: f.subcategoriaId,
      etiquetas: f.etiquetas,
      iva: Number(f.iva),
      redondeo: f.redondeo === '' ? null : Number(f.redondeo),
      idExterno: f.idExterno.trim(),
      esGranel,
      soloFraccionar: esGranel ? soloFraccionar : false,
    };
    if (!ed && f.proveedorId) {
      o.proveedorId = parseInt(f.proveedorId, 10);
      o.costoInicial = Number(f.costoInicial) || 0;
    }
    act(
      prod ? store.editarProducto(prod.id, o) : store.crearProducto(o),
      prod ? 'Producto actualizado.' : 'Producto creado.',
    );
  };

  return (
    <>
      <ModalShell
        title={ed ? `Editar producto #${prod.id}` : 'Nuevo producto'}
        wide
        onClose={closeModal}
        footer={[
          { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
          { texto: ed ? 'Guardar' : 'Crear', clase: 'btn-primary', onClick: guardar },
        ]}
      >
        <label className={s['granel-toggle']}>
          <input type="checkbox" checked={esGranel} disabled={ed} onChange={(e) => setEsGranel(e.target.checked)} />
          <span>
            <span className={s['t-title']}>Es un producto a granel</span><br />
            <span className={s['t-sub']}>Se vende por peso y se fracciona. Si no, es un producto entero por unidad.</span>
          </span>
        </label>
        {ed && <div className={s.hint}>El tipo no se cambia luego de crear el producto.</div>}

        {esGranel && (
          <label className={s['granel-toggle']}>
            <input type="checkbox" checked={soloFraccionar} onChange={(e) => setSoloFraccionar(e.target.checked)} />
            <span>
              <span className={s['t-title']}>Solo para fraccionar — no se vende suelto</span><br />
              <span className={s['t-sub']}>
                Llega a granel y se fracciona entero (la pimienta de Jamaica: 1 kg → 20 paquetes de
                50 g). El POS no lo ofrece por kg y la venta suelta se rechaza; sus paquetes se
                venden normal.
              </span>
            </span>
          </label>
        )}

        {/* --- Identificación --- */}
        <Seccion>Identificación</Seccion>
        <div className={s['form-grid-3']}>
          <div className={s.field}>
            <label>
              Código propio
              <button type="button" className={s.linkBtn} onClick={generarCodigo} tabIndex={-1}>Crear un código</button>
            </label>
            <input
              value={f.codigoPropio}
              onChange={(e) => set('codigoPropio', e.target.value)}
              placeholder="Interno"
            />
          </div>
          <div className={s.field}>
            <label>Código de barras</label>
            <input
              value={f.codigoBarras}
              onChange={(e) => set('codigoBarras', e.target.value)}
              placeholder="EAN de la unidad"
            />
          </div>
          <div className={s.field}>
            <label>DUN</label>
            <input value={f.dun} onChange={(e) => set('dun', e.target.value)} placeholder="EAN del bulto" />
          </div>
        </div>
        <div className={s.hint}>
          Los tres tienen que ser únicos entre sí y contra los de las presentaciones: si dos cosas
          responden al mismo código, el lector de la caja no tiene con qué desempatar.
        </div>

        <div className={s.field}>
          <label>Concepto <span className={s.req}>*</span></label>
          <input
            value={f.nombre}
            onChange={(e) => set('nombre', e.target.value)}
            placeholder="Ej: ALFAJOR 72% CACAO ALMENDRAS X64G"
          />
        </div>
        <div className={s.field}>
          <label>Descripción adicional</label>
          <input
            value={f.descripcion}
            onChange={(e) => set('descripcion', e.target.value)}
            placeholder="Opcional"
          />
        </div>

        {/* --- Clasificación --- */}
        <Seccion>Clasificación</Seccion>
        <div className={s['form-grid']}>
          <CatalogoPicker
            label="Marca"
            value={f.marcaId}
            opciones={cat.marcas}
            onChange={(id) => set('marcaId', id)}
            onCrear={crearEn('marcas')}
            onAdministrar={() => setAdmin('marcas')}
          />
          <CatalogoPicker
            label="Categoría"
            value={f.categoriaId}
            opciones={cat.categorias}
            onChange={setCategoria}
            onCrear={crearEn('categorias')}
            onAdministrar={() => setAdmin('categorias')}
          />
        </div>
        <div className={s['form-grid']}>
          <CatalogoPicker
            label="Subcategoría"
            value={f.subcategoriaId}
            opciones={subcategorias}
            disabled={!f.categoriaId}
            onChange={(id) => set('subcategoriaId', id)}
            onCrear={f.categoriaId ? crearEn('subcategorias', { categoriaId: f.categoriaId }) : null}
            onAdministrar={() => setAdmin('subcategorias')}
            ayuda={f.categoriaId ? 'Opcional.' : 'Elegí primero una categoría.'}
          />
          <EtiquetasPicker
            value={f.etiquetas}
            opciones={cat.etiquetas}
            onChange={(ids) => set('etiquetas', ids)}
            onCrear={crearEn('etiquetas')}
            onAdministrar={() => setAdmin('etiquetas')}
          />
        </div>

        {/* --- Valores --- */}
        <Seccion>Valores</Seccion>
        <div className={s['form-grid-3']}>
          <div className={s.field}>
            <label>Unidades por bulto</label>
            <input
              type="number"
              min="1"
              value={f.unidadesPorBulto}
              onChange={(e) => set('unidadesPorBulto', e.target.value)}
            />
          </div>
          <div className={s.field}>
            <label>Tasa de IVA</label>
            <select value={f.iva} onChange={(e) => set('iva', e.target.value)}>
              {IVA_OPCIONES.map((v) => <option key={v} value={v}>{num(v, 1)} %</option>)}
            </select>
          </div>
          <div className={s.field}>
            <label>Tipo de redondeo</label>
            <select value={f.redondeo} onChange={(e) => set('redondeo', e.target.value)}>
              <option value="">Heredar de configuración</option>
              {OPCIONES_REDONDEO_PRECIO.map((o) => (
                <option key={o.valor} value={o.valor}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className={s.hint}>
          El redondeo se aplica sobre el precio final con IVA. Dejalo heredado salvo que este
          producto necesite otra cosa.
        </div>

        {/* --- Proveedor (solo alta) --- */}
        {!ed && (
          <>
            <Seccion>Proveedor</Seccion>
            <div className={s['form-grid']}>
              <div className={s.field}>
                <label>Con quién llega</label>
                <select value={f.proveedorId} onChange={(e) => set('proveedorId', e.target.value)}>
                  <option value="">Elegir después (Formato de Compra)</option>
                  {store.state.proveedores
                    .filter((p) => p.proveeMercaderia !== false)
                    .map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div className={s.field}>
                <label>Costo de lista (neto)</label>
                <input
                  type="number" min="0" step="0.01"
                  value={f.costoInicial}
                  disabled={!f.proveedorId}
                  onChange={(e) => set('costoInicial', e.target.value)}
                  placeholder="Opcional"
                />
              </div>
            </div>
            <div className={s.hint}>
              Crea la relación con ese proveedor de entrada: el producto ya aparece al cargar su
              factura, y al ser el primero fija el precio. Los demás proveedores se suman después
              en el <strong>Formato de Compra</strong> del producto.
            </div>
          </>
        )}

        {/* --- Tienda --- */}
        <Seccion>Tienda</Seccion>
        <div className={s.hint} style={{ marginBottom: 10 }}>
          El producto aparece en el sitio web cuando tiene <strong>precio en la lista Mayorista</strong> —
          no hay switch de publicación. El destacado y la foto se manejan en el módulo <strong>Web</strong>.
        </div>
        <div className={s['form-grid']}>
          <div className={s.field}>
            <label>Id en la tienda</label>
            <input
              value={f.idExterno}
              onChange={(e) => set('idExterno', e.target.value)}
              placeholder="Lo asigna la tienda"
            />
          </div>
        </div>

        <div className={cx(s.callout, s.info)}>
          El <strong>precio de venta</strong> se define en <strong>Formato de Venta</strong>, y el costo y el
          código del proveedor en <strong>Formato de Compra</strong>, dentro del detalle.
          {esGranel && <> Las <strong>presentaciones</strong> se cargan en su propia pestaña.</>}
          {' '}El <strong>stock</strong> entra por <strong>Facturación</strong>.
        </div>
      </ModalShell>

      {/* Va montado ENCIMA: el formulario sigue vivo y no se pierde nada. */}
      {admin && (
        <ModalShell title="Administrar catálogo" wide onClose={() => setAdmin(null)}
          footer={[{ texto: 'Volver al producto', clase: 'btn-primary', onClick: () => setAdmin(null) }]}
        >
          <CatalogoAdmin tipo={admin} />
        </ModalShell>
      )}
    </>
  );
}

/* ---- Detalle de producto ---- */
function Di({ label, children }) {
  return <div className={s.di}><div className={s.l}>{label}</div><div className={s.v}>{children}</div></div>;
}

export function DetalleProductoModal({ prodId }) {
  const { store, isAdmin, closeModal, openModal } = useProductos();
  useSeccion('movimientos');
  const p = store.getProducto(prodId);
  const [tab, setTab] = useState(0);
  if (!p) return null;

  // Compra y Venta, en ese orden: es el recorrido real del producto — primero
  // cómo entra (y a qué costo), después cómo sale (y a qué precio).
  const tabDefs = [
    { label: 'Resumen', C: ResumenTab },
    { label: 'Formato de Compra', C: FormatoCompraTab },
    { label: 'Formato de Venta', C: VentaTab },
    { label: 'Evolución de precios', C: EvolucionPreciosTab },
  ];
  if (p.tipo === 'granel') tabDefs.push({ label: 'Presentaciones', C: PresentacionesTab });
  const Active = (tabDefs[tab] || tabDefs[0]).C;

  const footer = [];
  if (isAdmin) footer.push({ texto: 'Editar producto', clase: 'btn-primary', onClick: () => openModal('producto', { prodId: p.id }) });
  footer.push({ texto: 'Cerrar', clase: 'btn-ghost', onClick: closeModal });

  return (
    <ModalShell title={'Detalle — ' + p.nombre} wide onClose={closeModal} footer={footer}>
      <Tabs
        value={tab}
        onChange={(e, v) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        {tabDefs.map((t) => <Tab key={t.label} label={t.label} />)}
      </Tabs>
      <Active prod={p} />
    </ModalShell>
  );
}

/* ---- Pestaña Resumen ---- */
function ResumenTab({ prod: p }) {
  const { store } = useProductos();
  const base = p.tipo === 'granel'
    ? store.suma({ productoId: p.id, presentacionId: null, estado: 'disponible' })
    : store.suma({ productoId: p.id, estado: 'disponible' });
  let valor = 0;
  store.state.stock.forEach((st) => { if (st.productoId === p.id && st.estado === 'disponible') valor += store.valorEntry(st); });
  const provAct = store.formatoActivo(p);
  const provActNom = provAct ? (store.getProveedor(provAct.proveedorId) || {}).nombre : '—';

  const rows = store.state.stock.filter((st) => st.productoId === p.id && st.cantidad > 1e-9).map((st) => (
    <tr key={st.id}>
      <td>{store.getSucursal(st.sucursalId).nombre}</td>
      <td>{store.presLabel(p, st.presentacionId)}</td>
      <td><StockPill estado={st.estado} /></td>
      <td className={s.num}>{store.fmtCant(p, st.presentacionId, st.cantidad)}</td>
    </tr>
  ));
  const movs = store.movimientosDe(p.id).slice(0, 6).map((m) => (
    <tr key={m.id}><td>{fmtFechaHora(m.fecha)}</td><td><MovTag tipo={m.tipo} /></td><td>{m.descripcion}</td></tr>
  ));

  /* La verdad TOTAL del granel: el suelto MÁS lo ya fraccionado, en kg. "¿Cuánto
   * ajo hay?" no se responde mirando solo el suelto — se compra de más. */
  let fraccionadoKg = 0;
  if (p.tipo === 'granel') {
    for (const st of store.state.stock) {
      if (st.productoId !== p.id || st.estado !== 'disponible' || !st.presentacionId) continue;
      const pr = (p.presentaciones || []).find((x) => x.id === st.presentacionId);
      fraccionadoKg += st.cantidad * (pr?.tamKg || 0);
    }
  }

  return (
    <>
      <div className={s['detalle-grid']}>
        <Di label="Tipo">
          <TipoBadge prod={p} />
          {p.soloFraccionar && (
            <span className={cx(s.badge, s['badge-granel'])} style={{ marginLeft: 6 }}>no se vende suelto</span>
          )}
        </Di>
        <Di label="Marca">{p.marca || '—'}</Di>
        <Di label="Categoría">{p.categoria}</Di>
        <Di label="IVA">{num(p.iva ?? 21, 1)}%</Di>
        <Di label="Proveedor activo">{provActNom}</Di>
        <Di label="Disponible (base)">{num(base, 2)}{p.tipo === 'granel' ? ' kg' : ' u.'}</Di>
        {p.tipo === 'granel' && fraccionadoKg > 1e-9 && (
          <Di label="TOTAL equivalente">
            <strong>{num(base + fraccionadoKg, 2)} kg</strong>
            <div className={s.hint} style={{ margin: 0 }}>{num(base, 2)} suelto + {num(fraccionadoKg, 2)} fraccionado</div>
          </Di>
        )}
        <Di label="Valor disp. (costo)">{money(valor)}</Di>
      </div>

      <h3 className={s['card-title']} style={{ marginTop: 12 }}>Stock por sucursal / estado</h3>
      <Table cols={[{ h: 'Sucursal' }, { h: 'Present.' }, { h: 'Estado' }, { h: 'Cant.', num: true }]} empty="Sin stock.">
        {rows}
      </Table>
      <h3 className={s['card-title']} style={{ marginTop: 12 }}>Últimos movimientos</h3>
      <Table cols={[{ h: 'Fecha' }, { h: 'Tipo' }, { h: 'Detalle' }]} empty="Sin movimientos.">
        {movs}
      </Table>
    </>
  );
}

/* ---- Pestaña Presentaciones (granel): tamaño + recargo sobre el costo neto activo ---- */
/*
 * El campo se llama `recargo` en la base y en la API. Esta pantalla lo llamaba
 * `ganancia`: leía un campo que no existe (el input salía vacío aunque el
 * recargo estuviera cargado) y al guardar mandaba `ganancia`, que la API
 * ignora — o sea que ABRIR y GUARDAR ponía todos los recargos en cero. Lo
 * mismo con el código de barras de cada presentación, que no viajaba y se
 * borraba. Se ve cuando hay datos de verdad: con todo en cero no se notaba.
 */
function PresentacionesTab({ prod: p }) {
  const { store, isAdmin, toast } = useProductos();
  const neto = store.costoNeto(p);
  const [rows, setRows] = useState(() =>
    (p.presentaciones || []).map((pr) => ({
      id: pr.id,
      tamStr: pr.tamKg ? String(pr.tamKg < 1 ? Math.round(pr.tamKg * 1000) : pr.tamKg) : '',
      unidad: pr.tamKg && pr.tamKg < 1 ? 'g' : 'kg',
      recargo: String(pr.recargo ?? ''),
      codigoBarras: pr.codigoBarras ?? '',
    })),
  );
  const setRow = (i, patch) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  const delRow = (i) => setRows((r) => r.filter((_, j) => j !== i));
  const addRow = () => setRows((r) => [...r, { id: null, tamStr: '', unidad: 'g', recargo: '', codigoBarras: '' }]);

  const tamKgDe = (r) => { const t = parseFloat(r.tamStr); if (isNaN(t) || t <= 0) return 0; return r.unidad === 'kg' ? t : t / 1000; };

  const guardar = async () => {
    const presentaciones = rows
      .map((r) => ({
        id: r.id || null, tamKg: tamKgDe(r),
        recargo: Number(r.recargo) || 0,
        codigoBarras: r.codigoBarras.trim(),
      }))
      .filter((x) => x.tamKg > 0);
    const res = await store.guardarPresentaciones(p.id, presentaciones);
    toast(res.ok ? 'Presentaciones guardadas.' : res.error, res.ok ? 'ok' : 'err');
  };

  return (
    <div className={s.form}>
      <div className={cx(s.callout, s.info)}>
        El <strong>recargo</strong> es lo que se cobra de más por fraccionar: el paquete chico
        deja más que el kilo suelto. El precio sale del <strong>costo neto</strong> del proveedor
        activo (<strong>{money(neto)}</strong> /kg) × tamaño × (1 + markup de la lista) ×
        (1 + recargo %), y es el que cobra la caja al escanear su código.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '.8fr .6fr .8fr 1.2fr 1fr .6fr auto', gap: 8 }}>
          <div className={s['mini-label']}>Tamaño</div>
          <div className={s['mini-label']}>Unidad</div>
          <div className={s['mini-label']}>Recargo %</div>
          <div className={s['mini-label']}>Código de barras</div>
          <div className={s['mini-label']}>Precio (con IVA)</div>
          <div className={s['mini-label']}>En stock</div>
          <div />
        </div>
        {rows.map((r, i) => {
          const tamKg = tamKgDe(r);
          // El precio que ve el cliente: el de la API (ya lleva el markup de la
          // lista base y el redondeo de góndola). Mientras se edita, se estima.
          const guardada = (p.presentaciones || []).find((x) => x.id === r.id);
          const sinCambios = guardada
            && Math.abs((guardada.tamKg || 0) - tamKg) < 1e-9
            && Math.abs((guardada.recargo || 0) - (Number(r.recargo) || 0)) < 1e-9;
          const precio = sinCambios && guardada.precio
            ? store.precioFinal(guardada.precio, p.iva)
            : store.precioFinal(neto * tamKg * (1 + (Number(r.recargo) || 0) / 100), p.iva);
          const stk = r.id ? store.suma({ productoId: p.id, presentacionId: r.id, estado: 'disponible' }) : 0;
          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '.8fr .6fr .8fr 1.2fr 1fr .6fr auto', gap: 8, alignItems: 'center' }}>
              <input type="number" min="0" step="1" value={r.tamStr} placeholder="500" onChange={(e) => setRow(i, { tamStr: e.target.value })} />
              <select value={r.unidad} onChange={(e) => setRow(i, { unidad: e.target.value })}>
                <option value="g">g</option>
                <option value="kg">kg</option>
              </select>
              <input type="number" min="0" step="0.1" value={r.recargo} placeholder="0" onChange={(e) => setRow(i, { recargo: e.target.value })} />
              <input
                value={r.codigoBarras}
                placeholder="el de su etiqueta"
                onChange={(e) => setRow(i, { codigoBarras: e.target.value })}
              />
              <div className={s.mono} style={{ fontWeight: 700 }}>{money(precio)}</div>
              <div className={s.muted}>{num(stk, 0)} paq.</div>
              <button type="button" className={s['pres-remove']} onClick={() => delRow(i)}>×</button>
            </div>
          );
        })}
        {!rows.length && <div className={s.muted} style={{ padding: '8px 0' }}>Sin presentaciones.</div>}
      </div>
      {isAdmin && (
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <Btn variant="btn-ghost" small onClick={addRow}>+ Agregar presentación</Btn>
          <Btn variant="btn-primary" small onClick={guardar}>Guardar</Btn>
        </div>
      )}
    </div>
  );
}

/* ---- Pestaña Proveedor: costo por proveedor, descuento y flete (%), proveedor activo ---- */
/* ==================================================================== *
 * EVOLUCIÓN DE PRECIOS — las veces que cambió el precio, con su %
 * ==================================================================== *
 * Lee el historial que el backend registra por snapshot-diff después de cada
 * operación que mueve precios. Se pide al abrir la pestaña (no viaja con el
 * producto): es un dato de consulta, no de operación.
 */
const ORIGEN_PRECIO = {
  inicial: 'Alta',
  costo: 'Cambio de costo',
  formato_compra: 'Formato de compra',
  formato_venta: 'Formato de venta',
  activacion: 'Cambio de formato activo',
  reversion: 'Reversión',
};

function EvolucionPreciosTab({ prod: p }) {
  const { store } = useProductos();
  const [filas, setFilas] = useState(null);

  useEffect(() => {
    let vivo = true;
    store.evolucionPrecios(p.id).then((r) => { if (vivo) setFilas(r); }).catch(() => { if (vivo) setFilas([]); });
    return () => { vivo = false; };
  }, [p.id, store]);

  return (
    <>
      <div className={cx(s.callout, s.info)} style={{ marginBottom: 12 }}>
        Cada vez que el precio de góndola de una lista cambió, quedó acá: cuánto valía, cuánto pasó
        a valer y <strong>por qué</strong> (costo nuevo, markup, formato). Los precios son finales,
        con IVA — el número de la etiqueta.
      </div>
      <Table
        cols={[
          { h: 'Fecha' }, { h: 'Lista' }, { h: 'Antes', num: true }, { h: 'Después', num: true },
          { h: 'Variación', num: true }, { h: 'Motivo' },
        ]}
        empty={filas === null ? 'Cargando…' : 'Sin cambios registrados todavía.'}
      >
        {(filas ?? []).map((f) => (
          <tr key={f.id}>
            <td className={s.mono}>{fmtFechaHora(f.fecha)}</td>
            <td>{f.lista}</td>
            <td className={cx(s.num, s.mono)}>{f.precioAnterior != null ? money(f.precioAnterior) : '—'}</td>
            <td className={cx(s.num, s.mono)}><strong>{money(f.precio)}</strong></td>
            <td className={s.num}>
              {f.variacion == null
                ? <span className={s.muted}>alta</span>
                : (
                  <strong style={{ color: f.variacion > 0 ? 'var(--crm-color-error)' : 'var(--crm-color-success)' }}>
                    {f.variacion > 0 ? '+' : ''}{num(f.variacion, 2)}%
                  </strong>
                )}
            </td>
            <td>
              {ORIGEN_PRECIO[f.origen] || f.origen}
              {f.detalle && <div className={cx(s.muted)} style={{ fontSize: 12 }}>{f.detalle}</div>}
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}

/* ==================================================================== *
 * FORMATO DE VENTA — cómo se vende este producto
 * ==================================================================== *
 * Acá vive el markup, y por eso esta pestaña es el corazón del precio.
 *
 * La lista existe en el catálogo (Ventas › Formato de venta) pero NO lleva
 * precio: cada producto define el suyo. La misma "Mayorista" puede ir al 30% en
 * un producto y al 50% en otro, y un producto que no tiene fila mayorista
 * simplemente no se vende así — no hay nada que excluir ni que destildar.
 */
function VentaTab({ prod: p }) {
  const { store, isAdmin, toast } = useProductos();
  const neto = store.costoNeto(p);
  const unidad = p.tipo === 'granel' ? '/kg' : '/u';
  const act = store.formatoActivo(p);
  const nombreAct = act ? (store.getProveedor(act.proveedorId) || {}).nombre : null;

  const catalogo = store.state.listasCatalogo ?? { listas: [] };
  const activas = useMemo(
    () => (catalogo.listas ?? []).filter((l) => l.activa).sort((a, b) => a.orden - b.orden),
    [catalogo],
  );
  const baseId = store.state.configVentas?.listaBaseId;

  // Los números se editan como texto (permite borrar y tipear a medias).
  const [rows, setRows] = useState(() =>
    (p.listas || []).map((l) => ({
      listaId: l.listaId,
      modoPrecio: l.modoPrecio ?? 'markup',
      markup: String(l.markup ?? 0),
      precioFijo: String(l.precioFijo || ''),
      unidades: String(l.unidades ?? 1),
      codigoBarras: l.codigoBarras ?? '',
      unidadesMinimas: String(l.unidadesMinimas ?? 0),
    })),
  );
  const setRow = (i, patch) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  const quitar = (i) => setRows((r) => r.filter((_, j) => j !== i));

  /** Las que todavía no están cargadas: agregar una es agregar una fila. */
  const disponibles = activas.filter((l) => !rows.some((r) => r.listaId === l.id));
  const agregar = (id) => {
    const l = activas.find((x) => x.id === Number(id));
    if (l) {
      setRows((r) => [...r, {
        listaId: l.id, modoPrecio: 'markup', markup: '0', precioFijo: '',
        unidades: '1', codigoBarras: '', unidadesMinimas: '0',
      }]);
    }
  };

  const meta = (id) => activas.find((l) => l.id === id);
  const ordenadas = [...rows].sort((a, b) => (meta(a.listaId)?.orden ?? 999) - (meta(b.listaId)?.orden ?? 999));
  const tieneBase = rows.some((r) => r.listaId === baseId);

  const guardar = async () => {
    for (const r of rows) {
      if (r.modoPrecio === 'precio' && !(parseFloat(r.precioFijo) > 0)) {
        toast(`Con precio definido, cargá el precio del formato en ${meta(r.listaId)?.etiqueta ?? 'la lista'}.`, 'err');
        return;
      }
    }
    const res = await store.guardarListasProducto(p.id, { listas: rows });
    toast(res.ok ? 'Formato de venta guardado.' : res.error, res.ok ? 'ok' : 'err');
  };

  return (
    <div className={s.form}>
      <div className={cx(s.callout, s.info)}>
        Cada fila es una <strong>forma de vender</strong> este producto: en qué lista, en cuántas
        unidades (suelto o caja), con qué código y cómo se define el precio — un <strong>markup</strong>
        {' '}sobre el costo neto{nombreAct ? <> de <strong>{nombreAct}</strong></> : ''} ({money(neto)} {unidad}),
        que acompaña al costo, o un <strong>precio definido</strong> que no se mueve hasta que lo
        cambies. Si no está la fila, no se vende en esa lista.
      </div>

      {!tieneBase && activas.some((l) => l.id === baseId) && (
        <div className={cx(s.callout, s.warn)}>
          Falta la lista base (<strong>{meta(baseId)?.etiqueta}</strong>), que es el <strong>piso</strong>:
          el precio que se cobra cuando el ticket no habilita ninguna otra. Sin ella, el producto cae
          a la lista más cara que tenga cargada.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-3)' }}>
        {ordenadas.map((r) => {
          const i = rows.indexOf(r);
          const l = meta(r.listaId);
          const esPrecio = r.modoPrecio === 'precio';
          const unidades = Math.max(parseFloat(r.unidades) || 1, 1);
          // El MISMO cálculo que el backend (espejo en el store): la vista
          // previa no puede discrepar del precio que después cobra la caja.
          const pv = store.ventaFormato(p, {
            modoPrecio: r.modoPrecio,
            markup: parseFloat(r.markup) || 0,
            precioFijo: parseFloat(r.precioFijo) || 0,
            unidades,
          });
          return (
            <div key={r.listaId} className={cx(s.card, s.cardPad)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div>
                  <strong style={{ fontSize: 14 }}>{l?.etiqueta ?? `Lista ${r.listaId}`}</strong>
                  <span className={s.muted} style={{ marginLeft: 8, fontSize: 12 }}>
                    {r.listaId === baseId ? 'piso · siempre disponible' : `orden ${l?.orden ?? '—'}`}
                  </span>
                </div>
                {isAdmin && (
                  <button type="button" className={s['pres-remove']} onClick={() => quitar(i)} aria-label={`Quitar ${l?.etiqueta ?? ''}`}>×</button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.1fr .7fr 1fr .9fr .8fr', gap: 8, alignItems: 'end' }}>
                <div>
                  <div className={s['mini-label']}>Código de barras del formato</div>
                  <input
                    value={r.codigoBarras}
                    placeholder={unidades > 1 ? 'EAN de la caja' : 'Opcional'}
                    disabled={!isAdmin}
                    onChange={(e) => setRow(i, { codigoBarras: e.target.value.trim() })}
                  />
                </div>
                <div>
                  <div className={s['mini-label']}>Vende por</div>
                  <input
                    type="number" min="1" step="1" value={r.unidades} disabled={!isAdmin}
                    title="1 = por unidad; 12 = caja de 12"
                    onChange={(e) => setRow(i, { unidades: e.target.value })}
                  />
                </div>
                <div>
                  <div className={s['mini-label']}>Precio por</div>
                  <select
                    value={r.modoPrecio} disabled={!isAdmin}
                    onChange={(e) => setRow(i, { modoPrecio: e.target.value })}
                  >
                    <option value="markup">Markup %</option>
                    <option value="precio">Precio definido</option>
                  </select>
                </div>
                <div>
                  <div className={s['mini-label']}>{esPrecio ? 'Precio del formato (final)' : 'Markup %'}</div>
                  {esPrecio ? (
                    <input
                      type="number" min="0" step="0.01" value={r.precioFijo} placeholder="$ con IVA" disabled={!isAdmin}
                      onChange={(e) => setRow(i, { precioFijo: e.target.value })}
                    />
                  ) : (
                    <input
                      type="number" min="0" step="0.1" value={r.markup} disabled={!isAdmin}
                      onChange={(e) => setRow(i, { markup: e.target.value })}
                    />
                  )}
                </div>
                <div>
                  <div className={s['mini-label']}>Desde (unid.)</div>
                  <input
                    type="number" min="0" step="1" value={r.unidadesMinimas}
                    disabled={!isAdmin || r.listaId === baseId}
                    onChange={(e) => setRow(i, { unidadesMinimas: e.target.value })}
                  />
                </div>
              </div>

              {/* Los DOS precios finales, siempre a la vista: el del formato
                  (la caja — el número del cartel) y el detalle por unidad. */}
              <div style={{
                display: 'flex', gap: 24, marginTop: 10, paddingTop: 10, flexWrap: 'wrap',
                borderTop: '1px solid var(--crm-color-border)',
              }}>
                <div>
                  <div className={s['mini-label']}>Precio final unitario</div>
                  <strong className={s.mono} style={{ fontSize: 16 }}>{money(pv.finalUnitario)}</strong>
                </div>
                <div>
                  <div className={s['mini-label']}>
                    Precio final formato{unidades > 1 ? ` (x${unidades})` : ''}
                  </div>
                  <strong className={s.mono} style={{ fontSize: 16, color: 'var(--crm-color-primary)' }}>
                    {money(pv.finalFormato)}
                  </strong>
                </div>
                {esPrecio && neto > 0 && (
                  <div>
                    <div className={s['mini-label']}>Markup equivalente</div>
                    <span className={s.mono} style={{ fontWeight: 600 }}>
                      {num(((pv.netoUnitario / neto) - 1) * 100, 1)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {!rows.length && (
          <div className={s.muted} style={{ padding: '8px 0' }}>
            Este producto no se vende en ninguna lista todavía.
          </div>
        )}
      </div>

      <div className={s.hint} style={{ marginTop: 10 }}>
        <strong>Vende por</strong>: 1 = suelto; 12 = caja de 12 — al escanear el código del formato,
        la caja registradora carga las 12 unidades de una. <strong>Desde (unidades)</strong> en 0
        significa que la lista no se abre sola: se llega por contrato del cliente, regla de marca o
        monto de compra.
      </div>

      {isAdmin && (
        <div style={{ display: 'flex', gap: 8, marginTop: 14, alignItems: 'center' }}>
          <Btn variant="btn-primary" small onClick={guardar}>Guardar</Btn>
          {disponibles.length > 0 && (
            <select
              value=""
              aria-label="Agregar una lista a este producto"
              onChange={(e) => { agregar(e.target.value); e.target.value = ''; }}
            >
              <option value="">+ Agregar lista…</option>
              {disponibles.map((l) => <option key={l.id} value={l.id}>{l.etiqueta}</option>)}
            </select>
          )}
        </div>
      )}
    </div>
  );
}

/* ==================================================================== *
 * PANTALLA PROPIA DEL FRACCIONADO — el Ajo X500G como protagonista
 * ==================================================================== *
 * Hasta acá al fraccionado solo se llegaba entrando a la madre y abriendo
 * Presentaciones. Esta pantalla lo da vuelta: el paquete tiene su detalle
 * propio (stock real, movimientos, formato de venta) y una pestaña "Producto
 * madre" que muestra de qué producto descuenta — las dos caras de la misma
 * relación que la madre muestra en Presentaciones.
 *
 * EL COSTO ACÁ ES DE SOLO LECTURA, a propósito: se DERIVA del costo de la
 * madre (costo/kg × tamaño × recargo). Si fuera editable, el costo del
 * paquete y el de la madre divergirían — exactamente el vicio del sistema
 * viejo que obligó a revisar 24 precios al importar Bavosi. Lo editable es
 * el RECARGO, en la pestaña Presentaciones de la madre.
 */
export function FraccionadoModal({ prodId, presId }) {
  const { store, isAdmin, closeModal, openModal } = useProductos();
  useSeccion('movimientos');
  const [tab, setTab] = useState(0);
  const p = store.getProducto(prodId);
  const pr = p ? (p.presentaciones || []).find((x) => x.id === presId) : null;
  if (!p || !pr) return null;

  const etiqueta = `${p.nombre} · ${store.presLabel(p, pr.id)}`;
  const cn = store.costoNeto(p);
  const costoLista = cn * (pr.tamKg || 0);
  const costoPaquete = costoLista * (1 + (Number(pr.recargo) || 0) / 100);

  const footer = [];
  if (isAdmin) {
    footer.push({
      texto: 'Editar (en la madre)',
      clase: 'btn-primary',
      onClick: () => { closeModal(); openModal('detalleProducto', { prodId: p.id }); },
    });
  }
  footer.push({ texto: 'Cerrar', clase: 'btn-ghost', onClick: closeModal });

  return (
    <ModalShell title={`Fraccionado — ${etiqueta}`} wide onClose={closeModal} footer={footer}>
      <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Resumen" />
        <Tab label="Producto madre" />
      </Tabs>
      {tab === 0
        ? <FraccionadoResumen store={store} p={p} pr={pr} costoPaquete={costoPaquete} />
        : <FraccionadoMadre store={store} p={p} pr={pr} costoLista={costoLista} costoPaquete={costoPaquete} />}
    </ModalShell>
  );
}

function FraccionadoResumen({ store, p, pr, costoPaquete }) {
  const disponible = store.suma({ productoId: p.id, presentacionId: pr.id, estado: 'disponible' });

  const stockRows = store.state.stock
    .filter((st) => st.productoId === p.id && st.presentacionId === pr.id && st.cantidad > 1e-9)
    .map((st) => (
      <tr key={st.id}>
        <td>{store.getSucursal(st.sucursalId).nombre}</td>
        <td><StockPill estado={st.estado} /></td>
        <td className={s.num}>{num(st.cantidad, 0)} paq.</td>
        <td className={s.num}>{num(st.cantidad * (pr.tamKg || 0), 3)} kg</td>
      </tr>
    ));

  /* SOLO los movimientos de ESTE fraccionado: es lo que la pestaña de la
   * madre no puede mostrar sin mezclar. */
  const movs = store.movimientosDe(p.id)
    .filter((m) => m.presentacionId === pr.id)
    .slice(0, 8)
    .map((m) => (
      <tr key={m.id}><td>{fmtFechaHora(m.fecha)}</td><td><MovTag tipo={m.tipo} /></td><td>{m.descripcion}</td></tr>
    ));

  /* El formato de venta del paquete: el precio en cada lista del producto.
   * El markup lo pone la fila producto × lista; el paquete agrega su recargo. */
  const listasNombre = new Map(
    ((store.state.listasCatalogo?.listas) ?? []).map((l) => [l.id, `${l.nombre}${l.modalidad ? ` · ${l.modalidad}` : ''}`]),
  );
  const cn = store.costoNeto(p);
  const ventaRows = (p.listas || []).map((l) => {
    const markupEf = l.precio != null && cn > 0 ? ((l.precio / cn) - 1) * 100 : (Number(l.markup) || 0);
    return (
      <tr key={l.listaId}>
        <td>{listasNombre.get(l.listaId) || `Lista ${l.listaId}`}</td>
        <td className={s.num}>{num(markupEf, 1)}%</td>
        <td className={cx(s.num, s.mono)}>{money(store.precioPresentacion(p, pr, markupEf))}</td>
      </tr>
    );
  });

  return (
    <>
      <div className={s['detalle-grid']}>
        <Di label="Producto madre">{p.nombre}</Di>
        <Di label="Tamaño">{store.presLabel(p, pr.id)} ({num(pr.tamKg, 3)} kg)</Di>
        <Di label="Código de barras">{pr.codigoBarras || '—'}</Di>
        <Di label="Recargo de fraccionamiento">{num(pr.recargo ?? 0, 1)}%</Di>
        <Di label="Costo del paquete (derivado)">{money(costoPaquete)}</Di>
        <Di label="Precio de venta (piso)">{money(store.precioPresentacion(p, pr))}</Di>
        <Di label="Disponible">{num(disponible, 0)} paq. ({num(disponible * (pr.tamKg || 0), 3)} kg)</Di>
      </div>
      <div className={s.hint} style={{ marginTop: 4 }}>
        El costo del paquete <strong>se deriva del producto madre</strong> (costo/kg × tamaño ×
        recargo) y por eso acá es de solo lectura: no puede divergir. Lo editable es el
        <strong> recargo</strong>, en la pestaña Presentaciones de la madre.
      </div>

      <h3 className={s['card-title']} style={{ marginTop: 12 }}>Formato de venta</h3>
      <Table cols={[{ h: 'Lista' }, { h: 'Margen', num: true }, { h: 'Precio del paquete', num: true }]} empty="El producto madre no tiene listas de venta cargadas.">
        {ventaRows}
      </Table>

      <h3 className={s['card-title']} style={{ marginTop: 12 }}>Stock por sucursal</h3>
      <Table cols={[{ h: 'Sucursal' }, { h: 'Estado' }, { h: 'Paquetes', num: true }, { h: 'Equiv. kg', num: true }]} empty="Sin paquetes en stock. Se fabrican en Almacén › Fraccionamiento.">
        {stockRows}
      </Table>

      <h3 className={s['card-title']} style={{ marginTop: 12 }}>Últimos movimientos de este fraccionado</h3>
      <Table cols={[{ h: 'Fecha' }, { h: 'Tipo' }, { h: 'Detalle' }]} empty="Sin movimientos todavía.">
        {movs}
      </Table>
    </>
  );
}

/**
 * La pestaña "Producto madre": el Prod.Util del sistema viejo, con nuestros
 * números. Muestra de qué producto descuenta este fraccionado, cuánto consume
 * por paquete y los dos costos (lista = sin recargo, total = con recargo —
 * las columnas Lista/Total de la pantalla vieja).
 */
function FraccionadoMadre({ store, p, pr, costoLista, costoPaquete }) {
  const suelto = store.suma({ productoId: p.id, presentacionId: null, estado: 'disponible' });
  const misPaquetes = store.suma({ productoId: p.id, presentacionId: pr.id, estado: 'disponible' });

  /* La verdad TOTAL de la madre: suelto + todo lo ya fraccionado, en kg.
   * "Ajo: 5 kg sueltos y 10 paq de 500 g" = hay 10 kg de ajo. */
  let fraccionadoKg = 0;
  for (const st of store.state.stock) {
    if (st.productoId !== p.id || st.estado !== 'disponible' || !st.presentacionId) continue;
    const otra = (p.presentaciones || []).find((x) => x.id === st.presentacionId);
    fraccionadoKg += st.cantidad * (otra?.tamKg || 0);
  }
  const totalKg = suelto + fraccionadoKg;

  return (
    <>
      <div className={s.hint} style={{ marginTop: 0 }}>
        Este fraccionado <strong>se produce descontando del producto madre</strong>: cada paquete
        consume {num(pr.tamKg, 3)} kg. La relación inversa está en la madre, pestaña Presentaciones.
      </div>
      <Table
        cols={[
          { h: 'Código' }, { h: 'Producto madre' }, { h: 'Consume', num: true }, { h: 'Un.Med' },
          { h: 'Costo (lista)', num: true }, { h: 'Costo total (c/recargo)', num: true },
        ]}
      >
        <tr>
          <td className={s.mono}>{p.codigoPropio || p.id}</td>
          <td>
            {p.nombre}
            {p.soloFraccionar && (
              <span className={cx(s.badge, s['badge-granel'])} style={{ marginLeft: 8 }}>solo fraccionar</span>
            )}
          </td>
          <td className={s.num}>{num(pr.tamKg, 3)}</td>
          <td>kg</td>
          <td className={s.num}>{money(costoLista)}</td>
          <td className={cx(s.num, s.mono)}>{money(costoPaquete)}</td>
        </tr>
      </Table>

      <h3 className={s['card-title']} style={{ marginTop: 12 }}>Cuánto hay, contando todo</h3>
      <div className={s['detalle-grid']}>
        <Di label="Suelto en la madre">{num(suelto, 3)} kg</Di>
        <Di label="En este fraccionado">{num(misPaquetes, 0)} paq. ({num(misPaquetes * (pr.tamKg || 0), 3)} kg)</Di>
        <Di label="Fraccionado (todas las pres.)">{num(fraccionadoKg, 3)} kg</Di>
        <Di label="TOTAL equivalente"><strong>{num(totalKg, 3)} kg</strong></Di>
      </div>
      <div className={s.hint}>
        El <strong>total equivalente</strong> responde cuánto hay de verdad: lo suelto más lo ya
        envasado. Comprar mirando solo el suelto compra de más.
      </div>
    </>
  );
}
