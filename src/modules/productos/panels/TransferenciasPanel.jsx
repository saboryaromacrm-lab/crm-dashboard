/**
 * TRANSFERENCIAS — el circuito visto desde MI sucursal
 * ============================================================================
 * No son cuatro pantallas: es UN documento con estados, y cada vista es un
 * filtro por (estado + qué papel juega la sucursal activa en él). La misma
 * transferencia es "mercadería solicitada" para el que pidió y "pedido de
 * envío" para el que la tiene que mandar — por eso el mismo código sirve para
 * la Distribuidora y para cada Express sin ramificar nada.
 *
 *   solicitada   pendiente/preparada donde YO pedí (soy destino)
 *   envios       pendiente/preparada donde YO mando (soy origen)  ← cola de trabajo
 *   transito     en la ruta, de cualquiera de mis dos lados
 *   recibidas    cerradas donde yo era una punta
 */
import { useMemo, useState } from 'react';
import { useProductos } from '../context/ProductosContext.jsx';
import { fmtFecha } from '../domain/format.js';
import { cx } from '@shared/utils/classNames.js';
import { Table, PanelHead, TransferPill, Btn, usePaginado, s } from '../components/ui.jsx';
import { listasCompletas, difiereDelPedido } from '../components/modals/TransferModals.jsx';

const VISTAS = [
  { id: 'solicitada', label: 'Mercadería solicitada' },
  { id: 'envios', label: 'Pedidos de envío' },
  { id: 'transito', label: 'En tránsito' },
  { id: 'recibidas', label: 'Recibidas' },
];

/** Días transcurridos desde que entró a un estado (para la alerta de estancados). */
function diasEn(t, estado) {
  const h = (t.hist || []).filter((x) => x.estado === estado).pop();
  if (!h) return null;
  return Math.floor((Date.now() - new Date(h.fecha).getTime()) / 86400000);
}

export function TransferenciasPanel() {
  const { store, isAdmin, act, openModal } = useProductos();
  const [vista, setVista] = useState('envios');
  const miId = store.state.ctx.sucursalId;

  const todas = store.state.transferencias;

  /** Cuántas hay en cada vista: el contador va en el chip, como una bandeja. */
  const conteos = useMemo(() => {
    const c = { solicitada: 0, envios: 0, transito: 0, recibidas: 0 };
    for (const t of todas) {
      const abierta = t.estado === 'pendiente' || t.estado === 'preparada';
      if (abierta && t.destinoId === miId) c.solicitada += 1;
      if (abierta && t.origenId === miId) c.envios += 1;
      if (t.estado === 'transito' && (t.origenId === miId || t.destinoId === miId)) c.transito += 1;
      if (t.estado === 'recibida' && (t.origenId === miId || t.destinoId === miId)) c.recibidas += 1;
    }
    return c;
  }, [todas, miId]);

  const filas = useMemo(() => {
    const abierta = (t) => t.estado === 'pendiente' || t.estado === 'preparada';
    const f = {
      solicitada: (t) => abierta(t) && t.destinoId === miId,
      envios: (t) => abierta(t) && t.origenId === miId,
      transito: (t) => t.estado === 'transito' && (t.origenId === miId || t.destinoId === miId),
      recibidas: (t) => t.estado === 'recibida' && (t.origenId === miId || t.destinoId === miId),
    }[vista];
    return todas.filter(f).sort((a, b) => b.id - a.id);
  }, [todas, vista, miId]);

  /**
   * Reposición sugerida: productos de MI sucursal bajo su mínimo. El clic arma
   * el pedido con las cantidades que faltan — cierra el círculo que el legacy
   * dejaba abierto (calculaba el punto de reposición pero no hacía nada).
   */
  const reposicion = useMemo(() => {
    if (!miId) return [];
    const dist = store.distribuidora();
    if (!dist || dist.id === miId) return [];  // la Distribuidora repone comprando
    return store.state.productos
      // Solo lo que se sigue reponiendo: pedir lo que ya no se trae es trabajo
      // al aire (y el archivado no se puede ni mover).
      .filter((p) => p.stockMin > 0 && (p.estado || 'activo') === 'activo')
      .map((p) => {
        const disp = store.cant(p.id, miId, null, 'disponible');
        return disp < p.stockMin
          ? { productoId: p.id, nombre: p.nombre, falta: Math.ceil(p.stockMin - disp) }
          : null;
      })
      .filter(Boolean);
  }, [store, miId, todas]);

  const pedirReposicion = () => openModal('transferencia', {
    itemsIniciales: reposicion.map((r) => ({ prodId: String(r.productoId), presId: '', cant: String(r.falta) })),
    observaciones: 'Reposición por stock mínimo',
  });

  /**
   * Los pedidos que este local dejó a medio armar. Van ARRIBA de las bandejas y
   * no como una quinta pestaña: es lo primero que el cajero necesita ver cuando
   * vuelve al sistema —"¿dónde quedó lo que estaba armando?"— y son pocos (uno
   * por ruta, ver la migración 0056).
   */
  const borradores = store.misBorradores(miId);

  const acciones = (t) => {
    const out = [];
    const soyOrigen = t.origenId === miId;
    const soyDestino = t.destinoId === miId;
    // Preparan los ENCARGADOS: el de 'preparar' (enteros) y el fraccionador
    // (granel). Cualquiera toma el pedido pendiente — tomarlo solo abre la
    // fase de preparación, no toca stock.
    const puedePreparar = isAdmin || store.can('fraccionar') || store.can('preparar');
    if (puedePreparar && soyOrigen && t.estado === 'pendiente') {
      out.push(
        <Btn key="p" variant="btn-vender" small onClick={async () => {
          const ok = await act(store.avanzarTransferencia(t.id, 'pendiente'), 'En preparación: cada encargado tiene su lista.');
          if (ok) openModal('prepararTransfer', { id: t.id });
        }}>Preparar</Btn>,
      );
    }
    if (puedePreparar && soyOrigen && t.estado === 'preparada') {
      out.push(<Btn key="l" variant="btn-vender" small onClick={() => openModal('prepararTransfer', { id: t.id })}>Listas</Btn>);
      if (isAdmin && listasCompletas(t, store)) {
        out.push(<Btn key="d" variant="btn-primary" small onClick={() => act(store.avanzarTransferencia(t.id, 'preparada'), 'Despachada: en tránsito.')}>Despachar</Btn>);
      }
    }
    // Recibe QUIEN PIDE: el permiso 'pedidos' (cajeros) cubre armar el pedido
    // y confirmar que llegó bien — son las dos puntas del mismo trabajo.
    if ((isAdmin || store.can('pedidos')) && soyDestino && t.estado === 'transito') {
      out.push(<Btn key="r" variant="btn-primary" small onClick={() => openModal('recibirTransfer', { id: t.id })}>Recibir</Btn>);
    }
    out.push(<Btn key="v" variant="btn-edit" small onClick={() => openModal('detalleTransfer', { id: t.id })}>Ver</Btn>);
    if (isAdmin && (t.estado === 'pendiente' || t.estado === 'preparada')) {
      out.push(
        <Btn key="c" variant="btn-delete" small onClick={() => openModal('confirm', {
          title: 'Cancelar transferencia',
          texto: t.estado === 'preparada' ? 'Se liberará el stock reservado en origen. ¿Confirmás?' : 'El pedido se cancela sin tocar stock. ¿Confirmás?',
          claseOk: 'btn-delete',
          onOk: () => act(store.cancelarTransferencia(t.id), 'Transferencia cancelada.'),
        })}>Cancelar</Btn>,
      );
    }
    return out;
  };

  const pag = usePaginado(filas, 'transferencias', vista);

  const cuerpo = pag.visibles.map((t) => {
    const o = store.getSucursal(t.origenId);
    const d = store.getSucursal(t.destinoId);
    const u = store.getUsuario(t.usuarioId);
    const dias = t.estado === 'transito' ? diasEn(t, 'transito') : null;
    const estancada = dias != null && dias >= 3;
    return (
      <tr key={t.id}>
        <td className={s.mono}>{t.codigo}</td>
        <td>
          {o.nombre} → {d.nombre}
          {t.observaciones && <div className={s.muted} style={{ fontSize: 11.5 }}>{t.observaciones}</div>}
          {/* El receptor tiene que saber ANTES de abrir cajas que el envío no es 1:1 con su pedido. */}
          {(t.estado === 'preparada' || t.estado === 'transito') && difiereDelPedido(t) && (
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--crm-color-accent-2)' }}>
              ≠ difiere de lo pedido
            </div>
          )}
        </td>
        <td>{fmtFecha(t.fecha)}</td>
        <td>
          <TransferPill estado={t.estado} />
          {/* El remito viejo sin recibir es mercadería perdida o una recepción
              que nadie registró: se grita acá, no en un reporte mensual. */}
          {estancada && (
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--crm-color-accent-2)', marginTop: 2 }}>
              hace {dias} días en tránsito
            </div>
          )}
        </td>
        <td className={s.num}>{t.items.length}</td>
        <td>{u ? u.nombre : '—'}</td>
        <td className={s['actions-col']}><div className={s['row-actions']}>{acciones(t)}</div></td>
      </tr>
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title={`Transferencias — ${store.getSucursal(miId)?.nombre ?? 'elegí sucursal'}`}
        desc="Cada local pide lo que necesita; el que tiene la mercadería la prepara, la despacha y el solicitante la recibe contando. Lo que falte al contar genera una incidencia sola."
        actions={(isAdmin || store.can('pedidos')) && (
          <Btn variant="btn-primary" onClick={() => openModal('transferencia', {})}>+ Nuevo pedido</Btn>
        )}
      />

      {/* "¿Dónde quedó el pedido que estaba armando?" — la primera pregunta del
          cajero cuando vuelve al puesto. Es lo primero de la pantalla. */}
      {(isAdmin || store.can('pedidos')) && borradores.length > 0 && (
        <div className={cx(s.callout)} style={{ margin: 0 }}>
          <strong>
            {borradores.length === 1 ? 'Tenés un pedido a medio armar' : `Tenés ${borradores.length} pedidos a medio armar`}
          </strong>{' '}
          — todavía no se los pidió a nadie.
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            {borradores.map((b) => {
              const o = store.getSucursal(b.origenId);
              const u = store.getUsuario(b.usuarioId);
              const conCant = (b.items || []).filter((it) => it.cantidad > 0).length;
              return (
                <div
                  key={b.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}
                >
                  <span style={{ flex: 1, minWidth: 200, fontSize: 13 }}>
                    A <strong>{o?.nombre ?? '—'}</strong> · {conCant} renglón(es)
                    {u && <span className={s.muted}> · lo dejó {u.nombre}</span>}
                  </span>
                  <Btn small variant="btn-primary" onClick={() => openModal('transferencia', { borradorId: b.id })}>
                    Seguir armando
                  </Btn>
                  <Btn small variant="btn-delete" onClick={() => openModal('confirm', {
                    title: 'Descartar el pedido',
                    texto: `Se borra el pedido que estaba armándose para ${o?.nombre ?? 'esa sucursal'} con sus ${conCant} renglón(es). No queda registro: nunca se envió.`,
                    claseOk: 'btn-delete',
                    onOk: () => act(store.descartarBorradorPedido(b.id), 'Pedido descartado.'),
                  })}>
                    Descartar
                  </Btn>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {reposicion.length > 0 && (
        <div className={cx(s.callout, s.warn)} style={{ margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span>
            <strong>{reposicion.length} producto(s) bajo el mínimo</strong> en esta sucursal:{' '}
            {reposicion.slice(0, 3).map((r) => r.nombre).join(', ')}{reposicion.length > 3 && '…'}
          </span>
          {isAdmin && <Btn small variant="btn-primary" onClick={pedirReposicion}>Generar pedido de reposición</Btn>}
        </div>
      )}

      {/* Las bandejas: el contador dice cuánto trabajo hay en cada una. */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {VISTAS.map((v) => (
          <button
            key={v.id}
            type="button"
            className={cx(s.badge)}
            style={{
              cursor: 'pointer', padding: '7px 14px', fontSize: 13, border: '1px solid var(--crm-color-border)',
              ...(vista === v.id
                ? { background: 'var(--crm-color-primary)', color: 'var(--crm-color-primary-contrast)', borderColor: 'var(--crm-color-primary)' }
                : {}),
            }}
            onClick={() => setVista(v.id)}
          >
            {v.label}
            {conteos[v.id] > 0 && (
              <span style={{
                marginLeft: 7, padding: '0 7px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                background: vista === v.id ? 'rgba(255,255,255,.25)' : 'var(--crm-color-accent-2)',
                color: '#fff',
              }}>
                {conteos[v.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      <Table
        cols={[{ h: 'Código' }, { h: 'Ruta / obs.' }, { h: 'Fecha' }, { h: 'Estado' }, { h: 'Ítems', num: true }, { h: 'Responsable' }, { h: 'Acciones', cls: 'actions-col' }]}
        empty={{
          solicitada: 'No hay pedidos tuyos abiertos. "+ Nuevo pedido" para pedir mercadería.',
          envios: 'Nadie te pidió mercadería. Cuando otra sucursal pida acá, aparece en esta bandeja.',
          transito: 'Nada en la ruta ahora.',
          recibidas: 'Todavía no se recibió ninguna transferencia acá.',
        }[vista]}
        pag={pag}
      >
        {cuerpo}
      </Table>
    </div>
  );
}
