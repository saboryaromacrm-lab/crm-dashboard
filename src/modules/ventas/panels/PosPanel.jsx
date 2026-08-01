import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useVentas } from '../context/VentasContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { ventasApi } from '../services/ventas.api.js';
import { CONDICIONES_IVA, CONDICIONES_PAGO } from '../domain/constants.js';
import {
  buscarEnCatalogo, calcularRenglon, extrasParaApi, itemsParaApi, parseEtiquetaBalanza,
  problemasDelTicket, r2, ticketDesdeBorrador, ticketInicial, ticketReducer,
  totalesTicket, ultimoArticulo,
} from '../domain/pos.js';
import { Table, PanelHead, Btn, money, num, fmtFechaHora, s } from '../components/ui.jsx';
import p from '../styles/Pos.module.css';

/** Cada cuánto se persiste el ticket abierto mientras el cajero tipea. */
const AUTOGUARDADO_MS = 700;

/**
 * Las pestañas son una preferencia del PUESTO, no un estado del negocio: qué
 * ventas tiene el cajero a mano ahora. Cerrar una pestaña no toca la venta —
 * sigue en la tabla de ventas en curso—, así la barra no se llena.
 */
const PESTANAS_KEY = (sucursalId) => `crm_pos_pestanas_${sucursalId}`;

function leerPestanas(sucursalId) {
  try { return JSON.parse(localStorage.getItem(PESTANAS_KEY(sucursalId))) || []; } catch { return []; }
}
function guardarPestanas(sucursalId, ids) {
  try { localStorage.setItem(PESTANAS_KEY(sucursalId), JSON.stringify(ids)); } catch { /* modo privado */ }
}

/* ==================================================================== *
 * Buscador en línea
 * ==================================================================== */

/**
 * Un solo campo resuelve las tres formas de cargar un artículo: escaneo,
 * código tipeado y nombre. El foco vuelve acá después de cada acción porque el
 * lector es un teclado: si el foco está en otro lado, el código se pierde.
 */
function Buscador({ catalogo, config, onElegir, inputRef }) {
  const [q, setQ] = useState('');
  const [activo, setActivo] = useState(0);

  const resultados = useMemo(() => buscarEnCatalogo(catalogo, q), [catalogo, q]);

  const elegir = useCallback((item, cantidad) => {
    onElegir(item, cantidad);
    setQ('');
    setActivo(0);
  }, [onElegir]);

  /**
   * Enter: si el texto es una etiqueta de balanza se resuelve con su peso; si
   * hay un único resultado se agrega directo (el caso del escaneo); si hay
   * varios, se toma el resaltado.
   */
  const onEnter = () => {
    const etiqueta = parseEtiquetaBalanza(q, config);
    if (etiqueta) {
      const item = catalogo.find((i) => i.codigoBarras && i.codigoBarras.endsWith(etiqueta.codigoItem));
      if (item) {
        const cantidad = etiqueta.cantidad ?? (item.precio > 0 ? r2(etiqueta.importe / item.precio) : 0);
        if (cantidad > 0) { elegir(item, cantidad); return; }
      }
    }
    if (resultados[activo]) elegir(resultados[activo]);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); onEnter(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActivo((i) => Math.min(i + 1, resultados.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActivo((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Escape') { setQ(''); setActivo(0); }
  };

  return (
    <div className={p.buscador}>
      <input
        ref={inputRef}
        className={p.buscadorInput}
        placeholder="Escaneá un código o escribí el nombre…"
        value={q}
        onChange={(e) => { setQ(e.target.value); setActivo(0); }}
        onKeyDown={onKeyDown}
        autoFocus
        autoComplete="off"
      />
      {q && (
        <div className={p.resultados}>
          {resultados.length === 0 && (
            <div className={p.resultado}><span className={p.resultadoMeta}>Nada coincide con «{q}».</span></div>
          )}
          {resultados.map((item, i) => (
            <button
              key={item.key}
              type="button"
              className={cx(p.resultado, i === activo && p.resultadoActivo)}
              onMouseEnter={() => setActivo(i)}
              onClick={() => elegir(item)}
            >
              <span>
                <span className={p.resultadoNombre}>{item.nombre}</span>
                <span className={p.resultadoMeta}>
                  {' · '}{item.detalle}{item.marca ? ` · ${item.marca}` : ''}
                  {' · '}
                  <span className={item.stock <= 0 ? p.sinStock : undefined}>
                    {num(item.stock)} {item.unidad}
                  </span>
                </span>
              </span>
              <span className={p.resultadoPrecio}>
                {item.precio > 0 ? money(item.precio) : <span className={p.sinStock}>sin precio</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ==================================================================== *
 * Ticket
 * ==================================================================== */

function Ticket({ renglones, dispatch, permitirStockNegativo, descuentoMax, esAdmin }) {
  if (!renglones.length) {
    return (
      <div className={p.ticket}>
        <div className={p.vacio}>
          Escaneá o buscá un artículo para empezar el ticket.
        </div>
      </div>
    );
  }

  return (
    <div className={p.ticket}>
      <table className={p.ticketTabla}>
        <thead>
          <tr>
            <th>Artículo</th>
            <th style={{ textAlign: 'right' }}>Cantidad</th>
            <th style={{ textAlign: 'right' }}>Precio</th>
            <th style={{ textAlign: 'right' }}>Desc. %</th>
            <th style={{ textAlign: 'right' }}>Subtotal</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {renglones.map((r) => {
            const calc = calcularRenglon(r);
            const sinStock = !permitirStockNegativo && r.cantidad > r.stock + 1e-9;
            const descExcedido = !esAdmin && r.descuento > descuentoMax + 1e-9;
            return (
              <tr key={r.uid}>
                <td>
                  <div className={p.nombreCol}>{r.nombre}</div>
                  <div className={p.detalleCol}>
                    {r.detalle}
                    {sinStock && <span className={p.sinStock}> · solo hay {num(r.stock)} {r.unidad}</span>}
                  </div>
                </td>
                <td className={p.num}>
                  <input
                    className={cx(p.inputMini, sinStock && p.inputAlerta)}
                    type="number"
                    min="0"
                    step={r.fraccionable ? '0.001' : '1'}
                    value={r.cantidad}
                    onChange={(e) => dispatch({ tipo: 'cantidad', uid: r.uid, valor: e.target.value })}
                  />
                </td>
                <td className={p.num}>
                  {esAdmin ? (
                    <input
                      className={p.inputMini}
                      type="number" min="0" step="0.01"
                      value={r.precioUnitario}
                      onChange={(e) => dispatch({ tipo: 'precio', uid: r.uid, valor: e.target.value })}
                    />
                  ) : money(r.precioUnitario)}
                </td>
                <td className={p.num}>
                  <input
                    className={cx(p.inputMini, descExcedido && p.inputAlerta)}
                    style={{ width: 64 }}
                    type="number" min="0" max="100" step="0.5"
                    value={r.descuento}
                    onChange={(e) => dispatch({ tipo: 'descuento', uid: r.uid, valor: e.target.value })}
                  />
                </td>
                <td className={p.num}><strong>{money(calc.total)}</strong></td>
                <td>
                  <button
                    type="button"
                    className={p.quitar}
                    aria-label={`Quitar ${r.nombre}`}
                    onClick={() => dispatch({ tipo: 'quitar', uid: r.uid })}
                  >
                    ×
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ==================================================================== *
 * Tabla de ventas abiertas (pantalla principal)
 * ==================================================================== */

function VentasAbiertas({ abiertas, catalogo, onAbrir, onNueva, cargando }) {
  const { getCliente, usuarios, openModal } = useVentas();

  const nombreUsuario = (id) => usuarios.find((u) => u.id === id)?.nombre || '—';
  const stop = (e) => e.stopPropagation();

  const filas = abiertas.map((v) => {
    const ultimo = ultimoArticulo(v, catalogo);
    const cliente = getCliente(v.clienteId);
    return (
      <tr key={v.id} className={s.clickable} onClick={() => onAbrir(v.id)}>
        <td className={s.mono}>#{v.id}</td>
        <td>
          <strong>{cliente?.nombre || `Cliente #${v.clienteId}`}</strong>
          {cliente && <div className={s.hint} style={{ margin: 0 }}>{CONDICIONES_IVA[cliente.condicionIva]?.corto}</div>}
        </td>
        <td>{CONDICIONES_PAGO[v.condicionPago] || v.condicionPago}</td>
        <td className={s.num}><strong>{money(v.total)}</strong></td>
        <td>
          {ultimo
            ? <>
              {ultimo.nombre}
              <div className={s.hint} style={{ margin: 0 }}>× {num(ultimo.cantidad)} {ultimo.unidad}</div>
            </>
            : <span className={s.muted}>Ticket vacío</span>}
        </td>
        <td>{nombreUsuario(v.usuarioId)}</td>
        <td>{fmtFechaHora(v.fecha)}</td>
        <td className={s['actions-col']}>
          <div className={s['row-actions']} onClick={stop}>
            <Btn variant="btn-primary" small onClick={() => onAbrir(v.id)}>Continuar</Btn>
            <Btn variant="btn-delete" small onClick={() => openModal('descartarVenta', { ventaId: v.id, etiqueta: cliente?.nombre })}>
              Descartar
            </Btn>
          </div>
        </td>
      </tr>
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <div className={s['panel-head']}>
        <div>
          <h2>Ventas en curso</h2>
          <div className={s.desc}>
            Tickets abiertos esperando al cliente. Clic en una fila para continuarla donde quedó.
            Cerrar la pestaña con <strong>×</strong> solo saca la ventana de la barra: la venta
            sigue acá. Para eliminarla de verdad, usá <strong>Descartar</strong>.
          </div>
        </div>
        <div className={s['panel-actions']}>
          <Btn variant="btn-primary" onClick={onNueva}>+ Nueva venta</Btn>
        </div>
      </div>

      <Table
        cols={[
          { h: '#' }, { h: 'Cliente' }, { h: 'Forma de pago' }, { h: 'Total', num: true },
          { h: 'Último producto' }, { h: 'Vendedor' }, { h: 'Abierta' },
          { h: 'Acciones', cls: 'actions-col' },
        ]}
        empty={cargando ? 'Cargando…' : 'No hay ventas abiertas. Empezá una nueva.'}
      >
        {filas}
      </Table>
    </div>
  );
}

/* ==================================================================== *
 * Panel
 * ==================================================================== */

export function PosPanel() {
  const {
    clientes, config, ctx, usuarios, sucursales, getCliente, openModal, closeModal, toast,
  } = useVentas();

  const [ticket, dispatch] = useReducer(ticketReducer, ticketInicial);
  const [activaId, setActivaId] = useState(null);      // null = tabla de ventas en curso
  const [clienteId, setClienteId] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [pestanaIds, setPestanaIds] = useState([]);
  const buscadorRef = useRef(null);
  const guardadoRef = useRef(null);

  const sucursalId = ctx.sucursalId;
  const esAdmin = usuarios.find((u) => u.id === ctx.usuarioId)?.rol === 'admin';
  const descuentoMax = Number(config.descuentoMaxVendedor) || 0;

  /* --------------------------- Datos del puesto --------------------------- */

  const { data: caja, loading: cargandoCaja, reload: recargarCaja } = useResource(
    `caja:${sucursalId}`,
    () => ventasApi.cajaActual(sucursalId),
    { enabled: !!sucursalId },
  );

  const consumidorFinal = useMemo(() => clientes.find((c) => c.esConsumidorFinal), [clientes]);
  const clienteActual = getCliente(clienteId) || consumidorFinal || null;
  const lista = clienteActual?.listaPrecio || config.listaPrecioDefault || '';

  // El catálogo se pide UNA vez por (sucursal, lista) y se busca en memoria.
  const { data: catalogo, loading: cargandoCatalogo, error: errorCatalogo, reload: recargarCatalogo } = useResource(
    `catalogo:${sucursalId}:${lista}`,
    () => ventasApi.catalogo(sucursalId, lista),
    { enabled: !!sucursalId },
  );

  const { data: abiertasRaw, loading: cargandoAbiertas, reload: recargarAbiertas } = useResource(
    `abiertas:${sucursalId}`,
    () => ventasApi.ventasAbiertas(sucursalId),
    { enabled: !!sucursalId },
  );
  const abiertas = useMemo(() => abiertasRaw ?? [], [abiertasRaw]);

  /* ------------------------------ Pestañas ------------------------------ */

  // Al cambiar de sucursal se recuperan las pestañas de ese puesto.
  useEffect(() => {
    if (sucursalId) setPestanaIds(leerPestanas(sucursalId));
  }, [sucursalId]);

  const abrirPestana = useCallback((id) => {
    setPestanaIds((ids) => {
      if (ids.includes(id)) return ids;
      const next = [...ids, id];
      guardarPestanas(sucursalId, next);
      return next;
    });
  }, [sucursalId]);

  const cerrarPestana = useCallback((id) => {
    setPestanaIds((ids) => {
      const next = ids.filter((x) => x !== id);
      guardarPestanas(sucursalId, next);
      return next;
    });
  }, [sucursalId]);

  /**
   * Solo se muestran las pestañas cuya venta sigue abierta: una que se cobró o
   * se descartó desaparece sola, sin dejar una pestaña rota.
   */
  const pestanas = useMemo(
    () => pestanaIds.map((id) => abiertas.find((v) => v.id === id)).filter(Boolean),
    [pestanaIds, abiertas],
  );

  const totales = useMemo(() => totalesTicket(ticket.renglones, ticket.extras), [ticket.renglones, ticket.extras]);
  const problemas = useMemo(
    () => problemasDelTicket(ticket.renglones, {
      permitirStockNegativo: !!config.permitirStockNegativo, descuentoMax, esAdmin,
    }),
    [ticket.renglones, config.permitirStockNegativo, descuentoMax, esAdmin],
  );

  const cajaAbierta = caja?.estado === 'abierta';
  const requiereCaja = !!config.cajaObligatoria;
  const puedeCobrar = !!activaId && ticket.renglones.length > 0 && problemas.length === 0
    && (!requiereCaja || cajaAbierta);

  const enfocarBuscador = useCallback(() => {
    // Se difiere un tick: el modal de MUI devuelve el foco al cerrarse.
    setTimeout(() => buscadorRef.current?.focus(), 60);
  }, []);

  /* ---------------------- Persistencia del borrador ---------------------- */

  /**
   * El ticket abierto se guarda en el servidor con un pequeño retardo: así
   * sobrevive a un refresh o a que se cierre el navegador, sin mandar una
   * petición por tecla. Al cambiar de pestaña se fuerza el guardado.
   */
  const guardarAhora = useCallback(async (id, estado, cliente) => {
    if (!id) return;
    setGuardando(true);
    try {
      await ventasApi.guardarVenta(id, {
        clienteId: cliente?.id,
        listaPrecio: cliente?.listaPrecio || undefined,
        items: itemsParaApi(estado.renglones),
        extras: extrasParaApi(estado.extras),
      });
      recargarAbiertas();
    } catch (e) {
      toast(e?.data?.message || 'No se pudo guardar la venta abierta.', 'err');
    } finally {
      setGuardando(false);
    }
  }, [recargarAbiertas, toast]);

  useEffect(() => {
    if (!activaId) return undefined;
    clearTimeout(guardadoRef.current);
    guardadoRef.current = setTimeout(() => guardarAhora(activaId, ticket, clienteActual), AUTOGUARDADO_MS);
    return () => clearTimeout(guardadoRef.current);
    // `clienteActual` se sigue por id para no reguardar en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activaId, ticket, clienteActual?.id, guardarAhora]);

  /* ------------------------------ Navegación ------------------------------ */

  const irALista = useCallback(async () => {
    clearTimeout(guardadoRef.current);
    if (activaId) await guardarAhora(activaId, ticket, clienteActual);
    setActivaId(null);
    dispatch({ tipo: 'limpiar' });
    setClienteId(null);
  }, [activaId, ticket, clienteActual, guardarAhora]);

  const abrirVenta = useCallback(async (id) => {
    clearTimeout(guardadoRef.current);
    if (activaId && activaId !== id) await guardarAhora(activaId, ticket, clienteActual);
    try {
      const borrador = await ventasApi.venta(id);
      const cargado = ticketDesdeBorrador(borrador, catalogo ?? []);
      dispatch({ tipo: 'cargar', ...cargado });
      setClienteId(borrador.clienteId);
      setActivaId(id);
      abrirPestana(id);
      enfocarBuscador();
    } catch (e) {
      toast(e?.data?.message || 'No se pudo abrir la venta.', 'err');
    }
  }, [activaId, ticket, clienteActual, catalogo, guardarAhora, abrirPestana, enfocarBuscador, toast]);

  const nuevaVenta = useCallback(async () => {
    clearTimeout(guardadoRef.current);
    if (activaId) await guardarAhora(activaId, ticket, clienteActual);
    try {
      const borrador = await ventasApi.abrirVenta({
        clienteId: consumidorFinal?.id,
        sucursalId,
        usuarioId: ctx.usuarioId ?? undefined,
        items: [],
      });
      dispatch({ tipo: 'limpiar' });
      setClienteId(borrador.clienteId);
      setActivaId(borrador.id);
      abrirPestana(borrador.id);
      recargarAbiertas();
      enfocarBuscador();
    } catch (e) {
      toast(e?.data?.message || 'No se pudo abrir una venta nueva.', 'err');
    }
  }, [activaId, ticket, clienteActual, consumidorFinal, sucursalId, ctx.usuarioId, guardarAhora, abrirPestana, recargarAbiertas, enfocarBuscador, toast]);

  /** Cierra la ventana sin tocar la venta: sigue en la tabla para retomarla. */
  const cerrarVentana = useCallback(async (id) => {
    if (activaId === id) {
      clearTimeout(guardadoRef.current);
      await guardarAhora(id, ticket, clienteActual);
      setActivaId(null);
      dispatch({ tipo: 'limpiar' });
      setClienteId(null);
    }
    cerrarPestana(id);
  }, [activaId, ticket, clienteActual, guardarAhora, cerrarPestana]);

  /* ------------------------------ Acciones ------------------------------ */

  const agregar = useCallback((item, cantidad = 1) => {
    if (item.precio <= 0) {
      toast(`${item.nombre} no tiene precio cargado. Definilo en Compras › Productos.`, 'err');
      return;
    }
    dispatch({ tipo: 'agregar', item, cantidad, descuentoCliente: clienteActual?.descuento || 0 });
  }, [toast, clienteActual]);

  const trasCobrar = useCallback((idCobrado) => {
    setActivaId(null);
    dispatch({ tipo: 'limpiar' });
    setClienteId(null);
    if (idCobrado) cerrarPestana(idCobrado);
    recargarCatalogo();   // el stock cambió con la venta
    recargarCaja();
    recargarAbiertas();
  }, [cerrarPestana, recargarCatalogo, recargarCaja, recargarAbiertas]);

  const cobrar = useCallback(() => {
    if (!puedeCobrar) {
      toast(problemas[0] || (!activaId ? 'Abrí una venta primero.' : 'No hay un turno de caja abierto.'), 'err');
      return;
    }
    // Se fuerza el guardado antes de cobrar: el backend confirma lo GUARDADO.
    clearTimeout(guardadoRef.current);
    guardarAhora(activaId, ticket, clienteActual).then(() => {
      openModal('cobro', {
        ventaId: activaId,
        renglones: ticket.renglones,
        totales,
        clienteId: clienteActual.id,
        cajaSesionId: caja?.id ?? null,
        onCobrado: (venta, vuelto) => {
          closeModal();
          openModal('ventaEmitida', {
            venta, vuelto, renglones: ticket.renglones,
            onNuevoTicket: () => trasCobrar(venta.id),
          });
        },
      });
    });
  }, [puedeCobrar, problemas, activaId, ticket, clienteActual, totales, caja, guardarAhora, openModal, closeModal, trasCobrar, toast]);

  const cambiarCliente = (id) => {
    const anterior = clienteActual?.descuento || 0;
    const nuevo = getCliente(id);
    setClienteId(id);
    dispatch({ tipo: 'descuentoCliente', anterior, valor: nuevo?.descuento || 0 });
    enfocarBuscador();
  };

  /* ------------------------------ Teclado ------------------------------ */

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'F2') { e.preventDefault(); cobrar(); }
      else if (e.key === 'F4') { e.preventDefault(); enfocarBuscador(); }
      else if (e.key === 'Insert') {
        e.preventDefault();
        if (!activaId) { toast('Abrí una venta para cargar productos.', 'err'); return; }
        openModal(e.shiftKey ? 'busquedaMasiva' : 'cargaRapida', {
          catalogo: catalogo ?? [], config, onAgregar: agregar,
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cobrar, enfocarBuscador, activaId, catalogo, config, agregar, openModal, toast]);

  /* ------------------------------ Render ------------------------------ */

  if (!sucursalId) {
    return <div className={cx(s.callout, s.warn)}>Elegí la sucursal en la barra de arriba para operar la caja.</div>;
  }

  const sucursal = sucursales.find((x) => x.id === sucursalId);
  const enLista = !activaId;

  return (
    <div>
      <PanelHead
        title="Punto de venta"
        desc={`${sucursal?.nombre || ''} · lista ${lista || '—'}. Ins carga un producto, Shift+Ins abre la búsqueda, F2 cobra.`}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {guardando && <span className={s.hint} style={{ margin: 0 }}>Guardando…</span>}
            <Btn onClick={recargarCatalogo} disabled={cargandoCatalogo}>
              {cargandoCatalogo ? 'Cargando…' : 'Actualizar precios'}
            </Btn>
          </div>
        }
      />

      {/* ---------------- Barra de caja ---------------- */}
      <div className={cx(p.cajaBar, !cajaAbierta && p.cajaBarCerrada)}>
        {cargandoCaja ? (
          <span className={s.muted}>Verificando el turno de caja…</span>
        ) : cajaAbierta ? (
          <>
            <div className={p.cajaDato}><span>Turno</span><strong>#{caja.id} abierto</strong></div>
            <div className={p.cajaDato}><span>Desde</span><strong>{fmtFechaHora(caja.apertura)}</strong></div>
            <div className={p.cajaDato}><span>Fondo inicial</span><strong>{money(caja.montoInicial)}</strong></div>
            <span className={p.spacer} />
            <Btn small onClick={() => openModal('movimientoCaja', { cajaSesionId: caja.id, onChange: recargarCaja })}>
              Ingreso / egreso
            </Btn>
            <Btn variant="btn-delete" small onClick={() => openModal('cerrarCaja', { cajaSesionId: caja.id, onChange: recargarCaja })}>
              Cerrar caja
            </Btn>
          </>
        ) : (
          <>
            <div className={p.cajaDato}><span>Caja</span><strong>Sin turno abierto</strong></div>
            <span className={s.hint} style={{ margin: 0 }}>
              {requiereCaja
                ? 'La configuración exige un turno abierto para vender al contado.'
                : 'La caja no es obligatoria, pero sin turno no vas a poder arquear.'}
            </span>
            <span className={p.spacer} />
            <Btn variant="btn-primary" small onClick={() => openModal('abrirCaja', { onChange: recargarCaja })}>
              Abrir caja
            </Btn>
          </>
        )}
      </div>

      {/* ---------------- Pestañas ---------------- */}
      <div className={p.tabs} role="tablist" aria-label="Ventas abiertas">
        <button
          type="button"
          role="tab"
          aria-selected={enLista}
          className={cx(p.tab, enLista && p.tabActiva)}
          onClick={irALista}
        >
          <span className={p.tabNombre}>Ventas en curso</span>
          {abiertas.length > 0 && <span className={p.tabBadge}>{abiertas.length}</span>}
        </button>

        {pestanas.map((v) => {
          const cli = getCliente(v.clienteId);
          const activa = v.id === activaId;
          return (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={activa}
              className={cx(p.tab, activa && p.tabActiva)}
              onClick={() => (activa ? null : abrirVenta(v.id))}
            >
              <span className={p.tabNombre}>{cli?.nombre || `Venta #${v.id}`}</span>
              <span className={p.tabTotal}>{money(activa ? totales.total : v.total)}</span>
              <span
                className={p.tabCerrar}
                role="button"
                tabIndex={-1}
                aria-label="Cerrar la ventana (la venta queda abierta)"
                title="Cerrar la ventana — la venta queda en curso"
                onClick={(e) => { e.stopPropagation(); cerrarVentana(v.id); }}
              >
                ×
              </span>
            </button>
          );
        })}

        <button type="button" className={cx(p.tab, p.tabNueva)} onClick={nuevaVenta}>+ Nueva venta</button>
      </div>

      {errorCatalogo && (
        <div className={cx(s.callout, s.warn)}>No se pudo cargar el catálogo: <strong>{errorCatalogo}</strong></div>
      )}

      {/* ---------------- Contenido ---------------- */}
      {enLista ? (
        <VentasAbiertas
          abiertas={abiertas}
          catalogo={catalogo ?? []}
          onAbrir={abrirVenta}
          onNueva={nuevaVenta}
          cargando={cargandoAbiertas}
        />
      ) : (
        <div className={p.pos}>
          {/* ---------------- Columna izquierda ---------------- */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-3)' }}>
            <Buscador catalogo={catalogo ?? []} config={config} onElegir={agregar} inputRef={buscadorRef} />

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Btn small onClick={() => openModal('cargaRapida', { catalogo: catalogo ?? [], config, onAgregar: agregar })}>
                Cargar producto (Ins)
              </Btn>
              <Btn small onClick={() => openModal('busquedaMasiva', { catalogo: catalogo ?? [], onAgregar: agregar })}>
                Búsqueda de productos (Shift+Ins)
              </Btn>
              <Btn small onClick={() => openModal('cargaExtra', { onAgregar: (x) => dispatch({ tipo: 'extraAgregar', ...x }) })}>
                Cargo extra
              </Btn>
              <span className={p.spacer} />
              <Btn small onClick={() => openModal('delegarVenta', { ventaId: activaId, actualId: ctx.usuarioId, onChange: recargarAbiertas })}>
                Delegar
              </Btn>
              <Btn variant="btn-delete" small onClick={() => dispatch({ tipo: 'limpiar' })} disabled={!ticket.renglones.length && !ticket.extras.length}>
                Vaciar
              </Btn>
            </div>

            <Ticket
              renglones={ticket.renglones}
              dispatch={dispatch}
              permitirStockNegativo={!!config.permitirStockNegativo}
              descuentoMax={descuentoMax}
              esAdmin={esAdmin}
            />
          </div>

          {/* ---------------- Columna derecha ---------------- */}
          <div className={p.lateral}>
            <div className={p.bloque}>
              <div className={p.bloqueTitulo}>Cliente</div>
              <select
                className={s['select-inline']}
                style={{ width: '100%' }}
                value={clienteActual?.id ?? ''}
                onChange={(e) => cambiarCliente(Number(e.target.value))}
              >
                {clientes.filter((c) => c.activo).map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
              <div className={s.hint} style={{ margin: '8px 0 0' }}>
                {CONDICIONES_IVA[clienteActual?.condicionIva]?.label || '—'}
                {clienteActual?.descuento > 0 && ` · ${clienteActual.descuento}% de descuento`}
                {clienteActual?.ctaCteHabilitada && ' · cuenta corriente'}
              </div>
            </div>

            {ticket.extras.length > 0 && (
              <div className={p.bloque}>
                <div className={p.bloqueTitulo}>Cargos extra</div>
                {ticket.extras.map((e) => (
                  <div key={e.uid} className={p.extraFila}>
                    <span>{e.concepto} <span className={s.muted}>({e.iva}%)</span></span>
                    <span>
                      <strong>{money(e.importe)}</strong>
                      <button
                        type="button"
                        className={p.quitar}
                        aria-label={`Quitar ${e.concepto}`}
                        onClick={() => dispatch({ tipo: 'extraQuitar', uid: e.uid })}
                      >
                        ×
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className={p.bloque}>
              <div className={p.bloqueTitulo}>Ticket</div>
              <div className={p.linea}><span>Artículos</span><strong>{totales.renglones}</strong></div>
              <div className={p.linea}><span>Unidades</span><strong>{num(totales.unidades)}</strong></div>
              <div className={p.linea}><span>Neto</span><strong>{money(totales.neto)}</strong></div>
              {totales.descuento > 0 && (
                <div className={p.linea}>
                  <span>Descuentos</span>
                  <strong style={{ color: 'var(--crm-color-success)' }}>−{money(totales.descuento)}</strong>
                </div>
              )}
              {totales.extras > 0 && (
                <div className={p.linea}><span>Cargos extra</span><strong>{money(totales.extras)}</strong></div>
              )}
              <div className={p.linea}><span>IVA</span><strong>{money(totales.iva)}</strong></div>

              <div className={p.totalCaja}>
                <div className={p.totalLabel}>Total</div>
                <div className={p.totalValor}>{money(totales.total)}</div>
              </div>

              <button type="button" className={p.cobrar} onClick={cobrar} disabled={!puedeCobrar}>
                Cobrar · F2
              </button>

              <div className={p.atajos}>
                <span className={p.tecla}><kbd>Ins</kbd> cargar</span>
                <span className={p.tecla}><kbd>⇧Ins</kbd> buscar</span>
                <span className={p.tecla}><kbd>F2</kbd> cobrar</span>
                <span className={p.tecla}><kbd>F4</kbd> foco</span>
              </div>
            </div>

            {problemas.length > 0 && (
              <div className={cx(s.callout, s.warn)}>
                {problemas.map((m, i) => <div key={i}>{m}</div>)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
