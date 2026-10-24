import { useEffect, useMemo, useRef, useState } from 'react';
import { s } from './ui.jsx';

const norm = (v) => (v || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

/**
 * UN FILTRO DE VARIAS OPCIONES (24/10/2026, pedido del dueño: «poder
 * seleccionar varias marcas»). Se ve como los otros desplegables de la barra;
 * al tocarlo abre la lista con un buscador y una casilla por opción. Nada
 * elegido = todas. Se cierra con un clic afuera o con Escape.
 *
 * `opciones`: los textos (ya ordenados); `elegidas`: los tildados;
 * `todas`: lo que dice sin nada elegido («Todas las marcas»); `plural`: cómo
 * se nombran varias («marcas» → «3 marcas»).
 */
export function FiltroVarios({ opciones, elegidas, onChange, todas, plural }) {
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState('');
  const caja = useRef(null);
  /* Al cerrar se olvida la búsqueda: al reabrir se ven todas las opciones. */
  const cerrar = () => { setAbierto(false); setQ(''); };

  useEffect(() => {
    if (!abierto) return undefined;
    const afuera = (e) => { if (caja.current && !caja.current.contains(e.target)) cerrar(); };
    const escape = (e) => { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('mousedown', afuera);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', afuera); document.removeEventListener('keydown', escape); };
  }, [abierto]);

  const marcadas = useMemo(() => new Set(elegidas), [elegidas]);
  const visibles = useMemo(() => {
    const ql = norm(q);
    return ql ? opciones.filter((o) => norm(o).includes(ql)) : opciones;
  }, [opciones, q]);
  const alternar = (o) => onChange(marcadas.has(o) ? elegidas.filter((x) => x !== o) : [...elegidas, o]);
  const texto = !elegidas.length ? todas : elegidas.length === 1 ? elegidas[0] : `${elegidas.length} ${plural}`;

  return (
    <div ref={caja} style={{ position: 'relative' }}>
      <button
        type="button" className={s['select-inline']} aria-haspopup="true" aria-expanded={abierto}
        onClick={() => (abierto ? cerrar() : setAbierto(true))}
        style={{ textAlign: 'left', minWidth: 180, cursor: 'pointer', fontWeight: elegidas.length ? 600 : undefined }}
      >
        {texto} ▾
      </button>
      {abierto && (
        <div
          style={{
            position: 'absolute', zIndex: 30, top: 'calc(100% + 4px)', left: 0, width: 280, maxWidth: '90vw',
            background: 'var(--crm-color-surface)', border: '1px solid var(--crm-color-border)',
            borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.18)', padding: 8,
          }}
        >
          <input type="search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Buscar ${plural}…`} style={{ width: '100%' }} />
          <div style={{ maxHeight: 280, overflowY: 'auto', margin: '6px 0' }}>
            {visibles.length ? visibles.map((o) => (
              <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={marcadas.has(o)} onChange={() => alternar(o)} />
                {o}
              </label>
            )) : <div className={s.hint} style={{ margin: 0, padding: '6px' }}>Sin coincidencias.</div>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span className={s.hint} style={{ margin: 0 }}>{elegidas.length ? `${elegidas.length} elegida(s)` : 'Ninguna: se ven todas'}</span>
            <button type="button" className={s.linkBtn} onClick={() => onChange([])} disabled={!elegidas.length}>Limpiar</button>
          </div>
        </div>
      )}
    </div>
  );
}
