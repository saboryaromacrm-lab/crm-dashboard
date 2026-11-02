/**
 * EL CARTEL DEL STOCK (13/10/2026, pedido del dueño). Para todos menos el
 * superadmin: sale al abrir el ERP (cada inicio de sesión) y vuelve a salir
 * cada 2 horas. Cómo se recuerda y cómo frena el teclado: ver CartelRojo.jsx.
 */
import { useAuth } from '@core/auth/AuthContext.jsx';
import { CartelRojo, useAvisoCadaDosHoras } from './CartelRojo.jsx';

export function AvisoStock() {
  const { user } = useAuth();
  const activo = !!user && !(user.roles ?? []).includes('superadmin');
  const [abierto, entendido] = useAvisoCadaDosHoras('erp.avisoStock.', activo);
  if (!abierto) return null;
  return (
    <CartelRojo titulo="ATENCIÓN CON EL STOCK" onEntendido={entendido}>
      <p style={{ margin: 0 }}>Cada producto que falta o sobra es plata que se pierde.</p>
      <p style={{ margin: '.6em 0 0' }}>Contá bien, cargá bien, avisá si algo no cierra.</p>
    </CartelRojo>
  );
}
