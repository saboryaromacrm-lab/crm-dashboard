/**
 * FERIADOS: cómo se nombran y se leen, igual en Sistema › Feriados y en el
 * aviso de arriba de toda la app (19/10/2026). Ver crm-api/src/feriados.
 */
import { TURNO_TARDE_DESDE } from './turnos.js';
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

/**
 * Qué hace una sucursal ese día: «abre 08:00-12:30», «cerrada» o «sin definir»
 * (no tiene fila). Abre sin horario = todo el día, con su horario de siempre
 * (así lo lee también la agenda de envíos de la tienda).
 */
export const queHace = (config) => {
  if (!config) return 'sin definir';
  return config.abre ? (config.horario ? `abre ${config.horario}` : 'abre todo el día') : 'cerrada';
};

/** Las claves de los días de los locales de la tienda, por `getDay()` (0 = domingo). */
const CLAVE_DIA = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];
const CORTE = `${String(TURNO_TARDE_DESDE).padStart(2, '0')}:00`;

/**
 * Los turnos de una sucursal ese día (7/11/2026): los tramos de su horario de
 * siempre («08:00-12:30, 17:00-21:00», de Sistema › Horarios)
 * partidos en el corte de turno. Solo si abre en los dos: si no, «a la
 * mañana» sería lo mismo que «todo el día». `semana` null = sin horario cargado.
 */
export const turnosDelDia = (semana, fecha) => {
  const tramos = String(semana?.[CLAVE_DIA[aFecha(fecha).getDay()]] ?? '').split(', ').filter(Boolean);
  const manana = tramos.filter((t) => t < CORTE).join(', ');
  const tarde = tramos.filter((t) => t >= CORTE).join(', ');
  return manana && tarde ? { manana, tarde } : null;
};

/** Lo guardado → la opción del desplegable: '' | 'todo' | 'manana' | 'tarde' | 'otro' | 'no'. */
export const opcionDe = (config, turnos) => {
  if (!config) return '';
  if (!config.abre) return 'no';
  if (!config.horario) return 'todo';
  if (config.horario === turnos?.manana) return 'manana';
  return config.horario === turnos?.tarde ? 'tarde' : 'otro';
};
