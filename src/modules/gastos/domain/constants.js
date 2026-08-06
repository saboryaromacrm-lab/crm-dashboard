/**
 * Vocabulario del módulo Gastos. Datos, no lógica: etiquetas, colores de pill y
 * las dos o tres cuentas que se repiten en todos los paneles.
 */

export const TIPOS_DOC_GASTO = {
  factura: 'Factura',
  ticket: 'Ticket',
  recibo: 'Recibo',
  nota_credito: 'Nota de crédito',
  otro: 'Otro',
};

export const ESTADOS_GASTO = {
  pendiente: { label: 'Pendiente', pill: 'est-pendiente' },
  pagado: { label: 'Pagado', pill: 'est-recibida' },
  anulado: { label: 'Anulado', pill: 'est-cancelada' },
};

export const TIPOS_GASTO = {
  fijo: 'Fijo',
  variable: 'Variable',
};

export const FRECUENCIAS = {
  mensual: 'Mensual',
  bimestral: 'Bimestral',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
  anual: 'Anual',
};

export const MEDIOS_PAGO = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta_debito: 'Débito',
  tarjeta_credito: 'Crédito',
  cheque: 'Cheque',
  qr: 'QR',
  otro: 'Otro',
};

/** Redondeo a dos decimales. El sistema trabaja con doubles. */
export const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Fecha de hoy en 'AAAA-MM-DD' local (nunca `toISOString`: corre el día). */
export function hoyISO(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Período 'AAAA-MM' del mes indicado (0 = este mes, -1 = el anterior). */
export function periodoISO(offsetMeses = 0) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offsetMeses);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Primer día del mes actual, para el filtro por defecto de los listados. */
export function inicioDeMes() {
  const d = new Date();
  return hoyISO(new Date(d.getFullYear(), d.getMonth(), 1));
}

/**
 * Cómo mostrar el vencimiento de un documento impago. `dias` viene calculado
 * por la API (negativo = vencido) para no discutir con la zona horaria.
 */
export function urgenciaDe(dias) {
  if (dias === null || dias === undefined) return { label: 'Sin vencimiento', pill: null };
  if (dias < 0) return { label: `Vencido hace ${Math.abs(dias)} día${Math.abs(dias) === 1 ? '' : 's'}`, pill: 'est-cancelada' };
  if (dias === 0) return { label: 'Vence hoy', pill: 'est-pendiente' };
  if (dias <= 7) return { label: `Vence en ${dias} día${dias === 1 ? '' : 's'}`, pill: 'est-pendiente' };
  return { label: `En ${dias} días`, pill: null };
}

/** Etiqueta corta de un proveedor, con el texto libre como respaldo. */
export function nombreProveedor(gasto, proveedores = []) {
  if (gasto.proveedorId) {
    return proveedores.find((p) => p.id === gasto.proveedorId)?.nombre || `Proveedor #${gasto.proveedorId}`;
  }
  return gasto.proveedorTexto || '—';
}
