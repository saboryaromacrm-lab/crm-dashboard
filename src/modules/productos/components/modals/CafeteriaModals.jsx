/**
 * CAFETERÍA — modales del envío a coffit.
 * ============================================================================
 * El envío es un PUNTO DE SALIDA a costo, no una transferencia: la cafetería
 * vive en otro sistema (coffit, dueño de su stock). Del otro lado, coffit lo
 * ingresa en su almacén "Sabor y Aroma" y ELLA clasifica qué es cada cosa —
 * por eso acá no se pregunta ningún destino. El envío nace ENVIADO (egresa
 * stock y congela costo en el acto) y la corrección es EDITARLO: este mismo
 * formulario sirve para las dos cosas.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { esc, imprimirDocumento } from '@core/services/imprimir.js';
import { useProductos } from '../../context/ProductosContext.jsx';
import { money, num, fmtFechaHora, isoDate } from '../../domain/format.js';
import { ESTADOS_PEDIDO_CAFE, estadoEnvioCafe } from '../../domain/constants.js';
import { antiguedad, esVozDelCafe, vozCafeteria } from '../../domain/cafeteria.voz.js';
import { ModalShell } from '../Modal.jsx';
import { sucursalOptions } from '../selectOptions.jsx';
import { Table, Btn, Pill, s } from '../ui.jsx';

function Di({ label, children }) {
  return <div className={s.di}><div className={s.l}>{label}</div><div className={s.v}>{children}</div></div>;
}

const norm = (v) => (v || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

/*
 * LA SUCURSAL A LA QUE LA CAFETERÍA MANDA, recordada entre envíos. Si todas las
 * mañanas manda a la misma, elegirla de nuevo cada vez es trabajo puro; y el
 * error de no elegirla es caro, porque la mercadería aparece en el stock de
 * otro mostrador. Se guarda solo el destino: nada sensible.
 */
const ULTIMA_SUC = 'crm.cafeteria.entrada.sucursal';
/** A quién se le pidió la última vez: el café suele pedirle siempre al mismo. */
const ULTIMA_SUC_PEDIDO = 'crm.cafeteria.pedido.sucursal';
const leerUltimaSuc = () => { try { return localStorage.getItem(ULTIMA_SUC) || ''; } catch { return ''; } };
const guardarUltimaSuc = (v) => { try { localStorage.setItem(ULTIMA_SUC, String(v)); } catch { /* modo privado */ } };

/**
 * Buscador sobre TODO el catálogo (nombre, código interno o barras — también
 * el de las presentaciones fraccionadas, que llevan etiqueta propia).
 * Exportado: también lo usa el formulario del PEDIDO de la cafetería.
 */
export function BuscadorCatalogo({ store, onElegir, autoFocus, filtro }) {
  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(false);
  const blurTimer = useRef(null);

  const matches = useMemo(() => {
    const ql = norm(texto);
    const digitos = texto.replace(/\D/g, '');
    /* Sin ARCHIVADOS: no se piden, no se envían al café y no se les controla el
     * vencimiento (la API además los rechaza). El discontinuado SÍ aparece:
     * mientras quede stock, sigue circulando. */
    /* `filtro` acota el universo: en un envío de ENTRADA solo se ofrece lo que
     * la cafetería elabora — buscar entre miles de productos para encontrar las
     * cuatro que ella hace sería perder tiempo, y encima la API lo rechaza. */
    const todos = store.state.productos.filter((p) => (p.estado || 'activo') !== 'archivado'
      && (!filtro || filtro(p)));
    if (!ql) return todos.slice(0, 12).map((p) => ({ prod: p, presId: null }));
    const out = [];
    for (const p of todos) {
      if (norm(p.nombre).includes(ql) || (p.codigoPropio && norm(p.codigoPropio).includes(ql))
        || (digitos.length >= 4 && p.codigoBarras && p.codigoBarras.includes(digitos))) {
        out.push({ prod: p, presId: null });
      } else if (digitos.length >= 4) {
        const pres = (p.presentaciones || []).find((x) => x.codigoBarras && x.codigoBarras.includes(digitos));
        if (pres) out.push({ prod: p, presId: pres.id });
      }
      if (out.length >= 12) break;
    }
    return out;
  }, [store, texto, filtro]);

  const elegir = (m) => {
    clearTimeout(blurTimer.current);
    setTexto('');
    setAbierto(false);
    onElegir(m.prod, m.presId);
  };

  return (
    <div style={{ position: 'relative' }}>
      <input
        type="search"
        autoFocus={autoFocus}
        placeholder="Nombre, código o barras…"
        value={texto}
        onChange={(e) => { setTexto(e.target.value); setAbierto(true); }}
        onFocus={() => setAbierto(true)}
        onBlur={() => { blurTimer.current = setTimeout(() => setAbierto(false), 150); }}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === 'Return') && matches.length) { e.preventDefault(); elegir(matches[0]); }
        }}
      />
      {abierto && (
        <div
          style={{
            position: 'absolute', zIndex: 30, top: '100%', left: 0, minWidth: '130%',
            maxHeight: 300, overflowY: 'auto',
            background: 'var(--crm-color-surface)', border: '1px solid var(--crm-color-border)',
            borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.18)',
          }}
        >
          {matches.length === 0 ? (
            <div className={s.hint} style={{ margin: 0, padding: '10px 12px' }}>Sin coincidencias.</div>
          ) : matches.map((m) => (
            <button
              key={`${m.prod.id}-${m.presId ?? 0}`}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); elegir(m); }}
              onClick={() => elegir(m)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '7px 12px', border: 'none', background: 'none', cursor: 'pointer',
              }}
            >
              {m.prod.nombre}{m.presId ? ` · ${store.presLabel(m.prod, m.presId)}` : ''}
              <span className={s.hint} style={{ margin: 0, display: 'block' }}>
                {m.prod.codigoPropio ? `#${m.prod.codigoPropio}` : ''}
                {/* En una ENTRADA el costo no existe todavía —lo declara la
                    cafetería en el renglón— y mostrar "$0,00 de costo" sería
                    decir algo falso justo antes de pedir el número. */}
                {!filtro && <>{' · '}{money(store.costoNeto(m.prod))}/{store.unidadDe(m.prod, null) === 'kg' ? 'kg' : 'u'} de costo</>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ==================================================================== *
 * Búsqueda global en lote
 * ==================================================================== *
 * El mismo Shift+Ins de compras, versión cafetería: TODO el catálogo con
 * filtros por texto, marca y categoría, tildado manual y entrada de todos
 * juntos al envío. Para el pedido semanal del café — buscar de a uno sería
 * un renglón por minuto.
 */
function BusquedaGlobalModal({ store, yaCargados, onAgregar, onClose }) {
  const [texto, setTexto] = useState('');
  const [marca, setMarca] = useState('');
  const [categoria, setCategoria] = useState('');
  const [checks, setChecks] = useState(() => new Set());

  const productos = store.state.productos;
  const marcas = useMemo(
    () => [...new Set(productos.map((p) => p.marca).filter(Boolean))].sort(),
    [productos],
  );
  const categorias = useMemo(
    () => [...new Set(productos.map((p) => p.categoria).filter(Boolean))].sort(),
    [productos],
  );

  const resultados = useMemo(() => {
    const ql = norm(texto);
    const digitos = texto.replace(/\D/g, '');
    return productos.filter((p) => {
      if (marca && p.marca !== marca) return false;
      if (categoria && p.categoria !== categoria) return false;
      if (!ql) return true;
      return norm(p.nombre).includes(ql)
        || (p.codigoPropio && norm(p.codigoPropio).includes(ql))
        || (digitos.length >= 4 && p.codigoBarras && p.codigoBarras.includes(digitos));
    }).slice(0, 200);
  }, [productos, texto, marca, categoria]);

  const toggle = (id) => setChecks((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const confirmar = () => {
    onAgregar(productos.filter((p) => checks.has(p.id)));
  };

  return (
    <ModalShell
      title="Buscar en todo el catálogo"
      subtitle="Tildá lo que viaja al café y entra todo junto al envío"
      size="lg"
      onClose={onClose}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: onClose },
        { texto: checks.size ? `Agregar ${checks.size} renglón(es)` : 'Agregar', clase: 'btn-primary', onClick: confirmar },
      ]}
    >
      <div className={s.toolbar}>
        <input
          type="search" autoFocus style={{ flex: 1, minWidth: 180 }}
          placeholder="Nombre, código interno o código de barras…"
          value={texto} onChange={(e) => setTexto(e.target.value)}
        />
        <select className={s['select-inline']} value={marca} onChange={(e) => setMarca(e.target.value)}>
          <option value="">Todas las marcas</option>
          {marcas.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select className={s['select-inline']} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <Table
        cols={[{ h: '' }, { h: 'Producto' }, { h: 'Marca' }, { h: 'Costo', num: true }]}
        empty="Sin coincidencias con esos filtros."
      >
        {resultados.map((p) => {
          const ya = yaCargados.has(p.id);
          return (
            <tr
              key={p.id}
              className={ya ? undefined : s.clickable}
              onClick={ya ? undefined : () => toggle(p.id)}
              style={ya ? { opacity: 0.55 } : undefined}
            >
              <td style={{ width: 36 }}>
                {/* stopPropagation: sin él, el click del checkbox dispara
                    también el de la fila y los dos toggles se anulan. */}
                <input
                  type="checkbox"
                  disabled={ya}
                  checked={ya || checks.has(p.id)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => toggle(p.id)}
                />
              </td>
              <td>
                {p.nombre}
                <div className={s.hint} style={{ margin: 0 }}>
                  {p.codigoPropio ? `#${p.codigoPropio}` : ''}
                  {ya ? ' · ya en el envío' : ''}
                </div>
              </td>
              <td>{p.marca || '—'}</td>
              <td className={s.num}>
                {money(store.costoNeto(p))}
                <span className={s.muted}>/{store.unidadDe(p, null) === 'kg' ? 'kg' : 'u'}</span>
              </td>
            </tr>
          );
        })}
      </Table>
    </ModalShell>
  );
}

/* ============================== NUEVO ENVÍO / EDICIÓN ============================== */

/**
 * El MISMO formulario para las dos cosas: `envio` en null = alta; con valor =
 * edición de un envío ya enviado. En la edición, el costo que se muestra es el
 * CONGELADO de cada renglón que ya estaba (la API lo conserva); un renglón
 * nuevo se muestra —y se valúa— al costo de hoy, y el formulario lo dice.
 */
export function EnvioCafeteriaFormModal({ envio = null, pedido = null, sentido = 'salida' }) {
  const { store, closeModal, toast, sucOperativa, ctx, can } = useProductos();
  const v = useMemo(() => vozCafeteria(esVozDelCafe(can)), [can]);
  const esEdicion = !!envio;
  /*
   * LOS DOS SENTIDOS EN EL MISMO FORMULARIO (0097). La única diferencia real es
   * de dónde sale el costo: en una SALIDA lo sabe el sistema (el del formato de
   * compra) y se muestra; en una ENTRADA lo declara la cafetería y se tipea.
   * Buscar, agregar, cantidades y observaciones son lo mismo — duplicar el
   * formulario habría sido duplicar todo eso para cambiar una columna.
   */
  const entrada = (envio?.sentido ?? sentido) === 'entrada';
  /** En una entrada solo se ofrece lo que la cafetería elabora. */
  const soloDelCafe = useMemo(() => (entrada ? (p) => !!p.origenCafeteria : undefined), [entrada]);

  /* En una ENTRADA el destino NO cae por defecto en la distribuidora: lo que
   * la cafetería elabora se vende en un mostrador, y un default silencioso que
   * manda las medialunas al depósito es de los errores que nadie mira. Se
   * propone el último destino usado, o la sucursal del usuario. */
  const [sucId, setSucId] = useState(() => String(
    entrada
      /* `||` y no `??`: "sin guardar" es cadena vacía, no null — con `??` el
         destino recordado vacío se quedaba pegado y nunca se llegaba a la
         sucursal del usuario. */
      ? envio?.sucursalId ?? (leerUltimaSuc() || ctx.sucursalId || '')
      : envio?.sucursalId ?? sucOperativa() ?? store.distribuidora()?.id ?? '',
  ));
  const [fecha, setFecha] = useState(() => isoDate(envio ? new Date(envio.fecha) : new Date()));
  const [obs, setObs] = useState(envio?.observaciones ?? pedido?.observaciones ?? '');
  /** { prodId, presId, cantidad } — el costo lo maneja la API (congelado/hoy).
   * El detalle inicial sale del envío (edición) o del PEDIDO que se convierte:
   * lo pedido es la propuesta, y el que arma corrige a lo que de verdad va. */
  const [items, setItems] = useState(() => ((envio?.items ?? pedido?.items) ?? []).map((it) => ({
    prodId: it.productoId, presId: it.presentacionId ?? null, cantidad: String(it.cantidad),
    /* El costo declarado vive en el renglón solo en las entradas; al corregir,
     * arranca con el que la cafetería había puesto. */
    costo: it.costoUnitario != null ? String(it.costoUnitario) : '',
  })));
  const [busquedaLote, setBusquedaLote] = useState(false);
  /*
   * EL CANDADO DEL DOBLE CLICK. Sin esto, dos clicks en una conexión lenta
   * cargaban DOS envíos iguales y el stock quedaba al doble sin que nada
   * avisara — el error no se ve hoy, se ve cuando el inventario no cierra.
   *
   * Son DOS cosas y hacen falta las dos: el `ref` frena en el acto (probado:
   * tres clicks seguidos entraban los tres, porque el estado de React recién
   * se ve en el dibujo siguiente y los tres leían `false`), y el estado apaga
   * el botón para que se vea que está trabajando.
   */
  const enVuelo = useRef(false);
  const [guardando, setGuardando] = useState(false);
  /*
   * EL ENVÍO GEMELO que el servidor encontró: hoy ya se cargó uno idéntico a
   * esta sucursal. No es un error —el café puede haber mandado dos veces lo
   * mismo— así que en vez de rebotar, se pregunta y se ofrece confirmar.
   */
  const [gemelo, setGemelo] = useState(null);

  /*
   * EL COSTO QUE SE PROPONE EN CADA RENGLÓN. Llega una sola vez al abrir.
   *
   * Sale de la ficha del producto (Mis productos) cuando está declarado, y del
   * último envío cuando no. Es una SUGERENCIA: se pisa tipeando y lo que se
   * guarda es lo que quedó en el campo — una tanda puede salir más cara, y ese
   * cambio es de este envío y no del producto.
   */
  const [costosPrevios, setCostosPrevios] = useState(null);
  useEffect(() => {
    if (!entrada) return undefined;
    let vivo = true;
    store.costosEntradaCafeteria()
      .then((m) => { if (vivo) setCostosPrevios(m || {}); })
      .catch(() => { if (vivo) setCostosPrevios({}); });
    return () => { vivo = false; };
  }, [entrada, store]);
  /** De dónde salió el número propuesto, para poder contarlo en el renglón. */
  const fuenteCosto = useCallback(
    (prodId, presId) => costosPrevios?.[`${prodId}-${presId ?? 0}`] ?? null,
    [costosPrevios],
  );
  /** El costo que se propone para un renglón nuevo (vacío si no hay ninguno). */
  const costoPrevio = useCallback(
    (prodId, presId) => {
      const v = fuenteCosto(prodId, presId);
      return v?.costo == null ? '' : String(v.costo);
    },
    [fuenteCosto],
  );

  /** Costo congelado por renglón que ya estaba: clave prod-pres. */
  const congelados = useMemo(() => new Map(
    (envio?.items ?? []).map((it) => [`${it.productoId}-${it.presentacionId ?? 0}`, it.costoUnitario]),
  ), [envio]);

  const setItem = (i, patch) => setItems((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  const delItem = (i) => setItems((r) => r.filter((_, j) => j !== i));
  const agregar = (prod, presId) => setItems((r) => [
    ...r,
    { prodId: prod.id, presId: presId ?? null, cantidad: '', costo: costoPrevio(prod.id, presId) },
  ]);

  /* Si el envío cambió, ya no es el gemelo que el servidor señaló: el aviso se
   * cae solo en vez de quedar pegado diciendo algo que dejó de ser cierto. */
  useEffect(() => { setGemelo(null); }, [items, sucId, fecha]);

  /** Ingreso en lote desde el buscador global: un renglón por producto tildado. */
  const agregarLote = (elegidos) => {
    setItems((r) => [...r, ...elegidos.map((p) => ({
      prodId: p.id, presId: null, cantidad: '', costo: costoPrevio(p.id, null),
    }))]);
    setBusquedaLote(false);
    toast(`${elegidos.length} producto(s) agregados al envío.`, 'ok');
  };

  /** El costo del renglón: congelado si ya estaba en el envío; el de hoy si es nuevo. */
  const costoDe = (it) => {
    // En una ENTRADA el costo es SIEMPRE el tipeado: lo declara la cafetería.
    if (entrada) return { costo: Number(it.costo) || 0, congelado: false };
    const clave = `${it.prodId}-${it.presId ?? 0}`;
    if (congelados.has(clave)) return { costo: congelados.get(clave), congelado: true };
    const prod = store.getProducto(it.prodId);
    if (!prod) return { costo: 0, congelado: false };
    const cn = store.costoNeto(prod);
    const pres = it.presId ? store.presDe(prod, it.presId) : null;
    return { costo: pres ? cn * (pres.tamKg || 1) : cn, congelado: false };
  };
  const total = items.reduce((a, it) => a + costoDe(it).costo * (Number(it.cantidad) || 0), 0);
  /** Un renglón "sin costo" es el que se va a cargar y no tiene número puesto.
   *  Es el error caro de esta pantalla: entra al stock igual y la rentabilidad
   *  de ese producto queda mal para siempre, sin que nada lo muestre. */
  const sinCosto = entrada
    ? items.filter((it) => Number(it.cantidad) > 0 && (it.costo === '' || Number.isNaN(Number(it.costo)))).length
    : 0;
  /*
   * MEDIA MEDIALUNA NO EXISTE. Solo el granel se fracciona —ahí la cantidad
   * son kilos—; en unidades y paquetes es un conteo. El campo ya va de a uno
   * (`step`) y la API lo rechaza, pero un decimal se puede pegar o tipear con
   * coma: contarlos acá lo muestra en el momento, y no después de mandar.
   */
  const fraccionados = items.filter((it) => {
    const prod = store.getProducto(it.prodId);
    if (!prod || store.unidadDe(prod, it.presId) === 'kg') return false;
    const c = Number(it.cantidad);
    return c > 0 && !Number.isInteger(c);
  }).length;

  const guardar = async (confirmarDuplicado = false) => {
    if (enVuelo.current) return;
    const conCantidad = items.filter((it) => Number(it.cantidad) > 0);
    if (!conCantidad.length) { toast('Agregá al menos un renglón con cantidad.', 'err'); return; }
    /* En una ENTRADA el costo es obligatorio renglón por renglón: sin él, ese
     * producto quedaría con rentabilidad inventada. La API lo revalida. */
    if (entrada && conCantidad.some((it) => it.costo === '' || Number.isNaN(Number(it.costo)))) {
      toast('Poné el costo de cada renglón: en una entrada lo declara la cafetería.', 'err');
      return;
    }
    if (fraccionados) {
      toast('Hay renglones con media unidad: solo el granel se fracciona. Poné números enteros.', 'err');
      return;
    }
    const parsed = conCantidad.map((it) => ({
      productoId: it.prodId,
      presentacionId: it.presId || undefined,
      cantidad: Number(it.cantidad),
      ...(entrada ? { costoUnitario: Number(it.costo) } : {}),
    }));

    enVuelo.current = true;
    setGuardando(true);
    let res;
    try {
      res = esEdicion
        ? await store.editarEnvioCafeteria(envio.id, {
          version: envio.version, fecha, observaciones: obs.trim(), items: parsed,
        })
        : await store.crearEnvioCafeteria({
          sentido: entrada ? 'entrada' : undefined,
          confirmarDuplicado: confirmarDuplicado || undefined,
          sucursalId: parseInt(sucId, 10) || undefined, fecha,
          observaciones: obs.trim(), items: parsed,
          // El pedido que este envío cumple: la API lo cierra en el mismo acto.
          pedidoId: pedido?.id ?? undefined,
        });
    } finally {
      /* Se vuelve a habilitar SIEMPRE: si falló, la persona tiene que poder
       * corregir y reintentar sin cerrar y rearmar todo el envío. */
      enVuelo.current = false;
      setGuardando(false);
    }
    if (!res.ok) {
      /* 409 = "ya hay uno igual de hoy". No se avisa con un toast que se va
       * solo: queda el cartel con el código y el botón para confirmarlo. */
      if (res.status === 409) { setGemelo(res.datos?.duplicado || '—'); return; }
      toast(res.error || 'No se pudo registrar.', 'err');
      return;
    }
    if (entrada && !esEdicion && sucId) guardarUltimaSuc(sucId);
    toast(
      esEdicion
        ? `${res.codigo} corregido (versión ${res.version}) · nuevo total ${money(res.totalCosto)}. Coffit lo ve en su próxima sincronización.`
        : pedido
          ? `${res.codigo} enviado · cumple el pedido ${pedido.codigo}, que quedó cerrado.`
          : entrada
            ? v.okEntrada(res.codigo, money(res.totalCosto))
            : `${res.codigo} enviado · ${money(res.totalCosto)} a costo. La mercadería ya egresó del stock.`,
      'ok',
    );
    closeModal();
  };

  return (
    <>
    <ModalShell
      title={esEdicion
        ? `Editar ${envio.codigo}`
        : pedido
          ? `Armar envío — pedido ${pedido.codigo}`
          : entrada ? v.altaEntradaTitulo : 'Nuevo envío a Cafetería'}
      subtitle={esEdicion
        ? `Versión actual: ${envio.version}. La corrección revierte el envío anterior y aplica este detalle — el stock acompaña.`
        : pedido
          ? 'Lo pedido es la propuesta: corregí a lo que de verdad va. Al enviar, el pedido queda cerrado.'
          : entrada
            ? v.altaEntradaSub
            : 'El envío egresa el stock y congela el costo en el mismo acto: con esto ya se da por hecho que el café lo recibió'}
      wide
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal, disabled: guardando },
        {
          texto: guardando ? 'Registrando…' : (esEdicion ? 'Guardar corrección' : 'Enviar'),
          clase: 'btn-primary',
          onClick: () => guardar(),
          /* Con un gemelo a la vista el camino es el botón del cartel: así
             confirmar es un acto aparte y no el mismo click de recién. */
          disabled: guardando || !!gemelo,
        },
      ]}
    >
      {/*
        EL GEMELO DEL DÍA. El servidor encontró un envío idéntico ya cargado hoy
        a esta misma sucursal. Lo más probable es que sea la misma carga hecha
        dos veces —dos pestañas, la página que se colgó, dos personas— y eso
        duplica stock que nadie mira hasta que el inventario no cierra.
        Pero puede ser de verdad el segundo envío del día, así que se pregunta
        en vez de rebotar: el que sabe es el que está mirando la pantalla.
      */}
      {gemelo && (
        <div className={cx(s.callout, s.warn)}>
          <div>
            Hoy ya se cargó <strong>{gemelo}</strong>, idéntico a este y a la misma sucursal.
            Si fue esto mismo cargado dos veces, <strong>cancelá</strong>: el envío que vale ya
            está. Si de verdad la cafetería mandó dos veces lo mismo, confirmalo.
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Btn variant="btn-ghost" small onClick={closeModal}>Cancelar — ya estaba cargado</Btn>
            <Btn variant="btn-primary" small disabled={guardando} onClick={() => guardar(true)}>
              {guardando ? 'Registrando…' : 'Va igual, es otro envío'}
            </Btn>
          </div>
        </div>
      )}

      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>{entrada ? v.altaEntradaSuc : 'Sale de la sucursal'} <span className={s.req}>*</span></label>
          {/* En la edición no se cambia: el stock ya se movió en UNA sucursal. */}
          <select value={sucId} disabled={esEdicion} onChange={(e) => setSucId(e.target.value)}>
            {entrada && <option value="">Elegí la sucursal…</option>}
            {sucursalOptions(store, false)}
          </select>
        </div>
        <div className={s.field}>
          <label>Fecha</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
      </div>

      <div className={s['section-title']}>Renglones</div>
      <div className={s.hint} style={{ marginTop: 0 }}>
        {entrada ? (
          <>
            Solo se ofrecen los productos marcados como <strong>elaborados por la cafetería</strong>.
            El <strong>costo lo declarás vos</strong>: el sistema no puede saberlo, y de ese número
            sale la rentabilidad cuando se venda en el mostrador.
          </>
        ) : (
          <>
            Qué es cada cosa (góndola o insumo) <strong>lo decide coffit al recibir</strong> en su
            almacén “Sabor y Aroma” — acá solo viaja el detalle completo.{' '}
            {esEdicion
              ? <>El costo congelado de cada renglón <strong>se conserva</strong>; un renglón nuevo entra al costo de hoy.</>
              : <>El costo se congela al enviar, con el costo de hoy.</>}
          </>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr .8fr 1fr 1fr auto', gap: 8, marginBottom: 6 }}>
        {['Producto', 'Presentación', 'Cantidad', 'Costo unit.', 'Subtotal', ''].map((h, i) => (
          <div key={i} className={s['mini-label']}>{h}</div>
        ))}
      </div>
      {items.map((it, i) => {
        const prod = store.getProducto(it.prodId);
        if (!prod) return null;
        const u = store.unidadDe(prod, it.presId);
        const disp = store.cant(prod.id, parseInt(sucId, 10), it.presId, 'disponible');
        const { costo: costoU, congelado } = costoDe(it);
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr .8fr 1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'start' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>
                {prod.nombre}
                {/* La marca del 0089: en ESTA pantalla es el protagonista —
                    el envío es el único camino de salida del exclusivo. */}
                {prod.soloCafeteria && (
                  <span className={cx(s.badge, s['badge-granel'])} style={{ marginLeft: 6 }}>Cafetería</span>
                )}
              </div>
              {/* El disponible es el candado de una SALIDA (no se puede mandar
                  lo que no hay). En una ENTRADA la mercadería viene de afuera:
                  mostrarlo ahí sería un número sin relación con lo que se carga. */}
              {!entrada && (
                <div className={s.hint} style={{ margin: 0 }}>
                  disponible: {store.fmtCant(prod, it.presId, disp)}
                </div>
              )}
            </div>
            <select
              value={it.presId ?? ''}
              onChange={(e) => {
                const presId = e.target.value ? parseInt(e.target.value, 10) : null;
                /* El costo de un paquete no es el de la unidad: al cambiar de
                 * presentación se re-propone, pero SOLO si el campo está
                 * vacío — un número tipeado a mano no se pisa nunca. */
                setItem(i, {
                  presId,
                  ...(entrada && it.costo === '' ? { costo: costoPrevio(it.prodId, presId) } : {}),
                });
              }}
            >
              <option value="">{prod.tipo === 'granel' ? 'Granel (kg)' : 'Unidad'}</option>
              {(prod.presentaciones || []).map((p) => (
                <option key={p.id} value={p.id}>{store.presLabel(prod, p.id)}</option>
              ))}
            </select>
            <input
              type="number" min="0" step={u === 'kg' ? 'any' : '1'} value={it.cantidad}
              title={u === 'kg' ? 'Kilos' : 'Unidades / paquetes enteros'}
              onChange={(e) => setItem(i, { cantidad: e.target.value })}
            />
            {entrada ? (
              <div>
                {/* Si el renglón va a entrar y no tiene costo, el campo lo
                    muestra: es el único error de esta pantalla que no se ve
                    después, porque el producto entra al stock igual. */}
                <input
                  type="number" min="0" step="any" value={it.costo}
                  placeholder="costo"
                  title="Costo unitario que declara la cafetería"
                  style={Number(it.cantidad) > 0 && it.costo === ''
                    ? {
                      borderColor: 'var(--crm-color-warning)',
                      background: 'color-mix(in srgb, var(--crm-color-warning) 8%, transparent)',
                    }
                    : undefined}
                  onChange={(e) => setItem(i, { costo: e.target.value })}
                />
                {/* De dónde salió el número, y si viene de un costo viejo.
                    Un costo de hace cuatro meses propuesto en silencio es el
                    error caro de esta pantalla: entra igual y la rentabilidad
                    queda mal sin que nada avise. */}
                {it.costo !== '' && costoPrevio(it.prodId, it.presId) === it.costo && (() => {
                  const f = fuenteCosto(it.prodId, it.presId);
                  if (!f) return null;
                  if (f.origen !== 'ficha') {
                    return <div className={s.hint} style={{ margin: 0 }}>el del último envío</div>;
                  }
                  const a = antiguedad(f.dias);
                  return (
                    <div
                      className={s.hint}
                      style={{
                        margin: 0,
                        color: a.tono === 'ok' ? undefined : `var(--crm-color-${a.tono === 'mal' ? 'danger' : 'warning'})`,
                        fontWeight: a.tono === 'ok' ? 400 : 600,
                      }}
                    >
                      de la ficha · {a.texto}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div style={{ alignSelf: 'center' }}>
                <span className={cx(s.mono)}>{money(costoU)}</span>
                {esEdicion && (
                  <div className={s.hint} style={{ margin: 0 }}>{congelado ? 'congelado' : 'costo de hoy'}</div>
                )}
              </div>
            )}
            <div className={cx(s.mono, s.num)} style={{ fontWeight: 700, alignSelf: 'center' }}>
              {money(costoU * (Number(it.cantidad) || 0))}
            </div>
            <button type="button" className={s['pres-remove']} onClick={() => delItem(i)}>×</button>
          </div>
        );
      })}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <BuscadorCatalogo store={store} onElegir={agregar} autoFocus={items.length === 0} filtro={soloDelCafe} />
        </div>
        <button type="button" className={cx(s.btn, s['btn-ghost'], s['btn-sm'])} onClick={() => setBusquedaLote(true)}>
          Buscar en lote (marca / categoría)
        </button>
      </div>

      <div
        className={cx(s.callout, (sinCosto || fraccionados) ? s.warn : s.ok)}
        style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, gap: 12 }}
      >
        <span>
          {items.length} renglón(es)
          {sinCosto > 0 && <> · <strong>{sinCosto} sin costo</strong> — así no se puede enviar</>}
          {fraccionados > 0 && <> · <strong>{fraccionados} con media unidad</strong> — solo el granel se fracciona</>}
        </span>
        <span>Total {entrada ? 'declarado' : 'a costo'}: <strong>{money(total)}</strong></span>
      </div>

      <div className={s.field}>
        <label>Observaciones</label>
        <input value={obs} placeholder="Opcional — viaja en el remito" onChange={(e) => setObs(e.target.value)} />
      </div>
    </ModalShell>

    {/* Montado ENCIMA del formulario, que sigue vivo con lo ya cargado. */}
    {busquedaLote && (
      <BusquedaGlobalModal
        store={store}
        yaCargados={new Set(items.map((it) => it.prodId))}
        onAgregar={agregarLote}
        onClose={() => setBusquedaLote(false)}
      />
    )}
    </>
  );
}

/* ============================== DETALLE ============================== */

function imprimirRemito(envio) {
  const filas = (envio.items || []).map((it) => `
    <tr>
      <td>${esc(it.nombre)}</td>
      <td class="chica">${esc(it.codigoBarras || it.codigoPropio || '—')}</td>
      <td class="n">${num(it.cantidad, 3)} ${it.unidad}</td>
      <td class="chica">${it.totalKg != null ? `${num(it.totalKg, 3)} kg` : '—'}</td>
      <td class="n">${money(it.costoUnitario)}</td>
      <td class="n">${money(it.costoUnitario * it.cantidad)}</td>
    </tr>`).join('');
  imprimirDocumento('remitoCafeteria', {
    titulo: `${envio.codigo} — Remito a Cafetería`,
    cuerpo: `
      <h1>${esc(envio.codigo)} · Remito a Cafetería${envio.version > 1 ? ` (versión ${Number(envio.version)})` : ''}</h1>
      <div class="sub">${esc(new Date(envio.fecha).toLocaleString('es-AR'))} · sale de ${esc(envio.sucursalNombre || '')}${envio.usuarioNombre ? ` · ${esc(envio.usuarioNombre)}` : ''}</div>
      <table>
        <thead><tr><th>Producto</th><th>Código</th><th>Cantidad</th><th>Equiv. kg</th><th>Costo unit.</th><th>Subtotal</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
      <div class="tot"><strong>Total a costo: ${money(envio.totalCosto)}</strong></div>
      ${envio.observaciones ? `<div class="nota">${esc(envio.observaciones)}</div>` : ''}
      <div class="fiscal">TRASPASO INTERNO VALORIZADO A COSTO — DOCUMENTO NO FISCAL</div>`,
  });
}

export function EnvioCafeteriaDetalleModal({ id }) {
  const { store, act, closeModal, openModal, toast, can } = useProductos();
  const v = useMemo(() => vozCafeteria(esVozDelCafe(can)), [can]);
  /*
   * QUIEN TIENE LA SECCION DE CAFETERIA PUEDE OPERARLA, sea jefe o no.
   *
   * Antes estos botones pedian ROL de admin y la pantalla quedaba mas
   * cerrada que el servidor: la API exige `almacen.cafeteria` y nada mas en
   * TODOS estos endpoints. El resultado era que una cajera con la seccion
   * abierta veia el pedido del cafe y no podia despacharlo — tenia que
   * esperar a que pasara un administrador.
   *
   * El rol Cafeteria NO puede tocar una SALIDA: eso egresa stock real de la
   * distribuidora y sigue sin poder despacharse a si mismo. Lo que si puede
   * es corregir y anular SUS PROPIAS entradas (0097): si tipeo mal un costo o
   * una cantidad, obligarla a esperar a un administrador para arreglar un
   * papel suyo seria trabarle el dia. La API valida lo mismo.
   */
  const puedeOperar = can('almacen.cafeteria');
  const [envio, setEnvio] = useState(null);
  const [motivoAnular, setMotivoAnular] = useState('');
  const anulandoRef = useRef(false);
  const [anulando, setAnulando] = useState(false);
  const esEntrada = envio?.sentido === 'entrada';
  const puedeCorregir = puedeOperar || (esEntrada && can('almacen.cafeteria-entradas'));

  const cargar = useCallback(async () => {
    try { setEnvio(await store.envioCafeteria(id)); }
    catch { toast('No se pudo cargar el envío.', 'err'); }
  }, [store, id, toast]);
  useEffect(() => { cargar(); }, [cargar]);

  const anular = async () => {
    if (anulandoRef.current) return;
    if (!motivoAnular.trim()) { toast('Escribí por qué se anula.', 'err'); return; }
    anulandoRef.current = true;
    setAnulando(true);
    try {
      await act(
        store.anularEnvioCafeteria(id, motivoAnular.trim()),
        esEntrada
          ? 'Anulado — la mercadería salió del stock de la sucursal.'
          : 'Anulado — todo el stock volvió a su lugar. Coffit lo ve en su próxima sincronización.',
      );
    } finally { anulandoRef.current = false; setAnulando(false); }
  };

  const footerBase = [{ texto: 'Cerrar', clase: 'btn-ghost', onClick: closeModal }];
  if (!envio) {
    return <ModalShell title="Envío a Cafetería" onClose={closeModal} footer={footerBase}>
      <div className={s['empty-state']}>Cargando…</div>
    </ModalShell>;
  }

  const est = estadoEnvioCafe(envio.estado, envio.sentido);
  const vivo = envio.estado !== 'anulado';
  return (
    <ModalShell
      title={`${envio.codigo} · ${esEntrada ? v.detalleEntrada : v.detalleSalida}`}
      subtitle={envio.observaciones || undefined}
      wide
      onClose={closeModal}
      footer={[
        ...(puedeCorregir && vivo
          ? [{ texto: 'Editar', clase: 'btn-primary', onClick: () => { closeModal(); openModal('envioCafeteria', { envio }); } }]
          : []),
        { texto: 'Imprimir remito', clase: 'btn-ghost', onClick: () => imprimirRemito(envio) },
        ...footerBase,
      ]}
    >
      <div className={s['detalle-grid']}>
        <Di label="Estado"><Pill pill={est.pill} label={est.label || envio.estado} /></Di>
        <Di label="Fecha">{fmtFechaHora(envio.fecha)}</Di>
        <Di label={esEntrada ? v.colSucEntrada : v.colSucSalida}>{envio.sucursalNombre || '—'}</Di>
        <Di label="Quién">{envio.usuarioNombre || '—'}</Di>
        <Di label="Versión">
          v{envio.version}
          {envio.version > 1 && <div className={s.hint} style={{ margin: 0 }}>corregido {fmtFechaHora(envio.actualizadoEn)}</div>}
        </Di>
        <Di label="Total a costo"><strong>{money(envio.totalCosto)}</strong></Di>
      </div>
      {!vivo && envio.motivoAnulacion && (
        <div className={cx(s.callout, s.warn)}>Anulado: {envio.motivoAnulacion}</div>
      )}

      <Table
        cols={[
          { h: 'Producto' }, { h: 'Código' },
          { h: 'Cantidad', num: true }, { h: 'Equiv. kg', num: true },
          { h: 'Costo unit.', num: true }, { h: 'Subtotal', num: true },
        ]}
      >
        {(envio.items || []).map((it) => (
          <tr key={it.id}>
            <td>{it.nombre}</td>
            <td className={s.mono}>{it.codigoBarras || it.codigoPropio || '—'}</td>
            <td className={s.num}>{num(it.cantidad, 3)} {it.unidad}</td>
            <td className={s.num}>{it.totalKg != null ? `${num(it.totalKg, 3)} kg` : '—'}</td>
            <td className={s.num}>{money(it.costoUnitario)}</td>
            <td className={cx(s.num, s.mono)}>{money(it.costoUnitario * it.cantidad)}</td>
          </tr>
        ))}
      </Table>

      <div className={s.hint}>
        {esEntrada ? (
          <>
            Los costos son los que <strong>declaró la cafetería</strong> y quedaron congelados en el
            renglón: de ahí sale la rentabilidad cuando esta mercadería se venda en el mostrador.
            Coffit no ve este documento — es mercadería que ella misma despachó.
          </>
        ) : (
          <>
            Los costos quedaron <strong>congelados al enviar</strong>: este remito dice lo mismo aunque
            después cambien los proveedores. Qué es cada cosa lo decide coffit al recibirlo en su
            almacén “Sabor y Aroma” — la clave del mapeo es el código.
          </>
        )}
        {envio.version > 1 && <> Esta es la <strong>versión {envio.version}</strong>: hubo correcciones después del envío original.</>}
      </div>

      {vivo && (
        <div className={s.callout}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              style={{ flex: 1, minWidth: 220 }}
              placeholder="Motivo de anulación (obligatorio)"
              value={motivoAnular}
              onChange={(e) => setMotivoAnular(e.target.value)}
            />
            <Btn variant="btn-delete" small onClick={anular} disabled={anulando}>
              {anulando ? 'Anulando…' : 'Anular'}
            </Btn>
          </div>
          <div className={s.hint} style={{ margin: '8px 0 0' }}>
            {esEntrada
              ? <>Anular revierte TODO: la mercadería <strong>sale</strong> del stock de la sucursal. Si ya se vendió, no se puede — para corregir cantidades o costos, usá <strong>Editar</strong>.</>
              : <>Anular revierte TODO: la mercadería reingresa al stock y coffit tiene que deshacer su ingreso (le llega por sincronización). Para corregir cantidades, usá <strong>Editar</strong>.</>}
          </div>
        </div>
      )}
    </ModalShell>
  );
}

/* ==================================================================== *
 * EL PRODUCTO QUE ELABORA LA CAFETERÍA
 * ==================================================================== *
 * Tres campos y nada más. Un producto que no se compra no tiene proveedor,
 * ni formato de compra, ni costo de lista: el costo lo declara ella en cada
 * envío, y puede cambiar de una semana a la otra. Lo único que hace falta es
 * cómo se llama, si se cuenta o se pesa, y a cuánto lo vende el mostrador.
 *
 * El TIPO no se edita después del alta: pasar de contar a pesar le cambia el
 * significado a todo el stock y a todos los envíos que ya existen. Eso es un
 * producto nuevo, no una corrección.
 */
export function ProductoCafeteriaFormModal({ producto = null, onListo }) {
  const { store, closeModal, toast } = useProductos();
  const esEdicion = !!producto;

  const [nombre, setNombre] = useState(producto?.nombre ?? '');
  const [esGranel, setEsGranel] = useState(!!producto?.esGranel);
  const [precio, setPrecio] = useState(producto?.precio != null ? String(producto.precio) : '');
  const [costo, setCosto] = useState(producto?.costo != null ? String(producto.costo) : '');

  /* El margen, en vivo mientras se tipea: es la única forma de darse cuenta en
   * el momento de que el precio no cierra. Con los dos números a la vista, un
   * costo más alto que el precio salta solo. */
  const margen = useMemo(() => {
    const p = Number(precio);
    const c = Number(costo);
    if (!(p > 0) || costo === '' || Number.isNaN(c)) return null;
    return ((p - c) / p) * 100;
  }, [precio, costo]);

  const enVuelo = useRef(false);
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (enVuelo.current) return;
    const n = nombre.trim();
    if (!n) { toast('Poné el nombre del producto.', 'err'); return; }
    const p = Number(precio);
    if (!(p > 0)) { toast('Poné a cuánto se vende en el mostrador.', 'err'); return; }

    enVuelo.current = true;
    setGuardando(true);
    let res;
    try {
      /* El costo viaja solo si se puso algo: `undefined` es "no lo toques",
       * que no es lo mismo que mandar 0 y declarar que no cuesta nada. */
      const c = costo === '' ? undefined : Number(costo);
      res = esEdicion
        ? await store.editarProductoCafeteria(producto.id, { nombre: n, precio: p, costo: c })
        : await store.crearProductoCafeteria({ nombre: n, esGranel, precio: p, costo: c });
    } finally { enVuelo.current = false; setGuardando(false); }
    if (!res.ok) { toast(res.error || 'No se pudo guardar.', 'err'); return; }
    toast(
      esEdicion
        ? `${n} actualizado.`
        : `${n} cargado. Ya lo podés incluir en un envío.`,
      'ok',
    );
    onListo?.();
    closeModal();
  };

  return (
    <ModalShell
      title={esEdicion ? `Editar ${producto.nombre}` : 'Nuevo producto de la cafetería'}
      subtitle={esEdicion
        ? 'Se corrige el nombre, el costo y el precio. Cómo se vende (por unidad o por kilo) no se cambia: eso sería otro producto.'
        : 'Lo que elabora la cafetería y se vende en el mostrador. El costo lo declarás vos: no se compra, así que no sale de ningún proveedor.'}
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal, disabled: guardando },
        {
          texto: guardando ? 'Guardando…' : (esEdicion ? 'Guardar' : 'Crear producto'),
          clase: 'btn-primary',
          onClick: guardar,
          disabled: guardando,
        },
      ]}
    >
      <div className={s.field}>
        <label>Nombre <span className={s.req}>*</span></label>
        <input
          autoFocus
          value={nombre}
          placeholder="Medialuna de manteca"
          maxLength={120}
          onChange={(e) => setNombre(e.target.value)}
        />
      </div>

      <div className={s.field}>
        <label>Cómo se vende <span className={s.req}>*</span></label>
        <select
          value={esGranel ? 'granel' : 'unidad'}
          disabled={esEdicion}
          onChange={(e) => setEsGranel(e.target.value === 'granel')}
        >
          <option value="unidad">Por unidad — se cuenta (medialuna, sándwich)</option>
          <option value="granel">Por kilo — se pesa (café molido)</option>
        </select>
        <div className={s.hint} style={{ marginBottom: 0 }}>
          {esEdicion
            ? 'No se cambia: todo el stock y los envíos que ya existen están contados así.'
            : 'Define si las cantidades van enteras o con decimales. Solo el kilo se fracciona.'}
        </div>
      </div>

      <div className={s.field}>
        <label>Costo — lo que te cuesta hacerlo</label>
        <input
          type="number" min="0" step="any" value={costo}
          placeholder="700"
          onChange={(e) => setCosto(e.target.value)}
        />
        <div className={s.hint} style={{ marginBottom: 0 }}>
          El <strong>envío lo va a tomar de acá solo</strong>, así que no hay que volver a tipearlo
          cada vez. Si una tanda sale más cara se corrige en ese envío, y eso no cambia este número.
          {esEdicion && producto?.costo == null && <> Todavía no cargaste ninguno.</>}
        </div>
      </div>

      <div className={s.field}>
        <label>Precio en el mostrador <span className={s.req}>*</span></label>
        <input
          type="number" min="0" step="any" value={precio}
          placeholder="1500"
          onChange={(e) => setPrecio(e.target.value)}
        />
        <div className={s.hint} style={{ marginBottom: 0 }}>
          Lo que <strong>paga el cliente</strong>, con IVA incluido.
        </div>
      </div>

      {/* El margen en vivo: con los dos números a la vista, un precio que no
          cierra se ve antes de guardar y no tres meses después. */}
      {margen != null && (
        <div className={cx(s.callout, margen <= 0 ? s.warn : s.ok)}>
          {margen <= 0
            ? <>Con ese costo <strong>estarías perdiendo plata</strong> en cada uno: el precio no llega a cubrirlo.</>
            : <>Margen: <strong>{margen.toFixed(1)}%</strong> — de cada {money(Number(precio))} que cobrás, te quedan {money(Number(precio) - Number(costo))}.</>}
        </div>
      )}

      {!esEdicion && (
        <div className={cx(s.callout, s.ok)}>
          Al crearlo queda marcado como <strong>elaborado por la cafetería</strong>, que es lo que
          lo habilita en el envío. Aparece enseguida en el buscador.
        </div>
      )}
    </ModalShell>
  );
}

/* ==================================================================== *
 * EL PEDIDO DE LA CAFETERÍA — la demanda, no el envío
 * ==================================================================== *
 * Lo arma el usuario del rol Cafetería (su única pantalla del CRM) contra el
 * catálogo completo, con la disponibilidad a la vista. NO toca stock ni habla
 * de plata: es "esto necesito" — el que arma el envío corrige a lo que de
 * verdad va, y el envío cierra el pedido.
 */
/**
 * `inicial` (0101): el pedido armado desde «Disponible en depósito» llega con
 * los renglones y la sucursal ya puestos — el café marca cuánto quiere de lo
 * que ya es suyo, en vez de buscarlo de nuevo en el catálogo.
 */
export function PedidoCafeteriaFormModal({ inicial = null }) {
  const { store, closeModal, toast, can, ctx } = useProductos();
  const v = useMemo(() => vozCafeteria(esVozDelCafe(can)), [can]);
  /*
   * A QUÉ SUCURSAL SE LE PIDE (0098). Manda: solo ESA sucursal ve el pedido, la
   * disponibilidad que se muestra es la de ELLA, y el envío que lo cumple sale
   * de ahí. Antes el pedido iba "a la distribuidora" implícitamente y el que lo
   * armaba sacaba el stock de donde le quedaba cómodo.
   *
   * Arranca con la última que se usó: el café le pide casi siempre al mismo
   * lugar, y volver a elegirla cada vez es trabajo puro.
   */
  const [sucId, setSucId] = useState(() => String(
    inicial?.sucursalId
    || (() => { try { return localStorage.getItem(ULTIMA_SUC_PEDIDO) || ''; } catch { return ''; } })()
    || ctx.sucursalId || '',
  ));
  /* El mismo candado del envío: dos clicks mandaban dos pedidos iguales, y del
   * otro lado alguien armaba dos envíos. Ver el comentario en el formulario
   * del envío para por qué hacen falta el `ref` y el estado. */
  const enVuelo = useRef(false);
  const [enviando, setEnviando] = useState(false);
  const [obs, setObs] = useState('');
  /** { prodId, presId, cantidad } */
  const [items, setItems] = useState(() => (inicial?.items ?? []).map((it) => ({
    prodId: it.prodId, presId: it.presId ?? null, cantidad: it.cantidad ?? '',
  })));

  const setItem = (i, patch) => setItems((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  const delItem = (i) => setItems((r) => r.filter((_, j) => j !== i));
  const agregar = (prod, presId) => setItems((r) => [...r, { prodId: prod.id, presId: presId ?? null, cantidad: '' }]);

  const guardar = async () => {
    const parsed = items
      .filter((it) => Number(it.cantidad) > 0)
      .map((it) => ({
        productoId: it.prodId,
        presentacionId: it.presId || undefined,
        cantidad: Number(it.cantidad),
      }));
    if (!parsed.length) { toast('Agregá al menos un renglón con cantidad.', 'err'); return; }
    const suc = parseInt(sucId, 10) || 0;
    if (!suc) { toast('Elegí a qué sucursal se lo pedís.', 'err'); return; }
    if (enVuelo.current) return;
    enVuelo.current = true;
    setEnviando(true);
    let res;
    try {
      res = await store.crearPedidoCafeteria({ sucursalId: suc, observaciones: obs.trim(), items: parsed });
    } finally { enVuelo.current = false; setEnviando(false); }
    if (!res.ok) { toast(res.error || 'No se pudo enviar el pedido.', 'err'); return; }
    try { localStorage.setItem(ULTIMA_SUC_PEDIDO, String(suc)); } catch { /* modo privado */ }
    toast(`${res.codigo} enviado a ${store.getSucursal?.(suc)?.nombre || 'la sucursal'}. El estado lo seguís en esta pantalla.`, 'ok');
    closeModal();
  };

  return (
    <ModalShell
      title={v.pedidoAltaTitulo}
      subtitle="Elegí a quién se lo pedís y qué necesitás. La disponibilidad que ves es la de esa sucursal, y de ahí sale lo que te manden — el detalle final es el del envío."
      wide
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal, disabled: enviando },
        {
          texto: enviando ? 'Enviando…' : 'Enviar pedido',
          clase: 'btn-primary',
          onClick: guardar,
          disabled: enviando,
        },
      ]}
    >
      <div className={s.field}>
        <label>{v.pedidoSucLabel} <span className={s.req}>*</span></label>
        <select value={sucId} onChange={(e) => setSucId(e.target.value)}>
          <option value="">Elegí la sucursal…</option>
          {sucursalOptions(store, false)}
        </select>
        <div className={s.hint} style={{ marginBottom: 0 }}>
          Lo que ves disponible abajo es lo que tiene <strong>esta</strong> sucursal, y de acá sale
          lo que te manden. Si no tiene lo que necesitás, pedíselo a otra.
        </div>
      </div>

      <div className={s['section-title']}>Renglones</div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr .8fr auto', gap: 8, marginBottom: 6 }}>
        {['Producto', 'Presentación', 'Cantidad', ''].map((h, i) => (
          <div key={i} className={s['mini-label']}>{h}</div>
        ))}
      </div>
      {items.map((it, i) => {
        const prod = store.getProducto(it.prodId);
        if (!prod) return null;
        const u = store.unidadDe(prod, it.presId);
        /* La disponibilidad de LA SUCURSAL ELEGIDA, no la suma de todas: pedirle
         * a Norte contra el total del negocio es mirar un número que no tiene
         * nada que ver con lo que esa sucursal puede mandar. */
        const disp = store.cant(prod.id, parseInt(sucId, 10), it.presId, 'disponible');
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr .8fr auto', gap: 8, marginBottom: 8, alignItems: 'start' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{prod.nombre}</div>
              <div className={s.hint} style={{ margin: 0 }}>
                {sucId
                  ? <>disponible ahí: {store.fmtCant(prod, it.presId, disp)}</>
                  : <>elegí la sucursal para ver qué tiene</>}
              </div>
            </div>
            <select
              value={it.presId ?? ''}
              onChange={(e) => setItem(i, { presId: e.target.value ? parseInt(e.target.value, 10) : null })}
            >
              <option value="">{prod.tipo === 'granel' ? 'Granel (kg)' : 'Unidad'}</option>
              {(prod.presentaciones || []).map((p) => (
                <option key={p.id} value={p.id}>{store.presLabel(prod, p.id)}</option>
              ))}
            </select>
            <input
              type="number" min="0" step={u === 'kg' ? 'any' : '1'} value={it.cantidad}
              title={u === 'kg' ? 'Kilos' : 'Unidades / paquetes enteros'}
              onChange={(e) => setItem(i, { cantidad: e.target.value })}
            />
            <button type="button" className={s['pres-remove']} onClick={() => delItem(i)}>×</button>
          </div>
        );
      })}
      <BuscadorCatalogo store={store} onElegir={agregar} autoFocus={items.length === 0} />

      <div className={cx(s.callout, s.ok)} style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
        <span>{items.length} renglón(es)</span>
        <span>El pedido no mueve stock: es lo que necesitás, no lo que salió.</span>
      </div>

      <div className={s.field}>
        <label>Observaciones</label>
        <input value={obs} placeholder="Opcional — lo lee el que arma el envío" onChange={(e) => setObs(e.target.value)} />
      </div>
    </ModalShell>
  );
}

/** El detalle del pedido: lo ven las dos puntas, las acciones dependen del rol. */
export function PedidoCafeteriaDetalleModal({ id }) {
  const { store, act, closeModal, openModal, toast, can } = useProductos();
  const soyElCafe = esVozDelCafe(can);
  const v = useMemo(() => vozCafeteria(soyElCafe), [soyElCafe]);
  /* Misma llave que el modal de envio: la seccion habilita la operacion. */
  const puedeOperar = can('almacen.cafeteria');
  const [pedido, setPedido] = useState(null);
  const [motivoAnular, setMotivoAnular] = useState('');

  const cargar = useCallback(async () => {
    try { setPedido(await store.pedidoCafeteria(id)); }
    catch { toast('No se pudo cargar el pedido.', 'err'); }
  }, [store, id, toast]);
  useEffect(() => { cargar(); }, [cargar]);

  const footerBase = [{ texto: 'Cerrar', clase: 'btn-ghost', onClick: closeModal }];
  if (!pedido) {
    return <ModalShell title="Pedido de Cafetería" onClose={closeModal} footer={footerBase}>
      <div className={s['empty-state']}>Cargando…</div>
    </ModalShell>;
  }

  const est = ESTADOS_PEDIDO_CAFE[pedido.estado] || {};
  const abierto = pedido.estado === 'pendiente' || pedido.estado === 'armando';
  // La cafetería puede anular lo que todavía nadie tomó; el admin, todo lo abierto.
  const puedeAnular = abierto && (puedeOperar || pedido.estado === 'pendiente');

  const anular = async () => {
    if (!motivoAnular.trim()) { toast('Escribí por qué se anula.', 'err'); return; }
    await act(store.anularPedidoCafeteria(id, motivoAnular.trim()), 'Pedido anulado.');
  };

  return (
    <ModalShell
      title={`${pedido.codigo} · ${soyElCafe ? 'Tu pedido' : 'Pedido de la cafetería'}`}
      subtitle={pedido.observaciones || undefined}
      wide
      onClose={closeModal}
      footer={[
        ...(puedeOperar && pedido.estado === 'pendiente'
          ? [{ texto: 'Tomar (lo estoy armando)', clase: 'btn-ghost', onClick: () => act(store.tomarPedidoCafeteria(id), 'Tomado: el café lo ve como "armando".') }]
          : []),
        ...(puedeOperar && abierto
          ? [{ texto: 'Convertir en envío', clase: 'btn-primary', onClick: () => { closeModal(); openModal('envioCafeteria', { pedido }); } }]
          : []),
        ...footerBase,
      ]}
    >
      <div className={s['detalle-grid']}>
        <Di label="Estado"><Pill pill={est.pill} label={est.label || pedido.estado} /></Di>
        <Di label="Pedido">{fmtFechaHora(pedido.fecha)}</Di>
        {/* A quién se le pidió: decide quién lo ve y de dónde sale la
            mercadería, así que va arriba y no escondido en una ayuda. */}
        <Di label={v.pedidoColSuc}>{pedido.sucursalNombre || '—'}</Di>
        {!soyElCafe && <Di label="Quién">{pedido.usuarioNombre || '—'}</Di>}
        {pedido.envioCodigo && <Di label="Cumplido por"><span className={s.mono}>{pedido.envioCodigo}</span></Di>}
      </div>
      {pedido.estado === 'anulado' && pedido.motivoAnulacion && (
        <div className={cx(s.callout, s.warn)}>Anulado: {pedido.motivoAnulacion}</div>
      )}

      <Table cols={[{ h: 'Producto' }, { h: 'Cantidad pedida', num: true }]}>
        {(pedido.items || []).map((it) => (
          <tr key={it.id}>
            <td>{it.nombre}</td>
            <td className={s.num}>{num(it.cantidad, 3)} {it.unidad}</td>
          </tr>
        ))}
      </Table>

      <div className={s.hint}>
        El pedido es la <strong>demanda</strong>: no movió stock ni tiene precios. El detalle que
        vale es el del <strong>envío</strong> que lo cumple — puede diferir de lo pedido (faltantes,
        reemplazos){soyElCafe ? ', y te llega a coffit por la sincronización' : ', y el café lo recibe por su sincronización'}.{' '}
        {!soyElCafe && <><strong>El envío sale de esta sucursal</strong>: es a la que le pidieron, y
        es la disponibilidad que el café vio al pedir.</>}
      </div>

      {puedeAnular && (
        <div className={s.callout}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              style={{ flex: 1, minWidth: 220 }}
              placeholder="Motivo de anulación (obligatorio)"
              value={motivoAnular}
              onChange={(e) => setMotivoAnular(e.target.value)}
            />
            <Btn variant="btn-delete" small onClick={anular}>Anular pedido</Btn>
          </div>
        </div>
      )}
    </ModalShell>
  );
}
