/**
 * ESTÁS EN LA DIRECCIÓN VIEJA (5/10/2026, caso real en producción).
 *
 * El ERP también responde en la dirección de Dokploy (…sslip.io), pero para
 * el navegador es OTRO sitio: no tiene el registro de «Este equipo», así que
 * desaparece el cobro por QR de Mercado Pago (y la app instalada, la
 * impresora elegida…). Una PC que cobraba con QR dejó de verlo por entrar por
 * ahí. Este cartel no se oculta: la única salida es ir a la dirección buena.
 */
import { DIRECCION_DEFINITIVA, enDireccionVieja } from '@core/services/direccion.js';

export function DireccionViejaBanner() {
  if (!enDireccionVieja()) return null;
  const destino = `${DIRECCION_DEFINITIVA}${window.location.pathname}${window.location.search}`;
  return (
    <div
      role="alert"
      style={{
        display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10,
        padding: '8px 16px', background: '#fef2f2', borderBottom: '1px solid #fca5a5', color: '#991b1b', fontSize: 13.5,
      }}
    >
      <strong>⚠ Estás entrando por la dirección vieja del ERP.</strong>
      <span style={{ flex: 1, minWidth: 220 }}>
        Acá este equipo no está registrado: no aparece el cobro con <strong>QR de Mercado Pago</strong> y se pierden sus ajustes.
        Entrá siempre por <strong>erp.saboryaroma.com</strong> (y guardala en favoritos).
      </span>
      <a href={destino} style={{ border: '1px solid #fca5a5', background: '#fff', color: '#991b1b', borderRadius: 6, padding: '4px 10px', fontWeight: 700, textDecoration: 'none' }}>
        Ir a erp.saboryaroma.com
      </a>
    </div>
  );
}
