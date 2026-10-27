/**
 * PRESUPUESTOS — la bandeja de los pedidos mayoristas
 * ============================================================================
 * Se COTIZA en el POS ("Presupuesto" en el ticket): acá vive el ciclo de vida.
 *
 *   borrador → Enviar (congela validez) → Confirmar (¡reserva stock!)
 *   → armar con la hoja impresa y cargar lo armado (fracciona lo que se armó
 *   con el granel) → Cerrar en POS (el cajero ajusta y cobra)
 *
 * Dos papeles: el del CLIENTE (formal, con precios y validez — o "Copiar
 * WhatsApp") y el de ARMADO (sin precios, columna en blanco para el lápiz).
 * "Vencido" se calcula acá mismo: enviado con la fecha pasada.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cx } from '@shared/utils/classNames.js';
import { configImpresion, esc, imprimirDocumento } from '@core/services/imprimir.js';
import { useVentas } from '../context/VentasContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { ventasApi, errorMsg } from '../services/ventas.api.js';
import { abrirWhatsApp } from '@shared/utils/whatsapp.js';
import { ORIGENES_PEDIDO, direccionOrden, envioOrden, origenPedido, telefonoWa, totalConEnvio } from '../domain/constants.js';
import { envioAPagar, llevaEnvio, pasarCadeteAlCliente, pedirCadete } from '../domain/cadete.js';
import { r2 } from '../domain/pos.js';
import {
  Table, PanelHead, Btn, Pill, ModalShell, money, num, fmtFecha, usePaginado, s,
} from '../components/ui.jsx';

const ESTADOS = {
  // Solo por si una pendiente se cuela por un link viejo: viven en Pedidos online.
  pendiente: { label: 'Pendiente (web)', pill: 'est-pendiente' },
  borrador: { label: 'Borrador', pill: 'est-pendiente' },
  enviado: { label: 'Enviado', pill: 'est-preparada' },
  vencido: { label: 'Vencido', pill: 'est-cancelada' },
  confirmado: { label: 'Confirmado', pill: 'st-disponible' },
  cerrado: { label: 'Cerrado', pill: 'est-recibida' },
  cancelado: { label: 'Cancelado', pill: 'est-cancelada' },
};
/* `camioneta` es el id interno; se lee «Envío sin costo» como en la tienda (4/10/2026). */
const ENTREGAS = { retiro: 'Retiro en local', cadete: 'Cadete', camioneta: 'Envío sin costo' };

/** Lo que todavía hay que resolver (25/10/2026, el filtro por defecto): sin los cerrados ni los cancelados. */
const PENDIENTES = 'pendientes';
const resuelto = (est) => est === 'cerrado' || est === 'cancelado';

/** Estado EFECTIVO: un enviado con la fecha pasada se muestra vencido. */
const estadoDe = (p) => (
  p.estado === 'enviado' && p.vencimiento && new Date(p.vencimiento).getTime() < Date.now()
    ? 'vencido' : p.estado
);

const finalUnit = (it) => it.precioLista * (1 - (it.descuento || 0) / 100) * (1 + (it.iva ?? 21) / 100);
const armadaDe = (it) => (it.cantidadArmada ?? it.cantidad);
/** Los paquetes del renglón que se fraccionan al guardar `armada`: los que pasan de los ya armados, hasta lo apartado (la cuenta de la API). */
const seFraccionan = (it, armada) => Math.min(it.porArmar, Math.max(0, Math.ceil(armada - (it.cantidad - it.porArmar) - 1e-9)));
/** Paquetes que esperan su fraccionado: sin cargar lo armado, el pedido no se cierra. */
const faltaCargarArmado = (p) => p.items.some((it) => it.porArmar > 0 && it.cantidadArmada == null);

/* ------------------------- Impresiones y WhatsApp ------------------------- */
/* El formato (A4/Carta/rollo) y el membrete de la empresa salen de
 * Sistema › Impresión: acá solo se arma el CONTENIDO de cada documento.
 *
 * TODO DATO VA CON `esc()`. Este panel imprime pedidos que entraron por el
 * SITIO PÚBLICO: el nombre del cliente y las observaciones los escribió alguien
 * de internet, sin cuenta. Sin escapar, ese texto se ejecutaba como HTML en la
 * ventana de impresión, que comparte origen con el dashboard — o sea, con la
 * sesión abierta del vendedor. */

/** Hoja del CLIENTE: formal, con precios finales y validez. */
function imprimirCliente(p, cliente) {
  const filas = p.items.map((it) => `
    <tr>
      <td>${esc(it.nombre)}${it.detalle ? ` <span style="color:#666">· ${esc(it.detalle)}</span>` : ''}</td>
      <td class="chica n">${num(it.cantidad)}</td>
      <td class="chica n">${money(finalUnit(it))}</td>
      <td class="chica n"><strong>${money(finalUnit(it) * it.cantidad)}</strong></td>
    </tr>`).join('');
  imprimirDocumento('presupuesto', {
    titulo: `${p.codigo} — Presupuesto`,
    cuerpo: `
      <h1>Presupuesto ${esc(p.codigo)}</h1>
      <div class="sub">${esc(cliente?.nombre ?? '')} · ${esc(fmtFecha(p.fecha))}${p.vencimiento ? ` · <strong>válido hasta ${esc(fmtFecha(p.vencimiento))}</strong>` : ''}</div>
      <table><thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Importe</th></tr></thead>
      <tbody>${filas}</tbody></table>
      <div class="tot">Total: <strong>${money(p.total)}</strong> <span style="color:#666;font-size:12px">(IVA incluido)</span></div>
      ${p.observaciones ? `<div class="nota">${esc(p.observaciones)}</div>` : ''}`,
    pie: 'Los precios quedan garantizados hasta el vencimiento del presupuesto.',
  });
}

/** Hoja de ARMADO: sin precios, columna en blanco para anotar a lápiz. */
function imprimirArmado(p, cliente) {
  const filas = p.items.map((it) => `
    <tr>
      <td>${esc(it.nombre)}${it.detalle ? ` <span style="color:#666">· ${esc(it.detalle)}</span>` : ''}</td>
      <td class="chica n">${num(it.cantidad)}</td>
      <td class="prep"></td>
      <td class="obs">${esc(it.motivo || '')}</td>
      <td class="chica" style="text-align:center;font-size:16px">&#9744;</td>
    </tr>`).join('');
  imprimirDocumento('hojaArmado', {
    titulo: `${p.codigo} — Armado`,
    cuerpo: `
      <h1>${esc(p.codigo)} · Armado del pedido</h1>
      <div class="sub">${esc(cliente?.nombre ?? '')} · ${esc(ENTREGAS[p.entrega] ?? p.entrega)}${direccionOrden(p) ? ` · 📍 ${esc(direccionOrden(p))}` : ''} · anotá lo armado y cargalo al volver</div>
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
    envioOrden(p) != null ? `🛵 Envío a domicilio: ${envioOrden(p) ? money(envioOrden(p)) : 'gratis'}` : null,
    `💰 *TOTAL: ${money(totalConEnvio(p))}* _(IVA incluido${envioOrden(p) ? ', con envío' : ''})_`,
    p.vencimiento ? `⏳ Válido hasta el *${fmtFecha(p.vencimiento)}*` : null,
    `🚚 Entrega: ${ENTREGAS[p.entrega] ?? p.entrega}`,
    direccionOrden(p) ? `📍 ${direccionOrden(p)}` : null,
    p.observaciones ? `📝 ${p.observaciones}` : null,
    '',
    '¡Gracias por tu compra! 💚',
    'Ante cualquier duda, respondé este mensaje.',
  ].filter((l) => l !== null).join('\n');
}

/* ------------------------------ Modales ------------------------------ */

/**
 * CONFIRMAR UN PEDIDO CON PAQUETES SIN ARMAR (28/10/2026, pedido del dueño).
 * Confirmar no fracciona: aparta el granel de los paquetes que faltan, y se
 * fraccionan al cargar lo armado, por lo que se armó de verdad. Acá se avisa
 * cuánto granel se aparta. Toca stock: dos pasos y candado contra el doble clic.
 */
function ConfirmarConGranelModal({ p, orden, onConfirmar, onCerrar }) {
  const [guardando, setGuardando] = useState(false);
  const enVuelo = useRef(false);
  const kg = orden.fraccionar.reduce((a, f) => a + f.kg, 0);
  const cortos = orden.items.filter((it) => !it.alcanza);

  const confirmar = async () => {
    if (enVuelo.current) return;
    enVuelo.current = true; setGuardando(true);
    try { await onConfirmar(); } finally { enVuelo.current = false; setGuardando(false); }
  };

  return (
    <ModalShell
      title={`Confirmar ${p.codigo}`}
      onClose={onCerrar}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: onCerrar },
        { texto: guardando ? 'Confirmando…' : 'Confirmar y reservar', clase: 'btn-primary', onClick: confirmar, disabled: guardando },
      ]}
    >
      <div className={s.hint} style={{ marginTop: 0 }}>
        Faltan paquetes armados. Al confirmar se <strong>reserva el granel</strong> para armarlos; se fraccionan recién
        al <strong>cargar lo armado</strong>, por lo que se arme de verdad. Lo que no se arme vuelve al granel al cerrar el pedido.
      </div>
      <Table cols={[{ h: 'Se arma' }, { h: 'Paquetes', num: true }, { h: 'Granel que se reserva', num: true }]}>
        {orden.fraccionar.map((f) => (
          <tr key={`${f.nombre}-${f.tam}`}>
            <td>{f.nombre} · <strong>{f.tam}</strong></td>
            <td className={s.num}>{num(f.paquetes, 0)}</td>
            <td className={s.num}>{num(f.kg, 3)} kg</td>
          </tr>
        ))}
      </Table>
      <div className={s.hint}>En total se reservan <strong>{num(kg, 3)} kg</strong> de granel.</div>
      {cortos.length > 0 && (
        <div className={cx(s.callout, s.warn)}>
          Aun con el granel, {cortos.length} renglón(es) no alcanzan: {cortos.map((it) => it.nombre + (it.detalle ? ` (${it.detalle})` : '')).join(', ')}.
          Si el control de stock está prendido para esos productos, la confirmación va a frenar.
        </div>
      )}
    </ModalShell>
  );
}

/**
 * CARGAR LO ARMADO. Con la reserva, los paquetes que se armaron con el granel
 * apartado se FRACCIONAN al guardar (28/10/2026): se ve cuántos por renglón y
 * se pide quién fraccionó, si hay operadores cargados.
 */
function ArmadoModal({ p, onGuardar, onCerrar }) {
  const [edits, setEdits] = useState({});
  const [operadores, setOperadores] = useState([]);
  const [operadorId, setOperadorId] = useState('');
  const [guardando, setGuardando] = useState(false);
  const set = (id, patch) => setEdits((e) => ({ ...e, [id]: { ...(e[id] || {}), ...patch } }));
  const armada = (it) => (edits[it.id]?.armada != null ? Math.max(parseFloat(edits[it.id].armada) || 0, 0) : armadaDe(it));
  const conGranel = p.items.some((it) => it.porArmar > 0);
  const totalFracciona = p.items.reduce((a, it) => a + seFraccionan(it, armada(it)), 0);
  const faltaOperador = totalFracciona > 0 && operadores.length > 0 && !operadorId;

  /* Quién puede fraccionar: viene con la orden, solo si el pedido tiene granel reservado. */
  useEffect(() => {
    if (!conGranel) return undefined;
    let vivo = true;
    ventasApi.orden(p.id).then((o) => {
      if (!vivo) return;
      const ops = o?.operadores ?? [];
      setOperadores(ops);
      if (ops.length === 1) setOperadorId(String(ops[0].id));
    }).catch(() => {});
    return () => { vivo = false; };
  }, [p.id, conGranel]);

  const guardar = async () => {
    if (faltaOperador) return;
    setGuardando(true);
    const items = p.items.map((it) => ({
      itemId: it.id,
      cantidadArmada: edits[it.id]?.armada != null ? armada(it) : undefined,
      motivo: edits[it.id]?.motivo,
    })).filter((x) => x.cantidadArmada !== undefined || x.motivo !== undefined);
    const ok = await onGuardar(items, operadorId ? Number(operadorId) : null);
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
        { texto: guardando ? 'Guardando…' : 'Guardar armado', clase: 'btn-primary', onClick: guardar, disabled: guardando || faltaOperador },
      ]}
    >
      <div className={cx(s.callout, s.info)}>
        Pasá acá lo que el vendedor anotó en la hoja: qué se armó de verdad y por qué faltó lo que
        faltó. La venta va a salir por <strong>lo armado</strong>.
        {conGranel && ' Los paquetes que se armaron con el granel reservado se fraccionan al guardar; lo que no se armó vuelve al granel al cerrar el pedido.'}
      </div>
      <Table cols={[
        { h: 'Producto' }, { h: 'Pedido', num: true }, { h: 'Armado', num: true },
        ...(conGranel ? [{ h: 'Se fracciona', num: true }] : []), { h: 'Motivo' },
      ]}>
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
            {conGranel && (
              <td className={cx(s.num, s.mono)}>{it.porArmar > 0 ? num(seFraccionan(it, armada(it)), 0) : '—'}</td>
            )}
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
      {totalFracciona > 0 && operadores.length > 0 && (
        <div className={s.field}>
          <label htmlFor="armado-operador">¿Quién fraccionó? <span className={s.req}>*</span></label>
          <select id="armado-operador" value={operadorId} onChange={(e) => setOperadorId(e.target.value)}>
            <option value="">Elegí quién fraccionó…</option>
            {operadores.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
          </select>
        </div>
      )}
    </ModalShell>
  );
}

/* ------------------------------ Panel ------------------------------ */

/** Las dos tiendas, para el filtro de los presupuestos de la tienda. */
const ORIGENES_TIENDA = Object.entries(ORIGENES_PEDIDO).filter(([id]) => id !== 'pos');

/**
 * DOS BANDEJAS, UN PANEL (25/10/2026, pedido del dueño): en Ventas los de
 * MOSTRADOR (cotizados en el POS) y en Tienda online (`tienda`) los pedidos
 * del sitio ya aceptados, con su tienda a la vista y para filtrar.
 */
export function PresupuestosPanel({ tienda = false }) {
  const { clientes, usuarios, ctx, goPanel, toast, config } = useVentas();
  const navigate = useNavigate();
  const [filtroEstado, setFiltroEstado] = useState(PENDIENTES);
  /** De qué tienda vino (solo en la bandeja de la tienda): '' = las dos. */
  const [filtroOrigen, setFiltroOrigen] = useState('');
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
      // Los pedidos web sin revisar viven en SU bandeja (Pedidos online): acá
      // entran recién al aceptarse — mostrarlos en los dos lados era operarlos
      // dos veces.
      if (p.estado === 'pendiente') return false;
      if ((origenPedido(p) !== 'pos') !== tienda) return false;
      const est = estadoDe(p);
      if (filtroEstado === PENDIENTES ? resuelto(est) : filtroEstado && est !== filtroEstado) return false;
      if (filtroOrigen && origenPedido(p) !== filtroOrigen) return false;
      if (!ql) return true;
      const cli = clienteDe.get(p.clienteId)?.nombre ?? '';
      return p.codigo.toLowerCase().includes(ql) || cli.toLowerCase().includes(ql);
    });
  }, [lista, tienda, filtroEstado, filtroOrigen, q, clienteDe]);

  const pag = usePaginado(filtrados, 'presupuestos', `${filtroEstado}|${filtroOrigen}|${q}`);

  /**
   * CONFIRMAR (reserva el stock). Si el pedido lleva paquetes de un granel que
   * no están todos armados, se reserva su granel y se fraccionan al cargar lo
   * armado (28/10/2026, pedido del dueño): antes se muestra cuánto granel se
   * aparta, y se confirma en un segundo paso. Sin nada para armar —o sin
   * reserva de stock en la configuración— confirma directo, como siempre.
   */
  const confirmar = async (p) => {
    if (ocupado) return;
    if (config?.presupuestoReservaStock !== false) {
      setOcupado(true);
      let orden = null;
      try { orden = await ventasApi.orden(p.id); } catch (e) { toast(errorMsg(e), 'err'); setOcupado(false); return; }
      setOcupado(false);
      if (orden?.fraccionar?.length) { setModal({ tipo: 'granel', p, orden }); return; }
    }
    await accion(() => ventasApi.confirmarPresupuesto(p.id, ctx.usuarioId), 'Confirmado: stock reservado para armar el pedido.');
  };

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
      abrirWhatsApp(wa, texto);
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
    if (faltaCargarArmado(p)) { toast('Primero cargá lo armado: hay paquetes que se fraccionan con el granel reservado.', 'err'); return; }
    const items = p.items
      .filter((it) => armadaDe(it) > 1e-9)
      .map((it) => ({
        productoId: it.productoId, presentacionId: it.presentacionId ?? undefined,
        cantidad: armadaDe(it), precioLista: it.precioLista, precioUnitario: it.precioLista,
        /*
         * UN PEDIDO DEL SITIO NO LLEVA DESCUENTO A LA CAJA (16/10/2026). Su único
         * descuento es la PROMO con la que se cotizó (3×2, 15 % off): la caja la
         * vuelve a aplicar sola con su motor de ofertas —la misma cuenta, y bien
         * aunque el cliente cambie la cantidad—. Pasarlo además como descuento la
         * cobraba dos veces y lo frenaba el tope de descuento a mano del cajero.
         */
        /* Las excepciones las calculó el servidor y entran sin tope: el % del BARRIO (0185) en los renglones sin
         * oferta y, en uno con oferta, solo la parte del CUPÓN si el cupón también corría ahí (0199). */
        descuento: p.origen === 'web' && it.ofertaId ? Math.round(1e6 * (it.cuponPct || 0)) / 1e4 : (it.descuento || 0), iva: it.iva, lista: it.lista || undefined,
        /*
         * Viaja el `listaId` con el que se COTIZÓ, no el nombre. El servidor
         * reconoce el precio congelado contra el renglón del presupuesto (que
         * también recibe por `presupuestoId`) y lo registra con origen
         * 'presupuesto': ni un precio pisado a mano, ni el de la lista de hoy.
         */
        listaId: it.listaId ?? undefined,
      }));
    if (!items.length) { toast('No hay nada armado para vender.', 'err'); return; }
    /* El envío del sitio (0185) va como cargo extra: se carga neto, con el IVA del flete. */
    const envio = envioOrden(p);
    const ok = await accion(() => ventasApi.abrirVenta({
      clienteId: p.clienteId,
      sucursalId: p.sucursalId,
      usuarioId: ctx.usuarioId ?? undefined,
      presupuestoId: p.id,
      observaciones: `Cierra ${p.codigo}`,
      items,
      ...(envio > 0 ? { extras: [{ concepto: `Envío a domicilio${p.webCliente?.barrio ? ` (B° ${p.webCliente.barrio})` : ''}`, importe: r2(envio / 1.21), iva: 21 }] } : {}),
    }), `Venta en curso creada desde ${p.codigo}: se termina en el punto de venta.`);
    /* La venta en curso se termina en el punto de venta: desde Tienda online, se va a Ventas. */
    if (ok) { if (tienda) navigate('/ventas?panel=pos'); else goPanel('pos'); }
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
    /* Con envío, ya aceptado y sin cerrar: se le pasa al cadete con un botón (20/10/2026). */
    if (llevaEnvio(p) && (est === 'enviado' || est === 'confirmado')) {
      acciones.push(
        <Btn key="cad" small onClick={() => pedirCadete(p, { cliente: cli, cadete: config.tiendaCadeteWhatsapp, toast })} title="Abre WhatsApp con el pedido para el cadete">
          🛵 Pedir cadete
        </Btn>,
      );
      /* El envío lo paga el cliente: se le manda el link al chat del cadete (25/10/2026). */
      if (envioAPagar(p)) {
        acciones.push(
          <Btn key="cadcli" small onClick={() => pasarCadeteAlCliente(p, { cliente: cli, cadete: config.tiendaCadeteWhatsapp, toast })} title="Le manda al cliente el link al chat del cadete, con los datos de su envío, para que coordine el pago">
            📲 Cliente → cadete
          </Btn>,
        );
      }
    }
    if (puedeCotizar && est === 'enviado') {
      acciones.push(<Btn key="c" variant="btn-primary" small disabled={ocupado} onClick={() => confirmar(p)}>Confirmar</Btn>);
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
        <td>
          <span className={s.mono}>{p.codigo}</span>
          {/* De qué tienda vino (25/10/2026, pedido del dueño): en la misma fila. */}
          {tienda && (
            <div className={s.hint} style={{ margin: 0, whiteSpace: 'nowrap' }}>
              {ORIGENES_PEDIDO[origenPedido(p)].icono} {ORIGENES_PEDIDO[origenPedido(p)].label}
            </div>
          )}
        </td>
        <td>
          <strong>{cli?.nombre ?? `Cliente #${p.clienteId}`}</strong>
          <div className={s.hint} style={{ margin: 0 }}>
            {ENTREGAS[p.entrega] ?? p.entrega}
            {direccionOrden(p) && ` · 📍 ${direccionOrden(p)}`}
            {p.cuponCodigo && ` · 🎟 Cupón ${p.cuponCodigo}${p.webCliente?.medioPago ? ` (paga con ${p.webCliente.medioPago})` : ''}`}
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
        title={tienda ? 'Presupuestos de la tienda' : 'Presupuestos'}
        desc={tienda
          ? 'Los pedidos de la tienda online ya aceptados: se confirman (reserva stock), se arman y se cierran como venta en el punto de venta.'
          : 'Los de mostrador: se cotizan en el POS con el botón «Presupuesto»; acá se envían, se confirman (reserva stock), se arman y se cierran como venta.'}
        actions={puedeCotizar && !tienda && (
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
        <select className={s['select-inline']} value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} aria-label="Estado">
          <option value={PENDIENTES}>Pendientes (sin cerrar ni cancelar)</option>
          <option value="">Todos los estados</option>
          {Object.entries(ESTADOS).filter(([id]) => id !== 'pendiente').map(([id, e]) => <option key={id} value={id}>{e.label}</option>)}
        </select>
        {tienda && (
          <select className={s['select-inline']} value={filtroOrigen} onChange={(e) => setFiltroOrigen(e.target.value)} aria-label="Tienda">
            <option value="">Las dos tiendas</option>
            {ORIGENES_TIENDA.map(([id, o]) => <option key={id} value={id}>{o.icono} {o.label}</option>)}
          </select>
        )}
        <Btn small onClick={reload} disabled={loading}>{loading ? 'Cargando…' : 'Actualizar'}</Btn>
      </div>

      <Table
        cols={[
          { h: 'Código' }, { h: 'Cliente' }, { h: 'Fecha' }, { h: 'Vence' }, { h: 'Vendedor' },
          { h: 'Total', num: true }, { h: 'Estado' }, { h: 'Acciones', cls: 'actions-col' },
        ]}
        empty={loading ? 'Cargando…' : lista.some((p) => p.estado !== 'pendiente' && (origenPedido(p) !== 'pos') === tienda) ? 'Ningún presupuesto con estos filtros.'
          : tienda ? 'Todavía no hay pedidos de la tienda aceptados: se aceptan en Pedidos online.' : 'Sin presupuestos. Cotizá el primero desde el POS con el botón «Presupuesto».'}
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

      {modal?.tipo === 'granel' && (
        <ConfirmarConGranelModal
          p={modal.p}
          orden={modal.orden}
          onCerrar={() => setModal(null)}
          onConfirmar={async () => {
            const ok = await accion(
              () => ventasApi.confirmarPresupuesto(modal.p.id, ctx.usuarioId),
              'Confirmado y reservado: los paquetes que faltan se fraccionan al cargar lo armado.',
            );
            if (ok) setModal(null);
          }}
        />
      )}
      {modal?.tipo === 'armado' && (
        <ArmadoModal
          p={modal.p}
          onCerrar={() => setModal(null)}
          onGuardar={async (items, operadorId) => {
            let fraccionados = [];
            const ok = await accion(async () => {
              const r = await ventasApi.armarPresupuesto(modal.p.id, items, ctx.usuarioId, operadorId);
              fraccionados = r?.fraccionados ?? [];
            });
            if (ok) toast(fraccionados.length ? `Armado guardado. Se fraccionó: ${fraccionados.join(' · ')}.` : 'Armado guardado.', 'ok');
            return ok;
          }}
        />
      )}
    </div>
  );
}
