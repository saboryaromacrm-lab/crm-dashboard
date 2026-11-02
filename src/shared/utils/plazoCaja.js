/**
 * EL PLAZO PARA CERRAR LA CAJA (0212): cómo se dice en pantalla. La regla
 * (qué día vence y si frena la venta) la calcula el servidor (crm-api
 * src/caja/plazo.ts); acá solo se ponen en palabras los datos que manda.
 */

/** «miércoles 28/10», de un día 'AAAA-MM-DD' (al mediodía: sin saltos de huso). */
export const diaEnPalabras = (dia) => {
  if (!dia) return '';
  const d = new Date(`${dia}T12:00:00`);
  return `${d.toLocaleDateString('es-AR', { weekday: 'long' })} ${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
};

/** «Todos los días» o «Cada 3 días». */
export const textoCadaDias = (n) => (Number(n) > 1 ? `Cada ${Number(n)} días` : 'Todos los días');

/** El día de la apertura, en palabras, de un instante. */
const diaDeApertura = (instante) => diaEnPalabras(new Date(instante).toLocaleDateString('sv-SE'));

/**
 * Una caja que pasó su último día para cerrar (`/cashflow/alertas`):
 * «Centro (Ana, abrió el lunes 26/10, tenía que cerrar el miércoles 28/10: 1 día tarde)».
 */
export const textoCajaVencida = (c) => `${c.sucursal} (${c.usuario || 'sin usuario'}, abrió el ${diaDeApertura(c.apertura)}, `
  + `tenía que cerrar el ${diaEnPalabras(c.cerrarHasta)}: ${c.diasVencida} día${c.diasVencida === 1 ? '' : 's'} tarde)`;

/** Los días que abarcó un turno, solo si fue más de uno: «del 26/10 al 28/10» (vacío si abrió y cerró el mismo día). */
export const diasDelTurno = (apertura, cierre) => {
  if (!apertura || !cierre) return '';
  const [a, c] = [apertura, cierre].map((v) => new Date(v).toLocaleDateString('sv-SE'));
  return a === c ? '' : `del ${a.slice(8, 10)}/${a.slice(5, 7)} al ${c.slice(8, 10)}/${c.slice(5, 7)}`;
};
