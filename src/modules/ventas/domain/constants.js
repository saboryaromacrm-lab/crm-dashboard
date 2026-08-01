/**
 * VOCABULARIO DEL CIRCUITO DE VENTA
 * ============================================================================
 * Espejo exacto de los enums del backend (`crm-api/src/db/schema.ts`). Si allá
 * se agrega un valor, se agrega acá: son las dos puntas del mismo contrato.
 *
 * `pill`/`tag` son claves de clase del CSS del módulo — se resuelven con
 * `styles[key]` (ver components/ui.jsx).
 */

/**
 * Condición frente al IVA. Es el campo más importante del cliente: junto con la
 * condición propia de la empresa define la LETRA del comprobante a emitir.
 */
export const CONDICIONES_IVA = {
  responsable_inscripto: { label: 'Responsable Inscripto', corto: 'RI' },
  monotributo: { label: 'Monotributo', corto: 'MT' },
  consumidor_final: { label: 'Consumidor Final', corto: 'CF' },
  exento: { label: 'Exento', corto: 'EX' },
  no_categorizado: { label: 'No categorizado', corto: '—' },
};

/** `largo` 0 = sin validación de longitud. */
export const TIPOS_DOC = {
  cuit: { label: 'CUIT', largo: 11 },
  cuil: { label: 'CUIL', largo: 11 },
  dni: { label: 'DNI', largo: 0 },
  sin_identificar: { label: 'Sin identificar', largo: 0 },
};

export const MEDIOS_PAGO = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta_debito: 'Tarjeta de débito',
  tarjeta_credito: 'Tarjeta de crédito',
  cheque: 'Cheque',
  qr: 'QR / billetera',
  otro: 'Otro',
};

export const TIPOS_VENTA = {
  ticket: { label: 'Ticket', tag: 'tag-venta' },
  factura_a: { label: 'Factura A', tag: 'tag-ingreso' },
  factura_b: { label: 'Factura B', tag: 'tag-ingreso' },
  factura_c: { label: 'Factura C', tag: 'tag-ingreso' },
  nota_credito: { label: 'Nota de crédito', tag: 'tag-baja' },
  nota_debito: { label: 'Nota de débito', tag: 'tag-transf' },
};

export const ESTADOS_VENTA = {
  borrador: { label: 'Borrador', pill: 'est-pendiente' },
  confirmada: { label: 'Confirmada', pill: 'est-recibida' },
  anulada: { label: 'Anulada', pill: 'est-cancelada' },
  pendiente_cae: { label: 'Pendiente CAE', pill: 'est-revision' },
};

export const ESTADOS_COBRANZA = {
  confirmada: { label: 'Confirmada', pill: 'est-recibida' },
  anulada: { label: 'Anulada', pill: 'est-cancelada' },
};

export const CONDICIONES_PAGO = { contado: 'Contado', cuenta_corriente: 'Cuenta corriente' };

/** Opciones de redondeo de efectivo (para plazas sin monedas chicas). */
export const OPCIONES_REDONDEO = [
  { valor: 0, label: 'Sin redondeo' },
  { valor: 10, label: 'A $10' },
  { valor: 50, label: 'A $50' },
  { valor: 100, label: 'A $100' },
];

/**
 * Redondeo del precio de góndola. Incluye "al entero" —el caso habitual— que no
 * tiene sentido para el vuelto en efectivo, por eso es una lista aparte.
 */
export const OPCIONES_REDONDEO_PRECIO = [
  { valor: 0, label: 'Sin redondeo (con centavos)' },
  { valor: 1, label: 'Al entero ($1)' },
  { valor: 10, label: 'A $10' },
  { valor: 50, label: 'A $50' },
  { valor: 100, label: 'A $100' },
];

/** Texto comparable: sin mayúsculas ni acentos. Para los buscadores de los paneles. */
export function norm(v) {
  return (v || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

/** Nº de comprobante con el formato de plaza: 0001-00000123. */
export function nroComprobante(doc) {
  if (!doc) return '—';
  return `${doc.puntoVenta || '0001'}-${String(doc.numero ?? 0).padStart(8, '0')}`;
}

/** Documento legible: "CUIT 30-71234567-8". Vacío → guion. */
export function docLegible(cliente) {
  if (!cliente?.numeroDoc) return '—';
  const t = TIPOS_DOC[cliente.tipoDoc]?.label || '';
  const n = cliente.numeroDoc;
  const fmt = n.length === 11 ? `${n.slice(0, 2)}-${n.slice(2, 10)}-${n.slice(10)}` : n;
  return `${t} ${fmt}`.trim();
}
