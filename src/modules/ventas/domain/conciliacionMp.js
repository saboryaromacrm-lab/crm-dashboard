/**
 * VENTAS › CONCILIACIÓN MP — lo que la pantalla necesita saber (18/11/2026).
 * La cuenta la hace la API (`crm-api/src/mercadopago/conciliacion*.ts`): acá
 * solo nombres, el color de cada día y el calendario.
 */
import { TIPOS_VENTA, nroComprobante } from './constants.js';

export const FAMILIA = { qr: 'QR', tarjeta: 'Tarjeta (Point)', transferencia: 'Transferencia' };
export const MEDIO_ERP = { qr: 'QR', tarjeta_debito: 'Débito', tarjeta_credito: 'Crédito', transferencia: 'Transferencia' };
export const nombreMedio = (m) => MEDIO_ERP[m] ?? m;

/** ¿Los dos lados son la misma plata (al centavo)? */
export const mismoImporte = (cobro, pago) => Math.abs((cobro?.importe ?? 0) - (pago?.bruto ?? 0)) <= 0.009;

/**
 * «QR → Crédito» si atar este cobro con este pago le cambia el medio a la
 * venta; si no, null. La misma regla que la API: uno con uno, mismo importe,
 * Mercado Pago dice un medio claro (`pago.medioErp`) y distinto, y no es el QR
 * del ERP (referencia «MP n»).
 */
export const cambioDeMedio = (cobro, pago) => (cobro && pago?.medioErp && pago.medioErp !== cobro.medio
  && mismoImporte(cobro, pago) && !String(cobro.referencia ?? '').startsWith('MP ')
  ? `${nombreMedio(cobro.medio)} → ${nombreMedio(pago.medioErp)}` : null);

/** Por qué se sugiere un pago para un cobro (ver `sugerir` en la API). */
export const POR_QUE = {
  varios: 'Hay más de uno posible',
  otro_medio: 'Mismo importe, otro medio',
  monto_distinto: 'Misma hora, otro importe',
};
export const TIPO_ATADO = { auto: 'Solo', manual: 'A mano', sin_venta: 'No es venta', sin_mp: 'No entró a MP' };
/** Lo que se ofrece para explicar lo que quedó de un solo lado (siempre se puede escribir otra cosa). */
export const MOTIVOS = {
  sin_venta: ['Plata propia / aporte', 'Devolución o reintegro de un proveedor', 'Cobro de algo que no pasa por el ERP', 'Prueba'],
  sin_mp: ['Se cobró en efectivo (se marcó mal el medio)', 'Fue a otra cuenta', 'El cobro no pasó'],
};

/**
 * El color del día: rojo si quedó un cobro sin pago y sin candidato; amarillo
 * si hay algo para confirmar o mirar; verde si cerró. Sin datos, nada.
 */
export function estadoDia(d) {
  if (!d || (!d.vendido && !d.entro)) return 'vacio';
  if (d.faltan > 0.009) return 'falta';
  if (d.sugeridos > 0 || d.sinVenta > 0.009 || d.avisos > 0) return 'revisar';
  return 'ok';
}

const diaIso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** «2026-11» → primer y último día. */
export function rangoMes(mes) {
  const [y, m] = mes.split('-').map(Number);
  return { desde: diaIso(y, m, 1), hasta: diaIso(y, m, new Date(Date.UTC(y, m, 0)).getUTCDate()) };
}

/** «2026-11» y ±n meses. */
export function moverMes(mes, n) {
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Las semanas del mes, de lunes a domingo: cada una 7 días ('YYYY-MM-DD') o null fuera del mes. */
export function semanasDelMes(mes) {
  const [y, m] = mes.split('-').map(Number);
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const corrimiento = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // lunes = 0
  const celdas = [...Array(corrimiento).fill(null), ...Array.from({ length: ultimo }, (_, i) => diaIso(y, m, i + 1))];
  while (celdas.length % 7) celdas.push(null);
  return Array.from({ length: celdas.length / 7 }, (_, i) => celdas.slice(i * 7, i * 7 + 7));
}

/** «Factura B 00030-00000431» o «Recibo 0001-00000012». */
export const comprobanteDe = (c) => `${c.origen === 'recibo' ? 'Recibo' : TIPOS_VENTA[c.tipoDoc]?.label ?? c.tipoDoc} ${nroComprobante(c)}`;

/**
 * Lo de alrededor de un día para atar a mano. Una transferencia llega hasta 3
 * días ANTES de la venta: desde un cobro se mira 3 días atrás y 1 adelante;
 * desde un pago, 1 atrás y 3 adelante (las ventas que vinieron después).
 */
export function alrededor(dia, desdePago = false) {
  const d = new Date(`${dia}T12:00:00Z`);
  const mover = (n) => new Date(d.getTime() + n * 86_400_000).toISOString().slice(0, 10);
  return desdePago ? { desde: mover(-1), hasta: mover(3) } : { desde: mover(-3), hasta: mover(1) };
}
