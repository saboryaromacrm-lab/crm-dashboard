/**
 * ÓRDENES WEB — la bandeja de los pedidos del sitio
 * ============================================================================
 * Todo pedido del sitio nace acá, en estado `pendiente`: el cliente propuso y
 * NADIE de la casa lo miró todavía. No es una entidad nueva — es el mismo
 * presupuesto de siempre, filtrado por su estado de entrada:
 *
 *   pendiente ── Aceptar ──► enviado (sigue el ciclo normal en Presupuestos)
 *             └─ Rechazar ─► cancelado (con el motivo en observaciones)
 *
 * Al aceptar se resuelve el CLIENTE: si el DNI matcheó, ya viene adjudicado;
 * si es desconocido, acá se pregunta si darlo de alta (o se lo asigna a mano
 * a uno existente). Así una prueba o un spam no ensucian la base.
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { ordenesWeb } from '@core/services/ordenesWeb.js';
import { useVentas } from '../context/VentasContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { ventasApi, errorMsg } from '../services/ventas.api.js';
import { direccionOrden, telefonoWa } from '../domain/constants.js';
import {
  Table, PanelHead, Btn, Di, ModalShell, money, num, fmtFechaHora, usePaginado, s,
} from '../components/ui.jsx';

const ENTREGAS = { retiro: 'Retiro en local', cadete: 'Cadete', camioneta: 'Camioneta' };

/** Nombre a mostrar: el cliente adjudicado o lo que escribió en el formulario. */
function nombreOrden(p, getCliente) {
  if (p.clienteId) return getCliente(p.clienteId)?.nombre || `Cliente #${p.clienteId}`;
  const wc = p.webCliente ?? {};
  return `${wc.nombre ?? ''} ${wc.apellido ?? ''}`.trim() || '—';
}

/** Entrega + dirección, para la tabla y el detalle. */
function Entrega({ orden }) {
  const direccion = direccionOrden(orden);
  const conEnvio = orden.entrega && orden.entrega !== 'retiro';
  return (
    <>
      {ENTREGAS[orden.entrega] ?? orden.entrega}
      {conEnvio && (
        direccion
          ? <div className={s.hint} style={{ margin: 0 }}>📍 {direccion}</div>
          : <div className={s.hint} style={{ margin: 0, color: 'var(--crm-color-danger)' }}>Sin dirección: pedila por WhatsApp</div>
      )}
    </>
  );
}

/**
 * El teléfono del pedido como LINK a WhatsApp, con el saludo ya escrito:
 * responder una orden es un clic, no copiar el número a mano. Si lo que dejó
 * el cliente no llega a un número argentino completo, se muestra el texto tal
 * cual (sin link) — un link roto abre un chat que no existe y confunde más.
 */
function WhatsAppLink({ orden }) {
  const wc = orden.webCliente ?? {};
  const tel = String(wc.telefono ?? '').trim();
  if (!tel) return <span className={s.muted}>—</span>;

  const wa = telefonoWa(tel);
  if (!wa) {
    return <span title="No parece un número argentino completo: escribile a mano">{tel}</span>;
  }

  const nombre = String(wc.nombre ?? '').trim();
  const texto = encodeURIComponent(
    `Hola${nombre ? ` ${nombre}` : ''}, te escribimos por tu pedido ${orden.codigo} de ${money(orden.total)}.`,
  );
  return (
    <a
      href={`https://wa.me/${wa}?text=${texto}`}
      target="_blank"
      rel="noopener noreferrer"
      title={`Responder a ${nombre || tel} por WhatsApp`}
      style={{ color: '#25D366', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}
    >
      💬 {tel}
    </a>
  );
}

/* ==================================================================== *
 * Detalle (renglones + stock disponible)
 * ==================================================================== */

function DetalleOrdenModal({ orden, getCliente, onCerrar }) {
  const wc = orden.webCliente ?? {};
  const faltantes = orden.items.filter((it) => !it.alcanza);
  return (
    <ModalShell title={`Orden ${orden.codigo}`} wide onClose={onCerrar}
      footer={[{ texto: 'Cerrar', clase: 'btn-ghost', onClick: onCerrar }]}
    >
      <div className={s['detalle-grid']}>
        <Di label="Cliente">{nombreOrden(orden, getCliente)}{!orden.clienteId && <span className={cx(s.pill, s['est-pendiente'])} style={{ marginLeft: 6 }}>NUEVO</span>}</Di>
        <Di label="WhatsApp"><WhatsAppLink orden={orden} /></Di>
        <Di label="DNI">{wc.dni || '—'}</Di>
        <Di label="Entrega"><Entrega orden={orden} /></Di>
      </div>

      <Table cols={[
        { h: 'Producto' }, { h: 'Pedido', num: true }, { h: 'Stock disponible', num: true }, { h: 'Precio', num: true }, { h: 'Importe', num: true },
      ]}
      >
        {orden.items.map((it) => {
          const final = it.precioLista * (1 - (it.descuento || 0) / 100) * (1 + (it.iva ?? 21) / 100);
          return (
            <tr key={it.id}>
              <td>{it.nombre}{it.detalle ? <span className={s.muted}> · {it.detalle}</span> : ''}
                {it.ofertaNombre && <div className={s.hint} style={{ margin: 0 }}>Oferta: {it.ofertaNombre}</div>}
              </td>
              <td className={s.num}>{num(it.cantidad)}</td>
              <td className={s.num}>
                <strong style={{ color: it.alcanza ? 'var(--crm-color-success)' : 'var(--crm-color-danger)' }}>
                  {num(it.disponible)}
                </strong>
              </td>
              <td className={s.num}>{money(final)}</td>
              <td className={s.num}><strong>{money(final * it.cantidad)}</strong></td>
            </tr>
          );
        })}
      </Table>

      {faltantes.length > 0 && (
        <div className={cx(s.callout, s.warn)}>
          <strong>Stock corto</strong> en {faltantes.length} renglón(es): se puede aceptar igual,
          pero el armado va a quedar incompleto o va a haber que reponer antes.
        </div>
      )}

      <div className={s['detalle-grid']}>
        <Di label="Neto">{money(orden.subtotalNeto)}</Di>
        <Di label="IVA">{money(orden.ivaTotal)}</Di>
        <Di label="Total"><strong style={{ fontSize: 18 }}>{money(orden.total)}</strong></Di>
      </div>

      {orden.observaciones && <div className={s.callout}>{orden.observaciones}</div>}
    </ModalShell>
  );
}

/* ==================================================================== *
 * Aceptar (resuelve el cliente) y Rechazar (pide el motivo)
 * ==================================================================== */

function AceptarOrdenModal({ orden, onListo, onCerrar }) {
  const { clientes, ctx, toast, getCliente, recargar } = useVentas();
  const wc = orden.webCliente ?? {};
  const yaAdjudicada = !!orden.clienteId;
  const [modo, setModo] = useState('crear'); // 'crear' | 'asignar'
  const [clienteId, setClienteId] = useState('');
  const [enviando, setEnviando] = useState(false);

  const aceptar = async () => {
    if (!yaAdjudicada && modo === 'asignar' && !clienteId) {
      toast('Elegí a qué cliente asignar la orden.', 'err');
      return;
    }
    setEnviando(true);
    try {
      await ventasApi.aceptarOrden(orden.id, {
        usuarioId: ctx.usuarioId ?? undefined,
        ...(yaAdjudicada ? {} : modo === 'crear' ? { crearCliente: true } : { clienteId: Number(clienteId) }),
      });
      toast(`${orden.codigo} aceptada: ya está en Presupuestos.`, 'ok');
      ordenesWeb.refrescar();
      await recargar(); // si se creó un cliente, que aparezca en los catálogos
      onListo();
    } catch (e) {
      toast(errorMsg(e), 'err');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <ModalShell title={`Aceptar ${orden.codigo}`} onClose={onCerrar}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: onCerrar },
        { texto: enviando ? 'Aceptando…' : 'Aceptar orden', clase: 'btn-primary', onClick: aceptar },
      ]}
    >
      {yaAdjudicada ? (
        <div className={s.callout}>
          El DNI <strong>{wc.dni}</strong> ya es cliente de la casa: la orden queda adjudicada a{' '}
          <strong>{getCliente(orden.clienteId)?.nombre ?? `#${orden.clienteId}`}</strong>.
        </div>
      ) : (
        <>
          <div className={cx(s.callout, s.warn)}>
            El DNI <strong>{wc.dni || '—'}</strong> no está en la base de clientes.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '4px 0 10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13.5 }}>
              <input type="radio" checked={modo === 'crear'} onChange={() => setModo('crear')} />
              <span>
                Agregarlo como cliente nuevo: <strong>{`${wc.nombre ?? ''} ${wc.apellido ?? ''}`.trim() || '—'}</strong>
                {wc.telefono ? ` · ${wc.telefono}` : ''} · DNI {wc.dni || '—'}
                {direccionOrden(orden) ? ` · ${direccionOrden(orden)}` : ''}
              </span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13.5 }}>
              <input type="radio" checked={modo === 'asignar'} onChange={() => setModo('asignar')} />
              <span>Asignar la orden a un cliente existente</span>
            </label>
            {modo === 'asignar' && (
              <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} style={{ marginLeft: 26 }}>
                <option value="">Elegí el cliente…</option>
                {clientes.filter((c) => !c.esConsumidorFinal).map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}{c.numeroDoc ? ` (${c.numeroDoc})` : ''}</option>
                ))}
              </select>
            )}
          </div>
        </>
      )}
      <div className={s.hint}>
        Aceptar la pasa a <strong>Enviado</strong>: arranca la validez y sigue el ciclo normal
        (confirmar reserva el stock, armar, cerrar en el POS).
      </div>
    </ModalShell>
  );
}

function RechazarOrdenModal({ orden, onListo, onCerrar }) {
  const { ctx, toast } = useVentas();
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);

  const rechazar = async () => {
    if (!motivo.trim()) { toast('Indicá el motivo del rechazo: queda en el registro.', 'err'); return; }
    setEnviando(true);
    try {
      await ventasApi.cancelarPresupuesto(orden.id, ctx.usuarioId ?? undefined, motivo.trim());
      toast(`${orden.codigo} rechazada.`, 'ok');
      ordenesWeb.refrescar();
      onListo();
    } catch (e) {
      toast(errorMsg(e), 'err');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <ModalShell title={`Rechazar ${orden.codigo}`} onClose={onCerrar}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: onCerrar },
        { texto: enviando ? 'Rechazando…' : 'Rechazar orden', clase: 'btn-delete', onClick: rechazar },
      ]}
    >
      <div className={s.field}>
        <label>Motivo <span className={s.req}>*</span></label>
        <input autoFocus value={motivo} placeholder="Ej: pedido de prueba / sin stock / no es zona de entrega" onChange={(e) => setMotivo(e.target.value)} />
      </div>
      <div className={s.hint}>
        La orden queda <strong>cancelada</strong> con el motivo en observaciones. Si el cliente era
        nuevo, NO se da de alta — la base queda limpia.
      </div>
    </ModalShell>
  );
}

/* ==================================================================== *
 * Panel
 * ==================================================================== */

export function OrdenesPanel() {
  const { getCliente } = useVentas();
  const [modal, setModal] = useState(null); // { tipo: 'ver'|'aceptar'|'rechazar', orden }
  const [cargandoId, setCargandoId] = useState(0);

  const { data, loading, error, reload } = useResource('ordenes-web', async () => {
    const todos = await ventasApi.presupuestos();
    return todos.filter((p) => p.estado === 'pendiente');
  });
  const ordenes = useMemo(() => data ?? [], [data]);

  // La bandeja se recarga sola cuando el poller detecta que el contador
  // cambió: el pedido nuevo aparece sin tocar nada (igual que el badge).
  const pendientesWeb = useSyncExternalStore(ordenesWeb.subscribe, ordenesWeb.count, ordenesWeb.count);
  useEffect(() => { reload(); }, [pendientesWeb, reload]);
  const pag = usePaginado(ordenes, 'ordenesWeb');

  /** El detalle (con stock por renglón) se pide al abrir cualquier modal. */
  const abrir = async (tipo, p) => {
    setCargandoId(p.id);
    try {
      const orden = await ventasApi.orden(p.id);
      setModal({ tipo, orden });
    } catch { /* el toast global no está acá; la fila queda como estaba */ }
    finally { setCargandoId(0); }
  };

  const cerrarYRecargar = () => { setModal(null); reload(); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Órdenes web"
        desc="Los pedidos del sitio esperando revisión. Aceptar los pasa a Presupuestos (ciclo normal); rechazar los cancela con motivo. El cliente nuevo recién se da de alta al aceptar."
      />

      {error && <div className={cx(s.callout, s.warn)}>No se pudieron cargar las órdenes: <strong>{error}</strong></div>}

      <Table
        cols={[
          { h: 'Orden' }, { h: 'Recibida' }, { h: 'Cliente' }, { h: 'WhatsApp' },
          { h: 'Entrega' }, { h: 'Renglones', num: true }, { h: 'Total', num: true },
          { h: 'Acciones', cls: 'actions-col' },
        ]}
        empty={loading ? 'Cargando…' : 'No hay pedidos web esperando revisión. Los nuevos aparecen solos.'}
        pag={pag}
      >
        {pag.visibles.map((p) => (
          <tr key={p.id} style={cargandoId === p.id ? { opacity: 0.5 } : undefined}>
            <td className={s.mono}><strong>{p.codigo}</strong></td>
            <td>{fmtFechaHora(p.fecha)}</td>
            <td>
              {nombreOrden(p, getCliente)}
              {!p.clienteId && <span className={cx(s.pill, s['est-pendiente'])} style={{ marginLeft: 6 }}>NUEVO</span>}
            </td>
            <td onClick={(e) => e.stopPropagation()}><WhatsAppLink orden={p} /></td>
            <td><Entrega orden={p} /></td>
            <td className={s.num}>{p.items.length}</td>
            <td className={s.num}><strong>{money(p.total)}</strong></td>
            <td className={s['actions-col']}>
              <div className={s['row-actions']}>
                <Btn small onClick={() => abrir('ver', p)}>Ver</Btn>
                <Btn variant="btn-primary" small onClick={() => abrir('aceptar', p)}>Aceptar</Btn>
                <Btn variant="btn-delete" small onClick={() => abrir('rechazar', p)}>Rechazar</Btn>
              </div>
            </td>
          </tr>
        ))}
      </Table>

      <div className={s.hint}>
        La bandeja se actualiza sola cada 30 segundos (mismo contador que suena la alerta).
        Una vez aceptada, la orden sigue en <strong>Presupuestos</strong> con la marca 🌐 de origen web.
      </div>

      {modal?.tipo === 'ver' && (
        <DetalleOrdenModal orden={modal.orden} getCliente={getCliente} onCerrar={() => setModal(null)} />
      )}
      {modal?.tipo === 'aceptar' && (
        <AceptarOrdenModal orden={modal.orden} onListo={cerrarYRecargar} onCerrar={() => setModal(null)} />
      )}
      {modal?.tipo === 'rechazar' && (
        <RechazarOrdenModal orden={modal.orden} onListo={cerrarYRecargar} onCerrar={() => setModal(null)} />
      )}
    </div>
  );
}
