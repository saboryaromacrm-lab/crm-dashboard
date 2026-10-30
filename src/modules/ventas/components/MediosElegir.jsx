import { useEffect, useRef, useState } from 'react';
import { MEDIOS_PAGO } from '../domain/constants.js';

/**
 * «SOLO CON» DE UN DESCUENTO, CON VARIOS MEDIOS (0208, 30/10/2026, pedido del
 * dueño). Parece un desplegable común y se abre como una lista con casillas:
 * se tilda uno o varios. Ninguno = «Cualquier forma». `value` es un array en el
 * orden de la caja (el de MEDIOS_PAGO).
 */
export function MediosElegir({ value = [], onChange, id }) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef(null);

  // Se cierra al tocar afuera o con Escape, como un desplegable.
  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => { if (!caja.current?.contains(e.target)) setAbierto(false); };
    const tecla = (e) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', tecla); };
  }, [abierto]);

  const orden = Object.keys(MEDIOS_PAGO);
  const alternar = (m) => {
    const set = new Set(value);
    if (set.has(m)) set.delete(m); else set.add(m);
    onChange(orden.filter((k) => set.has(k)));
  };
  const texto = value.length ? value.map((m) => MEDIOS_PAGO[m] ?? m).join(' o ') : 'Cualquier forma';

  return (
    <div ref={caja} style={{ position: 'relative' }}>
      <button
        type="button" id={id} aria-haspopup="listbox" aria-expanded={abierto} title={texto}
        onClick={() => setAbierto((x) => !x)}
        style={{
          width: '100%', padding: '10px 30px 10px 12px', textAlign: 'left', cursor: 'pointer',
          border: `1px solid ${abierto ? 'var(--crm-color-primary)' : 'var(--crm-color-border)'}`,
          borderRadius: 'var(--crm-radius-sm)', background: 'var(--crm-color-surface)', color: 'var(--crm-color-text)',
          fontSize: 'var(--crm-font-size-sm)', fontFamily: 'inherit',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', position: 'relative',
        }}
      >
        {texto}
        <span aria-hidden style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 10, opacity: 0.6 }}>▼</span>
      </button>
      {abierto && (
        <div
          role="listbox" aria-multiselectable="true"
          style={{
            position: 'absolute', zIndex: 20, top: 'calc(100% + 4px)', left: 0, minWidth: '100%', padding: '6px 0',
            background: 'var(--crm-color-surface)', border: '1px solid var(--crm-color-border)',
            borderRadius: 'var(--crm-radius-sm)', boxShadow: '0 8px 24px rgba(0,0,0,.14)',
          }}
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: 13.5 }}>
            <input type="checkbox" checked={!value.length} onChange={() => onChange([])} />
            Cualquier forma
          </label>
          <div style={{ borderTop: '1px solid var(--crm-color-border)', margin: '4px 0' }} />
          {orden.map((m) => (
            <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: 13.5 }}>
              <input type="checkbox" checked={value.includes(m)} onChange={() => alternar(m)} />
              {MEDIOS_PAGO[m]}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
