/**
 * EL STOCK A GRANEL «A OJO» DENTRO DEL PEDIDO (5/10/2026, pedido del dueño) — TEMPORAL
 * ============================================================================
 * Mientras el stock real del sistema no está confiable, el depósito cuenta a
 * ojo las bolsas cerradas de cada granel (Proveedores › Stock provisorio
 * granel). Este apartado se lo muestra al cajero en la pestaña A granel del
 * pedido entre sucursales: qué hay y cuánto, y desde la misma fila lo suma al
 * pedido. Si el producto tiene cargados los kg de la bolsa (formato de compra
 * que fija el precio), se pide en BOLSAS y se convierte a kg; si no, en kg.
 *
 * Se borra junto con el stock provisorio (ver crm-api/src/stock-provisorio).
 * Si este usuario no tiene permiso, la consulta da 403 y el apartado no aparece.
 */
import { useEffect, useMemo, useState } from 'react';
import { httpClient } from '@core/services/httpClient.js';
import { fmtFechaHora, num } from '../domain/format.js';
import { kgBolsa } from '../domain/bulto.js';
import { Btn, s } from './ui.jsx';

const sinTildes = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();


export function StockGranelOjo({ store, onAgregar, toast }) {
  const [filas, setFilas] = useState(null); // null = cargando o sin permiso
  const [abierto, setAbierto] = useState(true);
  const [q, setQ] = useState('');
  const [cant, setCant] = useState({});

  useEffect(() => {
    let vivo = true;
    httpClient.get('/stock-provisorio/consulta')
      .then((d) => { if (vivo) setFilas(Array.isArray(d) ? d : []); })
      .catch(() => { if (vivo) setFilas([]); });
    return () => { vivo = false; };
  }, []);

  const lista = useMemo(() => {
    const t = sinTildes(q.trim());
    return (filas ?? [])
      .map((r) => ({ ...r, p: store.getProducto(r.productoId) }))
      .filter((r) => r.p && (!t || sinTildes(`${r.nombre} ${r.p.marca || ''} ${r.categoria}`).includes(t)))
      .sort((a, b) => a.categoria.localeCompare(b.categoria, 'es') || a.nombre.localeCompare(b.nombre, 'es'));
  }, [filas, q, store]);

  if (!filas || !filas.length) return null;
  const ultimo = filas.reduce((a, r) => (!a || r.fecha > a ? r.fecha : a), null);

  const pedir = (r) => {
    const kg = kgBolsa(r.p);
    const v = Number(String(cant[r.productoId] ?? '').replace(',', '.'));
    if (!(v > 0) || (kg && !Number.isInteger(v))) {
      toast(kg ? 'Poné cuántas bolsas (entero, más de 0).' : 'Poné los kilos (más de 0).', 'err');
      return;
    }
    const kilos = kg ? v * kg : v;
    onAgregar(r.p, kilos);
    toast(`Agregado al pedido: ${kg ? `${v} bolsa${v === 1 ? '' : 's'} (${num(kilos, 3)} kg)` : `${num(kilos, 3)} kg`} de ${r.nombre}.`, 'ok');
    setCant((c) => { const x = { ...c }; delete x[r.productoId]; return x; });
  };

  return (
    <div className={s.card} style={{ padding: 0, margin: 0, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, width: '100%', boxSizing: 'border-box', padding: '10px 14px', background: 'var(--crm-color-surface-2)' }}
      >
        <span>{abierto ? '▾' : '▸'}</span>
        <strong>Stock a granel en el depósito</strong>
        <span className={s.hint} style={{ margin: 0 }}>
          bolsas cerradas contadas a ojo · último conteo {ultimo ? fmtFechaHora(ultimo) : '—'} · es orientativo
        </span>
      </button>
      {abierto && (
        <div style={{ padding: '8px 14px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input type="search" placeholder="Buscar en el stock a granel…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar en el stock a granel" />
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            <table className={s.table} style={{ width: '100%' }}>
              <thead>
                <tr><th>Producto</th><th style={{ textAlign: 'right' }}>Bolsas</th><th style={{ textAlign: 'right' }}>Pedir</th></tr>
              </thead>
              <tbody>
                {lista.map((r) => {
                  const kg = kgBolsa(r.p);
                  const sin = r.bolsas <= 0;
                  return (
                    <tr key={r.productoId} style={sin ? { opacity: 0.55 } : undefined}>
                      <td>
                        {r.nombre}
                        <div className={s.hint} style={{ margin: 0 }}>{r.categoria}{kg ? ` · bolsa de ${num(kg, 3)} kg` : ''}</div>
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }} title={`Contado el ${fmtFechaHora(r.fecha)}`}>
                        {sin ? <span style={{ color: 'var(--crm-color-danger)', fontWeight: 700 }}>sin stock</span> : <strong>{num(r.bolsas, 0)}</strong>}
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <input
                          type="number" min="0" step={kg ? '1' : 'any'} inputMode={kg ? 'numeric' : 'decimal'}
                          value={cant[r.productoId] ?? ''} disabled={sin}
                          placeholder={kg ? 'bolsas' : 'kg'}
                          onChange={(e) => setCant((c) => ({ ...c, [r.productoId]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); pedir(r); } }}
                          aria-label={`Cuánto pedir de ${r.nombre}`}
                          style={{ width: 70, textAlign: 'right' }}
                        />{' '}
                        <Btn small onClick={() => pedir(r)} disabled={sin}>Agregar</Btn>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!lista.length && <div className={s.hint}>Nada coincide con «{q}».</div>}
          </div>
        </div>
      )}
    </div>
  );
}
