import { useVentas } from '../context/VentasContext.jsx';
import {
  ClienteFormModal, DetalleClienteModal, EliminarClienteModal, ReactivarClienteModal,
} from './modals/ClienteModals.jsx';
import {
  CobranzaFormModal, CobranzaDetalleModal, AnularCobranzaModal,
} from './modals/CobranzaModals.jsx';
import {
  AbrirCajaModal, CerrarCajaModal, ControlCajaModal, MovimientoCajaModal, ArqueoTurnoModal,
} from './modals/CajaModals.jsx';
import { CobroModal, VentaEmitidaModal } from './modals/CobroModal.jsx';
import {
  CargaRapidaModal, BusquedaMasivaModal, CargaExtraModal,
  DelegarVentaModal, DescartarVentaModal,
} from './modals/PosModals.jsx';
import {
  ModalidadFormModal, BorrarModalidadModal, ListaFormModal, BorrarListaModal, VerLogicaModal,
  ReglaMarcaFormModal, BorrarReglaMarcaModal,
} from './modals/ListaModals.jsx';
import { OfertaFormModal, BorrarOfertaModal } from './modals/OfertaModals.jsx';

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
  controlCaja: ControlCajaModal,
  movimientoCaja: MovimientoCajaModal,
  arqueoTurno: ArqueoTurnoModal,
  modalidadForm: ModalidadFormModal,
  borrarModalidad: BorrarModalidadModal,
  listaForm: ListaFormModal,
  borrarLista: BorrarListaModal,
  reglaMarcaForm: ReglaMarcaFormModal,
  borrarReglaMarca: BorrarReglaMarcaModal,
  ofertaForm: OfertaFormModal,
  borrarOferta: BorrarOfertaModal,
  verLogica: VerLogicaModal,
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
