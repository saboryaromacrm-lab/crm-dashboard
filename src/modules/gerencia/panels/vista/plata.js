/**
 * «¿DÓNDE ESTÁ MI PLATA?» — cómo se dicen en pantalla los números de
 * GET /gerencia/plata (crm-api/src/gerencia/plata.ts tiene las reglas).
 */

/** Hasta este importe, una diferencia se considera «cierra» (redondeos de centavos). */
export const TOLERANCIA = 1;

/** El estado del cuadre del efectivo: cierra, sobra o falta. */
export function estadoCuadre(sinExplicar) {
  const v = Number(sinExplicar) || 0;
  if (Math.abs(v) < TOLERANCIA) return { tono: 'ok', texto: 'El efectivo cierra al peso.' };
  if (v > 0) return { tono: 'warn', texto: 'Hay más efectivo del que explican los movimientos.' };
  return { tono: 'danger', texto: 'Falta efectivo que los movimientos no explican.' };
}

/** Lo que dice el historial de saldos de una cuenta: cada diferencia es plata que se movió sin pasar por el ERP. */
export function lecturaDiferencia(dif) {
  const v = Number(dif);
  if (dif == null || !Number.isFinite(v)) return null;
  if (Math.abs(v) < TOLERANCIA) return { tono: 'ok', texto: 'Coincidió con lo que calculaba el ERP.' };
  return v < 0
    ? { tono: 'danger', texto: 'Salió plata que no está cargada en el ERP (pagos, retiros, impuestos, compras con la tarjeta, pase a otra cuenta).' }
    : { tono: 'warn', texto: 'Entró plata que el ERP no conoce (una transferencia que no es venta, un pase desde otra cuenta).' };
}

/** «hace 3 días» / «hoy» desde un instante, para decir qué tan viejo es un saldo cargado. */
export function antiguedad(instante, ahora = new Date()) {
  if (!instante) return '';
  const dias = Math.floor((new Date(ahora).setHours(0, 0, 0, 0) - new Date(instante).setHours(0, 0, 0, 0)) / 86400000);
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'ayer';
  return `hace ${dias} días`;
}

/** Un saldo cargado hace más de una semana ya no sirve para decir dónde está la plata. */
export const saldoViejo = (instante, ahora = new Date()) => !!instante && (new Date(ahora) - new Date(instante)) > 7 * 86400000;

/** Signo explícito para las diferencias: «+$1.000» / «−$1.000». */
export const conSigno = (v, fmt) => `${v > 0.004 ? '+' : v < -0.004 ? '−' : ''}${fmt(Math.abs(Number(v) || 0))}`;
