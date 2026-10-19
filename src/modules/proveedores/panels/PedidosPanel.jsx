import { useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useProveedores } from '../context/ProveedoresContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { errorMsg, provApi } from '../services/proveedores.api.js';
import { BotonesAlta } from '../components/modals/PedidosModals.jsx';
import { ProveedorMenu } from '../components/ProveedorMenu.jsx';
import { Btn, PanelHead, Pill, Stat, Table, fmtFecha, fmtFechaHora, s } from '../components/ui.jsx';

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

/** Días de CALENDARIO hasta hoy (lo de anoche es «ayer», aunque no hayan pasado 24 h). */
function diasCalendario(fecha) {
  const d = new Date(fecha); d.setHours(0, 0, 0, 0);
  const h = new Date(); h.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((h - d) / 86400000));
}
/** «hoy», «ayer», «hace 5 días». */
const hace = (dias) => (dias === 0 ? 'hoy' : dias === 1 ? 'ayer' : `hace ${dias} días`);

export function PedidosPanel() {
  const { openModal, toast, recargarContadores, getProveedor } = useProveedores();
  const [vista, setVista] = useState('pizarra');
  /* 0164: la pizarra solo con los proveedores de la localidad. */
  const [soloLocales, setSoloLocales] = useState(false);
  const { data: tarjetas, reload } = useResource('prov-kanban', provApi.kanban);
  const visibles = (tarjetas ?? []).filter((t) => !soloLocales || getProveedor(t.proveedorId)?.esLocal);

  const mutar = async (promesa, ok) => {
    try {
      await promesa;
      await reload();
      recargarContadores();
      if (ok) toast(ok, 'ok');
    } catch (e) { toast(errorMsg(e), 'err'); }
  };

  const Tarjeta = ({ t }) => {
    const revisadoHace = t.revisadoAt ? diasCalendario(t.revisadoAt) : null;
    const anotadaHace = t.fechaAlta ? diasCalendario(t.fechaAlta) : null;
    return (
      <div className={s.card} style={{ padding: 10, marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
          <ProveedorMenu proveedorId={t.proveedorId} nombre={t.proveedorNombre} />
          <Btn small onClick={() => mutar(provApi.borrarPedido(t.id), 'Tarjeta eliminada.')}>×</Btn>
        </div>
        {/* CUÁNDO SE ANOTÓ (19/10/2026, pedido del dueño): la fecha en que se asentó
            la tarjeta, en las tres columnas; en «Pedido» además el día que se le pidió. */}
        {t.fechaAlta && (
          <div style={{ fontSize: 12.5, margin: '2px 0', color: 'var(--crm-color-text-secondary)' }}>
            Anotado el <strong style={{ color: 'var(--crm-color-text)' }}>{fmtFechaHora(t.fechaAlta)}</strong> · {hace(anotadaHace)}
          </div>
        )}
        {t.productosProveedor > 0 && (
          <div className={s.hint} style={{ margin: '2px 0' }}>trae {t.productosProveedor} producto(s)</div>
        )}
        {/* Una orden de pedido de Almacén trae la lista entera: en la tarjeta, las
            primeras líneas (la nota completa al pasar el mouse y en «Notas»). */}
        {t.notas && (
          <div
            className={s.hint} title={t.notas}
            style={{ margin: '4px 0', whiteSpace: 'pre-wrap', display: '-webkit-box', WebkitLineClamp: 6, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          >
            {t.notas}
          </div>
        )}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', margin: '4px 0' }}>
          {t.estado === 'solicitado' && t.pedidoEnviado && <Pill pill="est-recibida" label="pedido enviado" />}
          {t.estado === 'solicitado' && revisadoHace != null && (
            <Pill label={`lo viste ${hace(revisadoHace)}`} />
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
            {vista === 'pizarra' && (
              <label className={s.hint} style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <input id="pedidos-locales" type="checkbox" checked={soloLocales} onChange={(e) => setSoloLocales(e.target.checked)} />
                Solo proveedores locales
              </label>
            )}
            {vista === 'pizarra' && <BotonesAlta openModal={openModal} onChange={reload} />}
          </div>
        }
      />
      {vista === 'pizarra' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          {COLUMNAS.map((col) => {
            const filas = visibles.filter((t) => t.estado === col.estado);
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
