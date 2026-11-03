/**
 * REPARTIR UN GASTO ENTRE LOCALES POR PORCENTAJE (0216, 3/11/2026, pedido del dueño):
 * un alquiler o un sueldo compartido, 50 % Express 1 y 50 % Express 2. La regla
 * la valida el servidor (dos locales o más, cada uno más de 0 %, suma 100);
 * acá, armarlo y mostrarlo.
 */
import { r2 } from './constants.js';

/** El valor del selector de local que abre el reparto. */
export const REPARTO = 'reparto';

/** Lo que se manda: solo los locales con algo, como números. */
export const repartoAEnviar = (filas) => filas
  .filter((x) => Number(x.pct) > 0)
  .map((x) => ({ sucursalId: Number(x.sucursalId), pct: r2(x.pct) }));

export const sumaReparto = (filas) => r2(filas.reduce((a, x) => a + (Number(x.pct) || 0), 0));

/** Partes iguales entre `ids`, con el centésimo que sobra en el primero (33,34 + 33,33 + 33,33). */
export function partesIguales(ids) {
  if (!ids.length) return [];
  const base = Math.floor(10000 / ids.length) / 100;
  return ids.map((id, i) => ({ sucursalId: id, pct: i === 0 ? r2(100 - base * (ids.length - 1)) : base }));
}

/** «Express 1 50 % · Express 2 50 %». */
export const textoReparto = (reparto, nombreDe) => (reparto ?? [])
  .map((x) => `${nombreDe(x.sucursalId)} ${Number(x.pct).toLocaleString('es-AR', { maximumFractionDigits: 2 })} %`)
  .join(' · ');
