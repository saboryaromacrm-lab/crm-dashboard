import { useState } from 'react';
import { useProductos } from '../context/ProductosContext.jsx';
import { useSeccion } from '../hooks/useSeccion.js';
import { money, fmtFecha } from '../domain/format.js';
import { TIPOS_COMPROBANTE, ESTADOS_COMPROBANTE, CONDICIONES_PAGO } from '../domain/constants.js';
import { Table, PanelHead, Stat, Btn, s } from '../components/ui.jsx';
import { ComprobanteTag, ComprobanteEstadoPill, comprobanteNro } from '../components/modals/ComprobanteModals.jsx';

/**
 * Facturación — hub document-centric de comprobantes de compra.
 * Concentra facturas, remitos, notas de crédito/débito y órdenes de compra de
 * todos los proveedores. El detalle de cada proveedor consume estos mismos datos.
 */
export function FacturacionPanel() {
  const { store, isAdmin, openModal } = useProductos();
  useSeccion('comprobantes');
  const [tipoF, setTipoF] = useState('');
  const [provF, setProvF] = useState('');
  const [estadoF, setEstadoF] = useState('');

  const comps = store.state.comprobantes
    .slice()
    .sort((a, b) => b.id - a.id)
    .filter((c) => (!tipoF || c.tipo === tipoF) && (!provF || c.proveedorId === parseInt(provF, 10)) && (!estadoF || c.estado === estadoF));

  const totalFacturado = store.state.comprobantes
    .filter((c) => c.tipo === 'factura' && c.estado === 'confirmado')
    .reduce((a, c) => a + c.total, 0);
  const saldoCtaCte = store.state.proveedores.reduce((a, p) => a + store.cuentaProveedor(p.id), 0);

  const filas = comps.map((c) => {
    const prov = store.getProveedor(c.proveedorId);
    return (
      <tr key={c.id} className={s.clickable} onClick={() => openModal('comprobanteDetalle', { id: c.id })}>
        <td>{fmtFecha(c.fecha)}</td>
        <td><ComprobanteTag tipo={c.tipo} /></td>
        <td className={s.mono}>{comprobanteNro(c)}</td>
        <td>{prov ? prov.nombre : '—'}</td>
        <td>{CONDICIONES_PAGO[c.condicionPago] || c.condicionPago}</td>
        <td><ComprobanteEstadoPill estado={c.estado} /></td>
        <td className={s.num}>{money(c.total)}</td>
      </tr>
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Facturación"
        desc="Comprobantes de compra: facturas, remitos, notas de crédito/débito y órdenes de compra. El stock ingresa por la recepción."
        actions={isAdmin && <Btn variant="btn-primary" onClick={() => openModal('comprobanteForm', {})}>+ Nuevo comprobante</Btn>}
      />

      <div className={s.stats}>
        <Stat label="Comprobantes" value={store.state.comprobantes.length} />
        <Stat label="Total facturado" value={money(totalFacturado)} accent="accent-green" />
        <Stat label="Saldo cta. corriente" value={money(saldoCtaCte)} accent={saldoCtaCte > 0 ? 'accent-amber' : undefined} />
      </div>

      <div className={s.toolbar}>
        <select className={s['select-inline']} value={tipoF} onChange={(e) => setTipoF(e.target.value)}>
          <option value="">Todos los tipos</option>
          {Object.keys(TIPOS_COMPROBANTE).map((k) => <option key={k} value={k}>{TIPOS_COMPROBANTE[k].label}</option>)}
        </select>
        <select className={s['select-inline']} value={provF} onChange={(e) => setProvF(e.target.value)}>
          <option value="">Todos los proveedores</option>
          {store.state.proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        <select className={s['select-inline']} value={estadoF} onChange={(e) => setEstadoF(e.target.value)}>
          <option value="">Todos los estados</option>
          {Object.keys(ESTADOS_COMPROBANTE).map((k) => <option key={k} value={k}>{ESTADOS_COMPROBANTE[k].label}</option>)}
        </select>
      </div>

      <Table
        cols={[
          { h: 'Fecha' }, { h: 'Tipo' }, { h: 'Comprobante' }, { h: 'Proveedor' },
          { h: 'Cond. pago' }, { h: 'Estado' }, { h: 'Total', num: true },
        ]}
        empty="No hay comprobantes. Cargá el primero con “+ Nuevo comprobante”."
      >
        {filas}
      </Table>
    </div>
  );
}
