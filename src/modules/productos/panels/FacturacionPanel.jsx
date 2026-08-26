import { useState } from 'react';
import { Tabs, Tab } from '@mui/material';
import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../context/ProductosContext.jsx';
import { useSeccion } from '../hooks/useSeccion.js';
import { money, fmtFecha } from '../domain/format.js';
import { TIPOS_COMPROBANTE, ESTADOS_COMPROBANTE, CONDICIONES_PAGO } from '../domain/constants.js';
import { Table, PanelHead, Stat, Btn, usePaginado, s } from '../components/ui.jsx';
import { ComprobanteTag, ComprobanteEstadoPill, comprobanteNro } from '../components/modals/ComprobanteModals.jsx';
import { PagosSucursalTab } from './PagosSucursalPanel.jsx';

/**
 * De dónde salió la plata de un comprobante. Es la columna que responde "¿esta
 * factura se pagó con plata de una sucursal?" sin tener que abrir el detalle.
 *
 * Tres estados posibles y los tres importan: pagada desde la caja de una
 * sucursal (con cuál y qué turno), pagada por administración, o debiéndose.
 */
function TrazaPago({ c }) {
  const saldo = c.saldo ?? Math.round((c.total - (c.pagado ?? 0)) * 100) / 100;
  const pagos = c.pagos ?? [];

  if (!pagos.length) {
    if (c.tipo === 'nota_credito' || c.tipo === 'remito' || c.tipo === 'orden_compra') {
      return <span className={s.muted}>—</span>;
    }
    return (
      <>
        <span>{CONDICIONES_PAGO[c.condicionPago] || c.condicionPago}</span>
        {saldo > 0.009 && (
          <div className={s.hint} style={{ margin: 0, color: 'var(--crm-color-danger)' }}>
            debe {money(saldo)}
          </div>
        )}
      </>
    );
  }

  const deSucursal = pagos.filter((p) => p.cajaSesionId);
  return (
    <>
      {deSucursal.length > 0 ? (
        <>
          <span className={cx(s.badge, s['badge-granel'])}>Pago en sucursal</span>
          {deSucursal.map((p) => (
            <div key={p.pagoId} className={s.hint} style={{ margin: 0 }}>
              {p.sucursalNombre || 'sucursal'} · turno #{p.cajaSesionId}
              {p.usuarioNombre ? ` · ${p.usuarioNombre}` : ''} · {money(p.importe)}
            </div>
          ))}
        </>
      ) : (
        <>
          <span>Administración</span>
          <div className={s.hint} style={{ margin: 0 }}>{money(pagos.reduce((a, p) => a + p.importe, 0))}</div>
        </>
      )}
      {saldo > 0.009 && (
        <div className={s.hint} style={{ margin: 0, color: 'var(--crm-color-danger)' }}>
          debe {money(saldo)}
        </div>
      )}
    </>
  );
}

/**
 * Facturación — hub document-centric de comprobantes de compra, con la bandeja
 * de PAGOS EN SUCURSAL como segunda pestaña.
 *
 * Las dos viven juntas porque son las dos caras de la misma pregunta: qué me
 * facturó este proveedor y qué plata le salió a las sucursales. Por eso el
 * filtro de PROVEEDOR está afuera de las pestañas y manda sobre las dos: elegir
 * "Bebidas SA" muestra sus facturas de un lado y sus pagos del otro, sin volver
 * a filtrar. Los filtros que solo aplican a una (tipo y estado del comprobante;
 * sucursal y "sin aplicar" del pago) viven adentro de la suya.
 */
export function FacturacionPanel() {
  const { store, isAdmin, can, openModal } = useProductos();
  useSeccion('comprobantes');

  /** Filtro COMPARTIDO por las dos pestañas. */
  const [provF, setProvF] = useState('');
  const [tab, setTab] = useState('facturas');
  const [tipoF, setTipoF] = useState('');
  const [estadoF, setEstadoF] = useState('');

  const verPagos = can('compras.pagos');

  /*
   * SIN EL PERMISO `liquidaciones`, la mitad sin factura NO SE LISTA.
   *
   * Van mezcladas con las facturas a propósito (al mirar un proveedor se ve de
   * una todo lo que se le debe, que es la verdad operativa: la plata que se le
   * paga es una sola), así que el filtro tiene que estar acá y no en una pestaña.
   *
   * Como todo lo de permisos del sistema, esto esconde — no prohíbe. La API no
   * valida quién pregunta hasta que haya sesiones con token.
   */
  // Sin `isAdmin ||` a propósito: con él, revocarle el permiso a un admin no
  // haría nada. El superadmin queda cubierto por el comodín `*` de su rol.
  const verNoFiscal = can('liquidaciones');

  const comps = store.state.comprobantes
    .slice()
    .sort((a, b) => b.id - a.id)
    .filter((c) => (verNoFiscal || !TIPOS_COMPROBANTE[c.tipo]?.noFiscal)
      && (!tipoF || c.tipo === tipoF) && (!provF || c.proveedorId === parseInt(provF, 10)) && (!estadoF || c.estado === estadoF));

  /*
   * REMITOS PENDIENTES DE FACTURAR (26/8) — el espejo de "⚠ Sin facturar" de
   * Ventas. Mercadería que ya entró (y se vende) con un remito, esperando que
   * el proveedor mande la factura. Mientras haya alguno, la pestaña existe y
   * lo canta: un remito que se olvida es deuda que no figura y crédito fiscal
   * que no se computa. Respeta el filtro de proveedor de arriba.
   */
  const remitosPendientes = store.state.comprobantes
    .filter((c) => c.tipo === 'remito' && c.estado === 'confirmado'
      && (!provF || c.proveedorId === parseInt(provF, 10)))
    .sort((a, b) => b.id - a.id);
  // Si el último remito se facturó con la pestaña abierta, se vuelve a Facturas.
  const tabEfectiva = tab === 'remitos' && !remitosPendientes.length ? 'facturas' : tab;

  // "Facturado" es SOLO lo facturado: la liquidación no entra ni con el permiso
  // puesto. Es el número que se compara contra el libro de IVA.
  const totalFacturado = comps
    .filter((c) => c.tipo === 'factura' && c.estado === 'confirmado')
    .reduce((a, c) => a + c.total, 0);
  // Y este es el otro número que hace falta: cuánto de la compra no está facturado.
  const totalNoFiscal = verNoFiscal
    ? comps.filter((c) => TIPOS_COMPROBANTE[c.tipo]?.noFiscal && c.estado === 'confirmado').reduce((a, c) => a + c.total, 0)
    : 0;
  /*
   * El saldo lo da la API. Antes esta línea recorría TODOS los comprobantes una
   * vez por proveedor, en cada render y sin memo: con 50 proveedores y 2.000
   * comprobantes son 100.000 iteraciones por cada tecla tipeada en un filtro. Y
   * de paso sumaba proveedores de gastos, que nunca tienen comprobantes.
   */
  const saldoCtaCte = provF
    ? store.cuentaProveedor(parseInt(provF, 10))
    : store.saldoTotalProveedores();

  const pag = usePaginado(comps, 'comprobantes', `${tipoF}|${provF}|${estadoF}`);

  const filas = pag.visibles.map((c) => {
    const prov = store.getProveedor(c.proveedorId);
    return (
      <tr key={c.id} className={s.clickable} onClick={() => openModal('comprobanteDetalle', { id: c.id })}>
        <td>{fmtFecha(c.fecha)}</td>
        <td><ComprobanteTag tipo={c.tipo} /></td>
        <td className={s.mono}>{comprobanteNro(c)}</td>
        <td>{prov ? prov.nombre : '—'}</td>
        <td><TrazaPago c={c} /></td>
        <td><ComprobanteEstadoPill estado={c.estado} /></td>
        <td className={s.num}>{money(c.total)}</td>
      </tr>
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Facturación"
        desc="Comprobantes de compra y la plata que las sucursales ya pagaron. El stock ingresa por la recepción."
        actions={isAdmin && <Btn variant="btn-primary" onClick={() => openModal('comprobanteForm', {})}>+ Nuevo comprobante</Btn>}
      />

      {/* El proveedor manda sobre las dos pestañas: va afuera, arriba de todo. */}
      <div className={s.toolbar}>
        <select className={s['select-inline']} value={provF} onChange={(e) => setProvF(e.target.value)}>
          <option value="">Todos los proveedores</option>
          {store.state.proveedores
            .filter((p) => p.proveeMercaderia !== false)
            .map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        <span className={s.hint} style={{ margin: 0 }}>
          Filtra las dos pestañas: las facturas de ese proveedor y los pagos que se le hicieron.
        </span>
      </div>

      {(verPagos || remitosPendientes.length > 0) ? (
        <Tabs
          value={tabEfectiva}
          onChange={(e, v) => setTab(v)}
          sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 40 }}
        >
          <Tab value="facturas" label="Facturas" sx={{ minHeight: 40 }} />
          {verPagos && <Tab value="pagos" label="Pagos en sucursal" sx={{ minHeight: 40 }} />}
          {/* Solo existe mientras haya remitos esperando: un "⚠ (0)" fijo no avisa nada. */}
          {remitosPendientes.length > 0 && (
            <Tab value="remitos" label={`⚠ Remitos sin facturar (${remitosPendientes.length})`} sx={{ minHeight: 40 }} />
          )}
        </Tabs>
      ) : null}

      {tabEfectiva === 'remitos' && remitosPendientes.length > 0 ? (
        <>
          <div className={s.callout}>
            Mercadería que <strong>ya ingresó con un remito</strong> (y ya se vende) mientras el
            proveedor manda la factura. Cuando llegue el papel: <strong>Llegó la factura</strong> —
            el remito pasa a ser la factura, nace la deuda y <strong>el stock no se vuelve a
            mover</strong>. No cargues esa factura como comprobante nuevo: la mercadería entraría
            dos veces.
          </div>
          <Table
            cols={[
              { h: 'Ingresó' }, { h: 'Remito' }, { h: 'Proveedor' }, { h: 'Sucursal' },
              { h: 'Total estimado', num: true }, { h: 'Acciones', cls: 'actions-col' },
            ]}
          >
            {remitosPendientes.map((c) => {
              const prov = store.getProveedor(c.proveedorId);
              return (
                <tr key={c.id} className={s.clickable} onClick={() => openModal('comprobanteDetalle', { id: c.id })}>
                  <td>{fmtFecha(c.fecha)}</td>
                  <td className={s.mono}>{comprobanteNro(c)}</td>
                  <td>{prov ? prov.nombre : '—'}</td>
                  <td>{store.getSucursal(c.sucursalId)?.nombre || '—'}</td>
                  <td className={s.num}>{money(c.total)}</td>
                  <td className={s['actions-col']}>
                    <div className={s['row-actions']} onClick={(e) => e.stopPropagation()}>
                      {isAdmin && (
                        <Btn small variant="btn-primary" onClick={() => openModal('comprobanteForm', { remito: c })}>
                          Llegó la factura
                        </Btn>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </Table>
          <div className={s.hint}>
            El total es <strong>estimado</strong>: el remito entró con los costos de catálogo. El
            número real lo trae la factura, y se corrige al facturarlo.
          </div>
        </>
      ) : tabEfectiva === 'pagos' && verPagos ? (
        <PagosSucursalTab proveedorId={provF} />
      ) : (
        <>
          <div className={s.stats}>
            <Stat label="Comprobantes" value={comps.length} />
            <Stat label="Total facturado" value={money(totalFacturado)} accent="accent-green" />
            {/* Solo aparece si hay: la mayoría de los proveedores factura todo, y
                un "$0 sin factura" fijo en la pantalla no informa nada. */}
            {totalNoFiscal > 0.009 && (
              <Stat label="Sin factura" value={money(totalNoFiscal)} accent="accent-amber" />
            )}
            <Stat
              label={provF ? 'Saldo del proveedor' : 'Saldo cta. corriente'}
              value={money(saldoCtaCte)}
              accent={saldoCtaCte > 0 ? 'accent-amber' : undefined}
            />
          </div>

          <div className={s.toolbar}>
            <select className={s['select-inline']} value={tipoF} onChange={(e) => setTipoF(e.target.value)}>
              <option value="">Todos los tipos</option>
              {Object.keys(TIPOS_COMPROBANTE)
                .filter((k) => verNoFiscal || !TIPOS_COMPROBANTE[k].noFiscal)
                .map((k) => <option key={k} value={k}>{TIPOS_COMPROBANTE[k].label}</option>)}
            </select>
            <select className={s['select-inline']} value={estadoF} onChange={(e) => setEstadoF(e.target.value)}>
              <option value="">Todos los estados</option>
              {Object.keys(ESTADOS_COMPROBANTE).map((k) => <option key={k} value={k}>{ESTADOS_COMPROBANTE[k].label}</option>)}
            </select>
          </div>

          <Table
            cols={[
              { h: 'Fecha' }, { h: 'Tipo' }, { h: 'Comprobante' }, { h: 'Proveedor' },
              { h: 'Pago' }, { h: 'Estado' }, { h: 'Total', num: true },
            ]}
            empty="No hay comprobantes con esos filtros."
            pag={pag}
          >
            {filas}
          </Table>

          <div className={s.hint}>
            La columna <strong>Pago</strong> dice de dónde salió la plata: de la caja de una sucursal
            (con el turno y el cajero), de administración, o que todavía se debe.
          </div>
        </>
      )}
    </div>
  );
}
