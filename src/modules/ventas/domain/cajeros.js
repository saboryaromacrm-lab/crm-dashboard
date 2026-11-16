/**
 * QUIÉN ESTUVO EN LA CAJA (0229, pedido del dueño): el que abrió y el que
 * cerró, que pueden no ser el mismo («abrió Cristian, cerró Daniela»).
 */

/** El que cerró, si no es el que abrió (los viejos sin dato: nadie). */
export const cerroOtro = (turno) => (turno?.cerradoPor && turno.cerradoPor !== turno.usuarioId ? turno.cerradoPor : null);

/** «Cristian», o «Cristian (abrió) · Daniela (cerró)»: para listas y papeles. */
export function textoCajeros(turno, nombreDe) {
  const abrio = nombreDe(turno?.usuarioId) || '—';
  const otro = cerroOtro(turno);
  return otro ? `${abrio} (abrió) · ${nombreDe(otro) || '—'} (cerró)` : abrio;
}
