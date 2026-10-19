/**
 * ACCESOS DIRECTOS (13/10/2026, pedido del dueño): las secciones que más se
 * usan, a un clic desde la pantalla de inicio. Cada uno aparece solo si el
 * usuario tiene esa sección; las direcciones abren directo la sección pedida.
 *
 * «Retiro de mercadería» (19/10/2026) no lleva a ninguna sección: abre el
 * retiro sin costo en una ventana, sin pasar por el POS. Solo administración
 * (los socios retiran desde acá); en el POS el retiro sigue igual.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PaymentsIcon from '@mui/icons-material/Payments';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import WarehouseIcon from '@mui/icons-material/Warehouse';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import LocalCafeIcon from '@mui/icons-material/LocalCafe';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import { usePermissions } from '@core/permissions/PermissionContext.jsx';
import { RetiroDirectoModal } from '@modules/ventas/components/modals/RetiroDirectoModal.jsx';
import styles from '../styles/Dashboard.module.css';

const ACCESOS = [
  { label: 'Cash Flow', modulo: 'Gerencia', ruta: '/gerencia?seccion=cashflow', permiso: 'gerencia.cashflow', Icono: PaymentsIcon },
  { label: 'Proveedores', modulo: 'Proveedores', ruta: '/proveedores?panel=padron', permiso: 'proveedores.padron', Icono: LocalShippingIcon },
  { label: 'Existencias', modulo: 'Almacén', ruta: '/almacen?panel=existencias', permiso: 'almacen.existencias', Icono: WarehouseIcon },
  { label: 'Fraccionamiento', modulo: 'Almacén', ruta: '/almacen?panel=fraccionamiento', permiso: 'almacen.fraccionamiento', Icono: CallSplitIcon },
  { label: 'Coffit', modulo: 'Almacén', ruta: '/almacen?panel=cafeteria', permiso: 'almacen.cafeteria', Icono: LocalCafeIcon },
];

function Acceso({ modulo, label, Icono, onClick }) {
  return (
    <button type="button" className={styles.acceso} onClick={onClick}>
      <Icono className={styles.accesoIcono} />
      <span>
        <span className={styles.accesoModulo}>{modulo}</span>
        <strong>{label}</strong>
      </span>
    </button>
  );
}

export function AccesosDirectos() {
  const { can, esAdmin } = usePermissions();
  const navigate = useNavigate();
  const [retiro, setRetiro] = useState(false);
  const visibles = ACCESOS.filter((a) => can(a.permiso));
  /* El retiro usa la llave del POS (la misma que pide la API) y es de administración. */
  const veRetiro = esAdmin && can('ventas');
  if (!visibles.length && !veRetiro) return null;
  return (
    <nav className={styles.accesos} aria-label="Accesos directos">
      {visibles.map(({ label, modulo, ruta, Icono }) => (
        <Acceso key={ruta} modulo={modulo} label={label} Icono={Icono} onClick={() => navigate(ruta)} />
      ))}
      {veRetiro && <Acceso modulo="Ventas" label="Retiro de mercadería" Icono={ShoppingBagIcon} onClick={() => setRetiro(true)} />}
      {retiro && <RetiroDirectoModal onCerrar={() => setRetiro(false)} />}
    </nav>
  );
}
