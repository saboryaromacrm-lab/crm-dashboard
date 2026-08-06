import { useMemo, useState } from 'react';
import { useVentas } from '../context/VentasContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { ventasApi } from '../services/ventas.api.js';
import { MEDIOS_PAGO, nroComprobante } from '../domain/constants.js';
import {
  Table, PanelHead, Stat, Btn, CobranzaEstadoPill, usePaginado, money, fmtFecha, s,
} from '../components/ui.jsx';

/** Resume los medios de pago de un recibo: "Efectivo + Transferencia". */
function mediosDe(cobranza) {
  const nombres = (cobranza.pagos || []).map((p) => MEDIOS_PAGO[p.medio] || p.medio);
  return nombres.length ? [...new Set(nombres)].join(' + ') : '—';
}

export function CobranzasPanel() {
  const { clientes, getCliente, openModal } = useVentas();
  const [clienteId, setClienteId] = useState('');
  const [estado, setEstado] = useState('');

  /**
   * El listado se pide a la API con los filtros aplicados (no se filtra en el
   * navegador): las cobranzas crecen sin techo y no tiene sentido traerlas
   * todas para descartar la mayoría.
   */
  const filtros = { clienteId: clienteId || undefined, estado: estado || undefined, limit: 200 };
  const key = `cobranzas:${clienteId}:${estado}`;
  const { data, loading, error, reload } = useResource(key, () => ventasApi.cobranzas(filtros));

  const cobranzas = data ?? [];

  const stats = useMemo(() => {
    const vivas = cobranzas.filter((c) => c.estado === 'confirmada');
    return {
      cantidad: vivas.length,
      total: vivas.reduce((a, c) => a + c.total, 0),
      aCuenta: vivas.reduce((a, c) => a + c.aCuenta, 0),
    };
  }, [cobranzas]);

  const stop = (e) => e.stopPropagation();

  const pag = usePaginado(cobranzas, 'cobranzas', key);

  const filas = pag.visibles.map((c) => {
    const cli = getCliente(c.clienteId);
    return (
      <tr key={c.id} className={s.clickable} onClick={() => openModal('cobranzaDetalle', { cobranzaId: c.id, onChange: reload })}>
        <td className={s.mono}>{nroComprobante(c)}</td>
        <td>{fmtFecha(c.fecha)}</td>
        <td>{cli?.nombre || `Cliente #${c.clienteId}`}</td>
        <td>{mediosDe(c)}</td>
        <td className={s.num}>{money(c.total)}</td>
        <td className={s.num}>{c.aCuenta > 0.009 ? money(c.aCuenta) : <span className={s.muted}>—</span>}</td>
        <td><CobranzaEstadoPill estado={c.estado} /></td>
        <td className={s['actions-col']}>
          <div className={s['row-actions']} onClick={stop}>
            {c.estado === 'confirmada' && (
              <Btn variant="btn-delete" small onClick={() => openModal('anularCobranza', { cobranzaId: c.id, onChange: reload })}>
                Anular
              </Btn>
            )}
          </div>
        </td>
      </tr>
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Cobranzas"
        desc="Recibos de cobro a clientes. Cada uno registra los medios de pago y a qué comprobantes se imputa."
        actions={
          <Btn variant="btn-primary" onClick={() => openModal('cobranzaForm', { onChange: reload })}>
            + Nueva cobranza
          </Btn>
        }
      />

      <div className={s.stats}>
        <Stat label="Recibos" value={stats.cantidad} />
        <Stat label="Total cobrado" value={money(stats.total)} accent="accent-green" />
        <Stat label="Sin imputar (a cuenta)" value={money(stats.aCuenta)} accent="accent-amber" />
      </div>

      <div className={s.toolbar}>
        <select className={s['select-inline']} value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
          <option value="">Todos los clientes</option>
          {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <select className={s['select-inline']} value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="confirmada">Confirmadas</option>
          <option value="anulada">Anuladas</option>
        </select>
        <Btn small onClick={reload} disabled={loading}>{loading ? 'Cargando…' : 'Actualizar'}</Btn>
      </div>

      {error && <div className={`${s.callout} ${s.warn}`}>No se pudo cargar el listado: <strong>{error}</strong></div>}

      <Table
        cols={[
          { h: 'Recibo' }, { h: 'Fecha' }, { h: 'Cliente' }, { h: 'Medios' },
          { h: 'Total', num: true }, { h: 'A cuenta', num: true }, { h: 'Estado' },
          { h: 'Acciones', cls: 'actions-col' },
        ]}
        empty={loading ? 'Cargando…' : 'No hay cobranzas con esos filtros.'}
        pag={pag}
      >
        {filas}
      </Table>
    </div>
  );
}
