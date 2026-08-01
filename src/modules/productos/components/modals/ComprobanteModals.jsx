import { useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../../context/ProductosContext.jsx';
import { money, num, fmtFecha, isoDate } from '../../domain/format.js';
import { TIPOS_COMPROBANTE, ESTADOS_COMPROBANTE, LETRAS_COMPROBANTE, CONDICIONES_PAGO } from '../../domain/constants.js';
import { ModalShell } from '../Modal.jsx';
import { sucursalOptions, productoOptions, presentacionOptions } from '../selectOptions.jsx';
import { Table, Btn, s } from '../ui.jsx';

export function ComprobanteTag({ tipo }) {
  const m = TIPOS_COMPROBANTE[tipo] || { label: tipo, tag: 'tag-ajuste' };
  return <span className={cx(s['mov-tag'], s[m.tag])}>{m.label}</span>;
}
export function ComprobanteEstadoPill({ estado }) {
  const m = ESTADOS_COMPROBANTE[estado] || {};
  return <span className={cx(s.pill, s[m.pill])}>{m.label || estado}</span>;
}
/** Nº legible: A 0001-00001024. */
export function comprobanteNro(c) {
  return `${c.letra} ${c.puntoVenta}-${String(c.numero || c.id).padStart(8, '0')}`;
}

/* ============================== NUEVO COMPROBANTE ============================== */
export function ComprobanteFormModal({ proveedorId, tipo: tipoInit }) {
  const { store, act, closeModal, toast, sucOperativa } = useProductos();

  const [tipo, setTipo] = useState(tipoInit || 'factura');
  const [letra, setLetra] = useState('A');
  const [puntoVenta, setPuntoVenta] = useState('0001');
  const [numero, setNumero] = useState('');
  const [fecha, setFecha] = useState(isoDate(new Date()));
  const [fechaCarga, setFechaCarga] = useState(isoDate(new Date()));
  const [provId, setProvId] = useState(proveedorId || store.state.proveedores[0]?.id || '');
  const [sucId, setSucId] = useState(sucOperativa() ?? '');
  const [condicionPago, setCondicionPago] = useState('cuenta_corriente');
  const [recepcion, setRecepcion] = useState(false);
  const [venc, setVenc] = useState('');
  const [obs, setObs] = useState('');
  const [items, setItems] = useState(() => [nuevoItem(store, proveedorId)]);

  const permiteRecepcion = tipo === 'factura' || tipo === 'remito';

  /** Cuánto se demoró en cargarse el comprobante. Null si alguna fecha falta. */
  const diasAtraso = fecha && fechaCarga
    ? Math.round((new Date(fechaCarga) - new Date(fecha)) / 86400000)
    : null;

  const setItem = (i, patch) => setItems((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  const delItem = (i) => setItems((r) => r.filter((_, j) => j !== i));
  const addItem = () => setItems((r) => [...r, nuevoItem(store, provId)]);

  // Al cambiar el producto de una fila: precargar IVA y costo del proveedor elegido.
  const onProducto = (i, prodVal) => {
    const prod = store.getProducto(parseInt(prodVal, 10));
    const entry = prod && (prod.proveedores || []).find((e) => e.proveedorId === parseInt(provId, 10));
    setItem(i, {
      productoId: prodVal, presId: '',
      iva: prod ? String(prod.iva ?? 21) : '21',
      costoUnitario: entry ? String(entry.costo) : '',
    });
  };

  const calcRow = (it) => {
    const cantidad = Number(it.cantidad) || 0, costo = Number(it.costoUnitario) || 0, desc = Number(it.descuento) || 0;
    const neto = cantidad * costo * (1 - desc / 100);
    return { neto, iva: neto * (Number(it.iva) || 0) / 100 };
  };
  const tot = items.reduce((acc, it) => { const r = calcRow(it); acc.neto += r.neto; acc.iva += r.iva; return acc; }, { neto: 0, iva: 0 });
  const total = tot.neto + tot.iva;

  /**
   * DIFERENCIAS DE COSTO
   * ------------------------------------------------------------------
   * La factura ES la lista de precios nueva del proveedor. Si lo facturado no
   * coincide con el costo cargado y nadie lo actualiza, el catálogo se queda
   * viejo en silencio y se vende con el margen equivocado. Se compara acá
   * mismo, en memoria, y se ofrece actualizar en la misma operación.
   */
  const impacto = useMemo(() => {
    const pid = parseInt(provId, 10);
    if (!pid) return [];
    const vistos = new Set();
    const out = [];
    for (const it of items) {
      const prodId = parseInt(it.productoId, 10);
      const costo = Number(it.costoUnitario) || 0;
      if (!prodId || vistos.has(prodId)) continue;
      const prod = store.getProducto(prodId);
      if (!prod) continue;
      vistos.add(prodId);

      const entry = (prod.proveedores || []).find((e) => e.proveedorId === pid) || null;
      const costoCargado = entry ? entry.costo : null;
      const dif = costoCargado != null && costo > 0 ? costo - costoCargado : 0;
      // Medio punto de tolerancia: no vale molestar por un redondeo.
      const difRelevante = costoCargado != null && costo > 0
        && Math.abs(dif) >= 0.005
        && (costoCargado <= 0 || Math.abs(dif / costoCargado) >= 0.005);
      const variacion = difRelevante && costoCargado > 0 ? (costo / costoCargado - 1) * 100 : null;

      // Heurística: si la diferencia es casi exactamente una alícuota de IVA, lo
      // más probable es que el costo cargado tenga el IVA adentro.
      const pareceIva = variacion != null
        && [21, 10.5].some((a) => Math.abs(Math.abs(variacion) - a) < 0.6);

      out.push({
        productoId: prodId,
        nombre: prod.nombre,
        prod,
        entry,
        iva: prod.iva,
        costoCargado,
        costoFacturado: costo,
        difRelevante,
        variacion,
        pareceIva,
        esActivo: prod.proveedorActivoId === pid,
        activoNombre: store.getProveedor(prod.proveedorActivoId)?.nombre || '—',
      });
    }
    return out;
  }, [items, provId, store]);

  const diferencias = impacto.filter((d) => d.difRelevante);
  const cambiablesActivo = impacto.filter((d) => !d.esActivo && (d.entry || d.costoFacturado > 0));

  // El costo se tilda por defecto: olvidarse de actualizarlo es el error que
  // esto evita. El proveedor activo NO: cambia el precio de góndola y esa
  // decisión tiene que ser deliberada.
  const [costosOmitidos, setCostosOmitidos] = useState(() => new Set());
  const [activarIds, setActivarIds] = useState(() => new Set());
  const toggleEnSet = (setter) => (prodId) => setter((prev) => {
    const next = new Set(prev);
    if (next.has(prodId)) next.delete(prodId); else next.add(prodId);
    return next;
  });
  const toggleCosto = toggleEnSet(setCostosOmitidos);
  const toggleActivar = toggleEnSet(setActivarIds);

  const costosAActualizar = diferencias.filter((d) => !costosOmitidos.has(d.productoId));
  const aActivar = cambiablesActivo.filter((d) => activarIds.has(d.productoId));
  const hayAvisoIva = diferencias.some((d) => d.pareceIva && !costosOmitidos.has(d.productoId));

  /**
   * Precio de góndola que quedaría. Solo cambia si ese proveedor manda el
   * precio (ya es el activo, o el usuario tildó que pase a serlo).
   */
  const precioProyectado = (d) => {
    const seraActivo = d.esActivo || activarIds.has(d.productoId);
    if (!seraActivo) return null;
    const usaCosto = d.difRelevante && !costosOmitidos.has(d.productoId);
    const base = d.entry || { costo: 0, descuento: 0, flete: 0 };
    const cn = store.costoNetoEntry({ ...base, costo: usaCosto || !d.entry ? d.costoFacturado : base.costo });
    const ganancia = (d.prod.listasPrecio || [])[0]?.ganancia || 0;
    return store.precioFinal(cn * (1 + ganancia / 100), d.iva);
  };

  const guardar = () => {
    const parsed = items
      .filter((it) => it.productoId && Number(it.cantidad) > 0)
      .map((it) => ({
        productoId: parseInt(it.productoId, 10), presentacionId: it.presId ? parseInt(it.presId, 10) : null,
        cantidad: it.cantidad, costoUnitario: it.costoUnitario, descuento: it.descuento, iva: it.iva,
      }));
    if (!parsed.length) { toast('Agregá al menos un ítem con cantidad.', 'err'); return; }
    act(store.crearComprobante({
      tipo, letra, puntoVenta, numero, fecha, fechaCarga, proveedorId: parseInt(provId, 10),
      sucursalId: sucId ? parseInt(sucId, 10) : null, condicionPago, recepcion: permiteRecepcion && recepcion,
      vencimientoPago: venc || null, observaciones: obs.trim(), items: parsed,
      actualizarCostos: costosAActualizar.map((d) => ({ productoId: d.productoId, costo: d.costoFacturado })),
      activarProveedor: aActivar.map((d) => d.productoId),
    }), costosAActualizar.length || aActivar.length
      ? `Comprobante registrado · ${costosAActualizar.length} costo(s) y ${aActivar.length} activo(s) actualizado(s).`
      : 'Comprobante registrado.');
  };

  return (
    <ModalShell
      title="Nuevo comprobante de compra"
      wide
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Registrar', clase: 'btn-primary', onClick: guardar },
      ]}
    >
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Tipo <span className={s.req}>*</span></label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {Object.keys(TIPOS_COMPROBANTE).map((k) => <option key={k} value={k}>{TIPOS_COMPROBANTE[k].label}</option>)}
          </select>
        </div>
        <div className={s.field}>
          <label>Proveedor <span className={s.req}>*</span></label>
          <select value={provId} onChange={(e) => setProvId(e.target.value)}>{productoProveedorOptions(store)}</select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1.2fr 1fr', gap: 8 }}>
        <div className={s.field}>
          <label>Letra</label>
          <select value={letra} onChange={(e) => setLetra(e.target.value)}>
            {LETRAS_COMPROBANTE.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div className={s.field}>
          <label>Punto de venta</label>
          <input value={puntoVenta} onChange={(e) => setPuntoVenta(e.target.value)} placeholder="0001" />
        </div>
        <div className={s.field}>
          <label>Número</label>
          <input type="number" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="auto" />
        </div>
        <div className={s.field}>
          <label>Fecha del comprobante</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
      </div>

      {/* Dos fechas distintas y las dos importan: la del papel define el
          período fiscal; la de carga dice cuándo entró de verdad al sistema. */}
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Fecha de carga</label>
          <input type="date" value={fechaCarga} onChange={(e) => setFechaCarga(e.target.value)} />
          <div className={s.hint} style={{ margin: '6px 0 0' }}>
            Cuándo se registra en el sistema. Por defecto hoy; cambiala si estás cargando algo atrasado.
          </div>
        </div>
        <div className={s.field}>
          <label>Días de atraso</label>
          <input value={diasAtraso === null ? '—' : `${diasAtraso} día(s)`} readOnly tabIndex={-1} />
          <div className={s.hint} style={{ margin: '6px 0 0' }}>
            Diferencia entre la fecha del comprobante y la de carga.
          </div>
        </div>
      </div>

      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Condición de pago</label>
          <select value={condicionPago} onChange={(e) => setCondicionPago(e.target.value)}>
            {Object.keys(CONDICIONES_PAGO).map((k) => <option key={k} value={k}>{CONDICIONES_PAGO[k]}</option>)}
          </select>
        </div>
        <div className={s.field}>
          <label>Vencimiento de pago</label>
          <input type="date" value={venc} onChange={(e) => setVenc(e.target.value)} />
        </div>
      </div>

      {permiteRecepcion && (
        <div className={s['form-grid']}>
          <div className={s.field}>
            <label>Sucursal de recepción</label>
            <select value={sucId} onChange={(e) => setSucId(e.target.value)}>{sucursalOptions(store, false)}</select>
          </div>
          <label className={s['granel-toggle']} style={{ alignSelf: 'end' }}>
            <input type="checkbox" checked={recepcion} onChange={(e) => setRecepcion(e.target.checked)} />
            <span>
              <span className={s['t-title']}>Ingresa stock (recepción)</span><br />
              <span className={s['t-sub']}>Suma al inventario la mercadería de los ítems.</span>
            </span>
          </label>
        </div>
      )}

      <div className={s['section-title']}>Ítems</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr .8fr .9fr .7fr .7fr 1fr auto', gap: 8, marginBottom: 6 }}>
        {['Producto', 'Present.', 'Cant.', 'Costo u.', 'Desc%', 'IVA%', 'Subtotal', ''].map((h, i) => (
          <div key={i} className={s['mini-label']}>{h}</div>
        ))}
      </div>
      {items.map((it, i) => {
        const prod = it.productoId ? store.getProducto(parseInt(it.productoId, 10)) : null;
        const r = calcRow(it);
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr .8fr .9fr .7fr .7fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <select value={it.productoId} onChange={(e) => onProducto(i, e.target.value)}>{productoOptions(store, false)}</select>
            <select value={it.presId} onChange={(e) => setItem(i, { presId: e.target.value })} disabled={!prod || prod.tipo !== 'granel'}>
              {prod ? presentacionOptions(prod, true) : <option value="">—</option>}
            </select>
            <input type="number" min="0" step="0.001" value={it.cantidad} onChange={(e) => setItem(i, { cantidad: e.target.value })} />
            <input type="number" min="0" step="0.01" value={it.costoUnitario} onChange={(e) => setItem(i, { costoUnitario: e.target.value })} />
            <input type="number" min="0" step="0.1" value={it.descuento} onChange={(e) => setItem(i, { descuento: e.target.value })} />
            <input type="number" min="0" step="0.1" value={it.iva} onChange={(e) => setItem(i, { iva: e.target.value })} />
            <div className={cx(s.mono, s.num)} style={{ fontWeight: 700 }}>{money(r.neto)}</div>
            <button type="button" className={s['pres-remove']} onClick={() => delItem(i)}>×</button>
          </div>
        );
      })}
      <button type="button" className={cx(s.btn, s['btn-ghost'], s['btn-sm'])} onClick={addItem}>+ Agregar ítem</button>

      {/*
        IMPACTO EN PRECIOS. Las dos decisiones que mueven la góndola, juntas y
        mostrando el número que importa: el precio final que va a quedar.
      */}
      {(diferencias.length > 0 || cambiablesActivo.length > 0) && (
        <>
          <div className={s['section-title']}>Impacto en precios</div>
          <div className={cx(s.callout, s.warn)}>
            La factura es la lista nueva del proveedor. Si el costo no se actualiza, el catálogo
            queda viejo y se sigue vendiendo con el margen anterior. <strong>Pasar el proveedor a
            activo</strong> hace que su costo sea el que define el precio de venta — por eso no es
            automático.
          </div>

          {hayAvisoIva && (
            <div className={cx(s.callout, s.danger)}>
              La diferencia coincide casi exactamente con una alícuota de IVA. Puede que el costo
              cargado tenga el IVA incluido: los costos se guardan <strong>netos, sin IVA</strong>.
              Verificá antes de actualizar.
            </div>
          )}

          <Table
            cols={[
              { h: 'Actualizar costo' }, { h: 'Producto' },
              { h: 'Costo cargado', num: true }, { h: 'Facturado', num: true }, { h: 'Var.', num: true },
              { h: 'Proveedor activo' }, { h: 'Precio góndola', num: true },
            ]}
          >
            {impacto.map((d) => {
              const incluirCosto = d.difRelevante && !costosOmitidos.has(d.productoId);
              const activar = activarIds.has(d.productoId);
              const subio = d.variacion != null && d.variacion > 0;
              const proy = precioProyectado(d);
              const actual = store.precioFinal(store.precioBaseVenta(d.prod), d.iva);
              const cambia = proy != null && Math.abs(proy - actual) > 0.005;
              return (
                <tr key={d.productoId}>
                  <td style={{ width: 120 }}>
                    {d.difRelevante ? (
                      <input
                        type="checkbox"
                        checked={incluirCosto}
                        aria-label={`Actualizar el costo de ${d.nombre}`}
                        onChange={() => toggleCosto(d.productoId)}
                      />
                    ) : <span className={s.muted}>sin cambio</span>}
                  </td>
                  <td>{d.nombre}</td>
                  <td className={s.num}>{d.costoCargado == null ? <span className={s.muted}>nuevo</span> : money(d.costoCargado)}</td>
                  <td className={s.num}><strong>{money(d.costoFacturado)}</strong></td>
                  <td className={s.num}>
                    {d.variacion == null ? '—' : (
                      <strong style={{ color: subio ? 'var(--crm-color-danger)' : 'var(--crm-color-success)' }}>
                        {d.variacion > 0 ? '+' : ''}{num(d.variacion, 1)}%
                      </strong>
                    )}
                  </td>
                  <td>
                    {d.esActivo ? (
                      <span className={cx(s.badge, s['badge-entero'])}>Ya es el activo</span>
                    ) : (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                        <input type="checkbox" checked={activar} onChange={() => toggleActivar(d.productoId)} />
                        <span className={s.hint} style={{ margin: 0 }}>hoy: {d.activoNombre}</span>
                      </label>
                    )}
                  </td>
                  <td className={s.num}>
                    {proy == null ? (
                      <span className={s.muted} title="Este proveedor no define el precio">sin efecto</span>
                    ) : cambia ? (
                      <>
                        <span className={s.muted}>{money(actual)}</span>{' → '}
                        <strong style={{ color: proy > actual ? 'var(--crm-color-danger)' : 'var(--crm-color-success)' }}>
                          {money(proy)}
                        </strong>
                      </>
                    ) : money(actual)}
                  </td>
                </tr>
              );
            })}
          </Table>
          <div className={s.toolbar} style={{ marginBottom: 10 }}>
            <span className={s.hint} style={{ margin: 0, flex: 1 }}>
              {costosAActualizar.length} costo(s) y {aActivar.length} cambio(s) de proveedor activo.
              Todo queda en el historial y se puede deshacer.
            </span>
            {diferencias.length > 0 && (
              <>
                <Btn small onClick={() => setCostosOmitidos(new Set(diferencias.map((d) => d.productoId)))}>Ningún costo</Btn>
                <Btn small onClick={() => setCostosOmitidos(new Set())}>Todos los costos</Btn>
              </>
            )}
          </div>
        </>
      )}

      <div className={s.field} style={{ marginTop: 14 }}>
        <label>Observaciones</label>
        <textarea rows="2" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Referencia, remito asociado, etc." />
      </div>

      <div className={cx(s.callout, s.ok)} style={{ display: 'flex', justifyContent: 'flex-end', gap: 24 }}>
        <span>Neto: <strong>{money(tot.neto)}</strong></span>
        <span>IVA: <strong>{money(tot.iva)}</strong></span>
        <span>Total: <strong>{money(total)}</strong></span>
      </div>
    </ModalShell>
  );
}

function nuevoItem(store, provId) {
  const prod = store.state.productos[0];
  const entry = prod && provId ? (prod.proveedores || []).find((e) => e.proveedorId === provId) : null;
  return {
    productoId: prod?.id ?? '', presId: '', cantidad: '1',
    costoUnitario: entry ? String(entry.costo) : '', descuento: '0', iva: prod ? String(prod.iva ?? 21) : '21',
  };
}
function productoProveedorOptions(store) {
  return store.state.proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>);
}

/* ============================== DETALLE DE COMPROBANTE ============================== */
export function ComprobanteDetalleModal({ id }) {
  const { store, closeModal } = useProductos();
  const c = store.getComprobante(id);
  if (!c) return null;
  const prov = store.getProveedor(c.proveedorId);
  const suc = c.sucursalId ? store.getSucursal(c.sucursalId) : null;

  const Di = ({ label, children }) => <div className={s.di}><div className={s.l}>{label}</div><div className={s.v}>{children}</div></div>;

  const filas = c.items.map((it, i) => {
    const p = store.getProducto(it.productoId);
    return (
      <tr key={i}>
        <td>{p ? p.nombre : '—'}</td>
        <td>{p ? store.presLabel(p, it.presentacionId) : '—'}</td>
        <td className={s.num}>{num(it.cantidad, 3)}</td>
        <td className={s.num}>{money(it.costoUnitario)}</td>
        <td className={s.num}>{num(it.descuento, 1)}%</td>
        <td className={s.num}>{num(it.iva, 1)}%</td>
        <td className={cx(s.num, s.mono)}>{money(it.subtotal)}</td>
      </tr>
    );
  });

  return (
    <ModalShell title={'Comprobante ' + comprobanteNro(c)} wide onClose={closeModal} footer={[{ texto: 'Cerrar', clase: 'btn-ghost', onClick: closeModal }]}>
      <div className={s['detalle-grid']}>
        <Di label="Tipo"><ComprobanteTag tipo={c.tipo} /></Di>
        <Di label="Estado"><ComprobanteEstadoPill estado={c.estado} /></Di>
        <Di label="Proveedor">{prov ? prov.nombre : '—'}</Di>
        <Di label="Fecha del comprobante">{fmtFecha(c.fecha)}</Di>
        <Di label="Fecha de carga">{c.fechaCarga ? fmtFecha(c.fechaCarga) : '—'}</Di>
        <Di label="Condición">{CONDICIONES_PAGO[c.condicionPago] || c.condicionPago}</Di>
        <Di label="Recepción">{c.recepcion ? 'Sí (ingresó stock)' : 'No'}</Di>
        <Di label="Sucursal">{suc ? suc.nombre : '—'}</Di>
        <Di label="Vencimiento">{c.vencimientoPago ? fmtFecha(c.vencimientoPago) : '—'}</Di>
        <Di label="Total">{money(c.total)}</Di>
      </div>
      {c.observaciones && <div className={s.callout}>{c.observaciones}</div>}
      <h3 className={s['card-title']}>Ítems</h3>
      <Table cols={[{ h: 'Producto' }, { h: 'Present.' }, { h: 'Cant.', num: true }, { h: 'Costo u.', num: true }, { h: 'Desc.', num: true }, { h: 'IVA', num: true }, { h: 'Subtotal', num: true }]}>
        {filas}
      </Table>
      <div className={cx(s.callout, s.ok)} style={{ display: 'flex', justifyContent: 'flex-end', gap: 24, marginTop: 12 }}>
        <span>Neto: <strong>{money(c.subtotalNeto)}</strong></span>
        <span>IVA: <strong>{money(c.ivaTotal)}</strong></span>
        <span>Total: <strong>{money(c.total)}</strong></span>
      </div>
    </ModalShell>
  );
}
