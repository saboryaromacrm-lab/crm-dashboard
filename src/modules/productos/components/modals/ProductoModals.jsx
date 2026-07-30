import { useState } from 'react';
import { Tabs, Tab } from '@mui/material';
import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../../context/ProductosContext.jsx';
import { money, num, fmtFechaHora } from '../../domain/format.js';
import { CATEGORIAS, IVA_OPCIONES } from '../../domain/constants.js';
import { ModalShell } from '../Modal.jsx';
import { Table, TipoBadge, StockPill, MovTag, Btn, s } from '../ui.jsx';

/* ---- Alta / edición de producto ---- */
export function ProductoFormModal({ prodId }) {
  const { store, act, closeModal, toast } = useProductos();
  const prod = prodId != null ? store.getProducto(prodId) : null;
  const ed = !!prod;

  const [esGranel, setEsGranel] = useState(prod ? prod.tipo === 'granel' : false);
  const [nombre, setNombre] = useState(prod?.nombre || '');
  const [marca, setMarca] = useState(prod?.marca || '');
  const [categoria, setCategoria] = useState(prod?.categoria || 'General');
  const [iva, setIva] = useState(prod?.iva != null ? String(prod.iva) : '21');

  const guardar = () => {
    const nom = nombre.trim();
    if (!nom) { toast('El nombre es obligatorio.', 'err'); return; }
    const o = { nombre: nom, categoria, marca, iva: Number(iva), esGranel };
    act(prod ? store.editarProducto(prod.id, o) : store.crearProducto(o), prod ? 'Producto actualizado.' : 'Producto creado.');
  };

  return (
    <ModalShell
      title={ed ? 'Editar producto #' + prod.id : 'Nuevo producto'}
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

      <div className={s['form-grid']} style={{ marginTop: 12 }}>
        <div className={s.field}>
          <label>Nombre <span className={s.req}>*</span></label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Harina Integral" />
        </div>
        <div className={s.field}>
          <label>Marca</label>
          <input value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Ej: Molienda del Sur" />
        </div>
      </div>
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Categoría</label>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className={s.field}>
          <label>IVA</label>
          <select value={iva} onChange={(e) => setIva(e.target.value)}>
            {IVA_OPCIONES.map((v) => <option key={v} value={v}>{num(v, 1)}%</option>)}
          </select>
        </div>
      </div>

      <div className={cx(s.callout, s.info)}>
        El <strong>precio de venta</strong> se define en la pestaña <strong>Venta</strong> del detalle (por % de ganancia).
        {esGranel && <> Las <strong>presentaciones</strong> se cargan en la pestaña <strong>Presentaciones</strong> del detalle.</>}
        {' '}El <strong>stock</strong> se carga desde <strong>Facturación</strong>.
      </div>
    </ModalShell>
  );
}

/* ---- Detalle de producto ---- */
function Di({ label, children }) {
  return <div className={s.di}><div className={s.l}>{label}</div><div className={s.v}>{children}</div></div>;
}

export function DetalleProductoModal({ prodId }) {
  const { store, isAdmin, closeModal, openModal } = useProductos();
  const p = store.getProducto(prodId);
  const [tab, setTab] = useState(0);
  if (!p) return null;

  const tabDefs = [
    { label: 'Resumen', C: ResumenTab },
    { label: 'Proveedor', C: ProveedorTab },
    { label: 'Costo', C: CostoTab },
    { label: 'Venta', C: VentaTab },
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
  const provAct = store.proveedorActivoEntry(p);
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

  return (
    <>
      <div className={s['detalle-grid']}>
        <Di label="Tipo"><TipoBadge prod={p} /></Di>
        <Di label="Marca">{p.marca || '—'}</Di>
        <Di label="Categoría">{p.categoria}</Di>
        <Di label="IVA">{num(p.iva ?? 21, 1)}%</Di>
        <Di label="Proveedor activo">{provActNom}</Di>
        <Di label="Disponible (base)">{num(base, 2)}{p.tipo === 'granel' ? ' kg' : ' u.'}</Di>
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

/* ---- Pestaña Presentaciones (granel): tamaño + % ganancia sobre el costo neto activo ---- */
function PresentacionesTab({ prod: p }) {
  const { store, isAdmin, toast } = useProductos();
  const neto = store.costoNeto(p);
  const [rows, setRows] = useState(() =>
    (p.presentaciones || []).map((pr) => ({
      id: pr.id,
      tamStr: pr.tamKg ? String(pr.tamKg < 1 ? Math.round(pr.tamKg * 1000) : pr.tamKg) : '',
      unidad: pr.tamKg && pr.tamKg < 1 ? 'g' : 'kg',
      ganancia: String(pr.ganancia ?? ''),
    })),
  );
  const setRow = (i, patch) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  const delRow = (i) => setRows((r) => r.filter((_, j) => j !== i));
  const addRow = () => setRows((r) => [...r, { id: null, tamStr: '', unidad: 'g', ganancia: '' }]);

  const tamKgDe = (r) => { const t = parseFloat(r.tamStr); if (isNaN(t) || t <= 0) return 0; return r.unidad === 'kg' ? t : t / 1000; };

  const guardar = () => {
    const presentaciones = rows.map((r) => ({ id: r.id || null, tamKg: tamKgDe(r), ganancia: Number(r.ganancia) || 0 })).filter((x) => x.tamKg > 0);
    const res = store.guardarPresentaciones(p.id, presentaciones);
    toast(res.ok ? 'Presentaciones guardadas.' : res.error, res.ok ? 'ok' : 'err');
  };

  return (
    <div className={s.form}>
      <div className={cx(s.callout, s.info)}>
        Cada presentación se valoriza sobre el <strong>costo neto</strong> del proveedor activo
        (<strong>{money(neto)}</strong> /kg) × tamaño × (1 + ganancia %).
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr .7fr .9fr 1fr .6fr auto', gap: 8 }}>
          <div className={s['mini-label']}>Tamaño</div>
          <div className={s['mini-label']}>Unidad</div>
          <div className={s['mini-label']}>Ganancia %</div>
          <div className={s['mini-label']}>Precio</div>
          <div className={s['mini-label']}>En stock</div>
          <div />
        </div>
        {rows.map((r, i) => {
          const tamKg = tamKgDe(r);
          const precio = neto * tamKg * (1 + (Number(r.ganancia) || 0) / 100);
          const stk = r.id ? store.suma({ productoId: p.id, presentacionId: r.id, estado: 'disponible' }) : 0;
          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr .7fr .9fr 1fr .6fr auto', gap: 8, alignItems: 'center' }}>
              <input type="number" min="0" step="1" value={r.tamStr} placeholder="500" onChange={(e) => setRow(i, { tamStr: e.target.value })} />
              <select value={r.unidad} onChange={(e) => setRow(i, { unidad: e.target.value })}>
                <option value="g">g</option>
                <option value="kg">kg</option>
              </select>
              <input type="number" min="0" step="0.1" value={r.ganancia} placeholder="0" onChange={(e) => setRow(i, { ganancia: e.target.value })} />
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
function ProveedorTab({ prod: p }) {
  const { store, isAdmin, toast } = useProductos();
  const proveedores = store.state.proveedores;
  const [rows, setRows] = useState(() =>
    (p.proveedores || []).map((e) => ({ proveedorId: e.proveedorId, costo: String(e.costo ?? ''), descuento: String(e.descuento ?? ''), flete: String(e.flete ?? '') })),
  );
  const [activo, setActivo] = useState(p.proveedorActivoId ?? null);

  const setRow = (i, patch) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  const delRow = (i) => setRows((r) => r.filter((_, j) => j !== i));
  const addRow = () => {
    const usados = new Set(rows.map((r) => Number(r.proveedorId)));
    const libre = proveedores.find((pv) => !usados.has(pv.id)) || proveedores[0];
    if (!libre) { toast('Primero creá proveedores en el menú Proveedores.', 'err'); return; }
    setRows((r) => [...r, { proveedorId: libre.id, costo: '', descuento: '', flete: '' }]);
  };

  const guardar = () => {
    const res = store.guardarProveedoresProducto(p.id, { proveedores: rows, proveedorActivoId: activo });
    toast(res.ok ? 'Proveedores del producto guardados.' : res.error, res.ok ? 'ok' : 'err');
  };

  return (
    <div className={s.form}>
      <div className={cx(s.callout, s.info)}>
        Cargá el costo del producto con cada proveedor (descuento y flete en %). Tildá con cuál
        <strong> vino esta última vez</strong>: ese es el proveedor activo que define el costo y los precios.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '48px 1.6fr 1fr .9fr .9fr 1fr auto', gap: 8, alignItems: 'end' }}>
          <div className={s['mini-label']} style={{ textAlign: 'center' }}>Activo</div>
          <div className={s['mini-label']}>Proveedor</div>
          <div className={s['mini-label']}>Costo</div>
          <div className={s['mini-label']}>Desc. %</div>
          <div className={s['mini-label']}>Flete %</div>
          <div className={s['mini-label']}>Costo neto</div>
          <div />
        </div>
        {rows.map((r, i) => {
          const neto = store.costoNetoEntry({ costo: r.costo, descuento: r.descuento, flete: r.flete });
          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '48px 1.6fr 1fr .9fr .9fr 1fr auto', gap: 8, alignItems: 'center' }}>
              <input type="radio" name="prov-activo" style={{ width: 18, height: 18, justifySelf: 'center' }}
                checked={Number(activo) === Number(r.proveedorId)} onChange={() => setActivo(Number(r.proveedorId))} />
              <select value={r.proveedorId} onChange={(e) => setRow(i, { proveedorId: Number(e.target.value) })}>
                {proveedores.map((pv) => <option key={pv.id} value={pv.id}>{pv.nombre}</option>)}
              </select>
              <input type="number" min="0" step="0.01" value={r.costo} placeholder="0" onChange={(e) => setRow(i, { costo: e.target.value })} />
              <input type="number" min="0" step="0.1" value={r.descuento} placeholder="0" onChange={(e) => setRow(i, { descuento: e.target.value })} />
              <input type="number" min="0" step="0.1" value={r.flete} placeholder="0" onChange={(e) => setRow(i, { flete: e.target.value })} />
              <div className={s.mono} style={{ fontWeight: 700 }}>{money(neto)}</div>
              <button type="button" className={s['pres-remove']} onClick={() => delRow(i)}>×</button>
            </div>
          );
        })}
        {!rows.length && <div className={s.muted} style={{ padding: '8px 0' }}>Sin proveedores asignados a este producto.</div>}
      </div>
      {isAdmin && (
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <Btn variant="btn-ghost" small onClick={addRow}>+ Agregar proveedor</Btn>
          <Btn variant="btn-primary" small onClick={guardar}>Guardar</Btn>
        </div>
      )}
    </div>
  );
}

/* ---- Pestaña Costo: costo neto del proveedor activo y comparación ---- */
function CostoTab({ prod: p }) {
  const { store } = useProductos();
  const act = store.proveedorActivoEntry(p);
  const unidad = p.tipo === 'granel' ? '/kg' : '/u';

  if (!act) {
    return <div className={cx(s.callout, s.info)}>Asigná un proveedor en la pestaña <strong>Proveedor</strong> para calcular el costo.</div>;
  }
  const bruto = Number(act.costo) || 0;
  const desc = Number(act.descuento) || 0;
  const flete = Number(act.flete) || 0;
  const neto = store.costoNetoEntry(act);
  const nombreAct = (store.getProveedor(act.proveedorId) || {}).nombre || '—';

  const comp = (p.proveedores || []).map((e) => (
    <tr key={e.proveedorId}>
      <td>{(store.getProveedor(e.proveedorId) || {}).nombre || '—'}{e.proveedorId === p.proveedorActivoId && <span className={cx(s.pill, s['st-disponible'])} style={{ marginLeft: 6 }}>Activo</span>}</td>
      <td className={s.num}>{money(e.costo)}</td>
      <td className={s.num}>{num(e.descuento, 1)}%</td>
      <td className={s.num}>{num(e.flete, 1)}%</td>
      <td className={cx(s.num, s.mono)}>{money(store.costoNetoEntry(e))}</td>
    </tr>
  ));

  return (
    <>
      <div className={cx(s.callout)} style={{ marginBottom: 12 }}>
        Costo del proveedor activo <strong>{nombreAct}</strong>:
      </div>
      <div className={s['detalle-grid']}>
        <Di label="Costo bruto">{money(bruto)} {unidad}</Di>
        <Di label={'Descuento (' + num(desc, 1) + '%)'}>− {money(bruto * desc / 100)}</Di>
        <Di label={'Flete (' + num(flete, 1) + '%)'}>+ {money(bruto * (1 - desc / 100) * flete / 100)}</Di>
      </div>
      <div className={cx(s.callout, s.ok)}>
        Costo neto: <strong>{money(neto)} {unidad}</strong>
      </div>
      <h3 className={s['card-title']} style={{ marginTop: 12 }}>Comparación por proveedor</h3>
      <Table cols={[{ h: 'Proveedor' }, { h: 'Costo', num: true }, { h: 'Desc.', num: true }, { h: 'Flete', num: true }, { h: 'Neto', num: true }]} empty="Sin proveedores.">
        {comp}
      </Table>
    </>
  );
}

/* ---- Pestaña Venta: listas de precio por % de ganancia sobre el costo neto ---- */
function VentaTab({ prod: p }) {
  const { store, isAdmin, toast } = useProductos();
  const neto = store.costoNeto(p);
  const unidad = p.tipo === 'granel' ? '/kg' : '/u';
  const act = store.proveedorActivoEntry(p);
  const nombreAct = act ? (store.getProveedor(act.proveedorId) || {}).nombre : null;

  const [rows, setRows] = useState(() =>
    (p.listasPrecio || []).map((l) => ({ id: l.id, nombre: l.nombre, ganancia: String(l.ganancia ?? '') })),
  );
  const setRow = (i, patch) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  const delRow = (i) => setRows((r) => r.filter((_, j) => j !== i));
  const addRow = () => setRows((r) => [...r, { id: null, nombre: '', ganancia: '' }]);

  const guardar = () => {
    const res = store.guardarListasProducto(p.id, { listasPrecio: rows });
    toast(res.ok ? 'Listas de precio guardadas.' : res.error, res.ok ? 'ok' : 'err');
  };

  return (
    <div className={s.form}>
      <div className={cx(s.callout, s.info)}>
        El precio se calcula sobre el <strong>costo neto</strong> del proveedor activo{nombreAct ? <> (<strong>{nombreAct}</strong>)</> : ''}:
        {' '}<strong>{money(neto)} {unidad}</strong>. Definí una ganancia (%) por lista (minorista, mayorista, oferta…).
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr .9fr 1.1fr auto', gap: 8 }}>
          <div className={s['mini-label']}>Lista</div>
          <div className={s['mini-label']}>Ganancia %</div>
          <div className={s['mini-label']}>Precio</div>
          <div />
        </div>
        {rows.map((r, i) => {
          const precio = neto * (1 + (Number(r.ganancia) || 0) / 100);
          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.6fr .9fr 1.1fr auto', gap: 8, alignItems: 'center' }}>
              <input value={r.nombre} placeholder="Ej: Minorista" onChange={(e) => setRow(i, { nombre: e.target.value })} />
              <input type="number" min="0" step="0.1" value={r.ganancia} placeholder="0" onChange={(e) => setRow(i, { ganancia: e.target.value })} />
              <div className={s.mono} style={{ fontWeight: 700 }}>{money(precio)} {unidad}</div>
              <button type="button" className={s['pres-remove']} onClick={() => delRow(i)}>×</button>
            </div>
          );
        })}
        {!rows.length && <div className={s.muted} style={{ padding: '8px 0' }}>Sin listas de precio.</div>}
      </div>
      {isAdmin && (
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <Btn variant="btn-ghost" small onClick={addRow}>+ Agregar lista</Btn>
          <Btn variant="btn-primary" small onClick={guardar}>Guardar</Btn>
        </div>
      )}
    </div>
  );
}
