import { useState } from 'react';
import { useProveedores } from '../context/ProveedoresContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { errorMsg, provApi } from '../services/proveedores.api.js';
import {
  Btn, ImporteCompromiso, PanelHead, Pill, Stat, Table, VencePill, fmtFecha, money, s,
} from '../components/ui.jsx';

const FILTROS = [
  ['pendientes', 'Pendientes'], ['vencidos', 'Vencidos'], ['semana', 'Esta semana'],
  ['mes', 'Este mes'], ['futuros', 'Futuros'], ['pagados', 'Pagados'], ['todos', 'Todos'],
];

/**
 * CUENTAS CORRIENTES — los compromisos que NO son echeq (esos tienen su
 * sección). El saldo proyectado del EDOC sale de lo que se ve acá + la
 * cartera de echeqs.
 */
export function CtasCtesPanel() {
  const { proveedores, openModal, toast, recargarContadores, panels, goPanel, getProveedor } = useProveedores();
  /* Clic en el proveedor → su estado de cuenta (2/11/2026, pedido del dueño), si este usuario tiene esa sección. */
  const veEdoc = (panels ?? []).some((p) => p.id === 'edoc');
  const [filtro, setFiltro] = useState('pendientes');
  const [proveedorId, setProveedorId] = useState('');
  const { data, reload } = useResource(
    `compromisos:${filtro}:${proveedorId}`,
    () => provApi.compromisos({ filtro, proveedorId: proveedorId || undefined }),
  );
  const { data: stats, reload: reloadStats } = useResource('compromisos-stats', provApi.statsCompromisos);

  const refrescar = () => { reload(); reloadStats(); recargarContadores(); };
  const borrar = async (k) => {
    try {
      await provApi.borrarCompromiso(k.id);
      toast('Compromiso eliminado.', 'ok');
      refrescar();
    } catch (e) { toast(errorMsg(e), 'err'); }
  };

  return (
    <div>
      <PanelHead
        title="Cuentas corrientes"
        desc="Las promesas de pago con fecha. Nacen solas al confirmar la factura de un proveedor de cta cte, y se cierran solas cuando el pago salda la factura. Lo pagado a cuenta y los ajustes ya están descontados: cubren primero lo que vence antes, así que acá nunca ves más de lo que le debés a cada proveedor."
        actions={<Btn variant="btn-primary" onClick={() => openModal('compromiso', { onChange: refrescar })}>+ Compromiso manual</Btn>}
      />

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <Stat label="Vencidos" value={`${stats?.vencidos?.n ?? 0} · ${money(stats?.vencidos?.monto ?? 0)}`} accent={stats?.vencidos?.n ? 'accent-red' : undefined} />
        <Stat label="Próximos 3 días" value={`${stats?.prox3?.n ?? 0} · ${money(stats?.prox3?.monto ?? 0)}`} accent={stats?.prox3?.n ? 'accent-amber' : undefined} />
        <Stat label="Esta semana" value={`${stats?.semana?.n ?? 0} · ${money(stats?.semana?.monto ?? 0)}`} />
        <Stat label="Total pendiente" value={`${stats?.total?.n ?? 0} · ${money(stats?.total?.monto ?? 0)}`} />
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        {FILTROS.map(([k, v]) => (
          <Btn key={k} small variant={filtro === k ? 'btn-primary' : undefined} onClick={() => setFiltro(k)}>{v}</Btn>
        ))}
        <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} style={{ marginLeft: 'auto' }}>
          <option value="">Todos los proveedores</option>
          {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      </div>

      <Table cols={[
        { h: 'Vence' }, { h: 'Proveedor' }, { h: 'Detalle' },
        { h: 'Plazo' }, { h: 'Importe', num: true }, { h: 'Estado' }, { h: 'Acciones' },
      ]}>
        {(data?.filas ?? []).map((k) => (
          <tr key={k.id}>
            <td>{fmtFecha(k.fechaVenc)} {!k.pagado && <VencePill dias={k.diasRest} />}</td>
            <td>
              {veEdoc ? (
                <button
                  type="button" title="Ver su estado de cuenta" onClick={() => goPanel('edoc', { proveedorId: k.proveedorId })}
                  style={{
                    all: 'unset', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline',
                    textDecorationColor: 'var(--crm-color-border, #ccc)', textUnderlineOffset: 3,
                  }}
                >
                  {k.proveedorNombre}
                </button>
              ) : k.proveedorNombre}
              {getProveedor(k.proveedorId)?.modoCuenta === 'libre' && (
                <div className={s.hint} style={{ margin: 0 }}>cuenta libre: lo pagado cubre lo más viejo</div>
              )}
            </td>
            <td>
              {k.comprobanteEtiqueta || (k.origen === 'manual' ? 'Manual' : '—')}
              {k.cuota ? ` · cuota ${k.cuota}/${k.cuotas}` : ''}
              {k.obs && <div className={s.hint} style={{ margin: 0 }}>{k.obs}</div>}
            </td>
            <td>{k.diasPlazo ? `Cta cte ${k.diasPlazo}` : 'Cta cte'}</td>
            <td className={s.num}><ImporteCompromiso k={k} /></td>
            <td>{k.pagado ? <Pill pill="est-recibida" label="pagado" /> : <Pill pill="est-pendiente" label="pendiente" />}</td>
            <td>
              {!k.pagado && (
                <div style={{ display: 'flex', gap: 4 }}>
                  {k.falta > 0.009
                    ? <Btn small variant="btn-primary" onClick={() => openModal('pagarCompromiso', { compromiso: k, onChange: refrescar })}>Pagar</Btn>
                    : <span className={s.hint} style={{ margin: 0 }}>{k.cubiertoACuenta > 0.009 ? 'cubierta con lo pagado a cuenta' : 'cubierta'}</span>}
                  <Btn small onClick={() => openModal('compromiso', { compromiso: k, onChange: refrescar })}>Editar</Btn>
                  <Btn small onClick={() => borrar(k)}>×</Btn>
                </div>
              )}
            </td>
          </tr>
        ))}
      </Table>
      {!(data?.filas ?? []).length && <div className={s['empty-state']}>Nada en este filtro.</div>}
      {(data?.filas ?? []).length > 0 && (
        <div className={s.hint} style={{ marginTop: 8 }}>
          {data.total} compromiso(s) · {money(data.totalImporte)}
        </div>
      )}
    </div>
  );
}
