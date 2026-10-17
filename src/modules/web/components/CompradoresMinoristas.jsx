/**
 * LOS CLIENTES DE LA TIENDA MINORISTA (0178, 17/10/2026) — Tienda online ›
 * Accesos › Minoristas. Entran con su WhatsApp: se registran solos (nombre,
 * apellido y dirección) y ven los precios en el momento, sin aprobación. Acá se
 * ven todos, con sus datos completos, y se bloquea al que no tiene que entrar
 * (se le cierra la sesión al instante). Bloquear pide un segundo clic.
 */
import { useRef, useState } from 'react';
import { httpClient } from '@core/services/httpClient.js';
import { useResource } from '@modules/ventas/hooks/useResource.js';
import { errorMsg } from '@modules/ventas/services/ventas.api.js';
import { fmtFechaHora } from '@modules/productos/domain/format.js';
import { Table, Btn, s } from '@modules/productos/components/ui.jsx';
import { telLegible } from '@modules/ventas/domain/constants.js';

const api = {
  listar: (q) => httpClient.get(`/tienda-accesos/minoristas${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  bloqueo: (id, bloqueado) => httpClient.post(`/tienda-accesos/minoristas/${id}/bloqueo`, { bloqueado }),
};

/** `avisar(tipo, texto)`: el aviso de la página de Tienda online ('ok' | 'err'). */
export function CompradoresMinoristas({ avisar }) {
  const [q, setQ] = useState('');
  const buscado = q.trim();
  const { data, loading, error, reload } = useResource(`tienda-minoristas:${buscado}`, () => api.listar(buscado));
  /* Bloquear: el primer clic arma la confirmación de ESA fila, el segundo ejecuta. */
  const [armado, setArmado] = useState(null);
  const enVuelo = useRef(false);

  const cambiar = async (c, bloqueado) => {
    if (bloqueado && armado !== c.id) { setArmado(c.id); return; }
    if (enVuelo.current) return;
    enVuelo.current = true;
    try {
      await api.bloqueo(c.id, bloqueado);
      avisar('ok', bloqueado ? `${c.nombre} ${c.apellido} quedó bloqueado: no puede entrar a la tienda.` : `${c.nombre} ${c.apellido} puede volver a entrar.`);
      setArmado(null);
      reload();
    } catch (e) {
      avisar('err', errorMsg(e));
    } finally {
      enVuelo.current = false;
    }
  };

  const filas = data ?? [];
  return (
    <>
      <div className={s.toolbar}>
        <input type="search" placeholder="Buscar por nombre o WhatsApp…" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 260 }} />
        <span className={s.hint} style={{ margin: 0 }}>{filas.length} cliente{filas.length === 1 ? '' : 's'}{filas.length === 500 ? ' (los 500 más recientes)' : ''}</span>
      </div>

      {error && <div className={s.hint} style={{ color: 'var(--crm-color-danger)' }}>{error}</div>}

      <Table
        cols={[
          { h: 'Nombre' }, { h: 'WhatsApp' }, { h: 'Dirección' }, { h: 'Pedidos', num: true },
          { h: 'Último ingreso' }, { h: '', cls: 'actions-col' },
        ]}
        empty={loading ? 'Cargando…' : buscado ? 'Nadie con esa búsqueda.' : 'Todavía no se registró ningún cliente minorista.'}
      >
        {filas.map((c) => (
          <tr key={c.id} style={c.bloqueado ? { opacity: 0.6 } : undefined}>
            <td>
              <strong>{c.nombre} {c.apellido}</strong>
              {c.bloqueado && <div className={s.hint} style={{ margin: 0, color: 'var(--crm-color-danger)' }}>Bloqueado</div>}
            </td>
            <td className={s.mono}>{telLegible(c.telefono)}</td>
            <td>{[c.direccion, c.localidad].filter(Boolean).join(' · ') || <span className={s.muted}>—</span>}</td>
            <td className={s.num}>{c.pedidos}</td>
            <td>{c.ultimoIngreso ? fmtFechaHora(c.ultimoIngreso) : <span className={s.muted}>Todavía no entró</span>}</td>
            <td className={s['actions-col']}>
              <div className={s['row-actions']}>
                {c.bloqueado ? (
                  <Btn small variant="btn-primary" onClick={() => cambiar(c, false)}>Desbloquear</Btn>
                ) : armado === c.id ? (
                  <>
                    <Btn small onClick={() => setArmado(null)}>No</Btn>
                    <Btn small variant="btn-delete" onClick={() => cambiar(c, true)}>Sí, bloquear</Btn>
                  </>
                ) : (
                  <Btn small onClick={() => cambiar(c, true)}>Bloquear</Btn>
                )}
              </div>
            </td>
          </tr>
        ))}
      </Table>

      <div className={s.hint}>
        El cliente minorista entra con su <strong>WhatsApp</strong>: la primera vez se registra con nombre, apellido y dirección
        y ve los precios en el momento. Los que ya habían comprado entran directo. Bloquear le cierra la sesión al instante y no
        lo deja volver a entrar hasta que lo desbloquees.
      </div>
    </>
  );
}
