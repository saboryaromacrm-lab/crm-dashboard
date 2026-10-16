import { rangoDe } from '@modules/gerencia/panels/metricas/formato.js';
import { Btn, s } from './ui.jsx';

/** Los atajos de fecha de los reportes del módulo (15/10/2026); «Todo» = sin fechas. */
const ATAJOS = [['hoy', 'Hoy'], ['ayer', 'Ayer'], ['semana', 'Esta semana'], ['semana-pasada', 'Semana pasada'], ['mes', 'Este mes'], ['mes-pasado', 'Mes pasado'], ['todo', 'Todo']];
const rangoAtajo = (k) => (k === 'todo' ? ['', ''] : rangoDe(k));

/** Atajos + desde/hasta a mano. El atajo activo es el que coincide con las fechas puestas. */
export function Fechas({ desde, hasta, onChange }) {
  return (
    <>
      {ATAJOS.map(([k, l]) => {
        const [d, h] = rangoAtajo(k);
        return <Btn key={k} small variant={d === desde && h === hasta ? 'btn-primary' : undefined} onClick={() => onChange(d, h)}>{l}</Btn>;
      })}
      <label className={s.hint} style={{ margin: 0 }}>Desde</label>
      <input type="date" value={desde} max={hasta || undefined} onChange={(e) => onChange(e.target.value, hasta)} />
      <label className={s.hint} style={{ margin: 0 }}>Hasta</label>
      <input type="date" value={hasta} min={desde || undefined} onChange={(e) => onChange(desde, e.target.value)} />
    </>
  );
}
