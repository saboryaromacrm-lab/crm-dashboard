/* La MISMA piel que el resto del sistema (patrón de gastos/ui.jsx): se
 * re-exporta y se agregan solo las piezas propias del módulo. */
export {
  Table, PanelHead, Stat, Pill, Btn, usePaginado, s,
} from '@modules/productos/components/ui.jsx';
export { ModalShell } from '@modules/productos/components/Modal.jsx';
export { money, num, fmtFecha, fmtFechaHora } from '@modules/productos/domain/format.js';
export { Di, Saldo } from '@modules/gastos/components/ui.jsx';

import { Pill as PillBase } from '@modules/productos/components/ui.jsx';

/* Las clases de pill son las del sistema: est-pendiente (ámbar),
 * est-recibida (verde), est-cancelada (rojo), null = neutra. */

/** Los días que faltan (o pasaron) para un vencimiento, con su urgencia. */
export function VencePill({ dias }) {
  if (dias == null) return null;
  if (dias < 0) return <PillBase pill="est-cancelada" label={`vencido hace ${-dias} d`} />;
  if (dias === 0) return <PillBase pill="est-cancelada" label="vence HOY" />;
  if (dias <= 3) return <PillBase pill="est-pendiente" label={`en ${dias} d`} />;
  return <PillBase label={`en ${dias} d`} />;
}

export function EstadoEcheqPill({ estado, dias }) {
  const activo = estado === 'emitido' || estado === 'entregado';
  if (activo && dias != null && dias < 0) return <PillBase pill="est-cancelada" label={`vencido · ${estado}`} />;
  const pill = { entregado: 'est-pendiente', cobrado: 'est-recibida', anulado: 'est-cancelada' }[estado] || null;
  return <PillBase pill={pill} label={estado} />;
}

export function EstadoCuentaPill({ estado }) {
  const map = {
    a_favor: [null, 'A favor'],
    al_dia: ['est-recibida', 'Al día'],
    pendiente: ['est-pendiente', 'Pendiente'],
    vencido: ['est-cancelada', 'Vencido'],
  };
  const [pill, label] = map[estado] || [null, estado];
  return <PillBase pill={pill} label={label} />;
}
