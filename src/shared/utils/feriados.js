/**
 * FERIADOS: cómo se nombran y se leen, igual en Sistema › Feriados y en el
 * aviso de arriba de toda la app (19/10/2026). Ver crm-api/src/feriados.
 */
/** Lo dispara Sistema › Feriados al guardar: el aviso de arriba se relee en el acto. */
export const EVENTO_FERIADOS = 'erp:feriados';

export const TIPO_FERIADO = { feriado: 'Feriado', no_laborable: 'No laborable' };
export const ALCANCE_FERIADO = { nacional: 'Nacional', provincial: 'Provincial', municipal: 'Municipal' };

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const aFecha = (dia) => new Date(`${dia}T12:00:00`);

/** «lunes 23/11». */
export const diaYFecha = (dia) => {
  const d = aFecha(dia);
  return `${DIAS[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/** Días de calendario de `hoy` a `dia` (negativo = ya pasó). */
export const diasHasta = (dia, hoy) => Math.round((aFecha(dia) - aFecha(hoy)) / 86_400_000);

/** «hoy», «mañana», «en 5 días», «pasó». */
export const cuantoFalta = (dia, hoy) => {
  const n = diasHasta(dia, hoy);
  if (n < 0) return 'pasó';
  return n === 0 ? 'hoy' : n === 1 ? 'mañana' : `en ${n} días`;
};

/** Qué hace una sucursal ese día: «abre 9 a 13», «cerrada» o «sin definir» (no tiene fila). */
export const queHace = (config) => {
  if (!config) return 'sin definir';
  return config.abre ? `abre${config.horario ? ` ${config.horario}` : ''}` : 'cerrada';
};
