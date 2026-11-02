/**
 * EL PLAZO DE UNA CAJA DE VARIOS DÍAS (0212), a la vista de quien vende. El
 * servidor manda `caja.plazo` (crm-api src/caja/plazo.ts): el último día para
 * cerrar, en qué estado está y si ya frena la venta. La caja de todos los
 * días no muestra nada nuevo: sigue como siempre.
 */
import { cx } from '@shared/utils/classNames.js';
import { diaEnPalabras } from '@shared/utils/plazoCaja.js';
import { CartelRojo, useAvisoCadaDosHoras } from '@core/layout/components/CartelRojo.jsx';
import { Btn, s } from './ui.jsx';
import p from '../styles/Pos.module.css';

const COLOR = {
  en_plazo: 'var(--crm-color-success)',
  vence_hoy: 'var(--crm-color-warning)',
  vencida: 'var(--crm-color-danger)',
};

/** Solo las cajas que se cierran cada varios días llevan plazo a la vista. */
const deVariosDias = (caja) => caja?.estado === 'abierta' && caja.plazo?.plazoDias > 1;

/** El dato de la barra de caja: hasta qué día queda abierta, en verde, amarillo o rojo. */
export function PlazoCajaDato({ caja }) {
  if (!deVariosDias(caja)) return null;
  const { estado, cerrarHasta, plazoDias } = caja.plazo;
  return (
    <div className={p.cajaDato} title={`Esta caja se cierra cada ${plazoDias} días`}>
      <span>{estado === 'vencida' ? 'Se tenía que cerrar' : 'Cerrarla a más tardar'}</span>
      <strong style={{ color: COLOR[estado] }}>{estado === 'vence_hoy' ? `hoy, ${diaEnPalabras(cerrarHasta)}` : diaEnPalabras(cerrarHasta)}</strong>
    </div>
  );
}

/** La caja de varios días vencida no vende: lo dice y lleva al cierre. */
export function CajaVencidaAviso({ caja, onCerrar, textoBoton = 'Cerrar la caja' }) {
  if (!caja?.plazo?.bloquea) return null;
  return (
    <div
      className={cx(s.callout, s.warn)} role="alert"
      style={{ margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}
    >
      <span>
        <strong>La caja se tenía que cerrar el {diaEnPalabras(caja.plazo.cerrarHasta)}.</strong>{' '}
        Este local la cierra cada {caja.plazo.plazoDias} días: hasta que la cierres no se puede vender ni cobrar.
        Después abrís una nueva.
      </span>
      {onCerrar && <Btn variant="btn-delete" small onClick={onCerrar}>{textoBoton}</Btn>}
    </div>
  );
}

/** El día que vence, el cartel rojo al entrar y cada 2 horas (como el del stock). */
export function AvisoCierreCaja({ caja }) {
  const activo = deVariosDias(caja) && caja.plazo.estado === 'vence_hoy';
  const [abierto, entendido] = useAvisoCadaDosHoras('erp.avisoCierreCaja.', activo, `${caja?.id ?? ''}.`);
  if (!abierto) return null;
  return (
    <CartelRojo titulo="HOY HAY QUE CERRAR LA CAJA" onEntendido={entendido}>
      <p style={{ margin: 0 }}>Esta caja se cierra cada {caja.plazo.plazoDias} días y hoy es el último.</p>
      <p style={{ margin: '.6em 0 0' }}>Antes de irte, contala y mandá el sobre. Si no, mañana no se puede vender.</p>
    </CartelRojo>
  );
}
