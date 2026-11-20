/**
 * VENTAS › NOTAS DE CRÉDITO (19/11/2026, pedido del dueño). Los nombres de lo
 * que la API dice de cada nota (`crm-api/src/ventas/notas-credito.ts`).
 */
import { MEDIOS_COBRADOS, TIPOS_VENTA, nroComprobante } from './constants.js';

/** Qué pasó con la plata. */
export const PLATA_NC = {
  efectivo: { label: 'Efectivo devuelto del cajón', corto: 'Efectivo del cajón', pill: 'est-pendiente' },
  ctacte: { label: 'Descontada de la cuenta corriente del cliente', corto: 'Cuenta corriente', pill: 'est-transito' },
  medio: { label: 'No salió efectivo del cajón (se devuelve por el medio con que se cobró, o se rehízo la venta)', corto: 'Sin efectivo del cajón', pill: 'est-borrador' },
  cambio: { label: 'Cambio: pagó lo que el cliente se llevó en el momento (0236)', corto: 'Cambio', pill: 'est-preparada' },
};

/** La nota ante ARCA. */
export const ARCA_NC = {
  cae: { label: 'Con CAE', pill: 'est-recibida' },
  pendiente: { label: 'Pendiente de ARCA', pill: 'est-vencida' },
  interna: { label: 'Interna (sin ARCA)', pill: 'est-borrador' },
};

/** «Factura B 00034-00001064». */
export const comprobante = (doc) => (doc ? `${TIPOS_VENTA[doc.tipo]?.label ?? doc.tipo} ${nroComprobante(doc)}` : '—');

/** «Tarjeta de débito y QR / billetera» (con qué se había cobrado la venta original). */
export const mediosDe = (medios) => (medios ?? []).map((m) => MEDIOS_COBRADOS[m] ?? m).join(' y ');

/** ¿Devolvió todo lo que quedaba de la original o una parte? */
export const alcanceNota = (n) => {
  if (!n.original) return '';
  return Math.abs(n.total - n.original.total) <= 0.01 ? 'Total' : 'Parcial';
};
