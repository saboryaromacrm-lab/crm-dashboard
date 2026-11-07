/* La MISMA piel que el resto del sistema (patrón de gastos/ui.jsx): se
 * re-exporta y se agregan solo las piezas propias del módulo. */
export {
  Table, TablaMovil, PanelHead, Stat, Pill, Btn, usePaginado, s,
} from '@modules/productos/components/ui.jsx';
export { ModalShell } from '@modules/productos/components/Modal.jsx';
export { money, num, fmtFecha, fmtFechaHora } from '@modules/productos/domain/format.js';
export { Di, Saldo } from '@modules/gastos/components/ui.jsx';

import { Pill as PillBase, s } from '@modules/productos/components/ui.jsx';
import { fmtFecha, money } from '@modules/productos/domain/format.js';

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
 * Lo que ya cubre lo pagado a cuenta o un ajuste (3/11/2026) se dice aparte.
 */
export function ImporteCompromiso({ k }) {
  if (k.pagado || Math.abs(k.falta - k.importe) < 0.01) return money(k.importe);
  return (
    <>
      {money(k.falta)}
      <div className={s.hint} style={{ margin: 0 }}>de {money(k.importe)}</div>
      {k.cubiertoACuenta > 0.009 && (
        <div className={s.hint} style={{ margin: 0 }}>{money(k.cubiertoACuenta)} ya pagado a cuenta</div>
      )}
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

/**
 * Una fila que se tilda (factura, gasto, flete): botón y no checkbox — el CSS
 * global de formularios le pone ancho completo a todo `input` y un tilde nativo
 * suelto se estira a 240 px. A la derecha va el importe.
 */
export function FilaTilde({ marcado, onClick, disabled = false, valor, children }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      style={{
        all: 'unset', boxSizing: 'border-box', display: 'flex', alignItems: 'center',
        gap: 10, width: '100%', padding: '7px 10px', cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        font: 'inherit', fontSize: 13, lineHeight: 1.3, textAlign: 'left',
        borderBottom: '1px solid var(--crm-color-border)',
        background: marcado ? 'var(--crm-color-primary-soft)' : 'transparent',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 16, height: 16, flex: 'none', borderRadius: 4,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700,
          border: marcado ? '1.5px solid var(--crm-color-primary)' : '1.5px solid var(--crm-color-border)',
          background: marcado ? 'var(--crm-color-primary)' : 'transparent',
          color: 'var(--crm-color-primary-contrast)',
        }}
      >
        {marcado ? '✓' : ''}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
      <span style={{ flex: 'none', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{valor}</span>
    </button>
  );
}

/** La caja con borde y scroll donde van las `FilaTilde`. */
export const cajaTildes = (alto) => ({
  maxHeight: alto, overflowY: 'auto', overflowX: 'hidden',
  border: '1px solid var(--crm-color-border)', borderRadius: 8, marginBottom: 8,
});

/** Lo que el echeq pendiente cubre de una factura vs. lo ya cubierto por echeqs hechos (7/11/2026). */
export const echeqsDeFactura = (d) => {
  const xs = d.echeqs ?? [];
  const hechos = xs.filter((e) => e.estado !== 'pendiente');
  const pendientes = xs.filter((e) => e.estado === 'pendiente');
  const suma = (l) => Math.round(l.reduce((a, e) => a + e.cubre, 0) * 100) / 100;
  return { hechos, pendientes, cubreHechos: suma(hechos), cubrePendientes: suma(pendientes) };
};

/** «echeq N° 123 · $X · debita 12/11» o «echeq pendiente de hacer · $X», debajo de la factura. */
export function EcheqsDeFactura({ d }) {
  const xs = d.echeqs ?? [];
  if (!xs.length) return null;
  return (
    <span style={{ display: 'block', fontSize: 12, color: 'var(--crm-color-warning)' }}>
      {xs.map((e) => (e.estado === 'pendiente'
        ? `echeq pendiente de hacer · ${money(e.cubre)}`
        : `ya la cubre el echeq N° ${e.numero || e.id} · ${money(e.cubre)} · debita ${fmtFecha(e.fechaVenc)}`)).join(' — ')}
    </span>
  );
}
