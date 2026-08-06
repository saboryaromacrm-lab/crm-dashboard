/**
 * KIT DE UI DEL MÓDULO GASTOS
 * ============================================================================
 * Reexporta los componentes de presentación del subsistema de inventario en vez
 * de duplicarlos: son genéricos (tabla, botón, pill, paginador) y ya comparten
 * los tokens `--crm-*`. Igual que hace Ventas — si algún día se promueven a
 * `@shared`, cambia UN archivo por módulo y nada más.
 *
 * Debajo van solo las piezas propias de gastos y pagos.
 */
import { cx } from '@shared/utils/classNames.js';
import { Pill, s } from '@modules/productos/components/ui.jsx';
import { ESTADOS_GASTO, TIPOS_GASTO, urgenciaDe } from '../domain/constants.js';

export { Table, PanelHead, Stat, Pill, Btn, usePaginado, Paginador, s } from '@modules/productos/components/ui.jsx';
export { ModalShell } from '@modules/productos/components/Modal.jsx';
export { money, num, fmtFecha, fmtFechaHora, isoDate } from '@modules/productos/domain/format.js';

export function GastoEstadoPill({ estado }) {
  const m = ESTADOS_GASTO[estado] || {};
  return <Pill pill={m.pill} label={m.label || estado} />;
}

/** Fijo / Variable: distingue el rubro que se repite del que es ocasional. */
export function TipoGastoBadge({ tipo }) {
  return (
    <span className={cx(s.badge, tipo === 'fijo' ? s['badge-entero'] : s['badge-granel'])}>
      {TIPOS_GASTO[tipo] || tipo}
    </span>
  );
}

/** Vencimiento con su urgencia: vencido en rojo, esta semana en ámbar. */
export function VencimientoPill({ dias }) {
  const u = urgenciaDe(dias);
  if (!u.pill) return <span className={s.muted}>{u.label}</span>;
  return <Pill pill={u.pill} label={u.label} />;
}

/** Saldo pendiente: en rojo si queda algo, apagado si está saldado. */
export function Saldo({ valor, children }) {
  const v = Number(valor) || 0;
  const hay = Math.abs(v) > 0.009;
  return (
    <strong style={{ color: hay ? 'var(--crm-color-danger)' : 'var(--crm-color-text-muted)' }}>
      {children}
    </strong>
  );
}

/** Celda etiqueta/valor de los modales de detalle (va dentro de `.detalle-grid`). */
export function Di({ label, children }) {
  return (
    <div className={s.di}>
      <div className={s.l}>{label}</div>
      <div className={s.v}>{children}</div>
    </div>
  );
}
