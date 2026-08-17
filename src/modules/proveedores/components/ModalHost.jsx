import { useProveedores } from '../context/ProveedoresContext.jsx';
import { FichaProveedorModal } from './modals/FichaModals.jsx';
import { SolicitarPedidosModal, PedidoNotasModal } from './modals/PedidosModals.jsx';
import { CompromisoModal, PagarCompromisoModal } from './modals/CompromisosModals.jsx';
import { EcheqModal } from './modals/EcheqsModals.jsx';
import { EdocDetalleModal, AjusteModal } from './modals/EdocModals.jsx';

/** Un solo host: el contexto dice qué modal está abierto y con qué props. */
const MODALS = {
  ficha: FichaProveedorModal,
  solicitarPedidos: SolicitarPedidosModal,
  pedidoNotas: PedidoNotasModal,
  compromiso: CompromisoModal,
  pagarCompromiso: PagarCompromisoModal,
  echeq: EcheqModal,
  edocDetalle: EdocDetalleModal,
  ajuste: AjusteModal,
};

export function ModalHost() {
  const { modal } = useProveedores();
  if (!modal) return null;
  const Cmp = MODALS[modal.type];
  return Cmp ? <Cmp {...modal.props} /> : null;
}
