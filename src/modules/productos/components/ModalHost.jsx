import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../context/ProductosContext.jsx';
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
import { EnvioCafeteriaFormModal, EnvioCafeteriaDetalleModal } from './modals/CafeteriaModals.jsx';
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

/* Confirmación específica de baja de producto. */
function EliminarProductoModal({ prodId }) {
  const { store, act, closeModal } = useProductos();
  const p = store.getProducto(prodId);
  if (!p) return null;
  return (
    <ModalShell
      title="Eliminar producto"
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Eliminar', clase: 'btn-delete', onClick: () => act(store.eliminarProducto(p.id), 'Producto eliminado.') },
      ]}
    >
      <div className={cx(s.callout, s.warn)}>
        ¿Eliminar <strong>{p.nombre}</strong>? Solo se puede si no tiene stock.
      </div>
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
