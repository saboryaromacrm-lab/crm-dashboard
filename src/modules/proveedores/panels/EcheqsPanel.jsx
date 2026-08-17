import { useState } from 'react';
import { useProveedores } from '../context/ProveedoresContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { errorMsg, provApi } from '../services/proveedores.api.js';
import {
  Btn, EstadoEcheqPill, PanelHead, Stat, Table, VencePill, fmtFecha, money, s,
} from '../components/ui.jsx';

const FILTROS = [
  ['activos', 'Activos'], ['vencidos', 'Vencidos'], ['semana', 'Esta semana'],
  ['cobrados', 'Cobrados'], ['anulados', 'Anulados'], ['todos', 'Todos'],
];

/**
 * ECHEQS — la cartera propia. Nacen con la factura del proveedor que cobra
 * así (número "a completar") o a mano. "Cobrar" es EL momento contable:
 * crea el pago real, lo aplica a la factura y cierra el compromiso.
 */
export function EcheqsPanel() {
  const { proveedores, openModal, toast, recargarContadores } = useProveedores();
  const [filtro, setFiltro] = useState('activos');
  const [proveedorId, setProveedorId] = useState('');
  const [buscar, setBuscar] = useState('');
  const { data, reload } = useResource(
    `echeqs:${filtro}:${proveedorId}:${buscar}`,
    () => provApi.echeqs({ filtro, proveedorId: proveedorId || undefined, buscar: buscar || undefined }),
  );
  const { data: stats, reload: reloadStats } = useResource('echeqs-stats', provApi.statsEcheqs);

  const refrescar = () => { reload(); reloadStats(); recargarContadores(); };
  const cambiarEstado = async (e, estado, aviso) => {
    if (estado === 'cobrado') {
      // eslint-disable-next-line no-alert
      if (!window.confirm(`¿El banco debitó el echeq ${e.numero}? Esto registra el pago real al proveedor.`)) return;
    }
    try {
      await provApi.estadoEcheq(e.id, estado);
      toast(aviso, 'ok');
      refrescar();
    } catch (err) { toast(errorMsg(err), 'err'); }
  };

  return (
    <div>
      <PanelHead
        title="Echeqs propios"
        desc="La cartera de echeqs emitidos. Cobrarlo registra el pago de verdad — con su imputación a la factura y el cierre del compromiso."
        actions={<Btn variant="btn-primary" onClick={() => openModal('echeq', { onChange: refrescar })}>+ Echeq</Btn>}
      />

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <Stat label="Activos" value={`${stats?.activos?.n ?? 0} · ${money(stats?.activos?.monto ?? 0)}`} />
        <Stat label="Vencidos sin cobrar" value={`${stats?.vencidos?.n ?? 0} · ${money(stats?.vencidos?.monto ?? 0)}`} accent={stats?.vencidos?.n ? 'accent-red' : undefined} />
        <Stat label="Debitan en 3 días" value={`${stats?.prox3?.n ?? 0} · ${money(stats?.prox3?.monto ?? 0)}`} accent={stats?.prox3?.n ? 'accent-amber' : undefined} />
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        {FILTROS.map(([k, v]) => (
          <Btn key={k} small variant={filtro === k ? 'btn-primary' : undefined} onClick={() => setFiltro(k)}>{v}</Btn>
        ))}
        <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
          <option value="">Todos los proveedores</option>
          {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        <input
          type="search" placeholder="N°, banco, proveedor…" value={buscar}
          onChange={(e) => setBuscar(e.target.value)} style={{ marginLeft: 'auto' }}
        />
      </div>

      <Table cols={[
        { h: 'Número' }, { h: 'Banco' }, { h: 'Proveedor' }, { h: 'Debita' },
        { h: 'Importe', num: true }, { h: 'Estado' }, { h: 'Acciones' },
      ]}>
        {(data?.filas ?? []).map((e) => {
          const activo = e.estado === 'emitido' || e.estado === 'entregado';
          return (
            <tr key={e.id}>
              <td>
                {e.numero || '—'}
                {e.numero?.startsWith('PEND-') && <div className={s.hint} style={{ margin: 0 }}>completar N° real</div>}
              </td>
              <td>{e.banco || '—'}</td>
              <td>{e.proveedorNombre}</td>
              <td>{fmtFecha(e.fechaVenc)} {activo && <VencePill dias={e.diasRest} />}</td>
              <td className={s.num}>{money(e.importe)}</td>
              <td><EstadoEcheqPill estado={e.estado} dias={e.diasRest} /></td>
              <td>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {activo && (
                    <>
                      <Btn small variant="btn-primary" onClick={() => cambiarEstado(e, 'cobrado', 'Echeq cobrado: pago registrado.')}>Cobrar</Btn>
                      {e.estado === 'emitido' && (
                        <Btn small onClick={() => cambiarEstado(e, 'entregado', 'Marcado como entregado.')}>Entregado</Btn>
                      )}
                      <Btn small onClick={() => openModal('echeq', { echeq: e, onChange: refrescar })}>Editar</Btn>
                      <Btn small onClick={() => cambiarEstado(e, 'anulado', 'Echeq anulado.')}>Anular</Btn>
                    </>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </Table>
      {!(data?.filas ?? []).length && <div className={s['empty-state']}>Sin echeqs en este filtro.</div>}
    </div>
  );
}
