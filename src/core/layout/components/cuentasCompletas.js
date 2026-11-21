/**
 * El banner de «cuenta disponible completa» (0238) se entera apenas se paga,
 * se anula o se edita una cuenta desde el ERP, sin esperar al minuto.
 */
export const EVENTO_CUENTAS_COMPLETAS = 'erp:cuentas-completas';
export const avisarCuentasCompletas = () => window.dispatchEvent(new Event(EVENTO_CUENTAS_COMPLETAS));
