import { useState } from 'react';
import { useProveedores } from '../context/ProveedoresContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { errorMsg, provApi } from '../services/proveedores.api.js';
import {
  Btn, EcheqCubre, EstadoEcheqPill, PanelHead, Stat, Table, VencePill, fmtFecha, money, s,
} from '../components/ui.jsx';

const FILTROS = [
  ['activos', 'Activos'], ['pendientes', 'Pendientes de confirmar'], ['vencidos', 'Vencidos'], ['semana', 'Esta semana'],
  ['cobrados', 'Cobrados'], ['anulados', 'Anulados'], ['todos', 'Todos'],
];

/**
 * ECHEQS — la cartera propia. Nacen con la factura del proveedor que cobra
 * así o a mano. El de la factura espera PENDIENTE DE CONFIRMAR (0204): se
 * confirma con los datos del papel, o «No lo hice» y la deuda vuelve a
 * Cuentas corrientes. «Facturas» lo imputa a una o varias (0205). "Cobrar" es
 * EL momento contable: crea el pago real, lo aplica a sus facturas y lo que
 * sobra queda a cuenta.
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
      if (!window.confirm(`¿El banco debitó el echeq ${e.numero}? Esto registra el pago real al proveedor.`)) return;
    }
    if (estado === 'anulado') {
      const deuda = e.facturas.length ? ' Lo que cubría de sus facturas vuelve a Cuentas corrientes.' : '';
      if (!window.confirm(`¿Anular el echeq ${e.numero} por ${money(e.importe)}? Un echeq anulado no vuelve a la cartera.${deuda}`)) return;
    }
    try {
      await provApi.estadoEcheq(e.id, estado);
      toast(aviso, 'ok');
      refrescar();
    } catch (err) { toast(errorMsg(err), 'err'); }
  };
  const noSeHizo = async (e) => {
    if (!window.confirm(`¿No hiciste el echeq de ${money(e.importe)} a ${e.aNombreDe}? Se da de baja y la deuda vuelve a Cuentas corrientes.`)) return;
    try {
      await provApi.noSeHizoEcheq(e.id);
      toast('Listo: la deuda volvió a Cuentas corrientes.', 'ok');
      refrescar();
    } catch (err) { toast(errorMsg(err), 'err'); }
  };

  return (
    <div>
      <PanelHead
        title="Echeqs propios"
        desc="La cartera de echeqs propios. El que nace de una factura queda pendiente hasta que lo confirmes con sus datos reales. Con «Facturas» uno hecho cubre una o varias. Cobrarlo registra el pago de verdad, imputado a sus facturas; lo que sobra queda a cuenta."
        actions={<Btn variant="btn-primary" onClick={() => openModal('echeq', { onChange: refrescar })}>+ Echeq</Btn>}
      />

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <Stat label="Pendientes de confirmar" value={`${stats?.pendientes?.n ?? 0} · ${money(stats?.pendientes?.monto ?? 0)}`} accent={stats?.pendientes?.n ? 'accent-amber' : undefined} />
        <Stat label="En cartera (hechos)" value={`${stats?.activos?.n ?? 0} · ${money(stats?.activos?.monto ?? 0)}`} />
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
          type="search" placeholder="N°, banco, a nombre de…" value={buscar}
          onChange={(e) => setBuscar(e.target.value)} style={{ marginLeft: 'auto' }}
        />
      </div>

      <Table cols={[
        { h: 'Número' }, { h: 'Banco' }, { h: 'A nombre de' }, { h: 'Debita' },
        { h: 'Importe', num: true }, { h: 'Cubre' }, { h: 'Estado' }, { h: 'Acciones' },
      ]}>
        {(data?.filas ?? []).map((e) => {
          const activo = e.estado === 'emitido' || e.estado === 'entregado';
          const pendiente = e.estado === 'pendiente';
          return (
            <tr key={e.id}>
              <td>
                {pendiente ? '—' : (e.numero || '—')}
                {pendiente && <div className={s.hint} style={{ margin: 0 }}>todavía no confirmado</div>}
              </td>
              <td>{pendiente ? '—' : (e.banco || '—')}</td>
              <td>
                {e.aNombreDe}
                {!e.proveedorId && <div className={s.hint} style={{ margin: 0 }}>no es proveedor</div>}
              </td>
              <td>{fmtFecha(e.fechaVenc)} {activo && <VencePill dias={e.diasRest} />}</td>
              <td className={s.num}>{money(e.importe)}</td>
              <td><EcheqCubre e={e} /></td>
              <td><EstadoEcheqPill estado={e.estado} dias={e.diasRest} /></td>
              <td>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {pendiente && (
                    <>
                      <Btn small variant="btn-primary" onClick={() => openModal('confirmarEcheq', { echeq: e, onChange: refrescar })}>Confirmar</Btn>
                      <Btn small onClick={() => noSeHizo(e)}>No lo hice</Btn>
                    </>
                  )}
                  {activo && (
                    <>
                      {/* El banco no lo debita antes de su fecha (27/9/2026): antes de
                          eso no se ofrece "Cobrar" — la API también lo rechaza. */}
                      {e.diasRest <= 0
                        ? <Btn small variant="btn-primary" onClick={() => cambiarEstado(e, 'cobrado', e.proveedorId ? 'Echeq cobrado: pago registrado.' : 'Echeq cobrado.')}>Cobrar</Btn>
                        : <span className={s.hint} style={{ margin: 0 }}>se cobra desde el {fmtFecha(e.fechaVenc)}</span>}
                      {e.estado === 'emitido' && (
                        <Btn small onClick={() => cambiarEstado(e, 'entregado', 'Marcado como entregado.')}>Entregado</Btn>
                      )}
                      {e.proveedorId && (
                        <Btn small onClick={() => openModal('facturasEcheq', { echeq: e, onChange: refrescar })}>Facturas</Btn>
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
