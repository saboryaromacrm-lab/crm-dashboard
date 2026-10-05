/**
 * ¿El ERP se abrió por la dirección vieja de Dokploy (…sslip.io)? Para el
 * navegador es otro sitio: sin el registro de «Este equipo» (5/10/2026).
 */
export const DIRECCION_DEFINITIVA = 'https://erp.saboryaroma.com';

export const enDireccionVieja = () => {
  try { return /sslip\.io$/i.test(window.location.hostname); } catch { return false; }
};
