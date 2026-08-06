/**
 * Componentes de presentación compartidos del módulo Producto.
 * Puros: reciben props y pintan. Consumen el CSS Module del módulo (tokens).
 */
import { useEffect, useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import {
  ESTADOS_STOCK,
  ESTADOS_TRANSFER,
  ESTADOS_INCIDENCIA,
  TIPOS_MOV,
} from '../domain/constants.js';
import styles from '../styles/Productos.module.css';

export { styles as s };

/* ---------------- Paginación ---------------- */

const TAMANOS_PAGINA = [10, 20, 50, 100];
const TAM_DEFAULT = 20;

function tamGuardado(clave) {
  try {
    const v = Number(localStorage.getItem(`crm.filasPorPagina.${clave}`));
    return TAMANOS_PAGINA.includes(v) ? v : TAM_DEFAULT;
  } catch { return TAM_DEFAULT; }
}

/**
 * Paginación en memoria para cualquier listado. `clave` identifica la tabla y
 * persiste el tamaño elegido (default 20) para la próxima visita. `reinicio` es
 * la firma de los filtros del panel: cuando cambia, se vuelve a la página 1.
 * Si el filtro achica el listado, la página se ajusta sola al último rango.
 */
export function usePaginado(items, clave, reinicio = '') {
  const [tam, setTam] = useState(() => tamGuardado(clave));
  const [pagina, setPagina] = useState(1);

  useEffect(() => { setPagina(1); }, [reinicio]);

  const total = items.length;
  const paginas = Math.max(1, Math.ceil(total / tam));
  const actual = Math.min(pagina, paginas);

  const visibles = useMemo(
    () => (total <= tam ? items : items.slice((actual - 1) * tam, actual * tam)),
    [items, actual, tam, total],
  );

  const cambiarTam = (n) => {
    try { localStorage.setItem(`crm.filasPorPagina.${clave}`, String(n)); } catch { /* privado */ }
    setTam(n);
    setPagina(1);
  };

  return { visibles, total, tam, paginas, actual, setPagina, cambiarTam };
}

/** Barra de paginación. No aparece si el listado entra en la página más chica. */
export function Paginador({ pag }) {
  const { total, tam, paginas, actual, setPagina, cambiarTam } = pag;
  if (total <= TAMANOS_PAGINA[0]) return null;
  const desde = (actual - 1) * tam + 1;
  const hasta = Math.min(actual * tam, total);
  return (
    <div className={styles.paginador}>
      <span className={styles.pagInfo}>{desde}–{hasta} de {total}</span>
      <label className={styles.pagTam}>
        Filas por página
        <select value={tam} onChange={(e) => cambiarTam(Number(e.target.value))}>
          {TAMANOS_PAGINA.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <div className={styles.pagNav}>
        <button type="button" disabled={actual <= 1} onClick={() => setPagina(1)} aria-label="Primera página">«</button>
        <button type="button" disabled={actual <= 1} onClick={() => setPagina(actual - 1)} aria-label="Página anterior">‹</button>
        <span className={styles.pagActual}>{actual} / {paginas}</span>
        <button type="button" disabled={actual >= paginas} onClick={() => setPagina(actual + 1)} aria-label="Página siguiente">›</button>
        <button type="button" disabled={actual >= paginas} onClick={() => setPagina(paginas)} aria-label="Última página">»</button>
      </div>
    </div>
  );
}

/**
 * Tabla de datos con estado vacío. `cols`: [{ h, num }]. `children`: filas <tr>.
 * Con `pag` (lo que devuelve usePaginado) pinta la barra de paginación al pie;
 * el llamador pagina los DATOS (mapea pag.visibles), no las filas ya pintadas.
 */
export function Table({ cols, children, empty = 'Sin datos.', pag }) {
  const rows = Array.isArray(children) ? children.filter(Boolean) : children;
  const isEmpty = !rows || (Array.isArray(rows) && rows.length === 0);
  const tabla = (
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
  if (!pag) return tabla;
  return (
    <div className={styles.tablaPaginada}>
      {tabla}
      <Paginador pag={pag} />
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
