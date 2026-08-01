import { useVentas } from '../context/VentasContext.jsx';
import {
  ClienteFormModal, DetalleClienteModal, EliminarClienteModal, ReactivarClienteModal,
} from './modals/ClienteModals.jsx';
import {
  CobranzaFormModal, CobranzaDetalleModal, AnularCobranzaModal,
} from './modals/CobranzaModals.jsx';
import {
  AbrirCajaModal, CerrarCajaModal, MovimientoCajaModal, ArqueoTurnoModal,
} from './modals/CajaModals.jsx';
import { CobroModal, VentaEmitidaModal } from './modals/CobroModal.jsx';
import {
  CargaRapidaModal, BusquedaMasivaModal, CargaExtraModal,
  DelegarVentaModal, DescartarVentaModal,
} from './modals/PosModals.jsx';

/** Un solo modal a la vez: el contexto guarda `{ type, props }`. */
const REGISTRY = {
  clienteForm: ClienteFormModal,
  detalleCliente: DetalleClienteModal,
  eliminarCliente: EliminarClienteModal,
  reactivarCliente: ReactivarClienteModal,
  cobranzaForm: CobranzaFormModal,
  cobranzaDetalle: CobranzaDetalleModal,
  anularCobranza: AnularCobranzaModal,
  abrirCaja: AbrirCajaModal,
  cerrarCaja: CerrarCajaModal,
  movimientoCaja: MovimientoCajaModal,
  arqueoTurno: ArqueoTurnoModal,
  cobro: CobroModal,
  ventaEmitida: VentaEmitidaModal,
  cargaRapida: CargaRapidaModal,
  busquedaMasiva: BusquedaMasivaModal,
  cargaExtra: CargaExtraModal,
  delegarVenta: DelegarVentaModal,
  descartarVenta: DescartarVentaModal,
};

export function ModalHost() {
  const { modal } = useVentas();
  if (!modal) return null;
  const Component = REGISTRY[modal.type];
  if (!Component) return null;
  return <Component {...modal.props} />;
}
