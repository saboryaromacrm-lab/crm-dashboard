import { useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../context/ProductosContext.jsx';
import { ESTADOS_PRODUCTO, ESTADOS_STOCK_VIVO } from '../domain/constants.js';
import { fmtFechaHora } from '../domain/format.js';
import { ModalShell } from './Modal.jsx';
import { s } from './ui.jsx';
import { ProductoFormModal, DetalleProductoModal, FraccionadoModal } from './modals/ProductoModals.jsx';
import { CompraModal, VenderModal, FraccionarModal, MovimientoModal } from './modals/StockModals.jsx';
import { TransferenciaModal, DetalleTransferModal, RecibirTransferModal, PrepararTransferModal } from './modals/TransferModals.jsx';
import { IncidenciaModal, ResolverIncidenciaModal, DetalleIncidenciaModal } from './modals/IncidenciaModals.jsx';
import { ProveedorFormModal, DetalleProveedorModal } from './modals/ProveedorModals.jsx';
import { ComprobanteFormModal, ComprobanteDetalleModal } from './modals/ComprobanteModals.jsx';
import {
  TomarPagosComprobanteModal, PagoSucursalDetalleModal,
} from './modals/PagosSucursalModals.jsx';
import {
  EnvioCafeteriaFormModal, EnvioCafeteriaDetalleModal,
  PedidoCafeteriaFormModal, PedidoCafeteriaDetalleModal,
} from './modals/CafeteriaModals.jsx';
import {
  VencimientoEditarModal, VencimientoProcesarModal, VencimientoOfertaModal,
} from './modals/VencimientosModals.jsx';
import { ImportarCatalogoModal } from './modals/ImportarCatalogoModal.jsx';
import { LecturaFacturaModal } from './modals/LecturaFacturaModal.jsx';
import { HistorialPreciosModal, MargenesMasivosModal } from './modals/PreciosModals.jsx';

/* Confirmación genérica reutilizable. */
function ConfirmModal({ title, texto, onOk, claseOk = 'btn-primary' }) {
  const { closeModal } = useProductos();
  return (
    <ModalShell
      title={title}
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Confirmar', clase: claseOk, onClick: () => { onOk?.(); } },
      ]}
    >
      <div className={cx(s.callout, s.warn)}>{texto}</div>
    </ModalShell>
  );
}

/**
 * ELIMINAR de verdad. Es la excepción, no la regla: solo pasa si el producto no
 * dejó ninguna huella (un duplicado del importador, un alta con el dedo). Si ya
 * se compró, se vendió o se movió, la API lo frena diciendo cuál es la huella —
 * y el camino correcto es darlo de baja.
 */
function EliminarProductoModal({ prodId }) {
  const { store, act, closeModal, openModal } = useProductos();
  const p = store.getProducto(prodId);
  if (!p) return null;
  return (
    <ModalShell
      title="Eliminar producto"
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Mejor darlo de baja', clase: 'btn-ghost', onClick: () => { closeModal(); openModal('bajaProducto', { prodId: p.id }); } },
        { texto: 'Eliminar', clase: 'btn-delete', onClick: () => act(store.eliminarProducto(p.id), 'Producto eliminado.') },
      ]}
    >
      <div className={cx(s.callout, s.warn)}>
        ¿Eliminar <strong>{p.nombre}</strong> para siempre? Solo se puede si nunca se compró,
        vendió ni movió. Si ya tiene historia, la baja es el camino: deja de aparecer y se
        puede reactivar conservando precios, códigos e historial.
      </div>
    </ModalShell>
  );
}

/**
 * DAR DE BAJA / REACTIVAR — el ciclo de vida del producto.
 *
 * Las dos bajas son decisiones distintas y el modal las explica en lugar de
 * asumir que el usuario sabe la diferencia: discontinuado sigue vendiéndose
 * hasta agotar (lo normal cuando el proveedor lo baja), archivado lo saca de
 * todos lados y exige que no quede stock.
 */
function BajaProductoModal({ prodId }) {
  const { store, act, closeModal } = useProductos();
  const p = store.getProducto(prodId);
  if (!p) return null;

  const actual = p.estado || 'activo';
  const [estado, setEstado] = useState(actual === 'activo' ? 'discontinuado' : 'activo');
  const [motivo, setMotivo] = useState('');

  /* Cuánto queda y dónde: es el dato que decide si se puede archivar. Los
   * MISMOS estados que valida la API (`ESTADOS_STOCK_VIVO`): si acá se mirara
   * solo lo disponible, la pantalla diría "no queda nada" y el servidor
   * rechazaría igual por lo comprometido o lo que viaja. */
  const conStock = store.state.stock.filter((st) => st.productoId === p.id
    && st.cantidad > 1e-9 && ESTADOS_STOCK_VIVO.includes(st.estado));
  const totalStock = conStock.reduce((a, st) => a + st.cantidad, 0);

  /* El costo quedó congelado el día de la baja: reactivar y vender con ese
   * número es vender con un costo viejo. La fecha lo pone en evidencia. */
  const formato = store.formatoActivo?.(p);
  const fechaCosto = formato?.ultCambioCosto || formato?.actualizadoEn || null;

  const opciones = actual === 'activo'
    ? ['discontinuado', 'archivado']
    : ['activo', actual === 'discontinuado' ? 'archivado' : 'discontinuado'];

  const guardar = () => act(
    store.cambiarEstadoProducto(p.id, estado, motivo),
    estado === 'activo'
      ? `${p.nombre} volvió al catálogo.`
      : `${p.nombre}: ${ESTADOS_PRODUCTO[estado].label.toLowerCase()}.`,
  );

  return (
    <ModalShell
      title={(actual === 'activo' ? 'Dar de baja — ' : 'Cambiar estado — ') + p.nombre}
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: estado === 'activo' ? 'Reactivar' : 'Confirmar', clase: 'btn-primary', onClick: guardar },
      ]}
    >
      <div className={s.field}>
        <label>Estado actual</label>
        <strong style={{ fontSize: 14 }}>{ESTADOS_PRODUCTO[actual].label}</strong>
        {p.motivoBaja ? <div className={s.hint}>Motivo anotado: {p.motivoBaja}</div> : null}
      </div>

      <div className={s['mini-label']} style={{ marginTop: 4 }}>PASAR A</div>
      {opciones.map((op) => (
        <label
          key={op}
          className={cx(s.callout, estado === op ? s.ok : undefined)}
          style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', marginTop: 6 }}
        >
          <input
            type="radio" name="estadoProd" value={op} checked={estado === op}
            onChange={() => setEstado(op)} style={{ width: 'auto', marginTop: 3 }}
          />
          <span>
            <strong>{ESTADOS_PRODUCTO[op].label}</strong>
            <div className={s.hint} style={{ margin: 0 }}>{ESTADOS_PRODUCTO[op].ayuda}</div>
          </span>
        </label>
      ))}

      {estado !== 'activo' && (
        <div className={s.field} style={{ marginTop: 10 }}>
          <label>Motivo (queda anotado)</label>
          <input
            value={motivo} autoFocus
            placeholder="El proveedor lo discontinuó, no rotaba, cambió el envase…"
            onChange={(e) => setMotivo(e.target.value)}
          />
        </div>
      )}

      {/* El stock manda: sin esto, archivar deja mercadería que no se puede vender. */}
      {totalStock > 1e-9 && (
        <div className={cx(s.callout, estado === 'archivado' ? s.warn : s.info)} style={{ marginTop: 10 }}>
          Queda stock: <strong>{store.fmtCant(p, null, totalStock)}</strong> en{' '}
          {conStock.map((st) => store.getSucursal(st.sucursalId)?.nombre).filter(Boolean).join(', ')}.
          {estado === 'archivado'
            ? ' ⚠ Archivado no se puede vender: liquidalo (una oferta) o dalo de baja por merma antes. Mientras tanto, "discontinuado" es lo que corresponde.'
            : ' Discontinuado se sigue vendiendo hasta agotarlo — es exactamente para esto.'}
        </div>
      )}

      {estado === 'activo' && fechaCosto && (
        <div className={cx(s.callout, s.warn)} style={{ marginTop: 10 }}>
          Al reactivar, revisá el costo: el último cargado es del{' '}
          <strong>{fmtFechaHora(fechaCosto)}</strong>. El precio de venta se calcula con ese
          número hasta que entre la primera compra nueva.
        </div>
      )}
    </ModalShell>
  );
}

/* Confirmación específica de baja de proveedor. */
function EliminarProveedorModal({ provId }) {
  const { store, act, closeModal } = useProductos();
  const p = store.getProveedor(provId);
  if (!p) return null;
  const usos = store.state.productos.filter((prod) => (prod.proveedores || []).some((e) => e.proveedorId === provId)).length;
  return (
    <ModalShell
      title="Eliminar proveedor"
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Eliminar', clase: 'btn-delete', onClick: () => act(store.eliminarProveedor(p.id), 'Proveedor eliminado.') },
      ]}
    >
      <div className={cx(s.callout, s.warn)}>
        ¿Eliminar <strong>{p.nombre}</strong>?
        {usos > 0 && <> Está asociado a <strong>{usos}</strong> producto{usos === 1 ? '' : 's'}; se quitará de sus costos.</>}
      </div>
    </ModalShell>
  );
}

const REGISTRY = {
  confirm: ConfirmModal,
  eliminarProducto: EliminarProductoModal,
  // Ciclo de vida: dar de baja (discontinuado/archivado) y reactivar.
  bajaProducto: BajaProductoModal,
  proveedorForm: ProveedorFormModal,
  detalleProveedor: DetalleProveedorModal,
  eliminarProveedor: EliminarProveedorModal,
  comprobanteForm: ComprobanteFormModal,
  lecturaFactura: LecturaFacturaModal,
  comprobanteDetalle: ComprobanteDetalleModal,
  tomarPagosComprobante: TomarPagosComprobanteModal,
  pagoSucursalDetalle: PagoSucursalDetalleModal,
  envioCafeteria: EnvioCafeteriaFormModal,
  envioCafeteriaDetalle: EnvioCafeteriaDetalleModal,
  // El pedido del café: lo arma el rol Cafetería, lo trata el admin.
  pedidoCafeteria: PedidoCafeteriaFormModal,
  // Vencimientos: editar lo abierto, procesar lo vencido, armar la oferta real.
  vencimientoEditar: VencimientoEditarModal,
  vencimientoProcesar: VencimientoProcesarModal,
  vencimientoOferta: VencimientoOfertaModal,
  pedidoCafeteriaDetalle: PedidoCafeteriaDetalleModal,
  historialPrecios: HistorialPreciosModal,
  margenesMasivos: MargenesMasivosModal,
  producto: ProductoFormModal,
  detalleProducto: DetalleProductoModal,
  // La pantalla propia del fraccionado (el Ajo X500G): resumen + Producto madre.
  fraccionado: FraccionadoModal,
  importarCatalogo: ImportarCatalogoModal,
  compra: CompraModal,
  vender: VenderModal,
  fraccionar: FraccionarModal,
  movimiento: MovimientoModal,
  transferencia: TransferenciaModal,
  detalleTransfer: DetalleTransferModal,
  recibirTransfer: RecibirTransferModal,
  prepararTransfer: PrepararTransferModal,
  incidencia: IncidenciaModal,
  resolverIncidencia: ResolverIncidenciaModal,
  detalleIncidencia: DetalleIncidenciaModal,
};

/** Renderiza el modal activo según el estado del contexto. */
export function ModalHost() {
  const { modal } = useProductos();
  if (!modal) return null;
  const Component = REGISTRY[modal.type];
  if (!Component) return null;
  return <Component {...modal.props} />;
}
