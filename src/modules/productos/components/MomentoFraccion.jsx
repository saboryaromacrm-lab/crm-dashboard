/**
 * CUÁNDO SE FRACCIONÓ: día y turno, compartido por el registro y la corrección.
 *
 * Por defecto, ahora. Se puede asentar otro día y turno porque muchas veces se
 * carga después ("lo de ayer a la mañana"); la fecha de carga queda igual
 * guardada, así que se sabe que se asentó tarde. Los cortes son los mismos que
 * la API (inventario.service): la mañana va hasta las 14, y se asienta hasta 30
 * días atrás. Vive en un solo lugar para que el registro y la corrección no
 * puedan discrepar sobre qué turno es "ahora".
 */
import { useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { s } from './ui.jsx';

export const TURNO_TARDE_DESDE = 14;
export const DIAS_ASENTAR_ATRAS = 30;
export const TURNOS = { manana: 'Mañana', tarde: 'Tarde' };
const pad2 = (n) => String(n).padStart(2, '0');
export const isoDia = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const turnoDe = (d) => (d.getHours() < TURNO_TARDE_DESDE ? 'manana' : 'tarde');
export const diaLegible = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'numeric' });

export function useMomentoFraccion() {
  const [ahora] = useState(() => new Date());
  const hoy = isoDia(ahora);
  const turnoAhora = turnoDe(ahora);
  const minDia = isoDia(new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - DIAS_ASENTAR_ATRAS));
  const [dia, setDia] = useState(hoy);
  const [turno, setTurno] = useState(turnoAhora);
  const esAhora = dia === hoy && turno === turnoAhora;
  const aFuturo = dia > hoy || (dia === hoy && turno === 'tarde' && turnoAhora === 'manana');
  const muyAtras = !!dia && dia < minDia;
  const fechaMal = !dia || aFuturo || muyAtras;
  return {
    dia, setDia, turno, setTurno, hoy, minDia, esAhora, aFuturo, muyAtras, fechaMal,
    /** Lo que viaja a la API: nada si es ahora (la fecha la pone la base). */
    payload: esAhora ? {} : { dia, turno },
  };
}

/** Los dos campos, para ir adentro de la grilla de cabecera de cada modal. */
export function CamposMomento({ m, id = 'fracc' }) {
  return (
    <>
      <div className={s.field} style={{ marginBottom: 0 }}>
        <label htmlFor={`${id}-dia`}>Día que se fraccionó</label>
        <input id={`${id}-dia`} type="date" value={m.dia} min={m.minDia} max={m.hoy} onChange={(e) => m.setDia(e.target.value)} />
      </div>
      <div className={s.field} style={{ marginBottom: 0 }}>
        <label htmlFor={`${id}-turno`}>Turno</label>
        <select id={`${id}-turno`} value={m.turno} onChange={(e) => m.setTurno(e.target.value)}>
          {Object.entries(TURNOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
    </>
  );
}

/** El aviso de abajo: solo aparece si no es "ahora". */
export function AvisoMomento({ m, style }) {
  if (m.esAhora) return null;
  return (
    <div className={cx(s.callout, m.fechaMal ? s.warn : s.info)} style={style}>
      {!m.dia && 'Elegí el día en que se fraccionó.'}
      {m.dia && m.aFuturo && 'Ese turno todavía no empezó: no se puede asentar a futuro.'}
      {m.dia && m.muyAtras && `Solo se puede asentar hasta ${DIAS_ASENTAR_ATRAS} días atrás.`}
      {!m.fechaMal && (
        <>
          Se asienta como hecho el <strong>{diaLegible(m.dia)}</strong>, turno{' '}
          <strong>{TURNOS[m.turno].toLowerCase()}</strong>. El historial muestra también que se cargó hoy.
        </>
      )}
    </div>
  );
}
