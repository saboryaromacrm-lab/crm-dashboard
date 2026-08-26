import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useVentas } from '../context/VentasContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { ventasApi } from '../services/ventas.api.js';
import { CONDICIONES_IVA, CONDICIONES_PAGO, MEDIOS_PAGO, ORIGEN_LISTA } from '../domain/constants.js';
import {
  buscarEnCatalogo, calcularRenglon, descuentosDisponibles, descuentosParaApi,
  extrasParaApi, itemsParaApi, parseEtiquetaBalanza,
  problemasDelTicket, r2, ticketDesdeBorrador, ticketInicial, ticketReducer,
  totalesTicket, ultimoArticulo,
} from '../domain/pos.js';
import { indicePrecios, sugerenciaPorMonto } from '../domain/listas.js';
import { sugerenciasOfertaTicket } from '../domain/ofertas.js';
import { Table, PanelHead, Btn, ModalShell, money, num, fmtFechaHora, s } from '../components/ui.jsx';
import { imprimirVenta } from '@core/services/imprimir.js';
import { EVENTO_PRECIOS, cambiosPrecio } from '@core/services/cambiosPrecio.js';
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
 * Elegir cliente
 * ==================================================================== */

const normCliente = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

/**
 * El selector de cliente es un MODAL con buscador y lista clickeable (26/8,
 * pedido del dueño): el `<select>` nativo con el padrón entero adentro no
 * dejaba buscar por fantasía ni por documento, y con la lista creciendo se
 * volvía inmanejable. El default no cambia: sin elegir nada, la venta es de
 * Consumidor Final — que va SIEMPRE primero en la lista.
 */
function ElegirClienteModal({ clientes, actualId, onElegir, onCerrar }) {
  const [busca, setBusca] = useState('');

  /* Mientras el modal está abierto, las teclas del POS no pueden llegar al
   * listener global (F2 cobraría la venta con este modal adelante). Captura +
   * stopImmediatePropagation: se ejecuta antes que el listener de burbuja del
   * POS y lo apaga del todo. Esc acá adentro cierra ESTE modal. */
  useEffect(() => {
    const parar = (e) => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); onCerrar(); }
      else if (e.key === 'F2' || e.key === 'F4' || e.key === 'Insert') {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', parar, true);
    return () => window.removeEventListener('keydown', parar, true);
  }, [onCerrar]);

  const activos = useMemo(() => {
    const lista = clientes.filter((c) => c.activo);
    return [
      ...lista.filter((c) => c.esConsumidorFinal),
      ...lista.filter((c) => !c.esConsumidorFinal).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    ];
  }, [clientes]);

  const q = normCliente(busca.trim());
  const filtrados = q
    ? activos.filter((c) => normCliente(`${c.nombre} ${c.nombreFantasia || ''} ${c.numeroDoc || ''}`).includes(q))
    : activos;

  const elegir = (c) => { onElegir(c.id); onCerrar(); };

  return (
    <ModalShell
      title="Elegir cliente"
      onClose={onCerrar}
      footer={[{ texto: 'Cancelar', clase: 'btn-ghost', onClick: onCerrar }]}
    >
      <div className={s.field}>
        <input
          autoFocus
          placeholder="Escribí el nombre, la fantasía o el documento…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && filtrados.length) { e.preventDefault(); elegir(filtrados[0]); }
          }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 380, overflowY: 'auto' }}>
        {filtrados.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => elegir(c)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2,
              padding: '8px 12px', textAlign: 'left', cursor: 'pointer', width: '100%',
              border: '1px solid var(--crm-color-border)', borderRadius: 'var(--crm-radius-sm)',
              background: c.id === actualId
                ? 'color-mix(in srgb, var(--crm-color-primary, #166534) 10%, transparent)'
                : 'transparent',
            }}
          >
            <span style={{ fontWeight: 600 }}>
              {c.nombre}
              {c.nombreFantasia && <span className={s.muted} style={{ fontWeight: 400 }}> · {c.nombreFantasia}</span>}
            </span>
            <span className={s.hint} style={{ margin: 0 }}>
              {[
                c.numeroDoc || null,
                CONDICIONES_IVA[c.condicionIva]?.corto || null,
                c.ctaCteHabilitada ? 'cta. cte.' : null,
                c.descuento > 0 ? `${c.descuento}% desc.` : null,
              ].filter(Boolean).join(' · ') || '—'}
            </span>
          </button>
        ))}
        {!filtrados.length && (
          <div className={s['empty-state']}>Ningún cliente coincide con “{busca}”.</div>
        )}
      </div>

      <div className={s.hint} style={{ margin: '10px 0 0' }}>
        Enter elige el primero de la lista. Sin cliente elegido, la venta es de <strong>Consumidor Final</strong>.
      </div>
    </ModalShell>
  );
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
    // El escaneo de una CAJA trae sus unidades: cargarla es cargar las N.
    onElegir(item, cantidad ?? item._escaneoUnidades ?? 1);
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
    // Esc escalonado: con texto, limpia la búsqueda (y NO burbujea); vacío,
    // deja subir el evento y la registradora vuelve a la lista de ventas.
    else if (e.key === 'Escape' && q) { e.stopPropagation(); setQ(''); setActivo(0); }
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
                {/* El FINAL con IVA: acá se le contesta el precio al cliente.
                    El neto es la moneda del renglón, no la del mostrador. */}
                {item.precioFinal > 0 ? money(item.precioFinal) : <span className={p.sinStock}>sin precio</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ==================================================================== *
 * Descuentos con nombre (debajo del total)
 * ==================================================================== */

/**
 * El desplegable muestra el catálogo ENTERO, con los que no sirven en gris y su
 * motivo escrito. Esconderlos sería más prolijo y peor: la cajera que no
 * encuentra "Empleados" no sabe si no existe, si venció o si le falta permiso,
 * y termina llamando al encargado sin poder decirle qué pasa.
 *
 * Lo aplicado sale del desplegable y queda como chip a la vista: mientras cobra
 * es lo único de acá que necesita ver.
 */
function DescuentosConNombre({ opciones, puestos, onAlternar, habilitado }) {
  const [abierto, setAbierto] = useState(false);
  // Sin descuentos cargados no hay nada que ofrecer: la fila no aparece.
  if (!opciones.length) return null;

  return (
    <div>
      {puestos.map((d) => (
        <div key={d.id} className={p.descChip}>
          <span>
            <strong>{d.nombre}</strong> −{d.porcentaje}% · {d.lista}
            {/* Sin `toLowerCase`: el motivo lleva adentro el nombre de la lista
                y bajarle las mayúsculas la volvía otra cosa que la del combo. */}
            {d.motivo && <span className={p.descMotivo}>{d.motivo} — ya no descuenta</span>}
          </span>
          <button
            type="button"
            className={p.descChipQuitar}
            aria-label={`Quitar el descuento ${d.nombre}`}
            onClick={() => onAlternar(d)}
          >
            ×
          </button>
        </div>
      ))}

      <button
        type="button"
        className={p.descBoton}
        disabled={!habilitado}
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
      >
        {abierto ? 'Cerrar' : 'Aplicar descuento'}
      </button>

      {abierto && (
        <div className={p.descLista}>
          {opciones.map((d) => (
            <button
              key={d.id}
              type="button"
              className={cx(p.descItem, d.puesto && p.descItemPuesto)}
              disabled={!d.aplicable}
              onClick={() => { onAlternar(d); setAbierto(false); }}
            >
              <span>
                {d.puesto ? '✓ ' : ''}<strong>{d.nombre}</strong> −{d.porcentaje}%
              </span>
              <span className={p.descMotivo}>
                {d.motivo || `Sobre ${d.lista}${d.medioPago ? ` · solo con ${MEDIOS_PAGO[d.medioPago] || d.medioPago}` : ''}`}
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

function Ticket({ renglones, dispatch, permitirStockNegativo, descuentoMax, puedePisarPrecio, preciosDe, ultimoKey, listasPorId, overrideBloqueado }) {
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
            <th>Lista</th>
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
            /*
             * El tope se mide contra la BASE, no contra el descuento visible.
             * Un renglón bajo "Atención por tardanza 25%" muestra 25 y no está
             * excedido: ese porcentaje lo autorizó el dueño al crear el
             * descuento. Comparar el visible pintaría de rojo —y le avisaría al
             * cajero que hace falta un permiso— justo el caso que el descuento
             * con nombre existe para permitir. El servidor mide igual.
             */
            const descExcedido = !puedePisarPrecio
              && (Number(r.descuentoBase ?? r.descuento) || 0) > descuentoMax + 1e-9;
            return (
              <tr key={r.uid} className={cx(r.key === ultimoKey && p.filaUltima)}>
                <td>
                  <div className={p.nombreCol}>{r.nombre}</div>
                  <div className={p.detalleCol}>
                    {r.detalle}
                    {sinStock && <span className={p.sinStock}> · solo hay {num(r.stock)} {r.unidad}</span>}
                  </div>
                  {/* La oferta se muestra donde está el producto, con nombre e
                      importe: el cajero contesta "por qué dio ese número" sin
                      hacer cuentas. */}
                  {r.ofertaDescuento > 0 && (
                    <div className={p.ofertaBadge} title={r.ofertaDetalle || r.oferta}>
                      {r.oferta} · −{money(r.ofertaDescuento)}
                    </div>
                  )}
                  {/* Y el descuento con nombre, en el mismo lugar y por el
                      mismo motivo: el renglón dice de dónde salió su precio. */}
                  {r.descuentoId && (
                    <div className={p.ofertaBadge} title={`Descuento "${r.descuentoNombre}"`}>
                      {r.descuentoNombre} · −{r.descuento}%
                    </div>
                  )}
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
                {/*
                  Lista del renglón. Se muestra POR QUÉ la tiene (automática
                  por condición, del cliente, o elegida a mano): si el cliente
                  pregunta el precio, el cajero tiene que poder contestar.
                  El selector aparece solo si hay más de una opción y el rol
                  puede cambiarla.
                */}
                <td>
                  {(() => {
                    // Las opciones son el FORMATO DE VENTA del artículo: las
                    // listas que ese producto tiene cargadas. No las del
                    // catálogo entero — ofrecer una lista en la que no se vende
                    // sería ofrecer un precio que no existe.
                    const precios = preciosDe(r.key) ?? [];
                    const opciones = precios
                      .map((x) => ({ ...listasPorId.get(x.listaId), precio: x.precio }))
                      .filter((x) => x.listaId);
                    const motivo = ORIGEN_LISTA[r.listaOrigen];
                    const pie = (
                      <div className={p.detalleCol} title={motivo?.ayuda || ''}>
                        {motivo?.corto || ''}
                        {r.listaMotivo && <> · {r.listaMotivo}</>}
                      </div>
                    );
                    if (opciones.length <= 1 || overrideBloqueado) {
                      return (
                        <>
                          <div className={p.detalleCol} style={{ fontWeight: 600 }}>{r.lista || '—'}</div>
                          {pie}
                        </>
                      );
                    }
                    return (
                      <>
                        <select
                          className={p.selectMini}
                          value={r.listaId ?? ''}
                          aria-label={`Lista de precio de ${r.nombre}`}
                          onChange={(e) => {
                            const id = Number(e.target.value);
                            if (!id) { dispatch({ tipo: 'lista', uid: r.uid, manual: false }); return; }
                            const lista = opciones.find((l) => l.listaId === id);
                            if (lista) dispatch({ tipo: 'lista', uid: r.uid, lista, precio: lista.precio });
                          }}
                        >
                          {opciones.map((l) => (
                            <option key={l.listaId} value={l.listaId}>{l.etiqueta}</option>
                          ))}
                          {r.listaManual && <option value="">↺ Automática</option>}
                        </select>
                        {pie}
                      </>
                    );
                  })()}
                </td>
                <td className={p.num}>
                  {puedePisarPrecio ? (
                    <input
                      className={p.inputMini}
                      type="number" min="0" step="0.01"
                      value={r.precioUnitario}
                      onChange={(e) => dispatch({ tipo: 'precio', uid: r.uid, valor: e.target.value })}
                    />
                  ) : money(r.precioUnitario)}
                </td>
                {/*
                  Con un descuento CON NOMBRE ganando, el campo se vuelve texto.
                  Dejarlo editable mostrando 25 sería una trampa: lo que se
                  tipea encima es la base —el número de abajo—, así que escribir
                  30 sobre un 25 autorizado da un 30 que el servidor rebota por
                  el tope. Se saca el descuento y recién ahí se tipea.
                */}
                <td className={p.num}>
                  {r.descuentoId ? (
                    <span title={`Lo pone el descuento "${r.descuentoNombre}"`}>{r.descuento}%</span>
                  ) : (
                    <input
                      className={cx(p.inputMini, descExcedido && p.inputAlerta)}
                      style={{ width: 64 }}
                      type="number" min="0" max="100" step="0.5"
                      value={r.descuento}
                      onChange={(e) => dispatch({ tipo: 'descuento', uid: r.uid, valor: e.target.value })}
                    />
                  )}
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
    clientes, config, ctx, usuarios, sucursales, getCliente, openModal, closeModal, toast, modal,
    goPanel,
  } = useVentas();

  const [ticket, dispatch] = useReducer(ticketReducer, ticketInicial);
  const [activaId, setActivaId] = useState(null);      // null = tabla de ventas en curso
  const [clienteId, setClienteId] = useState(null);
  const [selectorCliente, setSelectorCliente] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [pestanaIds, setPestanaIds] = useState([]);
  /**
   * Último artículo cargado (clave + tick para re-disparar el destello). Es la
   * confirmación visual del escaneo: el cajero no mira la tabla, mira ese
   * renglón grande — como el visor de una registradora de supermercado.
   */
  const [ultimoKey, setUltimoKey] = useState(null);
  const [flashTick, setFlashTick] = useState(0);
  const buscadorRef = useRef(null);
  const guardadoRef = useRef(null);
  const ticketScrollRef = useRef(null);
  const prevLenRef = useRef(0);

  const sucursalId = ctx.sucursalId;
  const permisosActual = usuarios.find((u) => u.id === ctx.usuarioId)?.permisos ?? [];
  const puedePresupuestar = permisosActual.includes('*') || permisosActual.includes('presupuestos');
  /*
   * PISAR EL PRECIO es un PERMISO (`precio_manual`), no el rol.
   *
   * Antes esto era `rolClave === 'admin'`, y era la única barrera que existía:
   * `descuentoMaxVendedor` y `overrideListaRequiereAdmin` se evaluaban acá y en
   * ningún otro lado, así que un request armado a mano se los saltaba enteros.
   * Ahora la API valida lo mismo con esta misma clave — y tiene que ser LA MISMA,
   * porque si la pantalla habilita algo que el servidor rechaza, el cajero se
   * entera recién al cobrar.
   */
  const puedePisarPrecio = permisosActual.includes('*') || permisosActual.includes('precio_manual');
  const descuentoMax = Number(config.descuentoMaxVendedor) || 0;

  /* --------------------------- Datos del puesto --------------------------- */

  const { data: caja, loading: cargandoCaja, reload: recargarCaja } = useResource(
    `caja:${sucursalId}`,
    () => ventasApi.cajaActual(sucursalId),
    { enabled: !!sucursalId },
  );

  const consumidorFinal = useMemo(() => clientes.find((c) => c.esConsumidorFinal), [clientes]);
  const clienteActual = getCliente(clienteId) || consumidorFinal || null;

  /**
   * El catálogo se pide UNA vez por sucursal y trae el precio en TODAS las
   * listas disponibles: cambiar de cliente o cruzar un umbral se resuelve en
   * memoria, sin volver a la red.
   */
  const { data: catalogoRaw, loading: cargandoCatalogo, error: errorCatalogo, reload: recargarCatalogo } = useResource(
    `catalogo:${sucursalId}`,
    () => ventasApi.catalogo(sucursalId),
    { enabled: !!sucursalId },
  );
  const catalogo = useMemo(() => catalogoRaw?.items ?? [], [catalogoRaw]);
  const listasCatalogo = useMemo(() => catalogoRaw?.listas ?? [], [catalogoRaw]);

  /**
   * "Actualizar precios" del aviso global (`PreciosAlert`) recarga el catálogo
   * de acá. Los renglones ya cargados NO se re-precian: cada uno guarda el
   * precio con el que entró al ticket, y cambiarlo por atrás sería cobrarle al
   * cliente otro número del que se le dijo. Los precios nuevos rigen para lo
   * que se agregue de ahora en más.
   */
  /**
   * DESCUENTOS CON NOMBRE. Endpoint propio y no parte del bootstrap: los edita
   * el dueño en Configuración y la caja los necesita frescos.
   *
   * Se piden UNA vez y no en cada tecla, y alcanza: lo que caduca no es la
   * lista sino la vigencia de cada uno, y eso se decide comparando su fecha
   * contra el reloj que entra con el contexto — así, el que vence al mediodía
   * se apaga solo en el desplegable, sin volver a la red. Lo que sí necesita
   * recarga es un descuento NUEVO, y para eso está el mismo botón que ya
   * refresca los precios.
   */
  const { data: descuentosRaw, reload: recargarDescuentos } = useResource(
    'descuentos-pos',
    () => ventasApi.descuentos(),
  );
  const catalogoDescuentos = useMemo(() => descuentosRaw ?? [], [descuentosRaw]);

  useEffect(() => {
    const alRecargar = () => { recargarCatalogo(); recargarDescuentos(); };
    window.addEventListener(EVENTO_PRECIOS, alRecargar);
    return () => window.removeEventListener(EVENTO_PRECIOS, alRecargar);
  }, [recargarCatalogo, recargarDescuentos]);

  /** Recarga el catálogo y da por visto el aviso de cambio de precios. */
  const actualizarPrecios = useCallback(() => {
    recargarCatalogo();
    cambiosPrecio.marcarVisto();
  }, [recargarCatalogo]);

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

  /* ---------------------------- Listas de precio ---------------------------- */

  /**
   * Índice clave → formato de venta del artículo `[{listaId, precio,
   * unidadesMinimas}]`, armado UNA vez por catálogo.
   */
  const idxPrecios = useMemo(() => indicePrecios(catalogo), [catalogo]);
  const preciosDe = useCallback((key) => idxPrecios.get(key), [idxPrecios]);

  /** Identidad de cada lista, para etiquetar sin recorrer el catálogo. */
  const listasPorId = useMemo(
    () => new Map((catalogoRaw?.listas ?? []).map((l) => [l.listaId, l])),
    [catalogoRaw],
  );

  /**
   * El contexto de cotización vive en el reducer para que reasignar listas sea
   * síncrono y sin efectos. Se re-inyecta cuando cambia el catálogo o el
   * cliente, y eso recotiza todo lo que no esté fijado a mano.
   */
  useEffect(() => {
    dispatch({
      tipo: 'contexto',
      // `ahora` entra con el contexto para que el reducer siga puro. Alcanza:
      // cada carga de producto lo refresca, y una promo que vence a las 20:00
      // no necesita más precisión que la próxima tecla.
      ctx: {
        catalogo: catalogoRaw, cliente: clienteActual, precios: idxPrecios,
        sucursalId, ahora: new Date(), descuentos: catalogoDescuentos,
      },
    });
  }, [catalogoRaw, clienteActual, idxPrecios, sucursalId, catalogoDescuentos]);

  /**
   * Ofertas de ticket que el total habilita. Misma regla que el monto: se
   * sugieren, nunca se aplican solas.
   */
  const sugerenciasOferta = useMemo(
    () => sugerenciasOfertaTicket(
      catalogoRaw?.ofertas ?? [], ticket.renglones, totales.total,
      { ahora: new Date(), sucursalId }, ticket.ofertaTicket,
    ),
    [catalogoRaw, ticket.renglones, totales.total, sucursalId, ticket.ofertaTicket],
  );

  const aplicarOfertaTicket = useCallback((ofertaId) => {
    dispatch({ tipo: 'ofertaTicket', ofertaId });
    toast(ofertaId ? 'Oferta aplicada al ticket.' : 'Se retiró la oferta del ticket.', 'ok');
  }, [toast]);

  /**
   * DESCUENTOS CON NOMBRE: cuáles sirven para ESTE ticket y por qué los otros
   * no. Se recalcula con los renglones porque el conjunto cambia solo — cargar
   * un producto de Mayorista 1 habilita el descuento de Mayorista 1, y sacarlo
   * lo vuelve a apagar.
   */
  const descuentosDelTicket = useMemo(
    () => descuentosDisponibles(ticket, { esAdmin: puedePisarPrecio }),
    [ticket, puedePisarPrecio],
  );
  const descuentosPuestos = useMemo(
    () => descuentosDelTicket.filter((d) => d.puesto),
    [descuentosDelTicket],
  );

  /**
   * Aplicar o quitar. Se manda la lista ENTERA de ids y no un "toggle" en el
   * reducer: así el estado del ticket es lo único que decide, y sacar el
   * descuento devuelve cada renglón a su base sin que nadie recuerde cuál era.
   */
  const alternarDescuento = useCallback((d) => {
    const puestos = ticket.descuentos ?? [];
    const sacando = puestos.includes(d.id);
    // Uno por lista: aplicar uno desplaza al de su misma lista, si lo hubiera.
    const ids = sacando
      ? puestos.filter((x) => x !== d.id)
      : [...puestos.filter((x) => {
        const otro = catalogoDescuentos.find((c) => c.id === x);
        return !otro || otro.listaId !== d.listaId;
      }), d.id];
    dispatch({ tipo: 'descuentos', ids });
    toast(sacando ? `Se quitó "${d.nombre}".` : `${d.nombre}: ${d.porcentaje}% aplicado.`, 'ok');
  }, [ticket.descuentos, catalogoDescuentos, toast]);

  /**
   * La sugerencia por MONTO: lo único que se ofrece en vez de aplicarse solo.
   * Como el beneficio baja el total, auto-aplicarlo podría dejar el ticket por
   * debajo del umbral y revertirse en un ciclo. Las puertas por cantidad no
   * tienen ese problema y ya se aplicaron solas.
   */
  const sugerencia = useMemo(
    () => sugerenciaPorMonto(ticket.renglones, totales.total, catalogoRaw, preciosDe, !!ticket.montoAplicado),
    [ticket.renglones, ticket.montoAplicado, totales.total, catalogoRaw, preciosDe],
  );

  /** Desbloquea (o retira) la modalidad por monto. El motor reasigna el resto. */
  const aplicarMonto = useCallback((modalidadId) => {
    dispatch({ tipo: 'monto', modalidadId });
    toast(modalidadId ? 'Precio por monto de compra aplicado.' : 'Se retiró el precio por monto.', 'ok');
  }, [toast]);

  /** Modalidades del catálogo, para la aplicación masiva a mano. */
  const modalidades = useMemo(() => {
    const vistas = new Map();
    for (const l of catalogoRaw?.listas ?? []) {
      if (!vistas.has(l.modalidadId)) vistas.set(l.modalidadId, { id: l.modalidadId, nombre: l.modalidad });
    }
    return [...vistas.values()];
  }, [catalogoRaw]);

  /**
   * Aplica una modalidad a todo el ticket. Avisa cuántos quedaron afuera: un
   * producto sin lista en esa modalidad conserva su precio, y el cajero tiene
   * que enterarse antes de que lo pregunte el cliente.
   */
  const aplicarModalidadATodo = useCallback((valor) => {
    if (!valor) return;
    if (valor === 'auto') {
      dispatch({ tipo: 'modalidadTodos', modalidadId: null, listasPorId, preciosDe });
      toast('Los renglones volvieron al precio automático.', 'ok');
      return;
    }
    const modalidadId = Number(valor);
    const alcanza = ticket.renglones.filter(
      (r) => (preciosDe(r.key) ?? []).some((x) => listasPorId.get(x.listaId)?.modalidadId === modalidadId),
    ).length;
    if (!alcanza) {
      toast('Ningún artículo del ticket tiene una lista de esa modalidad.', 'err');
      return;
    }
    dispatch({ tipo: 'modalidadTodos', modalidadId, listasPorId, preciosDe });
    const afuera = ticket.renglones.length - alcanza;
    toast(
      afuera
        ? `Aplicada a ${alcanza} artículo(s). ${afuera} sin lista de esa modalidad, quedaron como estaban.`
        : `Aplicada a ${alcanza} artículo(s).`,
      'ok',
    );
  }, [ticket.renglones, listasPorId, preciosDe, toast]);
  const problemas = useMemo(
    () => problemasDelTicket(ticket.renglones, {
      permitirStockNegativo: !!config.permitirStockNegativo, descuentoMax, puedePisarPrecio,
    }),
    [ticket.renglones, config.permitirStockNegativo, descuentoMax, puedePisarPrecio],
  );

  /**
   * Cambiar la lista a mano esquiva el tope de descuento (pasar a mayorista
   * puede ser −40% sin registrarse como descuento). El automático por condición
   * no se toca: es una regla, no una decisión.
   */
  const overrideBloqueado = !!config.overrideListaRequiereAdmin && !puedePisarPrecio;

  const cajaAbierta = caja?.estado === 'abierta';
  const requiereCaja = !!config.cajaObligatoria;
  const puedeCobrar = !!activaId && ticket.renglones.length > 0 && problemas.length === 0
    && (!requiereCaja || cajaAbierta);

  const enfocarBuscador = useCallback(() => {
    // Se difiere un tick: el modal de MUI devuelve el foco al cerrarse.
    setTimeout(() => buscadorRef.current?.focus(), 60);
  }, []);

  /**
   * Con una venta abierta, la registradora tapa toda la pantalla (position:
   * fixed): se bloquea el scroll del documento para que no quede una página
   * "viva" scrolleando por detrás.
   */
  useEffect(() => {
    if (!activaId) return undefined;
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previo; };
  }, [activaId]);

  // Un artículo NUEVO baja el ticket hasta el final (ahí aparece); editar uno
  // existente no mueve nada — saltarle el scroll al cajero es perder el foco.
  useEffect(() => {
    const el = ticketScrollRef.current;
    if (el && ticket.renglones.length > prevLenRef.current) el.scrollTop = el.scrollHeight;
    prevLenRef.current = ticket.renglones.length;
  }, [ticket.renglones.length]);

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
        items: itemsParaApi(estado.renglones),
        extras: extrasParaApi(estado.extras),
        /* Los descuentos con nombre van EN CADA GUARDADO, no solo al cobrar:
         * el borrador tiene que volver igual a como quedó. Son ids —el
         * porcentaje lo pone el servidor— y se filtran los que ya no tienen
         * efecto, que el servidor rechaza (ver `descuentosParaApi`). */
        descuentos: descuentosParaApi(estado),
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
      setUltimoKey(null);
      setFlashTick(0);
      abrirPestana(id);
      enfocarBuscador();
    } catch (e) {
      toast(e?.data?.message || 'No se pudo abrir la venta.', 'err');
    }
  }, [activaId, ticket, clienteActual, catalogo, guardarAhora, abrirPestana, enfocarBuscador, toast]);

  /**
   * Abre un borrador nuevo y deja la registradora lista para tipear. NO guarda
   * nada de lo anterior: eso es responsabilidad de quien llama.
   *
   * Está separado de `nuevaVenta` por el caso de después de cobrar. Ahí no hay
   * nada que guardar —la venta se confirmó recién— y encima `activaId` todavía
   * apunta a ella, porque `setActivaId(null)` no se aplica hasta el próximo
   * render. Llamar a `nuevaVenta` desde ese punto intentaría re-guardar una
   * venta ya cerrada.
   */
  const abrirBorradorNuevo = useCallback(async () => {
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
      setUltimoKey(null);
      setFlashTick(0);
      abrirPestana(borrador.id);
      recargarAbiertas();
      enfocarBuscador();
    } catch (e) {
      toast(e?.data?.message || 'No se pudo abrir una venta nueva.', 'err');
    }
  }, [consumidorFinal, sucursalId, ctx.usuarioId, abrirPestana, recargarAbiertas, enfocarBuscador, toast]);

  const nuevaVenta = useCallback(async () => {
    clearTimeout(guardadoRef.current);
    if (activaId) await guardarAhora(activaId, ticket, clienteActual);
    await abrirBorradorNuevo();
  }, [activaId, ticket, clienteActual, guardarAhora, abrirBorradorNuevo]);

  /**
   * Guarda el ticket actual como PRESUPUESTO (pedido mayorista): el mismo
   * motor que cotiza en caja congela renglones y precios en un PR000N, y la
   * venta en curso se descarta — era una cotización, no una venta.
   */
  const guardarPresupuesto = useCallback(async () => {
    if (!activaId || !ticket.renglones.length) { toast('El ticket está vacío.', 'err'); return; }
    if (!clienteActual || clienteActual.esConsumidorFinal) {
      toast('Elegí el CLIENTE del presupuesto (Consumidor Final no lleva presupuesto).', 'err');
      return;
    }
    try {
      const items = ticket.renglones.map((r) => ({
        productoId: r.productoId, presentacionId: r.presentacionId ?? null,
        nombre: r.nombre, detalle: r.detalle,
        cantidad: r.cantidad, precioLista: r.precioLista, descuento: r.descuento || 0,
        iva: r.iva, lista: r.lista || '',
        /* La lista por ID además del nombre: es lo que después deja demostrar que
         * el precio cotizado era el de esa lista y no uno puesto a mano. Sin
         * esto, cerrar el pedido en el POS chocaba con el portero de precios. */
        listaId: r.listaId ?? null,
        ofertaNombre: r.oferta || '',
      }));
      const res = await ventasApi.crearPresupuesto({
        clienteId: clienteActual.id, sucursalId,
        usuarioId: ctx.usuarioId ?? undefined,
        items,
      });
      // La venta en curso fue solo el lienzo de la cotización.
      await ventasApi.descartarVenta(activaId);
      cerrarPestana(activaId);
      setActivaId(null);
      dispatch({ tipo: 'limpiar' });
      setClienteId(null);
      recargarAbiertas();
      toast(`Presupuesto ${res.codigo} guardado (borrador). Se envía desde Ventas › Presupuestos.`, 'ok');
    } catch (e) {
      toast(e?.data?.message || 'No se pudo guardar el presupuesto.', 'err');
    }
  }, [activaId, ticket, clienteActual, sucursalId, ctx.usuarioId, cerrarPestana, recargarAbiertas, toast]);

  /** Reimprime el último ticket cobrado en este puesto (formato de Sistema › Impresión). */
  const reimprimirTicket = useCallback(async () => {
    const id = Number(localStorage.getItem('crm_ultimo_ticket'));
    if (!id) { toast('Todavía no hay un ticket cobrado en este puesto.', 'err'); return; }
    try {
      const venta = await ventasApi.venta(id);
      // Con CAE sale la factura con su QR; sin CAE, el ticket de siempre.
      await imprimirVenta(venta, { moneda: money, fechaHora: fmtFechaHora });
    } catch {
      toast('No se pudo reimprimir el ticket.', 'err');
    }
  }, [toast]);

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
    // Escaneo de una CAJA: además de las unidades, se fija la lista del
    // formato — comprar la caja ES elegir el precio mayorista.
    let listaFija = null;
    if (item._escaneoListaId) {
      const precioLista = (preciosDe(item.key) ?? []).find((x) => x.listaId === item._escaneoListaId)?.precio;
      const lista = listasPorId.get(item._escaneoListaId);
      if (precioLista != null && lista) listaFija = { listaId: lista.listaId, etiqueta: lista.etiqueta, precio: precioLista };
    }
    const precioEfectivo = listaFija?.precio ?? item.precio;
    if (precioEfectivo <= 0) {
      /* El paquete fraccionado se cotiza solo (0053): si no tiene formato de
       * venta, el precio se carga en SU ficha y no en la de la madre. Decirlo
       * mal manda al cajero a una pantalla donde no está el campo. */
      toast(item.presentacionId
        ? `${item.nombre} · ${item.detalle} todavía no tiene precio: cargale su formato de venta en la ficha del fraccionado (Compras › Productos).`
        : `${item.nombre} no tiene precio cargado. Definilo en Compras › Productos.`, 'err');
      return;
    }
    dispatch({ tipo: 'agregar', item, cantidad, listaFija, descuentoCliente: clienteActual?.descuento || 0 });
    setUltimoKey(item.key);
    setFlashTick((t) => t + 1);
  }, [toast, clienteActual, preciosDe, listasPorId]);

  const trasCobrar = useCallback((idCobrado) => {
    dispatch({ tipo: 'limpiar' });
    setClienteId(null);
    setUltimoKey(null);
    setFlashTick(0);
    if (idCobrado) cerrarPestana(idCobrado);
    recargarCatalogo();   // el stock cambió con la venta
    recargarCaja();

    /*
     * Y ARRANCA LA SIGUIENTE VENTA SOLA.
     *
     * Antes acá iba `setActivaId(null)`, y eso hacía que `enLista` pasara a
     * true: el POS se caía de la registradora a pantalla completa a su vista de
     * lista, cuyo primer elemento es la barra de caja. El cajero lo vivía como
     * "me sacó a Caja" y tenía que apretar "+ Nueva venta" con el cliente
     * siguiente ya esperando en el mostrador.
     *
     * Una registradora siempre tiene un ticket abierto. `abrirBorradorNuevo`
     * ya deja el foco en el buscador, así que se puede escanear de una.
     *
     * Efecto lateral aceptado: si el cajero cierra el turno justo después de
     * cobrar, queda UN borrador vacío abierto. Es el ticket en curso del
     * puesto, no basura — y es uno solo, porque el siguiente cobro lo reusa.
     */
    abrirBorradorNuevo();
  }, [cerrarPestana, recargarCatalogo, recargarCaja, abrirBorradorNuevo]);

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
          catalogo, listas: listasCatalogo, config, onAgregar: agregar,
        });
      }
      // Esc sale de la registradora a la lista (guardando). Con un modal
      // abierto no: ese Esc es del modal. El buscador con texto tampoco deja
      // llegar el evento (limpia y corta la propagación).
      else if (e.key === 'Escape' && activaId && !modal) {
        e.preventDefault();
        irALista();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cobrar, enfocarBuscador, activaId, catalogo, config, agregar, openModal, toast, modal, irALista]);

  /* ------------------------------ Render ------------------------------ */

  if (!sucursalId) {
    return <div className={cx(s.callout, s.warn)}>Elegí la sucursal en la barra de arriba para operar la caja.</div>;
  }

  const sucursal = sucursales.find((x) => x.id === sucursalId);
  const enLista = !activaId;

  /**
   * La misma barra de pestañas vive en las dos vistas: la lista (panel normal)
   * y la registradora (pantalla completa). La primera pestaña vuelve a
   * "Ventas en curso"; el × cierra la ventana SIN tocar la venta.
   */
  const barraPestanas = (enReg) => (
    <div className={cx(p.tabs, enReg && p.tabsReg)} role="tablist" aria-label="Ventas abiertas">
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
  );

  /* ---------- Registradora: venta abierta, a pantalla completa ---------- */

  if (!enLista) {
    // El visor muestra lo último que entró; si se retomó una venta guardada,
    // el último renglón del ticket hace de referencia.
    const ultimo = ticket.renglones.find((r) => r.key === ultimoKey)
      ?? ticket.renglones[ticket.renglones.length - 1] ?? null;

    return (
      <div className={p.registradora}>
        {/* Barra superior: pestañas + estado del puesto. Nada más. */}
        <div className={p.regTop}>
          {barraPestanas(true)}
          <div className={p.regEstado}>
            {guardando && <span className={s.hint} style={{ margin: 0 }}>Guardando…</span>}
            <span className={cx(p.cajaChip, !cajaAbierta && p.cajaChipCerrada)}>
              {cargandoCaja ? 'Caja…' : cajaAbierta ? `Caja #${caja.id}` : 'Caja cerrada'}
            </span>
            {!cargandoCaja && !cajaAbierta && (
              <Btn variant="btn-primary" small onClick={() => goPanel('caja')}>
                Ir a Caja
              </Btn>
            )}
            <span className={p.regSucursal}>{sucursal?.nombre}</span>
          </div>
        </div>

        {errorCatalogo && (
          <div className={cx(s.callout, s.warn)} style={{ margin: 0 }}>
            No se pudo cargar el catálogo: <strong>{errorCatalogo}</strong>
          </div>
        )}

        <div className={p.regMain}>
          {/* ------ Columna de trabajo: escanear → confirmar → corregir ------ */}
          <div className={p.regIzq}>
            <Buscador catalogo={catalogo ?? []} config={config} onElegir={agregar} inputRef={buscadorRef} />

            {/* El "visor" de la registradora: lo último que entró, en grande. */}
            <div key={flashTick} className={cx(p.ultimoStrip, flashTick > 0 && p.ultimoFlash)}>
              {ultimo ? (
                <>
                  <span className={p.ultimoInfo}>
                    <span className={p.ultimoNombre}>{ultimo.nombre}</span>
                    <span className={p.ultimoMeta}>
                      {ultimo.detalle} · {num(ultimo.cantidad)} {ultimo.unidad} × {money(ultimo.precioUnitario)}
                    </span>
                  </span>
                  <span className={p.ultimoImporte}>{money(calcularRenglon(ultimo).total)}</span>
                </>
              ) : (
                <span className={s.muted}>El próximo artículo escaneado aparece acá.</span>
              )}
            </div>

            <div className={p.regTicketScroll} ref={ticketScrollRef}>
              <Ticket
                renglones={ticket.renglones}
                dispatch={dispatch}
                permitirStockNegativo={!!config.permitirStockNegativo}
                descuentoMax={descuentoMax}
                puedePisarPrecio={puedePisarPrecio}
                preciosDe={preciosDe}
                ultimoKey={ultimoKey}
                listasPorId={listasPorId}
                overrideBloqueado={overrideBloqueado}
              />
            </div>

            {/* Acciones secundarias: chicas y abajo, no compiten con el escaneo. */}
            <div className={p.regAcciones}>
              <Btn small onClick={() => openModal('cargaRapida', { catalogo: catalogo ?? [], config, onAgregar: agregar })}>
                Cargar (Ins)
              </Btn>
              <Btn small onClick={() => openModal('busquedaMasiva', { catalogo, listas: listasCatalogo, onAgregar: agregar })}>
                Buscar (⇧Ins)
              </Btn>
              {puedePresupuestar && (
                <Btn small onClick={guardarPresupuesto} title="Guardar el ticket como presupuesto mayorista (no vende)">
                  Presupuesto
                </Btn>
              )}
              <Btn small onClick={reimprimirTicket} title="Reimprimir el último ticket cobrado en este puesto">
                Reimprimir
              </Btn>
              <Btn small onClick={() => openModal('cargaExtra', { onAgregar: (x) => dispatch({ tipo: 'extraAgregar', ...x }) })}>
                Cargo extra
              </Btn>
              {/*
                Se elige MODALIDAD, no lista: las listas son del producto, así
                que "Mayorista" puede ser la 1 en un artículo y la 2 en otro.
                Cada renglón toma la mejor suya dentro de la modalidad.
              */}
              <select
                className={s['select-inline']}
                value=""
                aria-label="Aplicar una modalidad de precio a todo el ticket"
                disabled={!ticket.renglones.length || overrideBloqueado}
                onChange={(e) => { aplicarModalidadATodo(e.target.value); e.target.value = ''; }}
              >
                <option value="">Aplicar modalidad…</option>
                {modalidades.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                <option value="auto">↺ Volver al automático</option>
              </select>
              <span className={p.spacer} />
              <Btn small onClick={() => openModal('delegarVenta', { ventaId: activaId, actualId: ctx.usuarioId, onChange: recargarAbiertas })}>
                Delegar
              </Btn>
              <Btn
                variant="btn-delete"
                small
                onClick={() => dispatch({ tipo: 'limpiar' })}
                disabled={!ticket.renglones.length && !ticket.extras.length}
              >
                Vaciar
              </Btn>
            </div>
          </div>

          {/* ------ Columna de cobro: cliente, resumen y el TOTAL ------ */}
          <div className={p.regLateral}>
            <div className={p.bloque}>
              <div className={p.bloqueTitulo}>Cliente</div>
              {/* Botón, no <select>: abre el modal con buscador y lista. */}
              <button
                type="button"
                className={s['select-inline']}
                style={{
                  width: '100%', cursor: 'pointer', textAlign: 'left',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
                }}
                onClick={() => setSelectorCliente(true)}
                title="Elegir cliente"
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {clienteActual?.nombre || 'Consumidor Final'}
                </span>
                <span aria-hidden style={{ color: 'var(--crm-color-text-muted)' }}>▾</span>
              </button>
              {selectorCliente && (
                <ElegirClienteModal
                  clientes={clientes}
                  actualId={clienteActual?.id}
                  onElegir={cambiarCliente}
                  onCerrar={() => setSelectorCliente(false)}
                />
              )}
              <div className={s.hint} style={{ margin: '8px 0 0' }}>
                {CONDICIONES_IVA[clienteActual?.condicionIva]?.label || '—'}
                {clienteActual?.descuento > 0 && ` · ${clienteActual.descuento}% de descuento`}
                {clienteActual?.ctaCteHabilitada && ' · cuenta corriente'}
              </div>
            </div>

            {/*
              Sugerencia por monto. Se avisa POR ADELANTADO qué medio de pago
              exige: el precio se arma antes de cobrar, y descubrirlo recién al
              confirmar sería descubrirlo con el cliente enfrente.
            */}
            {sugerencia && (
              <div className={cx(s.callout, s.ok)} style={{ margin: 0 }}>
                Supera <strong>{money(sugerencia.monto)}</strong>: califica para{' '}
                <strong>{sugerencia.modalidad}</strong> en {sugerencia.renglones} artículo(s).
                {sugerencia.mediosPago.length > 0 && (
                  <div className={s.hint} style={{ margin: '4px 0 0' }}>
                    Solo pagando con {sugerencia.mediosPago.map((m) => MEDIOS_PAGO[m] || m).join(' o ')}.
                  </div>
                )}
                <div style={{ marginTop: 8 }}>
                  <Btn variant="btn-primary" small onClick={() => aplicarMonto(sugerencia.modalidadId)}>
                    Aplicar {sugerencia.modalidad}
                  </Btn>
                </div>
              </div>
            )}

            {ticket.montoAplicado && (
              <div className={cx(s.callout, s.info)} style={{ margin: 0 }}>
                Precio por <strong>monto de compra</strong> aplicado.
                <div style={{ marginTop: 8 }}>
                  <Btn small onClick={() => aplicarMonto(null)}>Quitar</Btn>
                </div>
              </div>
            )}

            {/* Ofertas de ticket: misma mecánica que el monto — avisan, no se
                aplican solas, y anuncian el medio de pago por adelantado. */}
            {sugerenciasOferta.map((o) => (
              <div key={o.id} className={cx(s.callout, s.ok)} style={{ margin: 0 }}>
                Supera <strong>{money(o.montoMinimo)}</strong>: oferta{' '}
                <strong>{o.nombre}</strong> (−{o.porcentaje}%).
                {o.mediosPago.length > 0 && (
                  <div className={s.hint} style={{ margin: '4px 0 0' }}>
                    Solo pagando con {o.mediosPago.map((m) => MEDIOS_PAGO[m] || m).join(' o ')}.
                  </div>
                )}
                <div style={{ marginTop: 8 }}>
                  <Btn variant="btn-primary" small onClick={() => aplicarOfertaTicket(o.id)}>
                    Aplicar oferta
                  </Btn>
                </div>
              </div>
            ))}

            {ticket.ofertaTicket && (
              <div className={cx(s.callout, s.info)} style={{ margin: 0 }}>
                Oferta de ticket aplicada
                {totales.ahorro > 0 && <> · ahorra <strong>{money(totales.ahorro)}</strong></>}.
                <div style={{ marginTop: 8 }}>
                  <Btn small onClick={() => aplicarOfertaTicket(null)}>Quitar</Btn>
                </div>
              </div>
            )}

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

            <div className={cx(p.bloque, p.regResumen)}>
              <div className={p.linea}><span>Artículos</span><strong>{totales.renglones}</strong></div>
              <div className={p.linea}><span>Unidades</span><strong>{num(totales.unidades)}</strong></div>
              <div className={p.linea}><span>Neto</span><strong>{money(totales.neto)}</strong></div>
              {/* `descuento` incluye las ofertas; acá se separan para que el
                  cajero vea dos cosas distintas: lo que él descontó y lo que
                  descontó la promoción. */}
              {totales.descuento - totales.ahorro > 0.005 && (
                <div className={p.linea}>
                  <span>Descuentos</span>
                  <strong style={{ color: 'var(--crm-color-success)' }}>−{money(totales.descuento - totales.ahorro)}</strong>
                </div>
              )}
              {totales.ahorro > 0 && (
                <div className={p.linea}>
                  <span>Ahorro por ofertas</span>
                  <strong style={{ color: 'var(--crm-color-success)' }}>−{money(totales.ahorro)}</strong>
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

              <DescuentosConNombre
                opciones={descuentosDelTicket}
                puestos={descuentosPuestos}
                onAlternar={alternarDescuento}
                habilitado={ticket.renglones.length > 0}
              />

              <button type="button" className={p.cobrar} onClick={cobrar} disabled={!puedeCobrar}>
                Cobrar · F2
              </button>

              <div className={p.atajos}>
                <span className={p.tecla}><kbd>Ins</kbd> cargar</span>
                <span className={p.tecla}><kbd>⇧Ins</kbd> buscar</span>
                <span className={p.tecla}><kbd>F2</kbd> cobrar</span>
                <span className={p.tecla}><kbd>F4</kbd> foco</span>
                <span className={p.tecla}><kbd>Esc</kbd> salir</span>
              </div>
            </div>

            {problemas.length > 0 && (
              <div className={cx(s.callout, s.warn)} style={{ margin: 0 }}>
                {problemas.map((m, i) => <div key={i}>{m}</div>)}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* --------------- Lista de ventas en curso (panel normal) --------------- */

  return (
    <div>
      <PanelHead
        title="Punto de venta"
        desc={`${sucursal?.nombre || ''}. Ins carga un producto, Shift+Ins abre la búsqueda, F2 cobra.`}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {guardando && <span className={s.hint} style={{ margin: 0 }}>Guardando…</span>}
            {/* Traer precios a mano también da por visto el aviso: el cajero que
                acaba de actualizar no tiene que ver el cartel. */}
            <Btn onClick={actualizarPrecios} disabled={cargandoCatalogo}>
              {cargandoCatalogo ? 'Cargando…' : 'Actualizar precios'}
            </Btn>
          </div>
        }
      />

      {/*
        Barra de caja MÍNIMA: la gestión del turno (abrir, movimientos, pagos a
        proveedor, controles, cierre) vive en Ventas › Caja. Acá queda solo el
        estado, porque el cajero necesita saber por qué un cobro se rechazaría.
      */}
      <div className={cx(p.cajaBar, !cajaAbierta && p.cajaBarCerrada)}>
        {cargandoCaja ? (
          <span className={s.muted}>Verificando el turno de caja…</span>
        ) : cajaAbierta ? (
          <>
            <div className={p.cajaDato}><span>Turno</span><strong>#{caja.id} abierto</strong></div>
            <div className={p.cajaDato}><span>Desde</span><strong>{fmtFechaHora(caja.apertura)}</strong></div>
            <span className={p.spacer} />
            <Btn small onClick={() => goPanel('caja')}>Gestionar caja</Btn>
          </>
        ) : (
          <>
            <div className={p.cajaDato}><span>Caja</span><strong>Sin turno abierto</strong></div>
            <span className={s.hint} style={{ margin: 0 }}>
              {requiereCaja
                ? 'La configuración exige un turno abierto para vender al contado. Se abre desde Caja.'
                : 'La caja no es obligatoria, pero sin turno no vas a poder arquear.'}
            </span>
            <span className={p.spacer} />
            <Btn variant="btn-primary" small onClick={() => goPanel('caja')}>Ir a Caja</Btn>
          </>
        )}
      </div>

      {/* ---------------- Pestañas ---------------- */}
      {barraPestanas(false)}

      {errorCatalogo && (
        <div className={cx(s.callout, s.warn)}>No se pudo cargar el catálogo: <strong>{errorCatalogo}</strong></div>
      )}

      {/* ---------------- Contenido ---------------- */}
      <VentasAbiertas
        abiertas={abiertas}
        catalogo={catalogo ?? []}
        onAbrir={abrirVenta}
        onNueva={nuevaVenta}
        cargando={cargandoAbiertas}
      />
    </div>
  );
}
