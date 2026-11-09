/**
 * DÍAS ABIERTOS Y TURNOS (9/11/2026, pedido del dueño) — los textos, sin React.
 * ============================================================================
 * La cuenta la hace la API (crm-api/src/metricas/actividad.ts): un local abrió
 * un día si vendió en el mostrador; los turnos son los de caja que se abrieron.
 * Lo usan Rentabilidad, Resultados, Métricas, Indicadores y la Vista profesional.
 */

const DIAS_SEM = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
/** Hasta cuántos días sin abrir se nombran uno por uno (más, se cuentan). */
const MAX_NOMBRADOS = 10;

/** 'AAAA-MM-DD' → «vie 1/5». */
export function diaCorto(dia) {
  const [a, m, d] = dia.split('-').map(Number);
  return `${DIAS_SEM[new Date(Date.UTC(a, m - 1, d)).getUTCDay()]} ${d}/${m}`;
}

/** «No abrió: vie 1/5, jue 25/5» o, si son muchos, «40 días sin abrir». */
export function textoSinAbrir(sinAbrir = []) {
  if (!sinAbrir.length) return '';
  return sinAbrir.length <= MAX_NOMBRADOS ? `No abrió: ${sinAbrir.map(diaCorto).join(', ')}` : `${sinAbrir.length} días sin abrir`;
}

/** Cuántos locales abrieron al menos un día. */
export const localesQueAbrieron = (a) => Object.values(a?.porSucursal ?? {}).filter((x) => x.dias > 0).length;

/** El monto por día abierto (null si no abrió ningún día). */
export const porDiaAbierto = (monto, abiertos) => (abiertos > 0 ? (Number(monto) || 0) / abiertos : null);

/** «abrió 22 días contra 25» para poner al lado de una comparación (vacío si abrió los mismos). */
export const textoDiasContra = (a, b) => (a != null && b != null && a !== b ? `abrió ${a} día${a === 1 ? '' : 's'} contra ${b}` : '');
