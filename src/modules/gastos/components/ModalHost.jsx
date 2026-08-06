import { useGastos } from '../context/GastosContext.jsx';
import {
  GastoFormModal, DetalleGastoModal, PagarGastoModal, AplicarAGastoModal, AnularGastoModal,
} from './modals/GastoModals.jsx';
import {
  PagoFormModal, DetallePagoModal, AnularPagoModal, CuentaProveedorModal,
} from './modals/PagoModals.jsx';
import {
  CategoriaFormModal, BorrarCategoriaModal, RecurrenteFormModal, BorrarRecurrenteModal,
  ProveedorFormModal,
} from './modals/CatalogoModals.jsx';

/** Un solo modal a la vez: el contexto guarda `{ type, props }`. */
const REGISTRY = {
  gastoForm: GastoFormModal,
  detalleGasto: DetalleGastoModal,
  pagarGasto: PagarGastoModal,
  aplicarAGasto: AplicarAGastoModal,
  anularGasto: AnularGastoModal,
  pagoForm: PagoFormModal,
  detallePago: DetallePagoModal,
  anularPago: AnularPagoModal,
  cuentaProveedor: CuentaProveedorModal,
  categoriaForm: CategoriaFormModal,
  borrarCategoria: BorrarCategoriaModal,
  recurrenteForm: RecurrenteFormModal,
  borrarRecurrente: BorrarRecurrenteModal,
  proveedorForm: ProveedorFormModal,
};

export function ModalHost() {
  const { modal } = useGastos();
  if (!modal) return null;
  const Component = REGISTRY[modal.type];
  if (!Component) return null;
  return <Component {...modal.props} />;
}
