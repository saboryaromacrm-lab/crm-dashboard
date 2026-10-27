/* La MISMA piel que el resto del sistema (patrón de gastos/ui.jsx): se
 * re-exporta y se agregan solo las piezas propias del módulo. */
export {
  Table, PanelHead, Stat, Pill, Btn, usePaginado, s,
} from '@modules/productos/components/ui.jsx';
export { ModalShell } from '@modules/productos/components/Modal.jsx';
export { money, num, fmtFecha, fmtFechaHora } from '@modules/productos/domain/format.js';
export { Di, Saldo } from '@modules/gastos/components/ui.jsx';

import { Pill as PillBase, s } from '@modules/productos/components/ui.jsx';
import { money } from '@modules/productos/domain/format.js';

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
  if (estado === 'pendiente') return <PillBase pill="est-pendiente" label="pendiente de confirmar" />;
  const activo = estado === 'emitido' || estado === 'entregado';
  if (activo && dias != null && dias < 0) return <PillBase pill="est-cancelada" label={`vencido · ${estado}`} />;
  const pill = { entregado: 'est-pendiente', cobrado: 'est-recibida', anulado: 'est-cancelada' }[estado] || null;
  return <PillBase pill={pill} label={estado} />;
}

/**
 * Lo que cubre un echeq (0205): sus facturas, con lo que falta de cada una, y
 * lo que no cubre de ninguna —al cobrarse va a cuenta del proveedor—.
 */
export function EcheqCubre({ e }) {
  const enCartera = e.estado === 'emitido' || e.estado === 'entregado';
  const sinFactura = enCartera && e.proveedorId && e.sinFactura > 0.009;
  if (!e.facturas.length && !sinFactura) return null;
  return (
    <div className={s.hint} style={{ margin: 0 }}>
      {e.facturas.map((f) => <div key={f.comprobanteId}>{f.etiqueta} · {money(f.falta)}</div>)}
      {sinFactura && <div>Sin factura: {money(e.sinFactura)}</div>}
    </div>
  );
}

/**
 * El importe de un compromiso (27/10/2026): el pendiente muestra lo que de
 * verdad falta, y si la factura ya se pagó en parte, de cuánto era la promesa.
 */
export function ImporteCompromiso({ k }) {
  if (k.pagado || Math.abs(k.falta - k.importe) < 0.01) return money(k.importe);
  return (
    <>
      {money(k.falta)}
      <div className={s.hint} style={{ margin: 0 }}>de {money(k.importe)}</div>
    </>
  );
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
