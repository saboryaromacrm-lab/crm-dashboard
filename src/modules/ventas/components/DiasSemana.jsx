import { cx } from '@shared/utils/classNames.js';
import { s } from './ui.jsx';

const DIAS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

/**
 * LOS DÍAS EN QUE VALE una oferta o un descuento: siete botones de lunes a
 * domingo, prendidos los que valen. `value` es la máscara ('0010000' = solo
 * miércoles); vacía = todos los días, que es también lo que se guarda al
 * dejarlos todos prendidos. No deja apagar el último: «ningún día» no existe.
 */
export function DiasSemana({ value, onChange }) {
  const activo = (i) => !value || value[i] === '1';
  const alternar = (i) => {
    const base = (value && value.length === 7 ? value : '1111111').split('');
    base[i] = base[i] === '1' ? '0' : '1';
    const mascara = base.join('');
    if (mascara === '0000000') return;
    onChange(mascara === '1111111' ? '' : mascara);
  };
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {DIAS.map((d, i) => (
        <button
          key={d} type="button" aria-pressed={activo(i)}
          className={cx(s.badge)}
          style={{ cursor: 'pointer', opacity: activo(i) ? 1 : 0.35, userSelect: 'none' }}
          onClick={() => alternar(i)}
        >
          {d}
        </button>
      ))}
    </div>
  );
}
