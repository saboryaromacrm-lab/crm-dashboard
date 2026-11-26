import { useProveedores } from '../context/ProveedoresContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { errorMsg, provApi } from '../services/proveedores.api.js';
import { ACCIONES, cantTxt, queTxt, totalesPendientes } from '../domain/diferencias.js';
import { Btn, Pill, Stat, Table, fmtFecha, money, s } from '../components/ui.jsx';

/** El filtro de los cambios, dicho para las diferencias. */
const ESTADO_DE = { pendientes: 'pendientes', completos: 'resueltas', todos: 'todas' };
const ESTADO = {
  pendiente: { pill: 'est-pendiente', label: 'Pendiente' },
  resuelta: { pill: 'est-recibida', label: 'Resuelta' },
};

/**
 * DIFERENCIAS DE ENTREGA (0248): lo que faltó o vino de más al recibir una
 * factura, pendiente con el proveedor hasta que se resuelve. Lo que resuelve
 * un papel (la NC del faltante, la factura que cobra lo de más) se ata al
 * cargarlo; acá se resuelve lo que no trae papel, y se deshace lo cargado a mano.
 */
export function DiferenciasEntrega({ filtro, proveedorId }) {
  const { openModal, toast } = useProveedores();
  const estado = ESTADO_DE[filtro] ?? 'pendientes';
  const { data, reload } = useResource(
    `diferencias-entrega:${estado}:${proveedorId}`,
    () => provApi.diferenciasEntrega({ estado, proveedorId: proveedorId || undefined }),
  );
  const filas = data ?? [];
  const { teDeben, leDebes } = totalesPendientes(filas);

  const deshacer = async (r) => {
    if (!window.confirm(`¿Deshacer «${r.texto}» (${r.cantidad})? Si movió stock, vuelve como estaba.`)) return;
    try { await provApi.deshacerResolucion(r.id); toast('Deshecho: la diferencia volvió a quedar pendiente.', 'ok'); reload(); } catch (e) { toast(errorMsg(e), 'err'); }
  };

  return (
    <div style={{ marginTop: 22 }}>
      <div className={s['section-title']}>Diferencias de entrega</div>
      <div className={s.hint} style={{ marginTop: 0 }}>
        Lo que faltó o vino de más al recibir una factura. El stock entró con lo que llegó y la deuda quedó por el papel: esto es lo
        que queda por arreglar. Una nota de crédito por un faltante, o una factura que cobra lo que vino de más, se atan al cargarlas.
      </div>
      {estado !== 'resueltas' && (teDeben > 0 || leDebes > 0) && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <Stat label="Faltó: te deben, a costo" value={money(teDeben)} accent={teDeben > 0 ? 'accent-amber' : undefined} />
          <Stat label="Vino de más: le debés, a costo" value={money(leDebes)} />
        </div>
      )}
      <Table
        cols={[{ h: 'Papel' }, { h: 'Proveedor' }, { h: 'Producto' }, { h: 'Qué pasó' }, { h: 'Pendiente', num: true }, { h: 'Estado' }, { h: 'Acciones' }]}
        empty={estado === 'pendientes' ? 'No hay diferencias pendientes.' : 'No hay diferencias.'}
      >
        {filas.map((d) => (
          <tr key={d.id}>
            <td style={{ whiteSpace: 'nowrap' }}>
              {d.papel}
              <div className={s.hint} style={{ margin: 0 }}>{fmtFecha(d.fechaPapel)} · {d.sucursal}</div>
            </td>
            <td>{d.proveedor}</td>
            <td>{d.producto}</td>
            <td>
              <strong style={{ color: d.tipo === 'faltante' ? 'var(--crm-color-danger)' : 'var(--crm-color-warning, #b45309)' }}>{queTxt(d)}</strong>
              {d.resoluciones.map((r) => (
                <div key={r.id} className={s.hint} style={{ margin: 0, textDecoration: r.anulada ? 'line-through' : undefined }}>
                  {fmtFecha(r.fecha)} · {r.texto}: {cantTxt(r.cantidad, d.tipoProducto)}{r.papel ? ` (${r.papel})` : ''}{r.quien ? ` · ${r.quien}` : ''}{r.nota ? ` · ${r.nota}` : ''}
                  {r.aMano && !r.anulada && d.estado !== 'anulada' && (
                    <button type="button" style={{ marginLeft: 6, background: 'none', border: 0, padding: 0, color: 'var(--crm-color-primary)', cursor: 'pointer', font: 'inherit' }} onClick={() => deshacer(r)}>
                      Deshacer
                    </button>
                  )}
                </div>
              ))}
            </td>
            <td className={s.num}>
              {d.estado === 'pendiente' ? <><strong>{cantTxt(d.pendiente, d.tipoProducto)}</strong><div className={s.hint} style={{ margin: 0 }}>{money(d.valorPendiente)}</div></> : '—'}
            </td>
            <td><Pill pill={ESTADO[d.estado]?.pill} label={ESTADO[d.estado]?.label ?? d.estado} /></td>
            <td>
              {d.estado === 'pendiente' && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {ACCIONES[d.tipo].map((a) => (
                    <Btn key={a.como} small variant={a.como === 'llego' || a.como === 'devuelto' ? 'btn-primary' : undefined}
                      onClick={() => openModal('resolverDiferencia', { diferencia: d, como: a.como, onChange: reload })}>
                      {a.boton}
                    </Btn>
                  ))}
                </div>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
