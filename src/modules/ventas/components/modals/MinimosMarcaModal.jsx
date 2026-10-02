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
      subtitle="Cuántas unidades de una marca hay que llevar para desbloquear su lista"
      wide
      onClose={closeModal}
      footer={[{ texto: 'Cerrar', clase: 'btn-ghost', onClick: closeModal }]}
    >
      <div className={s.hint}>
        Se suman las unidades de <strong>todos los productos de la marca</strong> que lleva el ticket.
        Al llegar al mínimo, el sistema avisa y con «Aplicar» esos renglones pasan a la lista
        desbloqueada (solo los de esa marca). Se cargan en Ventas › Configuración › Formato de venta.
      </div>

      {reglas.length === 0 ? (
        <div className={s.muted} style={{ padding: '16px 0' }}>
          No hay marcas con mínimo de compra cargado.
        </div>
      ) : (
        <>
          <div className={s.field}>
            <label htmlFor="minimos-marca-buscar">Buscar marca</label>
            <input
              id="minimos-marca-buscar"
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ej.: Coca-Cola"
            />
          </div>

          <Table cols={[
            { h: 'Marca' }, { h: 'Mínimo', num: true }, { h: 'Desbloquea' },
            ...(conVenta ? [{ h: 'En esta venta', num: true }] : []),
          ]}
          >
            {filas.map((r) => {
              const min = Number(r.unidadesMinimas) || 0;
              const lleva = Number(llevadas[r.marcaId]) || 0;
              const llego = lleva + 1e-9 >= min;
              const nombres = listasDe.get(r.modalidadId) ?? [];
              return (
                <tr key={`${r.marcaId}:${r.modalidadId}`}>
                  <td><strong>{r.marca}</strong></td>
                  <td className={s.num}><strong>{num(min)}</strong> u.</td>
                  <td>
                    {r.modalidad || '—'}
                    {nombres.length > 0 && (
                      <div className={s.hint} style={{ margin: 0 }}>{nombres.join(' · ')}</div>
                    )}
                  </td>
                  {conVenta && (
                    <td className={s.num}>
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
