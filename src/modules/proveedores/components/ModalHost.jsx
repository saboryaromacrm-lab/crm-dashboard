import { useProveedores } from '../context/ProveedoresContext.jsx';
import { FichaProveedorModal } from './modals/FichaModals.jsx';
import { ImportarProveedoresModal } from './modals/ImportarProveedoresModal.jsx';
import { SolicitarPedidosModal, PedidoNotasModal } from './modals/PedidosModals.jsx';
import { CompromisoModal, PagarCompromisoModal } from './modals/CompromisosModals.jsx';
import { EcheqModal } from './modals/EcheqsModals.jsx';
import { AjusteModal } from './modals/EdocModals.jsx';
import { PagoProveedorModal, AnularPagoModal } from './modals/PagosModals.jsx';

/** Un solo host: el contexto dice qué modal está abierto y con qué props.
 *  El estado de cuenta ya NO es un modal: es la pantalla EdocProveedorPage. */
const MODALS = {
  ficha: FichaProveedorModal,
  // El padrón del sistema viejo, en una pasada (26/8; acá desde el 27/8).
  importarProveedores: ImportarProveedoresModal,
  solicitarPedidos: SolicitarPedidosModal,
  pedidoNotas: PedidoNotasModal,
  compromiso: CompromisoModal,
  pagarCompromiso: PagarCompromisoModal,
  echeq: EcheqModal,
  ajuste: AjusteModal,
  pagoProveedor: PagoProveedorModal,
  anularPago: AnularPagoModal,
};

export function ModalHost() {
  const { modal } = useProveedores();
  if (!modal) return null;
  const Cmp = MODALS[modal.type];
  return Cmp ? <Cmp {...modal.props} /> : null;
}
