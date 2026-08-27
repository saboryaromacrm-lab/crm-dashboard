import { useState } from 'react';
import { useProductos } from '../context/ProductosContext.jsx';
import { useSeccion } from '../hooks/useSeccion.js';
import { num, money, fmtFechaHora } from '../domain/format.js';
import { TIPOS_MOV, ESTADOS_STOCK } from '../domain/constants.js';
import { sucursalOptions, productoOptions } from '../components/selectOptions.jsx';
import { Table, PanelHead, MovTag, Btn, usePaginado, s } from '../components/ui.jsx';
import { imprimirDocumento, cuerpoValeOperacion } from '@core/services/imprimir.js';

/**
 * HISTORIAL DE MOVIMIENTOS — la película del stock, fila por fila.
 *
 * Vive en DOS menús con la misma pantalla: Compras › Historial y Almacén ›
 * Movimientos (27/8, pedido del dueño: "quiero fecha, hora, usuario y el dato
 * que importe" — la película tiene que leerse al lado de la foto de
 * Existencias, no cruzando de módulo).
 *
 * Cada fila dice CUÁNDO (fecha y hora), QUÉ (tipo + producto + cantidad con
 * signo), DÓNDE (sucursal, con la flecha si fue un viaje), POR QUÉ (el
 * documento o motivo que lo generó: la venta, la factura, el remito, el
 * conteo…), CUÁNTO VALIÓ (solo las pérdidas: van valuadas a costo congelado) y
 * QUIÉN. Si nació de una transferencia o una incidencia, "Ver" abre ese
 * documento.
 */
export function HistorialPanel() {
  const { store, toast, openModal, panelParams } = useProductos();
  useSeccion('movimientos');
  const [tipoF, setTipoF] = useState('');
  /* Llegar DESDE UNA FILA de Existencias (botón "Movs.") entra con el
   * producto y la sucursal ya filtrados: la pregunta era sobre ESA fila. */
  const [prodF, setProdF] = useState(() => (panelParams?.productoId ? String(panelParams.productoId) : ''));
  const [sucF, setSucF] = useState(() => (panelParams?.sucursalId ? String(panelParams.sucursalId) : ''));

  const movs = store.state.movimientos
    .slice()
    .sort((a, b) => b.id - a.id)
    .filter((m) => {
      if (tipoF && m.tipo !== tipoF) return false;
      if (prodF && m.productoId !== parseInt(prodF, 10)) return false;
      if (sucF && m.sucursalId !== parseInt(sucF, 10) && m.sucursalDestinoId !== parseInt(sucF, 10)) return false;
      return true;
    });

  const pag = usePaginado(movs, 'movimientos', `${tipoF}|${prodF}|${sucF}`);

  /** El documento o motivo que explica el movimiento, como lo escribió quien
   *  lo generó ("Venta 0001-00000042 · Consumidor Final", "Recepción factura…",
   *  el motivo del ajuste). Es el POR QUÉ de la fila. */
  const detalleDe = (m) => m.descripcion || m.motivo || '';
  /** El cambio de estado, cuando lo hubo (cuarentena, viaje, resolución). */
  const cambioEstado = (m) => (m.estadoDesde && m.estadoHacia && m.estadoDesde !== m.estadoHacia
    ? `${ESTADOS_STOCK[m.estadoDesde]?.label ?? m.estadoDesde} → ${ESTADOS_STOCK[m.estadoHacia]?.label ?? m.estadoHacia}`
    : '');
  /** Valuación a costo CONGELADO: solo la llenan las bajas por pérdida. */
  const valorDe = (m) => (m.costoUnitario > 0 ? m.cantidad * m.costoUnitario : null);

  /* EL VALE, para firmar y archivar. Se ofrece en TODOS los movimientos y no
   * solo en las bajas: la regla "solo merma y ajuste" obliga a explicar por qué
   * esta fila tiene botón y la de al lado no, y la respuesta no le importa a
   * nadie. El motivo es lo único del vale que no se puede reconstruir después
   * mirando el stock, así que va aunque esté vacío. */
  const imprimirVale = async (m) => {
    const signo = m.signo > 0 ? '+' : m.signo < 0 ? '−' : '';
    const valor = valorDe(m);
    const ok = await imprimirDocumento('valeMovimiento', {
      titulo: `${TIPOS_MOV[m.tipo]?.label ?? m.tipo} #${m.id}`,
      cuerpo: cuerpoValeOperacion({
        titulo: `${TIPOS_MOV[m.tipo]?.label ?? m.tipo} #${m.id}`,
        subtitulo: `${fmtFechaHora(m.fecha)} · ${m.sucursalNombre}${
          m.sucursalDestinoNombre ? ` → ${m.sucursalDestinoNombre}` : ''}`,
        datos: [
          ['Producto', m.productoNombre],
          ['Presentación', m.presLabel],
          ['Cantidad', `${signo}${num(m.cantidad, 3)} ${m.unidad === 'kg' ? 'kg' : 'u'}`],
          ['Valor a costo', valor != null ? money(valor) : ''],
          ['Usuario', m.usuarioNombre],
          ['Motivo', detalleDe(m)],
        ],
        ahora: fmtFechaHora(new Date()),
        usuario: store.getUsuario(store.state.ctx.usuarioId)?.nombre,
      }),
    });
    if (!ok) toast('El navegador bloqueó la ventana de impresión. Permitile las ventanas emergentes y probá de nuevo.', 'err');
  };

  const filas = pag.visibles.map((m) => {
      const signo = m.signo > 0
        ? <span style={{ color: 'var(--crm-color-success)', fontWeight: 700 }}>+</span>
        : m.signo < 0
          ? <span style={{ color: 'var(--crm-color-danger)', fontWeight: 700 }}>−</span>
          : '';
      const detalle = detalleDe(m);
      const estado = cambioEstado(m);
      const valor = valorDe(m);
      return (
        <tr key={m.id}>
          <td style={{ whiteSpace: 'nowrap' }}>{fmtFechaHora(m.fecha)}</td>
          <td><MovTag tipo={m.tipo} /></td>
          <td>
            {m.productoNombre}
            {m.presLabel && <div className={s.hint} style={{ margin: 0 }}>{m.presLabel}</div>}
          </td>
          <td>{m.sucursalNombre}{m.sucursalDestinoNombre ? ' → ' + m.sucursalDestinoNombre : ''}</td>
          <td className={s.num}>{signo}{num(m.cantidad, 3)} {m.unidad === 'kg' ? 'kg' : 'u'}</td>
          {/* El POR QUÉ: el documento que lo generó o el motivo tipeado, y el
              cambio de estado cuando lo hubo (cuarentena, viaje, resolución). */}
          <td style={{ maxWidth: 280, fontSize: 12.5 }}>
            {detalle || <span className={s.muted}>—</span>}
            {estado && <div className={s.hint} style={{ margin: 0 }}>{estado}</div>}
            {m.proveedorNombre && <div className={s.hint} style={{ margin: 0 }}>{m.proveedorNombre}</div>}
          </td>
          {/* Valuado SOLO en las pérdidas (merma / vencido / defectuoso), a
              costo congelado del día del movimiento: es el número que suma el
              reporte de pérdidas y no cambia aunque el costo cambie. */}
          <td className={s.num}>{valor != null ? money(valor) : <span className={s.muted}>—</span>}</td>
          <td>{m.usuarioNombre}</td>
          <td className={s['actions-col']}>
            <div className={s['row-actions']}>
              {m.refTransferenciaId && (
                <Btn small variant="btn-edit" onClick={() => openModal('detalleTransfer', { id: m.refTransferenciaId })}>Ver</Btn>
              )}
              {m.refIncidenciaId && (
                <Btn small variant="btn-edit" onClick={() => openModal('detalleIncidencia', { id: m.refIncidenciaId })}>Ver</Btn>
              )}
              <Btn small variant="btn-ghost" onClick={() => imprimirVale(m)}>Vale</Btn>
            </div>
          </td>
        </tr>
      );
    });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Historial de movimientos"
        desc={`Registro inmutable de toda alta y baja de inventario: cuándo, qué, dónde, por qué y quién. ${store.state.movimientos.length} movimientos.`}
      />
      <div className={s.toolbar}>
        <select className={s['select-inline']} value={tipoF} onChange={(e) => setTipoF(e.target.value)}>
          <option value="">Todos los movimientos</option>
          {Object.keys(TIPOS_MOV).map((k) => <option key={k} value={k}>{TIPOS_MOV[k].label}</option>)}
        </select>
        <select className={s['select-inline']} value={prodF} onChange={(e) => setProdF(e.target.value)}>
          <option value="">Todos los productos</option>
          {productoOptions(store, false)}
        </select>
        <select className={s['select-inline']} value={sucF} onChange={(e) => setSucF(e.target.value)}>
          <option value="">Todas las sucursales</option>
          {sucursalOptions(store, false)}
        </select>
      </div>
      <Table
        cols={[
          { h: 'Fecha y hora' }, { h: 'Tipo' }, { h: 'Producto' }, { h: 'Sucursal' },
          { h: 'Cant.', num: true }, { h: 'Detalle' }, { h: 'Valor', num: true },
          { h: 'Usuario' }, { h: '', cls: 'actions-col' },
        ]}
        empty="Sin movimientos."
        pag={pag}
      >
        {filas}
      </Table>
      <div className={s.hint}>
        <strong>Detalle</strong> es el documento o motivo que generó el movimiento (la venta, la
        factura, el remito, el conteo, el ajuste con su porqué). <strong>Valor</strong> aparece solo
        en las bajas por pérdida (merma, vencido, defectuoso): van valuadas al costo del día del
        movimiento y ese número no cambia después.
      </div>
    </div>
  );
}
