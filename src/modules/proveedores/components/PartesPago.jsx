import { MEDIOS_PAGO_REAL } from '../services/proveedores.api.js';
import { CuentaPropiaSelect } from '@shared/components/CuentaPropiaSelect.jsx';
import { agregarParte, estadoPartes, restoParaParte, sumaPartes } from '../domain/partesPago.js';
import { Btn, money, s } from './ui.jsx';

const hoyISO = () => {
  const d = new Date(); const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/**
 * Las partes de un pago mixto (medio, cuenta, importe y fecha propia de cada
 * una: «una parte la transferí hace 10 días»). Lo usan Pagarle a un proveedor y
 * Pagar un compromiso. «El resto» completa una parte con lo que falta para el
 * total, y una parte nueva ya llega con lo que falta: nadie tiene que restar.
 */
export function PartesPago({ formas, setFormas, total }) {
  const cambiar = (i, k, v) => setFormas((xs) => xs.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const al = (i, k) => (e) => cambiar(i, k, e.target.value);
  const estado = estadoPartes(formas, total);

  return (
    <>
      {formas.map((x, i) => {
        const resto = restoParaParte(formas, total, i);
        const yaEsElResto = resto != null && Math.abs(resto - (Number(x.importe) || 0)) <= 0.009;
        // Se ofrece en una parte vacía o en la última: en una que ya tiene importe y no es la última, confunde.
        const ofrecerResto = resto != null && !yaEsElResto && (!(Number(x.importe) > 0) || i === formas.length - 1);
        return (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
            <select value={x.medio} onChange={al(i, 'medio')} style={{ width: 160 }}>
              {Object.entries(MEDIOS_PAGO_REAL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            {x.medio === 'transferencia' && (
              <CuentaPropiaSelect value={x.cuentaId} onChange={(v) => cambiar(i, 'cuentaId', v)} style={{ width: 170 }} />
            )}
            <input
              type="number" min="0" step="0.01" placeholder="Importe"
              value={x.importe} onChange={al(i, 'importe')} style={{ width: 130, textAlign: 'right' }}
            />
            {ofrecerResto && (
              <Btn small onClick={() => cambiar(i, 'importe', String(resto))} title={`Completa esta parte con ${money(resto)}`}>
                El resto
              </Btn>
            )}
            <input type="date" max={hoyISO()} value={x.fecha} onChange={al(i, 'fecha')} />
            {formas.length > 1 && (
              <Btn small onClick={() => setFormas((xs) => xs.filter((_, j) => j !== i))} aria-label="Quitar esta parte">×</Btn>
            )}
          </div>
        );
      })}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <Btn small onClick={() => setFormas((xs) => agregarParte(xs, total))}>+ Agregar parte</Btn>
        <span className={s.hint} style={{ margin: 0 }}>
          Suman {money(sumaPartes(formas))} de {money(total)}
          {estado.id === 'faltan' && <> · <strong>faltan {money(estado.monto)}</strong></>}
          {estado.id === 'sobran' && <> · <strong style={{ color: 'var(--crm-color-danger)' }}>sobran {money(estado.monto)}</strong></>}
          {estado.id === 'cierra' && <> · cierra justo</>}
        </span>
      </div>
    </>
  );
}
