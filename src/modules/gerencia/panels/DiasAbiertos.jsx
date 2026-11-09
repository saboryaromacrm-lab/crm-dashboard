/**
 * La línea de días abiertos y turnos que va arriba de cada período (9/11/2026):
 * «Abrió 24 de 30 días · 3 locales sumaron 70 días · 52 turnos de caja · No abrió: vie 1/5».
 * Ver actividad.js y crm-api/src/metricas/actividad.ts.
 */
import { s } from '@modules/productos/components/ui.jsx';
import { localesQueAbrieron, textoSinAbrir } from './actividad.js';

export function DiasAbiertos({ a }) {
  if (!a?.dias) return null;
  const locales = localesQueAbrieron(a);
  return (
    <div className={s.hint} style={{ margin: 0 }}>
      Abrió <strong>{a.abiertos}</strong> de {a.dias} días
      {locales > 1 && <> · {locales} locales sumaron {a.diasLocal} días</>}
      {' · '}<strong>{a.turnos}</strong> turno{a.turnos === 1 ? '' : 's'} de caja
      {a.sinAbrir?.length > 0 && <> · {textoSinAbrir(a.sinAbrir)}</>}
    </div>
  );
}
