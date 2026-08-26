import { useCallback, useEffect, useState } from 'react';
import { Tabs, Tab } from '@mui/material';
import { cx } from '@shared/utils/classNames.js';
import { httpClient } from '@core/services/httpClient.js';
import { useProductos } from '../../context/ProductosContext.jsx';
import { useSeccion } from '../../hooks/useSeccion.js';
import { money, fmtFecha, fmtFechaHora } from '../../domain/format.js';
import { CONDICIONES_IVA_PROV } from '../../domain/constants.js';
import { ModalShell } from '../Modal.jsx';
import { Table, Btn, s } from '../ui.jsx';
import { ComprobanteTag, ComprobanteEstadoPill, comprobanteNro } from './ComprobanteModals.jsx';
import { ProveedorCostosTab } from './ProveedorCostosTab.jsx';

/** Días entre la fecha del comprobante y la de carga (0 si se cargó el mismo día). */
function atrasoDe(c) {
  if (!c.fechaCarga || !c.fecha) return 0;
  return Math.max(0, Math.round((new Date(c.fechaCarga) - new Date(c.fecha)) / 86400000));
}

/* ---- Alta / edición de proveedor ---- */
export function ProveedorFormModal({ provId }) {
  const { store, act, closeModal, toast } = useProductos();
  const prov = provId != null ? store.getProveedor(provId) : null;
  const ed = !!prov;

  const [nombre, setNombre] = useState(prov?.nombre || '');
  const [cuit, setCuit] = useState(prov?.cuit || '');
  const [condicionIva, setCondicionIva] = useState(prov?.condicionIva || 'responsable_inscripto');
  const [telefono, setTelefono] = useState(prov?.telefono || '');
  const [email, setEmail] = useState(prov?.email || '');
  const [direccion, setDireccion] = useState(prov?.direccion || '');
  // Clasificación compartida con el módulo Gastos: un proveedor, un CUIT, una
  // cuenta. Los flags solo definen en qué buscador aparece.
  const [proveeMercaderia, setProveeMercaderia] = useState(prov ? prov.proveeMercaderia !== false : true);
  const [proveeGastos, setProveeGastos] = useState(!!prov?.proveeGastos);

  const guardar = () => {
    if (!nombre.trim()) { toast('El nombre comercial es obligatorio.', 'err'); return; }
    const o = { nombre, cuit, condicionIva, telefono, email, direccion, proveeMercaderia, proveeGastos };
    act(prov ? store.editarProveedor(prov.id, o) : store.crearProveedor(o), prov ? 'Proveedor actualizado.' : 'Proveedor creado.');
  };

  return (
    <ModalShell
      title={ed ? 'Editar proveedor' : 'Nuevo proveedor'}
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: ed ? 'Guardar' : 'Crear', clase: 'btn-primary', onClick: guardar },
      ]}
    >
      <div className={s.field}>
        <label>Nombre comercial <span className={s.req}>*</span></label>
        <input value={nombre} placeholder="Ej: Molino Sur" onChange={(e) => setNombre(e.target.value)} />
      </div>
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>CUIT</label>
          <input value={cuit} placeholder="30-71234567-9" onChange={(e) => setCuit(e.target.value)} />
        </div>
        <div className={s.field}>
          <label>Condición frente al IVA</label>
          <select value={condicionIva} onChange={(e) => setCondicionIva(e.target.value)}>
            {Object.entries(CONDICIONES_IVA_PROV).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <div className={s.hint}>Un monotributista o exento no discrimina IVA: sus comprobantes se cargan con alícuota 0.</div>
        </div>
        <div className={s.field}>
          <label>Teléfono</label>
          <input value={telefono} placeholder="11-4000-0000" onChange={(e) => setTelefono(e.target.value)} />
        </div>
      </div>
      <div className={s.field}>
        <label>Email</label>
        <input value={email} placeholder="ventas@proveedor.com" onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className={s.field}>
        <label>Dirección</label>
        <input value={direccion} placeholder="Calle, número, localidad" onChange={(e) => setDireccion(e.target.value)} />
      </div>

      <div className={s.field}>
        <label>Qué provee</label>
        <div className={s.chipRow}>
          <label className={s.chip} style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={proveeMercaderia} onChange={(e) => setProveeMercaderia(e.target.checked)} />
            Mercadería (Compras)
          </label>
          <label className={s.chip} style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={proveeGastos} onChange={(e) => setProveeGastos(e.target.checked)} />
            Gastos
          </label>
        </div>
        <div className={s.hint}>
          Define en qué buscador aparece. Puede ser las dos cosas: el que trae mercadería y además
          te cobra el flete es un solo proveedor, con una sola cuenta.
        </div>
      </div>
    </ModalShell>
  );
}

/* ============================== DETALLE DE PROVEEDOR ============================== */

export function DetalleProveedorModal({ provId }) {
  const { store, closeModal } = useProductos();
  useSeccion('comprobantes');
  const prov = store.getProveedor(provId);
  const [tab, setTab] = useState(0);
  if (!prov) return null;

  const tabDefs = [
    { label: 'Operaciones', C: OperacionesTab },
    { label: 'Resumen Cta.', C: ResumenCtaTab },
    { label: 'Productos y costos', C: ProveedorCostosTab },
    { label: 'Percepciones', C: PercepcionesTab },
    { label: 'Pend. Entrega', C: PendEntregaTab },
    { label: 'Auditoría', C: AuditoriaTab },
    { label: 'Historial', C: HistorialProvTab },
  ];
  const Active = (tabDefs[tab] || tabDefs[0]).C;

  // Sin botón Editar: la ficha (identidad, clasificación, cómo cobra) se
  // administra en el MÓDULO Proveedores desde 0068 — acá solo lo operativo.
  const footer = [{ texto: 'Cerrar', clase: 'btn-ghost', onClick: closeModal }];

  return (
    /*
     * Sin ficha de datos arriba: CUIT, teléfono, email y dirección se editan en
     * el formulario del proveedor (botón Editar) y ocupaban media pantalla
     * antes de lo que se viene a mirar acá, que son las pestañas.
     */
    <ModalShell title={'Proveedor — ' + prov.nombre} wide onClose={closeModal} footer={footer}>
      <Tabs
        value={tab}
        onChange={(e, v) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        {tabDefs.map((t) => <Tab key={t.label} label={t.label} />)}
      </Tabs>
      <Active prov={prov} />
    </ModalShell>
  );
}

/* ---- Percepciones: los impuestos que ESTE proveedor cobra por adelantado ---- */
/*
 * Se configuran una vez acá y la carga de la factura las ofrece con un tilde:
 * el mismo proveedor a veces las trae y a veces no, así que jamás se aplican
 * solas. No son IVA — son pago a cuenta de otro impuesto y al cierre hay que
 * declarar cada una por separado, así que cada una lleva su nombre.
 */
function PercepcionesTab({ prov }) {
  const { store, isAdmin, toast } = useProductos();
  const [filas, setFilas] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await store.percepcionesProveedor(prov.id);
      setFilas((r ?? []).map((x) => ({ ...x, alicuota: String(x.alicuota) })));
    } catch { toast('No se pudieron cargar las percepciones.', 'err'); setFilas([]); }
  }, [store, prov.id, toast]);
  useEffect(() => { cargar(); }, [cargar]);

  const set = (i, patch) => setFilas((r) => r.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const quitar = (i) => setFilas((r) => r.filter((_, j) => j !== i));
  const agregar = () => setFilas((r) => [...r, { nombre: '', alicuota: '', base: 'neto', activa: true }]);

  const guardar = async () => {
    setGuardando(true);
    const res = await store.guardarPercepcionesProveedor(prov.id, filas.map((f) => ({
      nombre: f.nombre, alicuota: Number(f.alicuota) || 0, base: f.base, activa: f.activa !== false,
    })));
    setGuardando(false);
    if (!res.ok) { toast(res.error || 'No se pudo guardar.', 'err'); return; }
    toast('Percepciones guardadas.', 'ok');
    cargar();
  };

  if (filas === null) return <div className={s['empty-state']}>Cargando…</div>;

  return (
    <>
      <div className={cx(s.callout, s.info)}>
        Los impuestos que <strong>{prov.nombre}</strong> suma al pie de sus facturas
        (&ldquo;Perc. IVA RG 5329&rdquo;, Ingresos Brutos…). Se cargan acá una vez y al registrar
        una factura aparecen para <strong>tildar la que vino</strong> — nunca se aplican solas,
        porque el mismo proveedor a veces las trae y a veces no.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr .7fr 1fr .6fr auto', gap: 8, marginBottom: 6 }}>
        {['Nombre (como figura en la factura)', 'Alícuota %', 'Se calcula sobre', 'Activa', ''].map((h, i) => (
          <div key={i} className={s['mini-label']}>{h}</div>
        ))}
      </div>
      {filas.map((f, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr .7fr 1fr .6fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
          <input
            value={f.nombre}
            placeholder="Perc. IVA RG 5329"
            disabled={!isAdmin}
            onChange={(e) => set(i, { nombre: e.target.value })}
          />
          <input
            type="number" min="0" max="100" step="any"
            value={f.alicuota}
            placeholder="3"
            disabled={!isAdmin}
            onChange={(e) => set(i, { alicuota: e.target.value })}
          />
          <select value={f.base} disabled={!isAdmin} onChange={(e) => set(i, { base: e.target.value })}>
            <option value="neto">El neto gravado</option>
            <option value="total">El total con IVA</option>
          </select>
          <input
            type="checkbox"
            checked={f.activa !== false}
            disabled={!isAdmin}
            onChange={(e) => set(i, { activa: e.target.checked })}
          />
          {isAdmin && <button type="button" className={s['pres-remove']} onClick={() => quitar(i)}>×</button>}
        </div>
      ))}
      {!filas.length && (
        <div className={s.muted} style={{ padding: '8px 0' }}>
          Este proveedor no tiene percepciones configuradas.
        </div>
      )}

      {isAdmin && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <Btn variant="btn-ghost" small onClick={agregar}>+ Agregar percepción</Btn>
          <Btn variant="btn-primary" small onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Btn>
        </div>
      )}

      <div className={s.hint}>
        <strong>Sobre qué se calcula:</strong> casi todas van sobre el <strong>neto gravado</strong>{' '}
        (el subtotal después de la bonificación, antes del IVA) — la de IVA RG 5329 y las de
        Ingresos Brutos, por ejemplo. Alguna provincia calcula sobre el total con IVA; para esas
        está la otra opción. El importe siempre se puede corregir al cargar la factura: el papel manda.
      </div>
      <div className={s.hint}>
        <strong>Desactivar</strong> una en vez de borrarla deja de ofrecerla en las facturas nuevas
        sin tocar las viejas, que guardan su propia copia con el nombre y la alícuota del día.
      </div>
    </>
  );
}

/* ---- Operaciones: gestión de comprobantes del proveedor + atajos de alta ---- */
const ACCIONES_COMP = [
  { tipo: 'factura', label: '+ Factura' },
  { tipo: 'remito', label: '+ Remito' },
  { tipo: 'nota_credito', label: '+ N. crédito' },
  { tipo: 'nota_debito', label: '+ N. débito' },
  { tipo: 'orden_compra', label: '+ Orden compra' },
];
function OperacionesTab({ prov }) {
  const { store, isAdmin, openModal } = useProductos();
  const comps = store.comprobantesDe(prov.id);

  const filas = comps.map((c) => (
    <tr key={c.id} className={s.clickable} onClick={() => openModal('comprobanteDetalle', { id: c.id })}>
      <td>{fmtFecha(c.fecha)}</td>
      <td><ComprobanteTag tipo={c.tipo} /></td>
      <td className={s.mono}>{comprobanteNro(c)}</td>
      <td><ComprobanteEstadoPill estado={c.estado} /></td>
      <td className={s.num}>{money(c.total)}</td>
    </tr>
  ));

  return (
    <>
      <div className={cx(s.callout, s.info)}>
        Gestión de compras del proveedor. Cargá comprobantes (factura, remito, notas, orden de compra);
        los que ingresan stock lo hacen por la <strong>recepción</strong>.
      </div>
      {isAdmin && (
        <div className={s['detalle-actions']}>
          {ACCIONES_COMP.map((a) => (
            <Btn key={a.tipo} variant="btn-ingreso" small onClick={() => openModal('comprobanteForm', { proveedorId: prov.id, tipo: a.tipo })}>{a.label}</Btn>
          ))}
        </div>
      )}
      <Table cols={[{ h: 'Fecha' }, { h: 'Tipo' }, { h: 'Comprobante' }, { h: 'Estado' }, { h: 'Total', num: true }]} empty="Sin comprobantes con este proveedor.">
        {filas}
      </Table>
    </>
  );
}

function ResumenCtaTab({ prov }) {
  const { store, openModal } = useProductos();
  const saldo = store.cuentaProveedor(prov.id);
  /* LISTA DE TIPOS · los movimientos de la cuenta corriente. Le faltaba la
   * liquidación (la deuda de la mitad no facturada no figuraba como movimiento)
   * y filtraba por `condicionPago`, criterio que el backend ya no usa: la deuda
   * la define el documento. Mismo criterio que `cuentaProveedor` del store. */
  const chrono = store.comprobantesDe(prov.id)
    .filter((c) => c.estado === 'confirmado'
      && ['factura', 'liquidacion', 'nota_debito', 'nota_credito'].includes(c.tipo))
    .sort((a, b) => a.id - b.id);
  let run = 0;
  const rows = chrono.map((c) => {
    const signo = c.tipo === 'nota_credito' ? -1 : 1;
    run += signo * c.total;
    return { c, signo, run };
  }).reverse();

  const filas = rows.map(({ c, signo, run: saldoAc }) => (
    <tr key={c.id} className={s.clickable} onClick={() => openModal('comprobanteDetalle', { id: c.id })}>
      <td>{fmtFecha(c.fecha)}</td>
      {/* Cuándo se cargó de verdad: con la fecha del papel sola no se puede
          saber si un comprobante entró al sistema con semanas de atraso. */}
      <td>
        {c.fechaCarga ? fmtFecha(c.fechaCarga) : <span className={s.muted}>—</span>}
        {atrasoDe(c) > 0 && <div className={s.hint} style={{ margin: 0 }}>+{atrasoDe(c)} día(s)</div>}
      </td>
      <td><ComprobanteTag tipo={c.tipo} /></td>
      <td className={s.mono}>{comprobanteNro(c)}</td>
      <td className={s.num}>{signo > 0 ? money(c.total) : '—'}</td>
      <td className={s.num}>{signo < 0 ? money(c.total) : '—'}</td>
      <td className={cx(s.num, s.mono)}>{money(saldoAc)}</td>
    </tr>
  ));

  return (
    <>
      <div className={cx(s.callout, saldo > 1e-9 ? s.warn : s.ok)}>
        Saldo de cuenta corriente: <strong>{money(saldo)}</strong>{saldo > 1e-9 ? ' (a pagar al proveedor)' : ''}
      </div>
      <Table
        cols={[
          { h: 'Fecha' }, { h: 'Ingreso' }, { h: 'Tipo' }, { h: 'Comprobante' },
          { h: 'Debe', num: true }, { h: 'Haber', num: true }, { h: 'Saldo', num: true },
        ]}
        empty="Sin movimientos de cuenta corriente."
      >
        {filas}
      </Table>
      <div className={s.hint}>
        <strong>Fecha</strong> es la del comprobante del proveedor; <strong>Ingreso</strong> es cuándo se cargó
        en el sistema. La diferencia se muestra debajo cuando hay atraso.
      </div>
    </>
  );
}
function PendEntregaTab({ prov }) {
  const { store, openModal } = useProductos();
  const ocs = store.comprobantesDe(prov.id).filter((c) => c.tipo === 'orden_compra' && c.estado !== 'anulado');

  const filas = ocs.map((c) => (
    <tr key={c.id} className={s.clickable} onClick={() => openModal('comprobanteDetalle', { id: c.id })}>
      <td>{fmtFecha(c.fecha)}</td>
      <td className={s.mono}>{comprobanteNro(c)}</td>
      <td className={s.num}>{c.items.length}</td>
      <td className={s.num}>{money(c.total)}</td>
    </tr>
  ));

  return (
    <>
      <div className={cx(s.callout, s.info)}>
        Órdenes de compra emitidas a este proveedor, pendientes de recepción. (La recepción parcial y el cierre de la OC llegan más adelante.)
      </div>
      <Table cols={[{ h: 'Fecha' }, { h: 'Orden' }, { h: 'Ítems', num: true }, { h: 'Total', num: true }]} empty="Sin órdenes de compra pendientes.">
        {filas}
      </Table>
    </>
  );
}
/**
 * AUDITORÍA (0086): quién cambió qué condición comercial y cuándo, con el
 * antes → después. Lo escriben el formato de compra, las percepciones y la
 * ficha del proveedor. Los documentos (facturas, pagos, anulaciones) NO van
 * acá: ya quedan firmados con usuario y fecha en sus propias pantallas.
 */
function AuditoriaTab({ prov }) {
  const [filas, setFilas] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let vivo = true;
    httpClient.get(`/auditoria?entidad=proveedor&entidadId=${prov.id}`)
      .then((r) => { if (vivo) setFilas(Array.isArray(r) ? r : []); })
      .catch((e) => { if (vivo) setError(e?.data?.message || 'No se pudo cargar el registro.'); });
    return () => { vivo = false; };
  }, [prov.id]);

  if (error) return <div className={cx(s.callout, s.warn)}>{error}</div>;
  if (!filas) return <div className={s['empty-state']}>Cargando el registro…</div>;

  return (
    <>
      <div className={s.hint} style={{ marginTop: 0 }}>
        Los cambios <strong>a mano</strong> de las condiciones comerciales: formato de compra
        (costos, descuentos, flete, sin factura), percepciones y ficha del proveedor. Cada fila
        es un campo, con el valor anterior y el nuevo. Las facturas y los pagos no están acá:
        quedan firmados en sus propias pantallas.
      </div>
      <Table
        cols={[{ h: 'Fecha y hora' }, { h: 'Dónde' }, { h: 'Qué cambió' }, { h: 'Antes' }, { h: 'Ahora' }, { h: 'Quién' }]}
        empty="Sin cambios registrados. El registro existe desde el 26/8/2026: lo anterior a esa fecha no dejó rastro."
      >
        {filas.map((f) => (
          <tr key={f.id}>
            <td style={{ whiteSpace: 'nowrap' }}>{fmtFechaHora(f.fecha)}</td>
            <td>
              {f.ambito}
              {f.detalle && <div className={s.hint} style={{ margin: 0 }}>{f.detalle}</div>}
            </td>
            <td><strong>{f.campo}</strong></td>
            <td className={s.muted}>{f.antes || '—'}</td>
            <td><strong>{f.despues || '—'}</strong></td>
            <td>{f.usuario || <span className={s.muted}>—</span>}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
function HistorialProvTab({ prov }) {
  const { store, openModal } = useProductos();
  const comps = store.comprobantesDe(prov.id);

  const filas = comps.map((c) => (
    <tr key={c.id} className={s.clickable} onClick={() => openModal('comprobanteDetalle', { id: c.id })}>
      <td>{fmtFecha(c.fecha)}</td>
      <td><ComprobanteTag tipo={c.tipo} /></td>
      <td className={s.mono}>{comprobanteNro(c)}</td>
      <td><ComprobanteEstadoPill estado={c.estado} /></td>
      <td className={s.num}>{money(c.total)}</td>
    </tr>
  ));

  return (
    <>
      <div className={cx(s.callout, s.info)}>Todos los comprobantes del proveedor, del más reciente al más antiguo.</div>
      <Table cols={[{ h: 'Fecha' }, { h: 'Tipo' }, { h: 'Comprobante' }, { h: 'Estado' }, { h: 'Total', num: true }]} empty="Sin comprobantes.">
        {filas}
      </Table>
    </>
  );
}
