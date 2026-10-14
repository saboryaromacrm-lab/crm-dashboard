/**
 * ACCESOS DIRECTOS (13/10/2026, pedido del dueño): las secciones que más se
 * usan, a un clic desde la pantalla de inicio. Cada uno aparece solo si el
 * usuario tiene esa sección; las direcciones abren directo la sección pedida.
 */
import { useNavigate } from 'react-router-dom';
import PaymentsIcon from '@mui/icons-material/Payments';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import WarehouseIcon from '@mui/icons-material/Warehouse';
import { usePermissions } from '@core/permissions/PermissionContext.jsx';
import styles from '../styles/Dashboard.module.css';

const ACCESOS = [
  { label: 'Cash Flow', modulo: 'Gerencia', ruta: '/gerencia?seccion=cashflow', permiso: 'gerencia.cashflow', Icono: PaymentsIcon },
  { label: 'Proveedores', modulo: 'Proveedores', ruta: '/proveedores?panel=padron', permiso: 'proveedores.padron', Icono: LocalShippingIcon },
  { label: 'Existencias', modulo: 'Almacén', ruta: '/almacen?panel=existencias', permiso: 'almacen.existencias', Icono: WarehouseIcon },
];

export function AccesosDirectos() {
  const { can } = usePermissions();
  const navigate = useNavigate();
  const visibles = ACCESOS.filter((a) => can(a.permiso));
  if (!visibles.length) return null;
  return (
    <nav className={styles.accesos} aria-label="Accesos directos">
      {visibles.map(({ label, modulo, ruta, Icono }) => (
        <button key={ruta} type="button" className={styles.acceso} onClick={() => navigate(ruta)}>
          <Icono className={styles.accesoIcono} />
          <span>
            <span className={styles.accesoModulo}>{modulo}</span>
            <strong>{label}</strong>
          </span>
        </button>
      ))}
    </nav>
  );
}
