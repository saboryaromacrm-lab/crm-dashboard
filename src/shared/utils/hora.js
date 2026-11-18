/**
 * LA HORA, DE 0 A 24 EN TODO EL SISTEMA (18/11/2026, pedido del dueño: «19:53»,
 * nunca «07:53 p. m.»). El formato argentino de los navegadores pone
 * «a. m. / p. m.»; `hourCycle: 'h23'` lo fuerza a 00–23 (`hour12: false` puede
 * dar «24:05» pasada la medianoche). Toda pantalla o impresión que muestra una
 * hora pasa por acá.
 */
const H23 = { hourCycle: 'h23' };

/** Fecha y hora con las opciones de `toLocaleString` que se pidan (sin opciones: «17/11/2026, 19:53:07»). */
export const fechaHoraAr = (v, opciones = {}) => new Date(v).toLocaleString('es-AR', { ...opciones, ...H23 });

/** Solo la hora: «19:53»; con `segundos`, «19:53:07». Se le pueden sumar otras opciones (p. ej. `timeZone`). */
export const horaAr = (v, { segundos = false, ...opciones } = {}) => new Date(v).toLocaleTimeString('es-AR', {
  hour: '2-digit', minute: '2-digit', ...(segundos ? { second: '2-digit' } : {}), ...opciones, ...H23,
});
