import { useMemo, useState } from 'react';
import { useVentas } from '../../context/VentasContext.jsx';
import { norm } from '../../domain/constants.js';
import { ModalShell, Table, num, s } from '../ui.jsx';

/**
 * MÍNIMOS DE COMPRA POR MARCA (2/10/2026, pedido del dueño).
 * ============================================================================
 * Consulta para el cajero, desde la registradora: qué marcas tienen cargado un
 * mínimo de unidades y qué lista desbloquea llegar a él ("12 de Coca-Cola
 * abren Mayorista"). Las unidades se suman entre TODOS los productos de la
 * marca en el ticket, igual que las cuenta el motor (`agregadosTicket`).
 *
 * Solo lectura: las reglas se cargan en Ventas › Configuración › Formato de
 * venta. Muestra las mismas que usa el POS (activas y con mínimo), así lo que
 * se lee acá es exactamente lo que después se aplica. Con una venta abierta,
 * cada fila dice cuántas lleva el ticket y cuántas faltan.
 */
const centro = { display: 'block', textAlign: 'center' };

export function MinimosMarcaModal({ reglas = [], listas = [], llevadas = {}, conVenta = false }) {
  const { closeModal } = useVentas();
  const [q, setQ] = useState('');

  /** Las listas de cada modalidad, en el orden en que se aplican. */
  const listasDe = useMemo(() => {
    const m = new Map();
    for (const l of [...listas].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))) {
      if (!m.has(l.modalidadId)) m.set(l.modalidadId, []);
      m.get(l.modalidadId).push(l.nombre);
    }
    return m;
  }, [listas]);

  const filas = useMemo(() => {
    const ql = norm(q.trim());
    return reglas
      .filter((r) => !ql || norm(r.marca ?? '').includes(ql))
      .sort((a, b) => String(a.marca).localeCompare(String(b.marca), 'es')
        || Number(a.unidadesMinimas) - Number(b.unidadesMinimas));
  }, [reglas, q]);

  return (
    <ModalShell
      title="Mínimos de compra por marca"
      subtitle="Unidades de la marca para desbloquear su lista"
      onClose={closeModal}
      footer={[{ texto: 'Cerrar', clase: 'btn-ghost', onClick: closeModal }]}
    >
      <div className={s.hint} style={{ marginTop: 0 }}>
        Se suman <strong>todos los productos de la marca</strong> del ticket. Al llegar al mínimo,
        la caja avisa y con «Aplicar» pasan a la lista desbloqueada.
      </div>

      {reglas.length === 0 ? (
        <div className={s.muted} style={{ padding: '16px 0' }}>
          No hay marcas con mínimo de compra cargado.
        </div>
      ) : (
        <>
          {reglas.length > 6 && (
            <div className={s.field}>
              <input
                id="minimos-marca-buscar"
                aria-label="Buscar marca"
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar marca…"
              />
            </div>
          )}

          {/* Las columnas de números van CENTRADAS, título y valor igual: el
              `num` de la tabla alinea el valor a la derecha pero no el título. */}
          <Table cols={[
            { h: 'Marca' }, { h: <span style={centro}>Mínimo</span> }, { h: 'Desbloquea' },
            ...(conVenta ? [{ h: <span style={centro}>En esta venta</span> }] : []),
          ]}
          >
            {filas.map((r) => {
              const min = Number(r.unidadesMinimas) || 0;
              const lleva = Number(llevadas[r.marcaId]) || 0;
              const llego = lleva + 1e-9 >= min;
              /* Las listas de la modalidad, solo si dicen algo más que su nombre. */
              const nombres = (listasDe.get(r.modalidadId) ?? [])
                .filter((n) => norm(n) !== norm(r.modalidad ?? ''));
              return (
                <tr key={`${r.marcaId}:${r.modalidadId}`}>
                  <td><strong>{r.marca}</strong></td>
                  <td style={{ textAlign: 'center' }}><strong>{num(min)}</strong> u.</td>
                  <td>
                    {r.modalidad || '—'}
                    {nombres.length > 0 && (
                      <div className={s.hint} style={{ margin: 0 }}>{nombres.join(' · ')}</div>
                    )}
                  </td>
                  {conVenta && (
                    <td style={{ textAlign: 'center' }}>
                      {lleva <= 0 ? <span className={s.muted}>—</span> : llego ? (
                        <strong style={{ color: 'var(--crm-color-success)' }}>{num(lleva)} · alcanzado</strong>
                      ) : (
                        <span>
                          {num(lleva)}
                          <div className={s.hint} style={{ margin: 0 }}>faltan {num(min - lleva)}</div>
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {filas.length === 0 && (
              <tr><td colSpan={conVenta ? 4 : 3} className={s.muted}>Ninguna marca coincide con «{q}».</td></tr>
            )}
          </Table>
        </>
      )}
    </ModalShell>
  );
}
