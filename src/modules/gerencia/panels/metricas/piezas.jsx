/** Piezas chicas que comparten todas las pestañas de Métricas. */
import { cx } from '@shared/utils/classNames.js';
import { num } from '@modules/productos/domain/format.js';
import { s } from '@modules/productos/components/ui.jsx';

/** Flecha + signo + texto de una variación en %: nunca el color solo. */
export function Variacion({ valor, contra = 'vs período anterior', sufijo = '%' }) {
  if (valor == null) return null;
  const sube = valor > 0.05;
  const baja = valor < -0.05;
  return (
    <span style={{ fontSize: 12, color: sube ? 'var(--crm-color-success)' : baja ? 'var(--crm-color-danger)' : 'var(--crm-color-text-secondary)', whiteSpace: 'nowrap' }}>
      {sube ? '▲' : baja ? '▼' : '='} {valor > 0 ? '+' : ''}{num(valor, 1)}{sufijo}
      {contra && <span style={{ color: 'var(--crm-color-text-secondary)' }}> {contra}</span>}
    </span>
  );
}

/** Un número con su comparación contra el período anterior. */
export function Tile({ label, valor, variacion, contra, detalle, alerta, marca }) {
  return (
    <div className={cx(s.card, s.cardPad)} style={{ minWidth: 0, flex: '1 1 180px', boxSizing: 'border-box' }}>
      <div className={s['mini-label']} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {marca && <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 3, background: marca, flex: 'none' }} />}
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, overflowWrap: 'anywhere', color: alerta ? 'var(--crm-color-warning, #b45309)' : 'var(--crm-color-text)' }}>{valor}</div>
      {variacion != null && <div><Variacion valor={variacion} contra={contra} /></div>}
      {detalle && <div className={s.hint} style={{ margin: '2px 0 0' }}>{detalle}</div>}
    </div>
  );
}

export const Tiles = ({ children }) => <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>{children}</div>;

export function Bloque({ titulo, sub, children, acciones }) {
  return (
    <div className={cx(s.card, s.cardPad)} style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0, boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div className={s['card-title']} style={{ margin: 0 }}>{titulo}</div>
          {sub && <div className={s.hint} style={{ margin: 0 }}>{sub}</div>}
        </div>
        {acciones}
      </div>
      {children}
    </div>
  );
}

/** Dos o más bloques lado a lado; en el celular, uno abajo del otro. */
export const Grilla = ({ children }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: 12 }}>{children}</div>
);

export const Aviso = ({ tono = 'info', children }) => <div className={cx(s.callout, s[tono])} style={{ margin: 0 }}>{children}</div>;
export const Cargando = () => <div className={s.hint}>Cargando…</div>;
