/**
 * EL PLAZO PARA CERRAR LA CAJA (0212 y 0214): cómo se dice en pantalla. La
 * regla (qué día vence y si frena la venta) la calcula el servidor (crm-api
 * src/caja/plazo.ts); acá solo se ponen en palabras los datos que manda.
 */

/** «miércoles 28/10», de un día 'AAAA-MM-DD' (al mediodía: sin saltos de huso). */
export const diaEnPalabras = (dia) => {
  if (!dia) return '';
  const d = new Date(`${dia}T12:00:00`);
  return `${d.toLocaleDateString('es-AR', { weekday: 'long' })} ${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
};

/** El día de la semana que sigue a 'AAAA-MM-DD': «jueves». */
export const diaSiguiente = (dia) => (dia ? new Date(new Date(`${dia}T12:00:00`).getTime() + 86_400_000).toLocaleDateString('es-AR', { weekday: 'long' }) : '');

/** Los días de la semana como los guarda el servidor: 1 = lunes … 7 = domingo. En plural, como se dice. */
export const DIAS_CIERRE = [[1, 'L', 'lunes'], [2, 'M', 'martes'], [3, 'M', 'miércoles'], [4, 'J', 'jueves'], [5, 'V', 'viernes'], [6, 'S', 'sábados'], [7, 'D', 'domingos']];

/** «Todos los días», «Los lunes» o «Los lunes y miércoles» (el mismo texto que la Auditoría). */
export const textoDiasCierre = (dias) => {
  const n = DIAS_CIERRE.filter(([d]) => (dias ?? []).includes(d)).map(([, , nombre]) => nombre);
  if (!n.length || n.length === 7) return 'Todos los días';
  return `Los ${n.length > 1 ? `${n.slice(0, -1).join(', ')} y ${n.at(-1)}` : n[0]}`;
};

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

/**
 * RENDIR TODO, DESDE Y HASTA (26/11/2026, pedido del dueño). El 25/11 una
 * cajera de un Express (cierre los miércoles) contó al cerrar solo el cajón:
 * la plata de los días anteriores la había sacado cada noche, como cuando
 * cerraba todos los días, y el cierre dio −$625.311 (después la rindió). Por
 * eso un turno que viene de otro día dice, con fechas, desde cuándo hasta
 * cuándo hay que rendir. `apertura`: instante de apertura; `hasta`: día
 * 'AAAA-MM-DD' (hoy al cerrar, el día de cierre en el arqueo). null si el
 * turno abrió ese mismo día: no hay nada de otros días que juntar.
 */
export const rendirDesdeHasta = (apertura, hasta) => {
  if (!apertura || !hasta) return null;
  const desde = new Date(apertura).toLocaleDateString('sv-SE');
  if (desde >= hasta) return null;
  return { desde: diaEnPalabras(desde), hasta: diaEnPalabras(hasta) };
};

/** Hoy, 'AAAA-MM-DD' en la hora de la computadora (la del local). */
export const hoyLocal = () => new Date().toLocaleDateString('sv-SE');
