import { partesIguales, sumaReparto } from '../domain/reparto.js';
import { Btn, s } from './ui.jsx';

/**
 * El reparto por % entre locales (0216): un renglón por local activo (y los que
 * ya estaban aunque hayan cerrado), con su porcentaje y la suma a la vista.
 * `filas`: [{ sucursalId, pct }] con todos los locales; los de 0 % no van.
 */
export function RepartoLocales({ filas, onChange, sucursales }) {
  const visibles = sucursales.filter((x) => x.activa !== false || filas.some((f) => f.sucursalId === x.id && Number(f.pct) > 0));
  const pctDe = (id) => filas.find((f) => f.sucursalId === id)?.pct ?? '';
  const poner = (id, pct) => onChange([...filas.filter((f) => f.sucursalId !== id), { sucursalId: id, pct }]);
  const suma = sumaReparto(filas);
  const usados = filas.filter((f) => Number(f.pct) > 0).map((f) => f.sucursalId);
  return (
    <div className={s.field}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(190px, 100%), 1fr))', gap: 8 }}>
        {visibles.map((x) => (
          <label key={x.id} style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.nombre}</span>
            <input
              id={`reparto-${x.id}`} type="number" min="0" max="100" step="0.01" style={{ width: 80 }}
              value={pctDe(x.id)} placeholder="0" aria-label={`Porcentaje de ${x.nombre}`}
              onChange={(e) => poner(x.id, e.target.value)}
            />
            %
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
        <span className={s.hint} style={{ margin: 0, color: Math.abs(suma - 100) > 0.01 ? 'var(--crm-color-danger)' : undefined }}>
          Suman <strong>{suma.toLocaleString('es-AR', { maximumFractionDigits: 2 })} %</strong>
          {Math.abs(suma - 100) > 0.01 ? ' — tienen que sumar 100 %' : ''}
        </span>
        <Btn small disabled={usados.length < 2} onClick={() => onChange(partesIguales(usados))}>
          En partes iguales entre los elegidos
        </Btn>
      </div>
    </div>
  );
}
