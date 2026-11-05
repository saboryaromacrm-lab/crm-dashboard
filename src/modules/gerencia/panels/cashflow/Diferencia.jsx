import { money } from '@modules/productos/domain/format.js';
import { s } from '@modules/productos/components/ui.jsx';

/** La diferencia, con su color: rojo faltó, verde sobró, gris nada. */
export function Diferencia({ v }) {
  if (v == null) return <span className={s.muted}>—</span>;
  const n = Number(v) || 0;
  if (Math.abs(n) < 0.009) return <span style={{ color: 'var(--crm-color-text-muted)' }}>sin diferencia</span>;
  return <strong style={{ color: n < 0 ? 'var(--crm-color-danger)' : 'var(--crm-color-primary)' }}>{n > 0 ? '+' : '−'}{money(Math.abs(n))}</strong>;
}
