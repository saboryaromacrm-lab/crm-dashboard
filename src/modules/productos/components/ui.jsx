/**
 * Componentes de presentación compartidos del módulo Producto.
 * Puros: reciben props y pintan. Consumen el CSS Module del módulo (tokens).
 */
import { cx } from '@shared/utils/classNames.js';
import {
  ESTADOS_STOCK,
  ESTADOS_TRANSFER,
  ESTADOS_INCIDENCIA,
  TIPOS_MOV,
} from '../domain/constants.js';
import styles from '../styles/Productos.module.css';

export { styles as s };

/** Tabla de datos con estado vacío. `cols`: [{ h, num }]. `children`: filas <tr>. */
export function Table({ cols, children, empty = 'Sin datos.' }) {
  const rows = Array.isArray(children) ? children.filter(Boolean) : children;
  const isEmpty = !rows || (Array.isArray(rows) && rows.length === 0);
  return (
    <div className={cx(styles.card, styles.tableCard, styles.tblScroll)}>
      <table className={styles.table}>
        <thead>
          <tr>
            {cols.map((c, i) => (
              <th key={i} className={cx(c.num && styles.num, c.cls && styles[c.cls])}>
                {c.h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isEmpty ? (
            <tr>
              <td colSpan={cols.length} className={styles['empty-state']}>
                {empty}
              </td>
            </tr>
          ) : (
            rows
          )}
        </tbody>
      </table>
    </div>
  );
}

export function PanelHead({ title, desc, actions }) {
  return (
    <div className={styles['panel-head']}>
      <div>
        <h2>{title}</h2>
        {desc && <div className={styles.desc}>{desc}</div>}
      </div>
      {actions && <div className={styles['panel-actions']}>{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, accent }) {
  return (
    <div className={cx(styles.stat, accent && styles[accent])}>
      <div className={styles['stat-label']}>{label}</div>
      <div className={styles['stat-value']}>{value}</div>
    </div>
  );
}

export function Pill({ pill, label }) {
  return <span className={cx(styles.pill, pill && styles[pill])}>{label}</span>;
}
export function StockPill({ estado }) {
  const m = ESTADOS_STOCK[estado] || {};
  return <Pill pill={m.pill} label={m.label || estado} />;
}
export function TransferPill({ estado }) {
  const m = ESTADOS_TRANSFER[estado] || {};
  return <Pill pill={m.pill} label={m.label || estado} />;
}
export function IncidPill({ estado }) {
  const m = ESTADOS_INCIDENCIA[estado] || {};
  return <Pill pill={m.pill} label={m.label || estado} />;
}

export function TipoBadge({ prod }) {
  return prod.tipo === 'granel' ? (
    <span className={cx(styles.badge, styles['badge-granel'])}>A granel</span>
  ) : (
    <span className={cx(styles.badge, styles['badge-entero'])}>Entero</span>
  );
}

export function MovTag({ tipo }) {
  const m = TIPOS_MOV[tipo] || { label: tipo, tag: 'tag-ajuste' };
  return <span className={cx(styles['mov-tag'], styles[m.tag])}>{m.label}</span>;
}

/** Botón con las variantes de color del módulo (btn-primary, btn-vender, …). */
export function Btn({ variant = 'btn-ghost', small, className, ...rest }) {
  return (
    <button
      type="button"
      className={cx(styles.btn, styles[variant], small && styles['btn-sm'], className)}
      {...rest}
    />
  );
}
