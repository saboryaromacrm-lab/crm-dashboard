import { useState } from 'react';
import { Tabs, Tab } from '@mui/material';
import ConstructionIcon from '@mui/icons-material/Construction';
import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../../context/ProductosContext.jsx';
import { useSeccion } from '../../hooks/useSeccion.js';
import { money, fmtFecha } from '../../domain/format.js';
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
  const { store, isAdmin, closeModal, openModal } = useProductos();
  useSeccion('comprobantes');
  const prov = store.getProveedor(provId);
  const [tab, setTab] = useState(0);
  if (!prov) return null;

  const tabDefs = [
    { label: 'Operaciones', C: OperacionesTab },
    { label: 'Resumen Cta.', C: ResumenCtaTab },
    { label: 'Productos y costos', C: ProveedorCostosTab },
    { label: 'Pend. Entrega', C: PendEntregaTab },
    { label: 'Auditoría', C: AuditoriaTab },
    { label: 'Historial', C: HistorialProvTab },
  ];
  const Active = (tabDefs[tab] || tabDefs[0]).C;

  const footer = [];
  if (isAdmin) footer.push({ texto: 'Editar', clase: 'btn-primary', onClick: () => openModal('proveedorForm', { provId }) });
  footer.push({ texto: 'Cerrar', clase: 'btn-ghost', onClick: closeModal });

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

/* ---- Pestañas que dependen de módulos futuros (Facturación / cuenta corriente) ---- */
function TabScaffold({ titulo, desc }) {
  return (
    <div className={cx(s.callout, s.info)} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <ConstructionIcon style={{ fontSize: 20, marginTop: 1 }} />
      <div>
        <strong>{titulo} — Próximamente.</strong><br />
        {desc}
      </div>
    </div>
  );
}
function ResumenCtaTab({ prov }) {
  const { store, openModal } = useProductos();
  const saldo = store.cuentaProveedor(prov.id);
  const chrono = store.comprobantesDe(prov.id)
    .filter((c) => c.estado === 'confirmado' && ((c.condicionPago === 'cuenta_corriente' && (c.tipo === 'factura' || c.tipo === 'nota_debito')) || c.tipo === 'nota_credito'))
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
function AuditoriaTab() {
  return <TabScaffold titulo="Auditoría" desc="Registro de cambios sobre el proveedor y sus condiciones comerciales (quién y cuándo modificó qué)." />;
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
