import { useEffect, useMemo, useState } from 'react';
import { Tabs, Tab } from '@mui/material';
import { cx } from '@shared/utils/classNames.js';
// La MISMA función que valida el código para dibujar la etiqueta: la fórmula
// del verificador vive en un solo lugar del front.
import { verificadorEan13 } from '@core/services/barcode.js';
import { useProductos } from '../../context/ProductosContext.jsx';
import { useSeccion } from '../../hooks/useSeccion.js';
import { money, num, fmtFechaHora, fmtTam } from '../../domain/format.js';
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

/** Las dos etapas del alta, con el mismo lenguaje visual que el comprobante. */
const ETAPAS_PRODUCTO = ['El producto', 'El proveedor'];
function EtapasProducto({ paso, irA }) {
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
      {ETAPAS_PRODUCTO.map((label, i) => {
        const n = i + 1;
        const activo = n === paso;
        const hecho = n < paso;
        return (
          <button
            key={n}
            type="button"
            disabled={!hecho}
            onClick={hecho ? () => irA(n) : undefined}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
              border: '1px solid ' + (activo ? 'var(--crm-color-primary)' : 'var(--crm-color-border)'),
              borderRadius: 8, background: activo ? 'var(--crm-color-primary-soft)' : 'var(--crm-color-surface)',
              cursor: hecho ? 'pointer' : 'default', textAlign: 'left', minWidth: 0,
            }}
          >
            <span
              style={{
                width: 22, height: 22, borderRadius: '50%', display: 'inline-flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 12, fontWeight: 700, flex: 'none',
                background: activo || hecho ? 'var(--crm-color-primary)' : 'var(--crm-color-border)',
                color: activo || hecho ? 'var(--crm-color-primary-contrast)' : 'var(--crm-color-text-secondary)',
              }}
            >
              {hecho ? '✓' : n}
            </span>
            <span
              style={{
                fontSize: 12.5, fontWeight: activo ? 700 : 500, minWidth: 0,
                color: activo ? 'var(--crm-color-text)' : 'var(--crm-color-text-secondary)',
              }}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
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
    // Se conserva tal cual (lo asigna la tienda): ya no tiene campo visible.
    idExterno: prod?.idExterno || '',
    // Solo alta (etapa 2): crea el Formato de Compra de entrada — con el
    // código del proveedor, su escala y su flete el producto nace completo.
    proveedorId: '',
    costoInicial: '',
    codigoProveedor: '',
    d1: '', d2: '', d3: '', d4: '',
    flete: '',
  }));
  /** Alta en DOS etapas: 1 = el producto en sí, 2 = con quién llega. */
  const [paso, setPaso] = useState(1);
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

  const continuar = () => {
    if (!f.nombre.trim()) { toast('El concepto es obligatorio.', 'err'); return; }
    setPaso(2);
  };

  const guardar = () => {
    const nombre = f.nombre.trim();
    if (!nombre) { toast('El concepto es obligatorio.', 'err'); return; }
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
      o.codigoProveedor = f.codigoProveedor.trim();
      o.descuento = Number(f.d1) || 0;
      o.descuento2 = Number(f.d2) || 0;
      o.descuento3 = Number(f.d3) || 0;
      o.descuento4 = Number(f.d4) || 0;
      o.flete = Number(f.flete) || 0;
    }
    act(
      prod ? store.editarProducto(prod.id, o) : store.crearProducto(o),
      prod ? 'Producto actualizado.' : 'Producto creado.',
    );
  };

  /* El pie cambia con la etapa: en el alta se avanza y se vuelve; la edición
   * sigue siendo una sola pantalla (el proveedor ya vive en su Formato). */
  const footer = ed
    ? [
      { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
      { texto: 'Guardar', clase: 'btn-primary', onClick: guardar },
    ]
    : paso === 1
      ? [
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Continuar', clase: 'btn-primary', onClick: continuar },
      ]
      : [
        { texto: 'Volver', clase: 'btn-ghost', onClick: () => setPaso(1) },
        { texto: 'Crear', clase: 'btn-primary', onClick: guardar },
      ];

  return (
    <>
      <ModalShell
        title={ed ? `Editar producto #${prod.id}` : 'Nuevo producto'}
        subtitle={ed ? undefined : (paso === 1
          ? 'Etapa 1 de 2 · El producto en sí'
          : 'Etapa 2 de 2 · Con quién llega')}
        wide
        onClose={closeModal}
        footer={footer}
      >
        {!ed && <EtapasProducto paso={paso} irA={setPaso} />}

        {(ed || paso === 1) && (
          <>
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

        {/* --- Tienda: SOLO informativo, sin campos (decisión del dueño 17/8) --- */}
        <Seccion>Tienda</Seccion>
        <div className={s.hint} style={{ marginBottom: 10 }}>
          Acá no se completa nada: el producto aparece en el sitio web cuando tiene
          <strong> precio en la lista Mayorista</strong> — no hay switch de publicación. El
          destacado y la foto se manejan en el módulo <strong>Web</strong>.
        </div>

        <div className={cx(s.callout, s.info)}>
          El <strong>precio de venta</strong> se define en <strong>Formato de Venta</strong>, dentro del
          detalle.
          {esGranel && <> Las <strong>presentaciones</strong> se cargan en su propia pestaña.</>}
          {' '}El <strong>stock</strong> entra por <strong>Facturación</strong>.
        </div>
          </>
        )}

        {/* --- Etapa 2 (solo alta): con quién llega --- */}
        {!ed && paso === 2 && (
          <>
            <div className={cx(s.callout, s.info)}>
              <strong>{f.nombre.trim() || 'El producto'}</strong> nace con su Formato de Compra: el
              proveedor con el que llega, <strong>el código con el que ÉL lo llama</strong>, su escala
              de descuentos y su flete. Al ser el primero, <strong>fija el precio</strong>. Los demás
              proveedores se suman después en el Formato de Compra del detalle.
            </div>

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
                <label>Código del proveedor</label>
                <input
                  value={f.codigoProveedor}
                  disabled={!f.proveedorId}
                  onChange={(e) => set('codigoProveedor', e.target.value)}
                  placeholder="Cómo lo llama él (su lista, su factura)"
                />
              </div>
            </div>
            <div className={s.hint}>
              El código del proveedor es el que aparece en <strong>su</strong> lista y su factura: con
              él, la lectura del PDF reconoce el renglón sola.
            </div>

            <Seccion>Costo</Seccion>
            <div className={s['form-grid']}>
              <div className={s.field}>
                <label>Costo de lista (neto)</label>
                <input
                  type="number" min="0" step="0.01"
                  value={f.costoInicial}
                  disabled={!f.proveedorId}
                  onChange={(e) => set('costoInicial', e.target.value)}
                  placeholder="Si no lo sabés, lo trae la primera factura"
                />
              </div>
              <div className={s.field}>
                <label>Flete %</label>
                <input
                  type="number" min="0" max="100" step="0.1"
                  value={f.flete}
                  disabled={!f.proveedorId}
                  onChange={(e) => set('flete', e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            <div className={s.field}>
              <label>Escala de descuentos (se aplican en cascada)</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {['d1', 'd2', 'd3', 'd4'].map((k) => (
                  <input
                    key={k}
                    type="number" min="0" max="100" step="0.1"
                    value={f[k]}
                    disabled={!f.proveedorId}
                    onChange={(e) => set(k, e.target.value)}
                    placeholder="0"
                  />
                ))}
              </div>
            </div>
            <div className={s.hint}>
              En cascada, no sumados: 30 y 10 es 37%, no 40% — se cargan tal como los da el
              proveedor. Todo esto se puede ajustar después en el Formato de Compra.
            </div>
          </>
        )}
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

/* ---- Pestaña Presentaciones (granel): SOLO los tamaños ---- *
 *
 * Acá se define **cuánto granel consume cada paquete** y nada más. Tuvo una
 * columna de `recargo` —lo que se cobraba de más por fraccionar— hasta la 0053:
 * el paquete ahora tiene formato de venta propio y su precio se edita en SU
 * ficha, con markup o precio fijo, caja por N y mínimo. Un solo número no
 * alcanzaba para el mostrador.
 *
 * Lección vieja que sigue valiendo: esta pantalla llamaba `ganancia` a lo que la
 * API llamaba `recargo`, así que ABRIR y GUARDAR ponía todos los recargos en
 * cero sin que nadie lo viera. Los nombres de los campos se comparten con la API
 * a propósito.
 */
/**
 * EN QUÉ ESTADO ESTÁ EL CÓDIGO DE UN RENGLÓN.
 *
 * El criterio es el mismo que aplica la API, y la razón de que no sea "válido o
 * inválido" es la herencia: hay 71 códigos del sistema viejo que no son EAN-13
 * (13 con el verificador mal, 58 más cortos). Trabarlos dejaría esas
 * presentaciones sin poder guardar ni un cambio de recargo, así que se avisan
 * pero pasan; lo que se exige es que lo NUEVO nazca bien.
 */
function estadoCodigo(row, previoDe, repetidos) {
  const c = (row.codigoBarras || '').trim();
  const previo = row.id ? (previoDe.get(row.id) || '') : null;
  if (c && repetidos.has(c)) {
    return { clave: 'repetido', bloquea: true, aviso: 'Repetido en esta lista: dos paquetes con el mismo código no se pueden distinguir en la caja.' };
  }
  if (!c) {
    if (previo === null) return { clave: 'falta', bloquea: true, aviso: 'Falta el código: es el que la caja escanea en el paquete. Generá uno.' };
    if (previo) return { clave: 'vaciado', bloquea: false, aviso: 'Le estás sacando el código: la etiqueta va a salir sin código de barras.' };
    return { clave: 'sinCodigo', bloquea: false, aviso: 'No tiene código (viene así): la caja no puede escanear este paquete. Generá uno.' };
  }
  if (verificadorEan13(c) === true) return { clave: 'ok', bloquea: false, aviso: '' };
  if (c === previo) {
    return { clave: 'viejo', bloquea: false, aviso: 'No es un EAN-13 válido (viene del sistema viejo). Se puede guardar igual, pero conviene reemplazarlo.' };
  }
  return {
    clave: 'malo',
    bloquea: true,
    aviso: /^\d{13}$/.test(c)
      ? 'Son 13 dígitos pero el verificador no cierra: ningún lector lo va a leer. Revisá si lo copiaste bien.'
      : 'Un EAN-13 son 13 dígitos. Copiá el del fabricante o generá uno propio.',
  };
}

function PresentacionesTab({ prod: p }) {
  const { store, isAdmin, toast, closeModal, openModal } = useProductos();
  const neto = store.costoNeto(p);
  const [rows, setRows] = useState(() =>
    (p.presentaciones || []).map((pr) => ({
      id: pr.id,
      tamStr: pr.tamKg ? String(pr.tamKg < 1 ? Math.round(pr.tamKg * 1000) : pr.tamKg) : '',
      unidad: pr.tamKg && pr.tamKg < 1 ? 'g' : 'kg',
      codigoBarras: pr.codigoBarras ?? '',
    })),
  );
  const [generando, setGenerando] = useState(null);
  const setRow = (i, patch) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  const delRow = (i) => setRows((r) => r.filter((_, j) => j !== i));
  const addRow = () => setRows((r) => [...r, { id: null, tamStr: '', unidad: 'g', codigoBarras: '' }]);

  const tamKgDe = (r) => { const t = parseFloat(r.tamStr); if (isNaN(t) || t <= 0) return 0; return r.unidad === 'kg' ? t : t / 1000; };

  /* El código guardado de cada renglón: es lo que distingue "lo trajo así" de
   * "lo acabo de escribir", y solo lo segundo se exige. */
  const previoDe = new Map((p.presentaciones || []).map((pr) => [pr.id, pr.codigoBarras || '']));
  const repetidos = new Set();
  const vistos = new Set();
  for (const r of rows) {
    const c = (r.codigoBarras || '').trim();
    if (!c) continue;
    if (vistos.has(c)) repetidos.add(c); else vistos.add(c);
  }
  const estados = rows.map((r) => estadoCodigo(r, previoDe, repetidos));

  /** Pide el código a la API, que es la única que ve TODOS los que ya existen. */
  const generar = async (i) => {
    setGenerando(i);
    try {
      // Los de la pantalla van como excluidos: el servidor no los conoce todavía.
      const enPantalla = rows.map((r) => (r.codigoBarras || '').trim()).filter(Boolean);
      const { codigo } = await store.siguienteEan(enPantalla);
      setRow(i, { codigoBarras: codigo });
    } catch {
      toast('No pude generar el código: revisá la conexión con el servidor.', 'err');
    } finally {
      setGenerando(null);
    }
  };

  const guardar = async () => {
    const conProblema = estados.findIndex((e, i) => e.bloquea && tamKgDe(rows[i]) > 0);
    if (conProblema >= 0) {
      const r = rows[conProblema];
      const cual = tamKgDe(r) ? fmtTam(tamKgDe(r)) : `renglón ${conProblema + 1}`;
      toast(`${cual}: ${estados[conProblema].aviso}`, 'err');
      return;
    }
    const presentaciones = rows
      .map((r) => ({ id: r.id || null, tamKg: tamKgDe(r), codigoBarras: r.codigoBarras.trim() }))
      .filter((x) => x.tamKg > 0);
    const res = await store.guardarPresentaciones(p.id, presentaciones);
    toast(res.ok ? 'Presentaciones guardadas.' : res.error, res.ok ? 'ok' : 'err');
  };

  return (
    <div className={s.form}>
      <div className={cx(s.callout, s.info)}>
        Cada fila es un <strong>tamaño</strong> en el que se fracciona este granel: lo único que se
        define acá es <strong>cuánto consume</strong> cada paquete del costo de la madre
        (<strong>{money(neto)}</strong> /kg) y su <strong>código de barras</strong>. El
        <strong> precio de cada paquete es propio</strong> y se carga en su ficha — clic en
        <strong> Ver ficha</strong>.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '.7fr .5fr 1.3fr 1fr .7fr auto auto', gap: 8 }}>
          <div className={s['mini-label']}>Tamaño</div>
          <div className={s['mini-label']}>Unidad</div>
          <div className={s['mini-label']}>Código de barras</div>
          <div className={s['mini-label']}>Precio del paquete</div>
          <div className={s['mini-label']}>En stock</div>
          <div />
          <div />
        </div>
        {rows.map((r, i) => {
          const est = estados[i];
          const guardada = (p.presentaciones || []).find((x) => x.id === r.id);
          const stk = r.id ? store.suma({ productoId: p.id, presentacionId: r.id, estado: 'disponible' }) : 0;
          const borde = est.bloquea ? 'var(--crm-color-danger)'
            : est.clave === 'ok' ? 'var(--crm-color-success)'
              : est.aviso ? 'var(--crm-color-warning)' : undefined;
          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '.7fr .5fr 1.3fr 1fr .7fr auto auto', gap: 8, alignItems: 'start' }}>
              <input type="number" min="0" step="1" value={r.tamStr} placeholder="500" onChange={(e) => setRow(i, { tamStr: e.target.value })} />
              <select value={r.unidad} onChange={(e) => setRow(i, { unidad: e.target.value })}>
                <option value="g">g</option>
                <option value="kg">kg</option>
              </select>
              {/* El código y su estado: el aviso va PEGADO al campo, no en un
                  cartel arriba — con varias presentaciones, un aviso lejos no
                  dice de cuál habla. */}
              <div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <input
                    value={r.codigoBarras}
                    placeholder="EAN-13 (13 dígitos)"
                    inputMode="numeric"
                    maxLength={13}
                    style={borde ? { borderColor: borde, flex: 1, minWidth: 0 } : { flex: 1, minWidth: 0 }}
                    onChange={(e) => setRow(i, { codigoBarras: e.target.value.replace(/\D/g, '') })}
                  />
                  <Btn
                    small
                    title="Generar un EAN-13 propio, libre y sin repetir"
                    disabled={generando === i}
                    onClick={() => generar(i)}
                  >
                    {generando === i ? '…' : 'Generar'}
                  </Btn>
                </div>
                {est.aviso && (
                  <div
                    className={s.hint}
                    style={{ margin: '3px 0 0', color: est.bloquea ? 'var(--crm-color-danger)' : 'var(--crm-color-warning)' }}
                  >
                    {est.aviso}
                  </div>
                )}
              </div>
              {/* El precio ya no se calcula acá: es del paquete y lo trae la API.
                  Sin formato de venta no es cero, es "sin precio" — y en rojo,
                  porque un paquete sin precio no se puede vender. */}
              <div className={s.mono} style={{ fontWeight: 700, paddingTop: 8 }}>
                {!guardada
                  ? <span className={s.muted}>al guardar</span>
                  : guardada.precioFinal != null
                    ? money(guardada.precioFinal)
                    : <span style={{ color: 'var(--crm-color-danger)' }}>sin precio</span>}
              </div>
              <div className={s.muted} style={{ paddingTop: 8 }}>{num(stk, 0)} paq.</div>
              {guardada ? (
                <Btn
                  small
                  variant="btn-ghost"
                  title="Abrir la ficha del paquete: ahí se carga su precio, su caja y sus ofertas"
                  onClick={() => { closeModal(); openModal('fraccionado', { prodId: p.id, presId: guardada.id }); }}
                >
                  Ver ficha
                </Btn>
              ) : <span />}
              <button type="button" className={s['pres-remove']} style={{ marginTop: 4 }} onClick={() => delRow(i)}>×</button>
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
 * FORMATO DE VENTA — cómo se vende esto
 * ==================================================================== *
 * Acá vive el markup, y por eso esta pestaña es el corazón del precio.
 *
 * La lista existe en el catálogo (Ventas › Formato de venta) pero NO lleva
 * precio: cada producto define el suyo. La misma "Mayorista" puede ir al 30% en
 * un producto y al 50% en otro, y un producto que no tiene fila mayorista
 * simplemente no se vende así — no hay nada que excluir ni que destildar.
 *
 * LA MISMA PESTAÑA SIRVE PARA UN PAQUETE FRACCIONADO (`pres`): desde la 0053 el
 * paquete se cotiza solo, y lo único que cambia es sobre qué costo (el del kilo
 * × su tamaño) y dónde se guarda. Tener dos editores parecidos habría garantizado
 * que uno se quedara atrás del otro.
 */
function VentaTab({ prod: p, pres = null }) {
  const { store, isAdmin, toast } = useProductos();
  const esPaquete = !!pres;
  /* La BASE del precio (0072), no el costo real: acá vive el markup, y con
   * mercadería sin factura las dos difieren — el paquete la hereda del kilo. */
  const neto = esPaquete
    ? store.costoPrecio(p) * (Number(pres.tamKg) || 0)
    : store.costoPrecio(p);
  const unidad = esPaquete ? '/paquete' : (p.tipo === 'granel' ? '/kg' : '/u');
  /** El código del artículo en sí: el del paquete es el de su etiqueta. */
  const codigoPropio = esPaquete ? pres.codigoBarras : p.codigoBarras;
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
    ((esPaquete ? pres.listas : p.listas) || []).map((l) => ({
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
    const res = esPaquete
      ? await store.guardarListasPresentacion(pres.id, { listas: rows })
      : await store.guardarListasProducto(p.id, { listas: rows });
    toast(res.ok ? 'Formato de venta guardado.' : res.error, res.ok ? 'ok' : 'err');
  };

  return (
    <div className={s.form}>
      <div className={cx(s.callout, s.info)}>
        Cada fila es una <strong>forma de vender</strong> {esPaquete ? 'este paquete' : 'este producto'}: en
        qué lista, en cuántas unidades ({esPaquete ? 'un paquete o una caja de N paquetes' : 'suelto o caja'}),
        con qué código y cómo se define el precio — un <strong>markup</strong> sobre el costo
        {esPaquete
          ? <> del paquete (<strong>{money(neto)}</strong>{unidad}, que es el costo del kilo × su tamaño)</>
          : <> neto{nombreAct ? <> de <strong>{nombreAct}</strong></> : ''} ({money(neto)} {unidad})</>},
        que acompaña al costo, o un <strong>precio definido</strong> que no se mueve hasta que lo
        cambies. Si no está la fila, no se vende en esa lista.
      </div>

      {/* El código que YA tiene el artículo, para que no se lo vuelva a cargar
          en la fila (el de la fila es el de la caja de N). Dice también dónde se
          edita: el del paquete vive en Presentaciones de la madre. */}
      <div className={s.hint} style={{ margin: '-4px 0 0' }}>
        Código de {esPaquete ? 'este paquete' : 'este producto'}:{' '}
        {codigoPropio
          ? <strong className={s.mono}>{codigoPropio}</strong>
          : <span style={{ color: 'var(--crm-color-danger)' }}>sin código</span>}
        {esPaquete
          ? <> — es el de su etiqueta, y se carga en <strong>Presentaciones</strong> del producto madre.</>
          : <> — se carga en la ficha del producto.</>}
        {' '}El código de cada fila de abajo es <strong>otro</strong>: el de la caja de N.
      </div>

      {esPaquete && !rows.length && (
        <div className={cx(s.callout, s.warn)}>
          Este paquete <strong>todavía no tiene precio</strong>: no lo puede vender la caja ni sale en la
          etiqueta. Agregale abajo la lista con la que se vende.
        </div>
      )}

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
          }, esPaquete ? neto : undefined);
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
                {/*
                 * EL CÓDIGO DE ESTA FILA ES EL DE LA CAJA, no el del artículo.
                 *
                 * El artículo ya tiene el suyo —el del producto, o el de la
                 * etiqueta del paquete que se carga en Presentaciones— así que
                 * con "vende por 1" un código acá sería un SEGUNDO código para
                 * lo mismo y el escáner de la caja se quedaría sin desempate.
                 * Por eso solo se habilita con la caja de N, y si quedó uno de
                 * antes (hay uno heredado del sistema viejo) se avisa en vez de
                 * borrarlo por atrás.
                 */}
                <div>
                  <div className={s['mini-label']}>
                    {unidades > 1 ? `Código de la caja (× ${num(unidades, 0)})` : 'Código de la caja'}
                  </div>
                  <input
                    value={r.codigoBarras}
                    placeholder={unidades > 1 ? 'EAN o DUN-14 de la caja' : 'solo con caja de N'}
                    disabled={!isAdmin || (unidades <= 1 && !r.codigoBarras)}
                    style={unidades <= 1 && r.codigoBarras ? { borderColor: 'var(--crm-color-danger)' } : undefined}
                    onChange={(e) => setRow(i, { codigoBarras: e.target.value.trim() })}
                  />
                  {unidades <= 1 && r.codigoBarras && (
                    <div className={s.hint} style={{ margin: '3px 0 0', color: 'var(--crm-color-danger)' }}>
                      Con <strong>1</strong> no puede tener código propio: competiría con el
                      del {esPaquete ? 'paquete' : 'artículo'}. Quitalo, o poné cuántas trae la caja.
                    </div>
                  )}
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

        {!rows.length && !esPaquete && (
          <div className={s.muted} style={{ padding: '8px 0' }}>
            Este producto no se vende en ninguna lista todavía.
          </div>
        )}
      </div>

      <div className={s.hint} style={{ marginTop: 10 }}>
        <strong>Vende por</strong>: 1 = {esPaquete ? 'un paquete' : 'suelto'}; 12 = caja de 12
        {esPaquete ? ' paquetes' : ''} — al escanear el código del formato, la caja registradora carga
        las 12 de una. <strong>Desde (unidades)</strong> en 0 significa que la lista no se abre sola:
        se llega por contrato del cliente, regla de marca o monto de compra.
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
 * EL COSTO ES DE SOLO LECTURA y el PRECIO ES PROPIO. Esa es la división desde la
 * 0053: el costo se DERIVA de la madre (costo/kg × tamaño) porque lo pone el
 * proveedor y no puede divergir; el precio se decide acá, en la pestaña Formato
 * de venta, con la misma libertad que un producto — markup o precio fijo, caja
 * por N, mínimo y código. El `recargo` que había antes decía una sola cosa y no
 * alcanzaba para el mostrador.
 */
export function FraccionadoModal({ prodId, presId }) {
  const { store, isAdmin, closeModal } = useProductos();
  useSeccion('movimientos');
  const [tab, setTab] = useState(0);
  const p = store.getProducto(prodId);
  const pr = p ? (p.presentaciones || []).find((x) => x.id === presId) : null;
  if (!p || !pr) return null;

  const etiqueta = `${p.nombre} · ${store.presLabel(p, pr.id)}`;
  const costoPaquete = Number(pr.costoNeto) || 0;

  return (
    <ModalShell
      title={`Fraccionado — ${etiqueta}`}
      wide
      onClose={closeModal}
      footer={[{ texto: 'Cerrar', clase: 'btn-ghost', onClick: closeModal }]}
    >
      <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Resumen" />
        {/* El paquete se cotiza solo: su formato de venta se edita ACÁ, no en la
            madre. Es la misma pestaña que usa el producto, con otro costo. */}
        {isAdmin && <Tab label={pr.sinFormato ? 'Formato de venta ⚠' : 'Formato de venta'} />}
        <Tab label="Producto madre" />
      </Tabs>
      {tab === 0 && <FraccionadoResumen store={store} p={p} pr={pr} costoPaquete={costoPaquete} />}
      {isAdmin && tab === 1 && <VentaTab prod={p} pres={pr} />}
      {tab === (isAdmin ? 2 : 1) && (
        <FraccionadoMadre store={store} p={p} pr={pr} costoPaquete={costoPaquete} />
      )}
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
  /* El formato de venta PROPIO del paquete: su markup, su caja y su precio.
   * Antes esta tabla mostraba las listas de la MADRE con el recargo aplicado —
   * de ahí venía el "El producto madre no tiene listas de venta cargadas" que
   * dejaba al paquete sin precio aunque el paquete se venda todos los días. */
  const ventaRows = (pr.listas || []).map((l) => (
    <tr key={l.listaId}>
      <td>{listasNombre.get(l.listaId) || `Lista ${l.listaId}`}</td>
      <td className={s.num}>
        {l.modoPrecio === 'precio' ? <span className={s.muted}>precio fijo</span> : `${num(l.markup, 1)}%`}
      </td>
      <td className={s.num}>{l.unidades > 1 ? `caja × ${num(l.unidades, 0)}` : '1 paq.'}</td>
      <td className={cx(s.num, s.mono)}>{money(l.precioFinalUnitario)}</td>
    </tr>
  ));

  return (
    <>
      <div className={s['detalle-grid']}>
        <Di label="Producto madre">{p.nombre}</Di>
        <Di label="Tamaño">{store.presLabel(p, pr.id)} ({num(pr.tamKg, 3)} kg)</Di>
        <Di label="Código de barras">{pr.codigoBarras || '—'}</Di>
        <Di label="Costo del paquete (derivado)">{money(costoPaquete)}</Di>
        <Di label="Precio de venta (piso)">
          {pr.precioFinal != null
            ? money(pr.precioFinal)
            : <span style={{ color: 'var(--crm-color-danger)', fontWeight: 700 }}>sin precio</span>}
        </Di>
        <Di label="Disponible">{num(disponible, 0)} paq. ({num(disponible * (pr.tamKg || 0), 3)} kg)</Di>
      </div>
      <div className={s.hint} style={{ marginTop: 4 }}>
        El <strong>costo</strong> se deriva del producto madre (costo/kg × tamaño) y por eso es de solo
        lectura: no puede divergir del de la madre. El <strong>precio es propio</strong> y se edita en la
        pestaña <strong>Formato de venta</strong> — este paquete se cotiza solo.
      </div>

      <h3 className={s['card-title']} style={{ marginTop: 12 }}>Formato de venta del paquete</h3>
      <Table
        cols={[{ h: 'Lista' }, { h: 'Precio por', num: true }, { h: 'Vende por', num: true }, { h: 'Precio del paquete', num: true }]}
        empty="Este paquete todavía no tiene precio: cargale su formato de venta en la pestaña de al lado."
      >
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
 * por paquete y a qué costo sale.
 */
function FraccionadoMadre({ store, p, pr, costoPaquete }) {
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
          { h: 'Costo del kilo', num: true }, { h: 'Costo del paquete', num: true },
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
          <td className={s.num}>{money(store.costoNeto(p))}</td>
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
