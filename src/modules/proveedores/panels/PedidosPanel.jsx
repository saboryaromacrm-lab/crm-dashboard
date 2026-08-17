import { useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useProveedores } from '../context/ProveedoresContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { errorMsg, provApi } from '../services/proveedores.api.js';
import { BotonesAlta } from '../components/modals/PedidosModals.jsx';
import { Btn, PanelHead, Pill, Stat, Table, fmtFecha, s } from '../components/ui.jsx';

/**
 * PEDIDOS — el kanban de la app externa, tal cual: la pizarra entre el admin
 * y el encargado de compras. Columnas Solicitado / Pedido / Para retomar
 * (lo recibido se va al historial de Ingresos). Sin drag & drop a propósito:
 * los botones dicen exactamente qué pasa, y funcionan igual con el mouse
 * apurado del mostrador.
 */
const COLUMNAS = [
  { estado: 'solicitado', titulo: 'Solicitado', hint: 'Hay que pedirle' },
  { estado: 'pedido', titulo: 'Pedido', hint: 'Esperando que llegue' },
  { estado: 'retomar', titulo: 'Para retomar', hint: 'Aparcado sin fecha' },
];

function diasDesde(fecha) {
  if (!fecha) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000));
}

export function PedidosPanel() {
  const { openModal, toast, recargarContadores } = useProveedores();
  const [vista, setVista] = useState('pizarra');
  const { data: tarjetas, reload } = useResource('prov-kanban', provApi.kanban);

  const mutar = async (promesa, ok) => {
    try {
      await promesa;
      await reload();
      recargarContadores();
      if (ok) toast(ok, 'ok');
    } catch (e) { toast(errorMsg(e), 'err'); }
  };

  const Tarjeta = ({ t }) => {
    const revisadoHace = diasDesde(t.revisadoAt);
    return (
      <div className={s.card} style={{ padding: 10, marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
          <strong>{t.proveedorNombre}</strong>
          <Btn small onClick={() => mutar(provApi.borrarPedido(t.id), 'Tarjeta eliminada.')}>×</Btn>
        </div>
        {t.productosProveedor > 0 && (
          <div className={s.hint} style={{ margin: '2px 0' }}>trae {t.productosProveedor} producto(s)</div>
        )}
        {t.notas && (
          <div className={s.hint} style={{ margin: '4px 0', whiteSpace: 'pre-wrap' }}>{t.notas}</div>
        )}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', margin: '4px 0' }}>
          {t.estado === 'solicitado' && t.pedidoEnviado && <Pill pill="est-recibida" label="pedido enviado" />}
          {t.estado === 'solicitado' && revisadoHace != null && (
            <Pill label={`lo viste hace ${revisadoHace} d`} />
          )}
          {t.estado === 'pedido' && t.fechaPedido && (
            <Pill label={`pedido el ${fmtFecha(t.fechaPedido)}`} />
          )}
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <Btn small onClick={() => openModal('pedidoNotas', { pedido: t, onChange: reload })}>Notas</Btn>
          {t.estado === 'solicitado' && (
            <>
              <Btn small onClick={() => mutar(provApi.togglePedidoEnviado(t.id))}>
                {t.pedidoEnviado ? 'No enviado' : 'Enviado ✓'}
              </Btn>
              <Btn small onClick={() => mutar(provApi.marcarRevisado(t.id, !!t.revisadoAt))}>
                {t.revisadoAt ? 'Volver a revisar' : 'Ya lo vi'}
              </Btn>
              <Btn small variant="btn-primary" onClick={() => mutar(provApi.estadoPedido(t.id, 'pedido'), 'A Pedido.')}>
                → Pedido
              </Btn>
              <Btn small onClick={() => mutar(provApi.estadoPedido(t.id, 'retomar'), 'Aparcado.')}>Aparcar</Btn>
            </>
          )}
          {t.estado === 'pedido' && (
            <>
              <Btn small variant="btn-primary" onClick={() => mutar(provApi.estadoPedido(t.id, 'recibido'), 'Recibido: pasó al historial de Ingresos.')}>
                ✓ Recibido
              </Btn>
              <Btn small onClick={() => mutar(provApi.estadoPedido(t.id, 'solicitado'), 'De vuelta en Solicitado.')}>
                ← Solicitado
              </Btn>
            </>
          )}
          {t.estado === 'retomar' && (
            <Btn small variant="btn-primary" onClick={() => mutar(provApi.estadoPedido(t.id, 'solicitado'), 'Retomado.')}>
              → Solicitado
            </Btn>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      <PanelHead
        title="Pedidos a proveedores"
        desc="La pizarra interna: a quién hay que pedirle, qué está pedido, qué llegó. No toca stock ni deuda — eso pasa al cargar la factura en Compras."
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Btn small variant={vista === 'pizarra' ? 'btn-primary' : undefined} onClick={() => setVista('pizarra')}>Pizarra</Btn>
            <Btn small variant={vista === 'ingresos' ? 'btn-primary' : undefined} onClick={() => setVista('ingresos')}>Ingresos</Btn>
            {vista === 'pizarra' && <BotonesAlta openModal={openModal} onChange={reload} />}
          </div>
        }
      />
      {vista === 'pizarra' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          {COLUMNAS.map((col) => {
            const filas = (tarjetas ?? []).filter((t) => t.estado === col.estado);
            return (
              <div key={col.estado}>
                <div className={s['section-title']}>
                  {col.titulo} ({filas.length})
                  <span className={s.hint} style={{ marginLeft: 6, fontWeight: 400 }}>{col.hint}</span>
                </div>
                {filas.map((t) => <Tarjeta key={t.id} t={t} />)}
                {!filas.length && <div className={cx(s.hint)} style={{ padding: 8 }}>Vacío.</div>}
              </div>
            );
          })}
        </div>
      ) : <Ingresos />}
    </div>
  );
}

/** El historial de recibidos: cuándo se pidió, cuándo llegó, cuánto tardó. */
function Ingresos() {
  const { proveedores } = useProveedores();
  const [filtro, setFiltro] = useState('mes');
  const [proveedorId, setProveedorId] = useState('');
  const [buscar, setBuscar] = useState('');
  const { data } = useResource(
    `prov-ingresos:${filtro}:${proveedorId}:${buscar}`,
    () => provApi.ingresos({ filtro, proveedorId: proveedorId || undefined, buscar: buscar || undefined }),
  );

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        <select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
          <option value="todos">Todos</option>
          <option value="semana">Última semana</option>
          <option value="mes">Este mes</option>
          <option value="mes_ant">Mes anterior</option>
        </select>
        <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
          <option value="">Todos los proveedores</option>
          {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        <input
          type="search" placeholder="Buscar en notas o proveedor…"
          value={buscar} onChange={(e) => setBuscar(e.target.value)}
        />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
          <Stat label="Recibidos este mes" value={data?.totalMes ?? 0} />
          <Stat label="Demora promedio" value={`${data?.promedioDias ?? 0} d`} />
        </div>
      </div>
      <Table cols={[{ h: 'Proveedor' }, { h: 'Pedido' }, { h: 'Recibido' }, { h: 'Días', num: true }, { h: 'Notas' }]}>
        {(data?.filas ?? []).map((f) => (
          <tr key={f.id}>
            <td>{f.proveedorNombre}</td>
            <td>{f.fechaPedido ? fmtFecha(f.fechaPedido) : '—'}</td>
            <td>{f.fechaRecepcion ? fmtFecha(f.fechaRecepcion) : '—'}</td>
            <td className={s.num}>{f.dias ?? '—'}</td>
            <td className={s.hint}>{f.notas}</td>
          </tr>
        ))}
      </Table>
      {!(data?.filas ?? []).length && <div className={s['empty-state']}>Sin ingresos en este filtro.</div>}
    </div>
  );
}
