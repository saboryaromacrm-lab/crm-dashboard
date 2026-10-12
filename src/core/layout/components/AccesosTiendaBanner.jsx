/**
 * EL CARTEL DE LOS PEDIDOS DE INGRESO A LA TIENDA (0155, pedido del dueño: «que
 * salga en el banner principal»). Queda arriba mientras haya pedidos esperando;
 * la cruz lo esconde hasta que entre otro.
 */
import { useState, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '@core/permissions/PermissionContext.jsx';
import { accesosTienda, sinSuscripcion } from '@core/services/accesosTienda.js';

export function AccesosTiendaBanner() {
  const { can } = usePermissions();
  const puede = can('ventas.accesos_tienda');
  const navigate = useNavigate();
  const n = useSyncExternalStore(puede ? accesosTienda.subscribe : sinSuscripcion, accesosTienda.count, accesosTienda.count);
  const [ocultoEn, setOcultoEn] = useState(0);
  if (!puede || !n || n === ocultoEn) return null;

  return (
    <div
      role="status"
      style={{
        display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10,
        padding: '8px 16px', background: '#f0fdf4', borderBottom: '1px solid #86efac', color: '#14532d', fontSize: 13.5,
      }}
    >
      <strong>🛒 {n === 1 ? '1 persona pide' : `${n} personas piden`} ingreso a la tienda mayorista.</strong>
      <span style={{ flex: 1, minWidth: 180 }}>Habilitalos y avisales por WhatsApp con un toque.</span>
      <button
        type="button"
        onClick={() => navigate('/web?seccion=accesos')}
        style={{ border: '1px solid #86efac', background: '#fff', color: '#14532d', borderRadius: 6, padding: '4px 10px', fontWeight: 700, cursor: 'pointer' }}
      >
        Revisar
      </button>
      <button
        type="button" aria-label="Ocultar hasta que entre otro" title="Ocultar hasta que entre otro"
        onClick={() => setOcultoEn(n)}
        style={{ border: 'none', background: 'none', color: '#14532d', fontSize: 18, lineHeight: 1, cursor: 'pointer' }}
      >
        ×
      </button>
    </div>
  );
}
