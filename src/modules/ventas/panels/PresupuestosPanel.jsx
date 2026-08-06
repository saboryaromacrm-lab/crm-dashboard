/**
 * PRESUPUESTOS — la bandeja de los pedidos mayoristas
 * ============================================================================
 * Se COTIZA en el POS ("Presupuesto" en el ticket): acá vive el ciclo de vida.
 *
 *   borrador → Enviar (congela validez) → Confirmar (¡reserva stock!)
 *   → armar con la hoja impresa → Cerrar en POS (el cajero ajusta y cobra)
 *
 * Dos papeles: el del CLIENTE (formal, con precios y validez — o "Copiar
 * WhatsApp") y el de ARMADO (sin precios, columna en blanco para el lápiz).
 * "Vencido" se calcula acá mismo: enviado con la fecha pasada.
 */
import { useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { configImpresion, imprimirDocumento } from '@core/services/imprimir.js';
import { useVentas } from '../context/VentasContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { ventasApi, errorMsg } from '../services/ventas.api.js';
import { telefonoWa } from '../domain/constants.js';
import {
  Table, PanelHead, Btn, Pill, ModalShell, money, num, fmtFecha, usePaginado, s,
} from '../components/ui.jsx';

const ESTADOS = {
  // Solo por si una pendiente se cuela por un link viejo: viven en Órdenes web.
  pendiente: { label: 'Pendiente (web)', pill: 'est-pendiente' },
  borrador: { label: 'Borrador', pill: 'est-pendiente' },
  enviado: { label: 'Enviado', pill: 'est-preparada' },
  vencido: { label: 'Vencido', pill: 'est-cancelada' },
  confirmado: { label: 'Confirmado', pill: 'st-disponible' },
  cerrado: { label: 'Cerrado', pill: 'est-recibida' },
  cancelado: { label: 'Cancelado', pill: 'est-cancelada' },
};
const ENTREGAS = { retiro: 'Retiro en local', cadete: 'Cadete', camioneta: 'Camioneta' };

/** Estado EFECTIVO: un enviado con la fecha pasada se muestra vencido. */
const estadoDe = (p) => (
  p.estado === 'enviado' && p.vencimiento && new Date(p.vencimiento).getTime() < Date.now()
    ? 'vencido' : p.estado
);

const finalUnit = (it) => it.precioLista * (1 - (it.descuento || 0) / 100) * (1 + (it.iva ?? 21) / 100);
const armadaDe = (it) => (it.cantidadArmada ?? it.cantidad);

/* ------------------------- Impresiones y WhatsApp ------------------------- */
/* El formato (A4/Carta/rollo) y el membrete de la empresa salen de
 * Sistema › Impresión: acá solo se arma el CONTENIDO de cada documento. */

/** Hoja del CLIENTE: formal, con precios finales y validez. */
function imprimirCliente(p, cliente) {
  const filas = p.items.map((it) => `
    <tr>
      <td>${it.nombre}${it.detalle ? ` <span style="color:#666">· ${it.detalle}</span>` : ''}</td>
      <td class="chica n">${num(it.cantidad)}</td>
      <td class="chica n">${money(finalUnit(it))}</td>
      <td class="chica n"><strong>${money(finalUnit(it) * it.cantidad)}</strong></td>
    </tr>`).join('');
  imprimirDocumento('presupuesto', {
    titulo: `${p.codigo} — Presupuesto`,
    cuerpo: `
      <h1>Presupuesto ${p.codigo}</h1>
      <div class="sub">${cliente?.nombre ?? ''} · ${fmtFecha(p.fecha)}${p.vencimiento ? ` · <strong>válido hasta ${fmtFecha(p.vencimiento)}</strong>` : ''}</div>
      <table><thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Importe</th></tr></thead>
      <tbody>${filas}</tbody></table>
      <div class="tot">Total: <strong>${money(p.total)}</strong> <span style="color:#666;font-size:12px">(IVA incluido)</span></div>
      ${p.observaciones ? `<div class="nota">${p.observaciones}</div>` : ''}`,
    pie: 'Los precios quedan garantizados hasta el vencimiento del presupuesto.',
  });
}

/** Hoja de ARMADO: sin precios, columna en blanco para anotar a lápiz. */
function imprimirArmado(p, cliente) {
  const filas = p.items.map((it) => `
    <tr>
      <td>${it.nombre}${it.detalle ? ` <span style="color:#666">· ${it.detalle}</span>` : ''}</td>
      <td class="chica n">${num(it.cantidad)}</td>
      <td class="prep"></td>
      <td class="obs">${it.motivo || ''}</td>
      <td class="chica" style="text-align:center;font-size:16px">&#9744;</td>
    </tr>`).join('');
  imprimirDocumento('hojaArmado', {
    titulo: `${p.codigo} — Armado`,
    cuerpo: `
      <h1>${p.codigo} · Armado del pedido</h1>
      <div class="sub">${cliente?.nombre ?? ''} · ${ENTREGAS[p.entrega] ?? p.entrega} · anotá lo armado y cargalo al volver</div>
      <table><thead><tr><th>Producto</th><th>Pedido</th><th>Armado</th><th>Observación</th><th>&#10003;</th></tr></thead>
      <tbody>${filas}</tbody></table>`,
  });
}

/**
 * El presupuesto como MENSAJE de WhatsApp: prolijo y con identidad. WhatsApp
 * no pinta colores — el verde de la marca entra por los emojis (🌿💚), las
 * *negritas* y el orden de los datos. El nombre de la empresa sale de
 * Sistema › Empresa, el mismo membrete que usan los impresos.
 */
function textoWhatsApp(p, cliente, empresaNombre) {
  const nombrePila = (p.webCliente?.nombre || cliente?.nombre || '').trim().split(/\s+/)[0];
  const lineas = p.items.map((it) =>
    `  •  ${num(it.cantidad)} × ${it.nombre}${it.detalle ? ` _(${it.detalle})_` : ''}\n      ${money(finalUnit(it) * it.cantidad)}`);
  return [
    `🌿 *${(empresaNombre || 'Sabor y Aroma').toUpperCase()}* 🌿`,
    '',
    `¡Hola${nombrePila ? ` ${nombrePila}` : ''}! 👋 Te pasamos tu presupuesto:`,
    '',
    `📋 *${p.codigo}* — ${fmtFecha(p.fecha)}`,
    '',
    '🛒 *Tu pedido:*',
    ...lineas,
    '',
    '━━━━━━━━━━━━━━',
    `💰 *TOTAL: ${money(p.total)}* _(IVA incluido)_`,
    p.vencimiento ? `⏳ Válido hasta el *${fmtFecha(p.vencimiento)}*` : null,
    `🚚 Entrega: ${ENTREGAS[p.entrega] ?? p.entrega}`,
    p.observaciones ? `📝 ${p.observaciones}` : null,
    '',
    '¡Gracias por tu compra! 💚',
    'Ante cualquier duda, respondé este mensaje.',
  ].filter((l) => l !== null).join('\n');
}

/* ------------------------------ Modales ------------------------------ */

function ArmadoModal({ p, onGuardar, onCerrar }) {
  const [edits, setEdits] = useState({});
  const [guardando, setGuardando] = useState(false);
  const set = (id, patch) => setEdits((e) => ({ ...e, [id]: { ...(e[id] || {}), ...patch } }));

  const guardar = async () => {
    setGuardando(true);
    const items = p.items.map((it) => ({
      itemId: it.id,
      cantidadArmada: edits[it.id]?.armada != null ? Math.max(parseFloat(edits[it.id].armada) || 0, 0) : undefined,
      motivo: edits[it.id]?.motivo,
    })).filter((x) => x.cantidadArmada !== undefined || x.motivo !== undefined);
    const ok = await onGuardar(items);
    setGuardando(false);
    if (ok) onCerrar();
  };

  return (
    <ModalShell
      title={`Armado de ${p.codigo}`}
      wide
      onClose={onCerrar}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: onCerrar },
        { texto: guardando ? 'Guardando…' : 'Guardar armado', clase: 'btn-primary', onClick: guardar },
      ]}
    >
      <div className={cx(s.callout, s.info)}>
        Pasá acá lo que el vendedor anotó en la hoja: qué se armó de verdad y por qué faltó lo que
        faltó. La venta va a salir por <strong>lo armado</strong>.
      </div>
      <Table cols={[{ h: 'Producto' }, { h: 'Pedido', num: true }, { h: 'Armado', num: true }, { h: 'Motivo' }]}>
        {p.items.map((it) => (
          <tr key={it.id}>
            <td>{it.nombre}{it.detalle && <div className={s.hint} style={{ margin: 0 }}>{it.detalle}</div>}</td>
            <td className={cx(s.num, s.mono)}>{num(it.cantidad)}</td>
            <td className={s.num}>
              <input
                type="number" min="0" step="1"
                value={edits[it.id]?.armada ?? String(armadaDe(it))}
                style={{ width: 84, textAlign: 'right' }}
                onChange={(e) => set(it.id, { armada: e.target.value })}
              />
            </td>
            <td>
              <input
                value={edits[it.id]?.motivo ?? (it.motivo || '')}
                placeholder="faltó stock, se rompió…"
                style={{ width: 180 }}
                onChange={(e) => set(it.id, { motivo: e.target.value })}
              />
            </td>
          </tr>
        ))}
      </Table>
    </ModalShell>
  );
}

/* ------------------------------ Panel ------------------------------ */

export function PresupuestosPanel() {
  const { clientes, usuarios, ctx, goPanel, toast } = useVentas();
  const [filtroEstado, setFiltroEstado] = useState('');
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(null); // { tipo: 'armado', p }
  const [ocupado, setOcupado] = useState(false);

  const { data, loading, reload } = useResource('presupuestos', () => ventasApi.presupuestos());
  const lista = data ?? [];

  const clienteDe = useMemo(() => new Map(clientes.map((c) => [c.id, c])), [clientes]);
  const usuarioDe = useMemo(() => new Map(usuarios.map((u) => [u.id, u])), [usuarios]);

  const permisosActual = usuarioDe.get(ctx.usuarioId)?.permisos ?? [];
  const puedeCotizar = permisosActual.includes('*') || permisosActual.includes('presupuestos');
  const puedeVender = puedeCotizar || permisosActual.includes('ventas');

  const filtrados = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return lista.filter((p) => {
      // Los pedidos web sin revisar viven en SU bandeja (Órdenes web): acá
      // entran recién al aceptarse — mostrarlos en los dos lados era operarlos
      // dos veces.
      if (p.estado === 'pendiente') return false;
      if (filtroEstado && estadoDe(p) !== filtroEstado) return false;
      if (!ql) return true;
      const cli = clienteDe.get(p.clienteId)?.nombre ?? '';
      return p.codigo.toLowerCase().includes(ql) || cli.toLowerCase().includes(ql);
    });
  }, [lista, filtroEstado, q, clienteDe]);

  const pag = usePaginado(filtrados, 'presupuestos', `${filtroEstado}|${q}`);

  /** Corre una acción de la API y recarga; los errores van al toast de arriba. */
  const accion = async (fn, okMsg) => {
    setOcupado(true);
    try {
      await fn();
      if (okMsg) toast(okMsg, 'ok');
      await reload();
      return true;
    } catch (e) {
      toast(errorMsg(e), 'err');
      return false;
    } finally {
      setOcupado(false);
    }
  };

  /**
   * WhatsApp DIRECTO: abre el chat del cliente con el presupuesto ya escrito —
   * queda revisar y tocar enviar. El teléfono sale del formulario web (si la
   * orden vino del sitio) o de la ficha del cliente. Sin un número argentino
   * completo, cae al plan B de siempre: copiar el texto al portapapeles.
   */
  const enviarWhatsApp = async (p) => {
    const cliente = clienteDe.get(p.clienteId);
    const { empresa } = await configImpresion();
    const texto = textoWhatsApp(p, cliente, empresa?.nombre);

    const wa = telefonoWa(p.webCliente?.telefono || cliente?.telefono || '');
    if (wa) {
      window.open(`https://wa.me/${wa}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
      toast('Se abrió WhatsApp con el presupuesto listo: revisalo y tocá enviar.', 'ok');
      return;
    }
    try {
      await navigator.clipboard.writeText(texto);
      toast('El cliente no tiene un WhatsApp completo cargado: el presupuesto quedó copiado para pegar a mano.', 'ok');
    } catch {
      toast('No se pudo copiar al portapapeles.', 'err');
    }
  };

  /**
   * Cerrar en POS: crea la VENTA EN CURSO desde lo ARMADO, con los precios
   * congelados, atada al presupuesto. El cajero la retoma en el punto de
   * venta, agrega o saca lo que el cliente pida, y al cobrar el presupuesto
   * se cierra solo (y se libera la reserva).
   */
  const cerrarEnPos = async (p) => {
    const items = p.items
      .filter((it) => armadaDe(it) > 1e-9)
      .map((it) => ({
        productoId: it.productoId, presentacionId: it.presentacionId ?? undefined,
        cantidad: armadaDe(it), precioLista: it.precioLista, precioUnitario: it.precioLista,
        descuento: it.descuento || 0, iva: it.iva, lista: it.lista || undefined,
        listaOrigen: 'manual',
      }));
    if (!items.length) { toast('No hay nada armado para vender.', 'err'); return; }
    const ok = await accion(() => ventasApi.abrirVenta({
      clienteId: p.clienteId,
      sucursalId: p.sucursalId,
      usuarioId: ctx.usuarioId ?? undefined,
      presupuestoId: p.id,
      observaciones: `Cierra ${p.codigo}`,
      items,
    }), `Venta en curso creada desde ${p.codigo}: se termina en el punto de venta.`);
    if (ok) goPanel('pos');
  };

  const filas = pag.visibles.map((p) => {
    const est = estadoDe(p);
    const cli = clienteDe.get(p.clienteId);
    const vendedor = usuarioDe.get(p.vendedorId);
    const acciones = [];
    if (puedeCotizar && est === 'borrador') {
      acciones.push(<Btn key="e" variant="btn-primary" small disabled={ocupado} onClick={() => accion(() => ventasApi.enviarPresupuesto(p.id), 'Enviado: corre la validez.')}>Enviar</Btn>);
    }
    if (est !== 'borrador' && est !== 'cancelado') {
      acciones.push(<Btn key="i" small onClick={() => imprimirCliente(p, cli)}>Imprimir</Btn>);
      acciones.push(<Btn key="w" small onClick={() => enviarWhatsApp(p)}>WhatsApp</Btn>);
    }
    if (puedeCotizar && est === 'enviado') {
      acciones.push(<Btn key="c" variant="btn-primary" small disabled={ocupado} onClick={() => accion(() => ventasApi.confirmarPresupuesto(p.id, ctx.usuarioId), 'Confirmado: stock reservado para armar el pedido.')}>Confirmar</Btn>);
    }
    if (puedeCotizar && (est === 'enviado' || est === 'vencido')) {
      acciones.push(<Btn key="r" small disabled={ocupado} onClick={() => accion(() => ventasApi.reabrirPresupuesto(p.id), 'Reabierto como borrador.')}>Reabrir</Btn>);
    }
    if (est === 'confirmado') {
      acciones.push(<Btn key="h" small onClick={() => imprimirArmado(p, cli)}>Hoja armado</Btn>);
      acciones.push(<Btn key="a" variant="btn-edit" small onClick={() => setModal({ tipo: 'armado', p })}>Cargar armado</Btn>);
      if (puedeVender) {
        acciones.push(<Btn key="v" variant="btn-vender" small disabled={ocupado} onClick={() => cerrarEnPos(p)}>Cerrar en POS</Btn>);
      }
    }
    if (puedeCotizar && (est === 'borrador' || est === 'enviado' || est === 'vencido' || est === 'confirmado')) {
      acciones.push(<Btn key="x" variant="btn-delete" small disabled={ocupado} onClick={() => accion(() => ventasApi.cancelarPresupuesto(p.id, ctx.usuarioId), 'Cancelado.')}>Cancelar</Btn>);
    }

    return (
      <tr key={p.id}>
        <td className={s.mono}>
          {p.codigo}
          {p.origen === 'web' && <span title="Pedido del sitio web" style={{ marginLeft: 4 }}>🌐</span>}
        </td>
        <td>
          <strong>{cli?.nombre ?? `Cliente #${p.clienteId}`}</strong>
          <div className={s.hint} style={{ margin: 0 }}>
            {ENTREGAS[p.entrega] ?? p.entrega}
            {p.observaciones && ` · ${p.observaciones}`}
          </div>
        </td>
        <td>{fmtFecha(p.fecha)}</td>
        <td style={est === 'vencido' ? { color: 'var(--crm-color-accent-2)', fontWeight: 700 } : undefined}>
          {p.vencimiento ? fmtFecha(p.vencimiento) : '—'}
        </td>
        <td>
          {puedeCotizar && est !== 'cerrado' && est !== 'cancelado' ? (
            <select
              className={s['select-inline']}
              value={p.vendedorId ?? ''}
              onChange={(e) => accion(() => ventasApi.delegarPresupuesto(p.id, e.target.value ? Number(e.target.value) : null))}
            >
              <option value="">Sin asignar</option>
              {usuarios.filter((u) => u.activo !== false).map((u) => (
                <option key={u.id} value={u.id}>{u.nombre}</option>
              ))}
            </select>
          ) : (vendedor?.nombre ?? '—')}
        </td>
        <td className={cx(s.num, s.mono)}>{money(p.total)}</td>
        <td><Pill pill={ESTADOS[est]?.pill} label={ESTADOS[est]?.label ?? est} /></td>
        <td className={s['actions-col']}>
          <div className={s['row-actions']}>{acciones.length ? acciones : <span className={s.muted}>—</span>}</div>
        </td>
      </tr>
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Presupuestos"
        desc="Pedidos mayoristas (WhatsApp hoy, tienda web mañana). Se cotizan en el POS con el botón «Presupuesto»; acá se envían, se confirman (reserva stock), se arman y se cierran como venta."
        actions={puedeCotizar && (
          <Btn variant="btn-primary" onClick={() => goPanel('pos')}>+ Cotizar en el POS</Btn>
        )}
      />

      <div className={s.toolbar}>
        <input
          type="search"
          placeholder="Buscar por código o cliente..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className={s['select-inline']} value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {Object.entries(ESTADOS).map(([id, e]) => <option key={id} value={id}>{e.label}</option>)}
        </select>
        <Btn small onClick={reload} disabled={loading}>{loading ? 'Cargando…' : 'Actualizar'}</Btn>
      </div>

      <Table
        cols={[
          { h: 'Código' }, { h: 'Cliente' }, { h: 'Fecha' }, { h: 'Vence' }, { h: 'Vendedor' },
          { h: 'Total', num: true }, { h: 'Estado' }, { h: 'Acciones', cls: 'actions-col' },
        ]}
        empty={loading ? 'Cargando…' : 'Sin presupuestos. Cotizá el primero desde el POS con el botón «Presupuesto».'}
        pag={pag}
      >
        {filas}
      </Table>

      <div className={s.hint}>
        Un <strong>enviado</strong> vence solo al pasar la validez (se reabre y re-cotiza). Un{' '}
        <strong>confirmado</strong> tiene stock reservado: se cierra en el POS o se cancela (y la
        reserva se libera). Entregas con chofer: la venta se cierra en <strong>cuenta corriente</strong>{' '}
        al despachar y la plata que trae el chofer se registra como cobranza.
      </div>

      {modal?.tipo === 'armado' && (
        <ArmadoModal
          p={modal.p}
          onCerrar={() => setModal(null)}
          onGuardar={(items) => accion(() => ventasApi.armarPresupuesto(modal.p.id, items), 'Armado guardado.')}
        />
      )}
    </div>
  );
}
