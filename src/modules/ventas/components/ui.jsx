/**
 * KIT DE UI DEL MÓDULO VENTAS
 * ============================================================================
 * Reexporta los componentes de presentación del subsistema de inventario en
 * lugar de duplicarlos: son genéricos (tabla, botón, pill, cabecera de panel) y
 * ya comparten los tokens `--crm-*`. Ventas los consume por acá, así que si
 * algún día se promueven a `@shared`, cambia UN archivo y nada más.
 *
 * Debajo van solo las piezas propias del circuito de venta.
 */
import { cx } from '@shared/utils/classNames.js';
import { Pill, s } from '@modules/productos/components/ui.jsx';
import {
  CONDICIONES_IVA, ESTADOS_COBRANZA, ESTADOS_VENTA, TIPOS_VENTA,
} from '../domain/constants.js';

export {
  Table, PanelHead, Stat, Pill, Btn, usePaginado, usePaginadoServidor, Paginador, s,
} from '@modules/productos/components/ui.jsx';
export { ModalShell } from '@modules/productos/components/Modal.jsx';
export { money, num, fmtFecha, fmtFechaHora, isoDate } from '@modules/productos/domain/format.js';

export function VentaEstadoPill({ estado }) {
  const m = ESTADOS_VENTA[estado] || {};
  return <Pill pill={m.pill} label={m.label || estado} />;
}

export function CobranzaEstadoPill({ estado }) {
  const m = ESTADOS_COBRANZA[estado] || {};
  return <Pill pill={m.pill} label={m.label || estado} />;
}

export function VentaTag({ tipo }) {
  const m = TIPOS_VENTA[tipo] || { label: tipo, tag: 'tag-ajuste' };
  return <span className={cx(s['mov-tag'], s[m.tag])}>{m.label}</span>;
}

/** Condición de IVA en formato corto (RI / MT / CF): entra en cualquier tabla. */
export function CondIvaBadge({ condicion }) {
  const m = CONDICIONES_IVA[condicion];
  if (!m) return <span className={s.muted}>—</span>;
  return <span className={s.badge} title={m.label}>{m.corto}</span>;
}

/** Saldo con color: deuda en rojo, a favor en verde, cero apagado. */
export function SaldoMonto({ valor, children }) {
  const v = Number(valor) || 0;
  const color = v > 0.009 ? 'var(--crm-color-danger)' : v < -0.009 ? 'var(--crm-color-success)' : 'inherit';
  return <strong style={{ color }}>{children}</strong>;
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
