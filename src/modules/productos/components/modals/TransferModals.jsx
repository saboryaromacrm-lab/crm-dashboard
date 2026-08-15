/**
 * TRANSFERENCIAS — pedido (pull), recepción contada y detalle
 * ============================================================================
 * El pedido lo arma el que NECESITA (destino = mi sucursal): por eso no valida
 * stock del origen — es demanda, y la realidad entra recién cuando el origen
 * prepara. La recepción es el paso con plata en juego: se cuenta lo que llegó
 * y la diferencia genera una incidencia sola.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useProductos } from '../../context/ProductosContext.jsx';
import { fmtFechaHora, money, num } from '../../domain/format.js';
import { cx } from '@shared/utils/classNames.js';
import { esc, imprimirDocumento } from '@core/services/imprimir.js';
import { leerSesion } from '@core/auth/sesion.js';
import { ModalShell } from '../Modal.jsx';
import { sucursalOptions, sucursalOptionsOtras, presentacionOptions, usuarioOptions } from '../selectOptions.jsx';
import { Table, TransferPill, Btn, s } from '../ui.jsx';
import { LISTAS_PREP, GRUPOS_PEDIDO, listaDeProducto, puedeMandar, disponibleTotal } from '../../domain/pedido.js';
import { ExplorarProductosModal } from './ExplorarProductosModal.jsx';

/* ---------------- Preparación: helpers compartidos ---------------- */

/** Todas las listas PRESENTES del pedido están confirmadas → se puede despachar. */
export function listasCompletas(t, store) {
  let enteros = false;
  let granel = false;
  for (const it of t.items || []) {
    if (listaDeProducto(store.getProducto(it.productoId)) === 'granel') granel = true;
    else enteros = true;
  }
  return (!enteros || t.enterosListo) && (!granel || t.granelListo);
}

/** El envío difiere de lo pedido (cantidades ajustadas o renglones agregados). */
export function difiereDelPedido(t) {
  return (t.items || []).some((it) => it.agregado || Math.abs((it.cantidadPreparada ?? it.cantidad) - it.cantidad) > 1e-9);
}

/* ============================== NUEVO PEDIDO ============================== */

/** Texto comparable: sin mayúsculas ni acentos. */
const normTxt = (v) => (v || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

const PASOS_PEDIDO = ['A quién le pido', 'Qué se pide', 'Revisar y enviar'];

/**
 * Indicador de pasos. Solo se puede volver a los ya recorridos: saltar para
 * adelante por acá se comería las validaciones de "Continuar".
 */
function PasosPedido({ paso, irA }) {
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
      {PASOS_PEDIDO.map((label, i) => {
        const n = i + 1;
        const activo = n === paso;
        const hecho = n < paso;
        return (
          <button
            key={n}
            type="button"
            disabled={!hecho}
            onClick={hecho ? () => irA(n) : undefined}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
              border: '1px solid ' + (activo ? 'var(--crm-color-primary)' : 'var(--crm-color-border)'),
              borderRadius: 8, background: activo ? 'var(--crm-color-primary-soft)' : 'var(--crm-color-surface)',
              cursor: hecho ? 'pointer' : 'default', textAlign: 'left', minWidth: 0,
            }}
          >
            <span
              style={{
                width: 22, height: 22, borderRadius: '50%', display: 'inline-flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 12, fontWeight: 700, flex: 'none',
                background: activo || hecho ? 'var(--crm-color-primary)' : 'var(--crm-color-border)',
                color: activo || hecho ? 'var(--crm-color-primary-contrast)' : 'var(--crm-color-text-secondary)',
              }}
            >
              {hecho ? '✓' : n}
            </span>
            <span
              style={{
                fontSize: 12.5, fontWeight: activo ? 700 : 500, minWidth: 0,
                color: activo ? 'var(--crm-color-text)' : 'var(--crm-color-text-secondary)',
              }}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Cartelito del guardado automático: el cajero tiene que poder confiar en él. */
function AvisoGuardado({ estado }) {
  const m = {
    pendiente: { txt: 'Cambios sin guardar…', color: 'var(--crm-color-text-secondary)' },
    guardando: { txt: 'Guardando…', color: 'var(--crm-color-text-secondary)' },
    guardado: { txt: '✓ Guardado — podés cerrar y seguir después', color: 'var(--crm-color-success)' },
    error: { txt: '⚠ No se pudo guardar. Revisá la conexión antes de cerrar.', color: 'var(--crm-color-accent-2)' },
  }[estado];
  if (!m) return null;
  return <span style={{ fontSize: 12, fontWeight: 600, color: m.color, whiteSpace: 'nowrap' }}>{m.txt}</span>;
}

/**
 * EL PEDIDO SE ARMA EN TRES PASOS, Y DURANTE EL DÍA.
 * ============================================================================
 * Cómo se usa de verdad: el cajero atiende clientes y arma el pedido en los
 * ratos libres. Así que el pedido NO vive en esta pantalla: vive en la base
 * como `borrador` desde que se elige la ruta (0055). Todo lo que se toca acá
 * se guarda solo; cerrar el modal es "sigo después", no "perdí el día".
 *
 * El borrador es UNO POR RUTA (origen → destino), no por cajero: el pedido es
 * del local, y el que entra al turno sigue la lista que dejó el anterior.
 *
 * Los tres pasos:
 *   1. a quién le pido y para dónde  → al continuar, abre o RETOMA el borrador
 *   2. qué pido                      → buscador + dos pestañas, guardado solo
 *   3. revisar y enviar              → resumen, avisos y recién ahí es demanda
 */
export function TransferenciaModal({ itemsIniciales, observaciones: obsInicial, borradorId }) {
  const { store, act, toast, closeModal } = useProductos();
  const dist = store.distribuidora();
  // Los defaults salen de la SESIÓN: quien pide es el que se logueó, para SU
  // sucursal. (Un admin parado en otra sucursal puede cambiarlos igual.)
  const sesion = leerSesion();
  const miId = (sesion?.sucursal?.id != null && store.getSucursal(sesion.sucursal.id) ? sesion.sucursal.id : null)
    ?? store.state.ctx.sucursalId;
  // Al retomar, la ruta la manda el borrador: es la que lo identifica.
  const retomado = borradorId ? store.state.transferencias.find((t) => t.id === borradorId) : null;
  // Pull: el destino soy YO; el origen arranca en la Distribuidora, que es el
  // depósito central — pero puede ser cualquier otra sucursal.
  const [destinoId, setDestinoId] = useState(retomado?.destinoId ?? miId ?? dist?.id);
  const [origenId, setOrigenId] = useState(() => {
    if (retomado) return retomado.origenId;
    const candidato = dist && dist.id !== miId ? dist.id : store.state.sucursales.find((su) => su.id !== miId)?.id;
    return candidato ?? '';
  });
  /**
   * QUIÉN PIDE: el usuario de la sesión, y NO se elige (15/8/2026).
   *
   * Al RETOMAR queda el que lo abrió (decisión del dueño): el pedido se arma
   * durante el día y lo continúa quien entra al turno, pero el responsable del
   * armado es quien lo empezó. Si se pisara con el de la sesión, al enviarlo
   * figuraría el último que pasó por la pantalla, no el que lo armó.
   */
  const [userId, setUserId] = useState(
    retomado?.usuarioId
      ?? (sesion?.usuario?.id != null && store.getUsuario(sesion.usuario.id) ? sesion.usuario.id : null)
      ?? store.state.ctx.usuarioId,
  );
  /**
   * El jefe puede armar el pedido EN NOMBRE de otra sucursal —el servidor se lo
   * permite (`sucursalDeOperacion` honra el destino pedido solo para jefes)— y
   * esto abre esa puerta sin dejarla abierta: arranca cerrada, y ni siquiera se
   * ve para la cajera, a quien el servidor le clava su sucursal igual.
   */
  const esJefe = ['admin', 'superadmin'].includes(sesion?.usuario?.rolClave ?? '');
  const [cambiandoQuienPide, setCambiandoQuienPide] = useState(false);
  const [obs, setObs] = useState(obsInicial ?? '');
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [soloSinStock, setSoloSinStock] = useState(false);
  /** Se abre en el paso 2 cuando se viene a RETOMAR un borrador ya elegido. */
  const [paso, setPaso] = useState(borradorId ? 2 : 1);
  const [abriendo, setAbriendo] = useState(false);
  const [guardado, setGuardado] = useState(null);
  /** El explorador del catálogo, para armar el pedido recorriendo en vez de tipear. */
  const [explorando, setExplorando] = useState(false);
  /**
   * En qué grupo se está trabajando MIENTRAS se arma la lista. El pedido que
   * sale es UNO solo: esto no lo parte, solo separa la vista — las cajeras
   * recorren la góndola de los enteros y la de los granel en dos recorridos
   * distintos, y mezclarlos en una lista larga hace perder el lugar.
   *
   * Arranca en el grupo del PRIMER renglón cuando el modal abre con cosas
   * cargadas (el sugerido por stock bajo): si no, abriría en una pestaña vacía
   * teniendo renglones en la otra.
   */
  const [grupo, setGrupo] = useState('enteros');
  const otroGrupo = GRUPOS_PEDIDO.find((g) => g.id !== grupo);

  const origenNum = parseInt(origenId, 10) || null;
  const destinoNum = parseInt(destinoId, 10) || null;

  /*
   * EL ORIGEN SIGUE AL DESTINO, y esto no es un lujo: son dos formas de que el
   * modal quede con un origen que no existe en su propio desplegable, y en las
   * dos el <select> muestra otra cosa de la que tiene guardada.
   *
   *   · El valor inicial se calcula al MONTAR, y las sucursales llegan por red:
   *     con la lista todavía vacía no hay candidato y el origen queda en "".
   *   · Y si se cambia el destino a la sucursal que estaba de origen, esa opción
   *     desaparece de la lista pero el estado se queda con ella.
   *
   * Se repara acá una sola vez, con la misma preferencia de siempre: la
   * Distribuidora, que es el depósito central, y si no cualquier otra.
   */
  useEffect(() => {
    if (origenNum && origenNum !== destinoNum && store.getSucursal(origenNum)) return;
    const preferida = dist && dist.id !== destinoNum ? dist.id : null;
    const otra = preferida ?? store.state.sucursales.find((su) => su.id !== destinoNum)?.id ?? '';
    if (otra !== origenId) setOrigenId(otra);
    // `store.getSucursal` es estable; lo que importa es la lista y el destino.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.state.sucursales, destinoNum, origenNum]);
  const origen = store.getSucursal(origenNum);
  const destino = store.getSucursal(destinoNum);

  /* Las dos medidas del stock, con su regla en domain/pedido.js: el DESTINO
     vale por lo que tiene (en cualquier forma) y el ORIGEN por lo que puede
     mandar (el granel suelto). Son distintas a propósito. */
  const dispTotal = (p, sucId) => disponibleTotal(store, p, sucId);
  const dispParaEnviar = (p, sucId) => puedeMandar(store, p, sucId);

  /**
   * Cada pestaña busca SOLO lo suyo: parado en "Prod. Enteros" no aparece un
   * granel. Si no, el buscador obliga a leer el tipo de cada resultado antes de
   * hacer clic, que es justo el trabajo que las pestañas vinieron a sacar.
   *
   * Se cuentan igual las coincidencias de la OTRA pestaña (`otros`) para no
   * dejar un "nada coincide" mentiroso cuando el producto existe al lado.
   */
  const busqueda = useMemo(() => {
    const ql = normTxt(q);
    if (!ql && !soloSinStock) return { lista: [], otros: 0 };
    const cod = q.trim();
    const lista = [];
    let otros = 0;
    for (const p of store.state.productos) {
      if (soloSinStock && dispTotal(p, destinoNum) > 1e-9) continue;
      if (ql && !(normTxt(p.nombre).includes(ql) || normTxt(p.marca).includes(ql)
        || (p.codigoBarras || '').includes(cod) || (p.codigoPropio || '').includes(cod)
        // También por el código del PAQUETE: escanear un 500 g tiene que
        // encontrarlo, y ese código es de la presentación, no de la madre.
        || (p.presentaciones || []).some((pr) => (pr.codigoBarras || '').includes(cod)))) continue;
      if (listaDeProducto(p) !== grupo) { otros += 1; continue; }
      if (lista.length >= 8) continue;

      /*
       * EN GRANEL SE OFRECEN LOS TAMAÑOS, NO LA MADRE (decisión del dueño,
       * 11/8/2026): lo que viaja a una sucursal son paquetes, así que la madre
       * en la lista solo daba una fila más para elegir mal — y obligaba a
       * elegir el tamaño DESPUÉS, en un desplegable del renglón ya agregado.
       *
       * El explorador del catálogo ya lo hacía así desde el primer día; este
       * buscador —el rápido, el que se usa con el lector— se había quedado con
       * la fila de la madre. Misma regla en los dos, y la excepción también:
       * un granel SIN tamaños definidos no tiene paquetes que ofrecer, y
       * esconderlo sería no poder pedirlo nunca.
       */
      const tamanos = grupo === 'granel' ? (p.presentaciones || []) : [];
      if (!tamanos.length) { lista.push({ clave: `p${p.id}`, p, pres: null }); continue; }
      for (const pr of tamanos) {
        if (lista.length >= 8) break;
        lista.push({ clave: `f${pr.id}`, p, pres: pr });
      }
    }
    return { lista, otros };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.state.productos, store.state.stock, q, soloSinStock, destinoNum, grupo]);
  const resultados = busqueda.lista;

  /** Cuántos renglones cayeron en cada pestaña (el pedido sigue siendo UNO). */
  const porGrupo = useMemo(() => {
    const c = { enteros: 0, granel: 0 };
    for (const it of items) {
      const prod = store.getProducto(parseInt(it.prodId, 10));
      if (prod) c[listaDeProducto(prod)] += 1;
    }
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, store.state.productos]);

  /* ==================== EL BORRADOR Y SU GUARDADO SOLO ====================
   * El estado que importa vive en refs y no en `useState`: el guardado corre
   * con retardo (después de que el cajero deja de tipear) y al desmontar, o
   * sea FUERA del render que lo programó. Leer de `items` ahí guardaría la
   * lista vieja — el error clásico de un autosave con clausura vieja.
   */
  const bId = useRef(borradorId ?? null);
  const itemsRef = useRef(items);
  const obsRef = useRef(obs);
  const sucio = useRef(false);
  const timer = useRef(null);
  const vivo = useRef(true);
  itemsRef.current = items;
  obsRef.current = obs;

  const guardarYa = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (!bId.current || !sucio.current) return true;
    sucio.current = false;
    if (vivo.current) setGuardado('guardando');
    const r = await store.guardarBorradorPedido(bId.current, {
      observaciones: obsRef.current,
      items: itemsRef.current.map((it) => ({
        productoId: parseInt(it.prodId, 10),
        presId: it.presId ? parseInt(it.presId, 10) : null,
        cantidad: parseFloat(it.cant) || 0,
      })).filter((it) => it.productoId),
    });
    if (!r.ok) sucio.current = true;   // que el próximo intento lo reintente
    if (vivo.current) setGuardado(r.ok ? 'guardado' : 'error');
    return r.ok;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Cada cambio programa el guardado; tipear seguido no manda una llamada por tecla. */
  const marcarSucio = useCallback(() => {
    if (!bId.current) return;
    sucio.current = true;
    setGuardado('pendiente');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(guardarYa, 900);
  }, [guardarYa]);

  /*
   * Al desmontar se guarda lo que quedó pendiente. Es la red de seguridad del
   * caso real: el cajero cierra el modal (o la pestaña) apurado porque entró
   * un cliente, medio segundo después de tipear la última cantidad.
   */
  useEffect(() => {
    vivo.current = true;   // se re-arma: en desarrollo React monta dos veces
    return () => {
      vivo.current = false;
      if (sucio.current) guardarYa();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [guardarYa]);

  /** Retomar: trae los renglones del borrador a la pantalla. */
  const cargarDelBorrador = (b) => {
    setItems((b.items || []).map((it) => ({
      prodId: String(it.productoId),
      presId: it.presentacionId ? String(it.presentacionId) : '',
      cant: String(it.cantidad ?? 0),
    })));
    if (b.observaciones) setObs(b.observaciones);
    // Abre en la pestaña donde HAY algo: si no, se ve vacía teniendo renglones.
    const prim = (b.items || [])[0];
    const prod = prim ? store.getProducto(prim.productoId) : null;
    setGrupo(prod ? listaDeProducto(prod) : 'enteros');
  };

  /** Al montar sobre un borrador ya elegido (botón "Seguir armando"). */
  useEffect(() => {
    if (retomado) cargarDelBorrador(retomado);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Paso 1 → 2: abre o RETOMA el borrador de esa ruta. Si el modal venía con
   * renglones sugeridos (la reposición por stock mínimo), se suman a lo que ya
   * había en vez de reemplazarlo.
   */
  const abrirYSeguir = async () => {
    if (!origenNum || !destinoNum || origenNum === destinoNum) {
      toast('Elegí un origen y un destino distintos.', 'err');
      return;
    }
    setAbriendo(true);
    const r = await store.abrirBorradorPedido(origenNum, destinoNum);
    setAbriendo(false);
    if (!r.ok) { toast(r.error || 'No se pudo abrir el pedido.', 'err'); return; }
    bId.current = r.id;
    const previos = (r.items || []).map((it) => ({
      prodId: String(it.productoId),
      presId: it.presentacionId ? String(it.presentacionId) : '',
      cant: String(it.cantidad ?? 0),
    }));
    const sugeridos = itemsIniciales || [];
    const juntos = [...previos];
    for (const sug of sugeridos) {
      const i = juntos.findIndex((x) => x.prodId === String(sug.prodId) && (x.presId || '') === (sug.presId || ''));
      if (i >= 0) juntos[i] = { ...juntos[i], cant: String((parseFloat(juntos[i].cant) || 0) + (parseFloat(sug.cant) || 0)) };
      else juntos.push({ prodId: String(sug.prodId), presId: sug.presId || '', cant: String(sug.cant ?? 1) });
    }
    setItems(juntos);
    if (r.observaciones && !obsInicial) setObs(r.observaciones);
    const prim = juntos[0];
    const prod = prim ? store.getProducto(parseInt(prim.prodId, 10)) : null;
    setGrupo(prod ? listaDeProducto(prod) : 'enteros');
    setPaso(2);
    if (sugeridos.length) marcarSucio();   // lo sugerido hay que persistirlo
    if (previos.length) {
      toast(`Retomaste el pedido que estaba armado: ${previos.length} renglón(es).`, 'ok');
    }
  };

  /**
   * Agrega arriba de todo; si el MISMO artículo ya está (mismo producto y misma
   * presentación), suma 1 en vez de duplicar el renglón.
   *
   * `presId` viene del explorador del catálogo, que lista cada tamaño como una
   * fila propia: desde ahí se pide "Ajo en Polvo · 500 g" derecho, sin agregar
   * la madre y después cambiar el selector.
   */
  const agregar = (p, presId = '') => {
    if (!p) return;
    const pres = presId ? String(presId) : '';
    setItems((rows) => {
      const i = rows.findIndex((r) => parseInt(r.prodId, 10) === p.id && (r.presId || '') === pres);
      if (i >= 0) return rows.map((r, j) => (j === i ? { ...r, cant: String((parseFloat(r.cant) || 0) + 1) } : r));
      return [{ prodId: String(p.id), presId: pres, cant: '1' }, ...rows];
    });
    setQ('');
    marcarSucio();
    // No hace falta saltar de pestaña: el buscador de cada una solo ofrece lo
    // suyo, así que el renglón cae siempre en la que está a la vista.
  };

  const setItem = (i, patch) => {
    setItems((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    marcarSucio();
  };
  const delItem = (i) => {
    setItems((rows) => rows.filter((_, j) => j !== i));
    marcarSucio();
  };
  const editarObs = (v) => { setObs(v); marcarSucio(); };

  /**
   * Cierra dejando el pedido a medio armar. Guarda lo pendiente y **recarga el
   * estado una vez**: el guardado automático no lo hace a propósito (traería el
   * inventario entero cada dos segundos), así que sin esta recarga el panel
   * quedaba mostrando la foto de cuando se abrió el borrador y decía
   * "0 renglones" justo después de que el cajero agregó cinco.
   */
  const cerrarYSeguirDespues = async () => {
    await guardarYa();
    closeModal();
    store.refetch();
  };

  /** Envía: recién acá el pedido es demanda y el origen lo ve. */
  const enviar = async () => {
    const ok = await guardarYa();
    if (!ok) { toast('No se pudo guardar el pedido — revisá la conexión.', 'err'); return; }
    act(
      store.enviarBorradorPedido(bId.current),
      'Pedido enviado (Pendiente). El origen lo ve en su bandeja de envíos.',
    );
  };

  /** Descarta el borrador entero. No se cancela: nunca fue un documento. */
  const descartar = () => {
    if (!bId.current) { closeModal(); return; }
    sucio.current = false;   // que el guardado del desmontaje no lo resucite
    act(store.descartarBorradorPedido(bId.current), 'Pedido descartado.');
  };

  /**
   * Lo que hay que mirar antes de mandar: cuántos renglones van, cuántos kilos
   * tiene que fraccionar el origen, y —lo que más sirve— qué renglones el
   * origen NO puede cubrir hoy. Es la única pantalla donde eso se ve junto:
   * pedir 20 kg de algo que allá tienen 3 no es un error, pero conviene
   * saberlo antes y no cuando llega el envío cortado.
   */
  const resumen = useMemo(() => {
    let enteros = 0; let granel = 0; let kgAFraccionar = 0;
    const sinCantidad = [];
    const cortos = [];
    for (const it of items) {
      const prod = store.getProducto(parseInt(it.prodId, 10));
      if (!prod) continue;
      const cant = parseFloat(it.cant) || 0;
      if (!(cant > 0)) { sinCantidad.push(prod.nombre); continue; }
      const esGranel = prod.tipo === 'granel';
      if (esGranel) granel += 1; else enteros += 1;
      const presNum = it.presId ? parseInt(it.presId, 10) : null;
      const pres = presNum ? (prod.presentaciones || []).find((x) => x.id === presNum) : null;
      const pide = esGranel ? cant * (pres ? pres.tamKg : 1) : cant;
      if (esGranel) kgAFraccionar += pres ? pide : 0;
      const hay = dispParaEnviar(prod, origenNum);
      if (pide > hay + 1e-9) {
        cortos.push({
          nombre: prod.nombre,
          detalle: esGranel
            ? `pide ${num(pide, 3)} kg y hay ${num(hay, 3)} kg de granel`
            : `pide ${num(cant, 3)} y hay ${num(hay, 3)}`,
        });
      }
    }
    return { enteros, granel, kgAFraccionar, sinCantidad, cortos, conCantidad: enteros + granel };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, store.state.productos, store.state.stock, origenNum]);

  const footer = paso === 1
    ? [
      { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
      { texto: abriendo ? 'Abriendo…' : 'Continuar', clase: 'btn-primary', onClick: abrirYSeguir },
    ]
    : paso === 2
      ? [
        { texto: 'Cerrar y seguir después', clase: 'btn-ghost', onClick: cerrarYSeguirDespues },
        { texto: 'Volver', clase: 'btn-ghost', onClick: () => setPaso(1) },
        { texto: 'Continuar', clase: 'btn-primary', onClick: () => setPaso(3) },
      ]
      : [
        { texto: 'Descartar el pedido', clase: 'btn-delete', onClick: descartar },
        { texto: 'Volver', clase: 'btn-ghost', onClick: () => setPaso(2) },
        {
          texto: resumen.conCantidad ? `Enviar pedido (${resumen.conCantidad})` : 'Enviar pedido',
          clase: 'btn-primary',
          onClick: enviar,
        },
      ];

  return (
    <>
      <ModalShell
        title="Pedido de mercadería"
        subtitle={`Paso ${paso} de 3 · ${PASOS_PEDIDO[paso - 1]}`}
        wide
        onClose={cerrarYSeguirDespues}
        footer={footer}
      >
      <PasosPedido paso={paso} irA={setPaso} />

      {/* ==================== PASO 1 · A QUIÉN Y PARA DÓNDE ==================== */}
      {paso === 1 && (
      <>
      {/*
        DOS PREGUNTAS, NO TRES (15/8/2026, rediseño pedido por el dueño).
        Antes eran "Pedir a (origen)", "Entregar en (destino)" y "Responsable",
        y las tres se elegían. Pero dos de ellas no son preguntas: quien pide es
        el que está logueado, en el local donde está parado, y lo que pide se
        descarga ahí mismo — se entiende por lógica y no hace falta decirlo.
        Peor: al ofrecerlas como desplegables invitaban a un error caro (mandarle
        el pedido a otro local) en la pantalla más apurada del día.
        Queda QUIÉN PIDE, fijo, y A QUIÉN, que es la única decisión real.
      */}
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Quién pide</label>
          {cambiandoQuienPide ? (
            <>
              <select value={destinoId} onChange={(e) => setDestinoId(parseInt(e.target.value, 10))}>
                {sucursalOptions(store, false)}
              </select>
              <select
                value={userId}
                onChange={(e) => setUserId(parseInt(e.target.value, 10))}
                style={{ marginTop: 6 }}
              >
                {usuarioOptions(store)}
              </select>
            </>
          ) : (
            <>
              <div className={cx(s.card)} style={{ padding: '9px 12px', display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <strong>{destino?.nombre ?? '—'}</strong>
                <span className={s.muted}>· {store.getUsuario(userId)?.nombre ?? 'sin usuario'}</span>
              </div>
              {/* Solo el jefe: a la cajera el servidor le clava su sucursal
                  igual, así que ofrecérselo sería prometer lo que no se cumple. */}
              {esJefe && !retomado && (
                <button type="button" className={s.linkBtn} style={{ marginTop: 4 }} onClick={() => setCambiandoQuienPide(true)}>
                  Pedir en nombre de otra sucursal
                </button>
              )}
            </>
          )}
        </div>
        <div className={s.field}>
          <label>A quién le pide <span className={s.req}>*</span></label>
          {/* Las OTRAS, nunca la propia: pedirse mercadería a uno mismo no es una
              operación. Y no va el filtro por sesión —el de `sucursalOptions`—
              porque acá la sucursal no es dónde opero sino a quién le pido, que
              es justamente el trabajo de la cajera. Ver `sucursalOptionsOtras`. */}
          <select value={origenId} onChange={(e) => setOrigenId(parseInt(e.target.value, 10))}>
            {sucursalOptionsOtras(store, destinoNum)}
          </select>
          <div className={s.hint} style={{ margin: '6px 0 0' }}>
            La mercadería se descarga en <strong>{destino?.nombre ?? 'tu local'}</strong>.
          </div>
        </div>
      </div>

      {/* El aviso que evita el susto de "¿y esto de dónde salió?": si esa ruta
          ya tiene un pedido a medio armar, al continuar se RETOMA ese. */}
      {(() => {
        const yaHay = origenNum && destinoNum ? store.borradorDeRuta(origenNum, destinoNum) : null;
        if (!yaHay) {
          return (
            <div className={s.hint}>
              El pedido se guarda solo desde el primer renglón: podés armarlo de a poco durante el día
              y volver cuando puedas. Recién se le avisa al origen cuando lo <strong>envías</strong>.
            </div>
          );
        }
        const u = store.getUsuario(yaHay.usuarioId);
        return (
          <div className={cx(s.callout)} style={{ marginTop: 4 }}>
            <strong>Ya hay un pedido armándose para esta ruta</strong> con{' '}
            {yaHay.items?.length ?? 0} renglón(es){u ? `, lo dejó ${u.nombre}` : ''}. Al continuar lo
            vas a <strong>retomar</strong> — el pedido es del local, no de cada cajero, así que no se
            arman dos por separado.
          </div>
        );
      })()}
      </>
      )}

      {/* ==================== PASO 2 · QUÉ SE PIDE ==================== */}
      {paso === 2 && (
      <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div className={s.muted} style={{ fontSize: 13 }}>
          <strong>{origen?.nombre ?? 'origen'}</strong> → <strong>{destino?.nombre ?? 'destino'}</strong>
        </div>
        <AvisoGuardado estado={guardado} />
      </div>

      {/* Dos grupos SOLO para armar: el pedido que sale es uno. Es el recorrido
          real de la góndola — los enteros por un lado, el granel por otro.
          Van ARRIBA del buscador porque manda sobre él: cada pestaña busca,
          ofrece y lista únicamente sus productos. */}
      <div className={s.pestanas} role="tablist" aria-label="Cómo se agrupan los renglones del pedido" style={{ marginTop: 4 }}>
        {GRUPOS_PEDIDO.map((g) => (
          <button
            key={g.id}
            type="button"
            role="tab"
            aria-selected={grupo === g.id}
            className={cx(s.pestana, grupo === g.id && s.pestanaActiva)}
            onClick={() => setGrupo(g.id)}
          >
            {g.label}
            {porGrupo[g.id] > 0 && <span className={s.pestanaBadge}>{porGrupo[g.id]}</span>}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        <div className={s.toolbar} style={{ marginTop: 4 }}>
          <input
            type="search"
            autoFocus
            placeholder={grupo === 'granel'
              ? 'Buscar un producto a granel por nombre, marca o código y agregarlo con Enter…'
              : 'Buscar un producto entero por nombre, marca o código y agregarlo con Enter…'}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregar(resultados[0]); } }}
          />
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, whiteSpace: 'nowrap', cursor: 'pointer' }}>
            <input type="checkbox" checked={soloSinStock} onChange={(e) => setSoloSinStock(e.target.checked)} />
            Ver solo sin stock en {destino?.nombre ?? 'mi sucursal'}
          </label>
          {/* El buscador de arriba sirve si ya sabés qué querés. Esto es para
              RECORRER el catálogo por proveedor, categoría o marca — que es
              como se arma el pedido semanal mirando la góndola. */}
          <Btn variant="btn-edit" onClick={() => setExplorando(true)}>Buscar en el catálogo</Btn>
        </div>

        {resultados.length > 0 && (
          <div className={s.card} style={{ padding: 0, marginTop: 6, overflow: 'hidden' }}>
            {resultados.map(({ clave, p, pres }) => {
              /*
               * ORIGEN: lo que puede MANDAR, que en un granel es siempre el
               * granel suelto —también en la fila de un tamaño—, porque el
               * paquete se fracciona del madre al preparar.
               * DESTINO: lo que TIENE en ESA forma, o sea los paquetes de ese
               * tamaño; y el granel suelto va como nota al lado, porque la fila
               * de la madre ya no está para decirlo. Sin eso, "0 paq. de 500 g"
               * esconde que el local tiene 123 kg sin envasar y se pide de más.
               */
              const enOrigen = dispParaEnviar(p, origenNum);
              const aca = pres
                ? store.cant(p.id, destinoNum, pres.id, 'disponible')
                : dispTotal(p, destinoNum);
              const suelto = pres ? store.cant(p.id, destinoNum, null, 'disponible') : 0;
              const codigo = pres ? (pres.codigoBarras || '') : (p.codigoBarras || p.codigoPropio || '');
              return (
                <div
                  key={clave}
                  className={s.clickable}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', borderBottom: '1px solid var(--crm-color-border)', cursor: 'pointer' }}
                  onClick={() => agregar(p, pres ? pres.id : '')}
                >
                  <span style={{ flex: 1 }}>
                    <strong>{p.nombre}</strong>
                    {pres && <strong> · {store.presLabel(p, pres.id)}</strong>}
                    <span className={s.muted}> · {p.marca || 'Sin marca'}</span>
                    {codigo && <span className={cx(s.muted, s.mono)} style={{ fontSize: 11.5 }}> · {codigo}</span>}
                  </span>
                  <span className={cx(s.mono)} style={{ fontSize: 12.5, color: enOrigen > 0 ? 'var(--crm-color-text-secondary)' : 'var(--crm-color-accent-2)' }}>
                    {origen?.nombre}: {store.fmtCant(p, null, enOrigen)}
                  </span>
                  <span className={cx(s.mono)} style={{ fontSize: 12.5, color: aca > 0 ? 'var(--crm-color-text-secondary)' : 'var(--crm-color-accent-2)' }}>
                    acá: {store.fmtCant(p, pres ? pres.id : null, aca)}
                    {suelto > 1e-9 && (
                      <span className={s.muted}> (+{store.fmtCant(p, null, suelto)} a granel)</span>
                    )}
                  </span>
                  <span style={{ color: 'var(--crm-color-primary)', fontWeight: 700 }}>+ Agregar</span>
                </div>
              );
            })}
          </div>
        )}
        {/* Un buscador acotado puede decir "no existe" de algo que sí existe: si
            la coincidencia está en la otra pestaña, se avisa y se ofrece ir. */}
        {(q || soloSinStock) && !resultados.length && (
          <div className={s.hint}>
            {busqueda.otros > 0 ? (
              <>
                Nada coincide entre los productos {grupo === 'granel' ? 'a granel' : 'enteros'}
                {soloSinStock ? ' sin stock' : ''}, pero hay {busqueda.otros}{' '}
                {grupo === 'granel' ? 'entre los enteros' : 'a granel'}.{' '}
                <button
                  type="button"
                  className={s.linkBtn}
                  onClick={() => setGrupo(grupo === 'granel' ? 'enteros' : 'granel')}
                >
                  Ver {otroGrupo.label}
                </button>
              </>
            ) : (
              <>Nada coincide{soloSinStock ? ' entre los productos sin stock' : ''}.</>
            )}
          </div>
        )}

        <div className={s['section-title']} style={{ marginTop: 8 }}>
          {grupo === 'granel' ? 'A granel' : 'Enteros'} en el pedido ({porGrupo[grupo]} de {items.length} en
          total) — el último agregado queda arriba
        </div>
        <Table
          cols={[
            { h: 'Producto' }, { h: 'Present.' },
            { h: `En ${origen?.nombre ?? 'origen'}`, num: true }, { h: `En ${destino?.nombre ?? 'destino'}`, num: true },
            { h: 'Cantidad', num: true }, { h: '', cls: 'actions-col' },
          ]}
          empty={grupo === 'granel'
            ? 'Todavía no agregaste productos a granel. Buscalos con el buscador de esta pestaña.'
            : 'Todavía no agregaste productos enteros. Buscá arriba y agregá con un clic o Enter.'}
        >
          {items
            // El índice ORIGINAL viaja con la fila: editar y borrar apuntan a la
            // lista completa, no a la vista filtrada.
            .map((it, i) => ({ it, i }))
            .filter(({ it }) => {
              const prod = store.getProducto(parseInt(it.prodId, 10));
              return prod && listaDeProducto(prod) === grupo;
            })
            .map(({ it, i }) => {
              const prod = store.getProducto(parseInt(it.prodId, 10));
              const presNum = it.presId ? parseInt(it.presId, 10) : null;
              const esGranel = prod.tipo === 'granel';
              /*
               * ORIGEN: lo que puede mandar. En un granel es SIEMPRE el granel
               * suelto —de ahí se fracciona— sin importar qué presentación se
               * pidió; los paquetes que ya están armados en la Distribuidora son
               * su góndola y no viajan.
               */
              const enOrigen = origenNum ? dispParaEnviar(prod, origenNum) : 0;
              const aca = destinoNum ? store.cant(prod.id, destinoNum, presNum, 'disponible') : 0;
              // Cuántos kg de granel hace falta fraccionar para este renglón.
              const pres = presNum ? (prod.presentaciones || []).find((x) => x.id === presNum) : null;
              const pideKg = esGranel
                ? (parseFloat(it.cant) || 0) * (pres ? pres.tamKg : 1)
                : 0;
              const alcanza = !esGranel || pideKg <= enOrigen + 1e-9;
              return (
                <tr key={`${it.prodId}-${it.presId}-${i}`}>
                  <td>
                    <strong>{prod.nombre}</strong>
                    <div className={s.hint} style={{ margin: 0 }}>{prod.marca || 'Sin marca'}</div>
                  </td>
                  <td>
                    <select value={it.presId} onChange={(e) => setItem(i, { presId: e.target.value })}>
                      {presentacionOptions(prod, true)}
                    </select>
                  </td>
                  {/* El disponible es informativo: orienta el pedido, no lo limita. */}
                  <td
                    className={cx(s.num, s.mono)}
                    style={alcanza && enOrigen > 0 ? undefined : { color: 'var(--crm-color-accent-2)', fontWeight: 700 }}
                  >
                    {store.fmtCant(prod, esGranel ? null : presNum, enOrigen)}
                    {esGranel && pideKg > 0 && (
                      <div className={s.hint} style={{ margin: 0, whiteSpace: 'nowrap' }}>
                        {alcanza
                          ? `se fraccionan ${num(pideKg, 3)} kg`
                          : `faltan ${num(pideKg - enOrigen, 3)} kg`}
                      </div>
                    )}
                  </td>
                  <td className={cx(s.num, s.mono)} style={aca > 0 ? undefined : { color: 'var(--crm-color-accent-2)', fontWeight: 700 }}>
                    {store.fmtCant(prod, presNum, aca)}
                  </td>
                  <td className={s.num}>
                    {/* La flechita va DE A 1 (antes sumaba 0.001 y "1" pasaba a
                        "1,001"). Para kg con coma se tipea el número directo. */}
                    <input
                      type="number" min="0" step="1"
                      value={it.cant}
                      style={{ width: 90, textAlign: 'right' }}
                      onChange={(e) => setItem(i, { cant: e.target.value })}
                    />
                  </td>
                  <td className={s['actions-col']}>
                    <button type="button" className={s['pres-remove']} onClick={() => delItem(i)}>×</button>
                  </td>
                </tr>
              );
            })}
        </Table>
      </div>

      <div className={s.hint}>
        El pedido es <strong>demanda</strong>: no toca ni exige stock. El origen lo divide en sus dos
        listas al preparar y la reserva llega recién cuando cada encargado confirma la suya. En los
        productos a granel, la columna de <strong>{origen?.nombre ?? 'origen'}</strong> muestra el
        <strong> granel suelto</strong>: los paquetes se fraccionan del madre al preparar, y los que ya
        están armados allá son su góndola.
      </div>
      </>
      )}

      {/* ==================== PASO 3 · REVISAR Y ENVIAR ==================== */}
      {paso === 3 && (
      <>
      <div className={s.card} style={{ marginBottom: 'var(--crm-space-3)' }}>
        <div className={s['detalle-info']}>
          <div className={s.di}><div className={s.l}>Le pido a</div><div className={s.v}>{origen?.nombre ?? '—'}</div></div>
          <div className={s.di}><div className={s.l}>Entregar en</div><div className={s.v}>{destino?.nombre ?? '—'}</div></div>
          <div className={s.di}><div className={s.l}>Responsable</div><div className={s.v}>{store.getUsuario(parseInt(userId, 10))?.nombre ?? '—'}</div></div>
          <div className={s.di}>
            <div className={s.l}>Renglones</div>
            <div className={s.v}>
              {resumen.conCantidad} — {resumen.enteros} entero(s) y {resumen.granel} a granel
            </div>
          </div>
          {resumen.kgAFraccionar > 0 && (
            <div className={s.di}>
              <div className={s.l}>Van a fraccionar</div>
              <div className={s.v}>{num(resumen.kgAFraccionar, 3)} kg del producto madre</div>
            </div>
          )}
        </div>
      </div>

      {/* Los renglones que el origen no puede cubrir HOY. No frena el pedido —es
          demanda, y mañana puede haber— pero pedir 20 kg de algo que allá tienen
          3 conviene saberlo acá y no cuando llega el envío cortado. */}
      {resumen.cortos.length > 0 && (
        <div className={cx(s.callout, s.warn)}>
          <strong>{origen?.nombre ?? 'El origen'} hoy no llega con {resumen.cortos.length} renglón(es):</strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {resumen.cortos.slice(0, 6).map((c, i) => (
              <li key={i} style={{ fontSize: 13 }}>{c.nombre} — {c.detalle}</li>
            ))}
          </ul>
          {resumen.cortos.length > 6 && <div className={s.hint} style={{ margin: 0 }}>y {resumen.cortos.length - 6} más.</div>}
          <div className={s.hint} style={{ marginBottom: 0 }}>
            Se puede pedir igual: el origen ajusta lo que prepara y vos lo ves al recibir.
          </div>
        </div>
      )}

      {resumen.sinCantidad.length > 0 && (
        <div className={cx(s.callout)}>
          <strong>{resumen.sinCantidad.length} renglón(es) quedaron sin cantidad</strong> y no se van a
          enviar: {resumen.sinCantidad.slice(0, 4).join(', ')}{resumen.sinCantidad.length > 4 ? '…' : ''}.
          Volvé al paso anterior si querés completarlos.
        </div>
      )}

      <div className={s.field}>
        <label>Observaciones para el que prepara</label>
        <input
          value={obs}
          placeholder="Reposición semanal, urgente, mandar con el flete del jueves…"
          onChange={(e) => editarObs(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}><AvisoGuardado estado={guardado} /></div>

      <div className={s.hint}>
        Al enviarlo, el pedido toma su número de la serie TR y le aparece al origen en{' '}
        <strong>Pedidos de envío</strong>. Hasta entonces nadie lo ve más que ustedes.
        <strong> Descartar</strong> lo borra: no queda un pedido cancelado en el historial, porque
        nunca fue un documento.
      </div>
      </>
      )}
      </ModalShell>

      {/* El explorador del catálogo, arriba del pedido. Comparte el `agregar`
          del pedido, así lo que se elige acá también se guarda solo. */}
      {explorando && (
        <ExplorarProductosModal
          grupo={grupo}
          origenId={origenNum}
          destinoId={destinoNum}
          yaEnPedido={(prodId, presId) => {
            const it = items.find((r) => parseInt(r.prodId, 10) === prodId
              && (r.presId ? parseInt(r.presId, 10) : null) === (presId || null));
            return it ? (parseFloat(it.cant) || 0) : 0;
          }}
          onAgregar={agregar}
          onClose={() => setExplorando(false)}
        />
      )}
    </>
  );
}

/* ============================== PREPARACIÓN EN DOS LISTAS ============================== */

/**
 * Hoja imprimible de UNA lista: el papel que cada encargado se lleva al
 * depósito. "Preparar" va EN BLANCO a propósito: ahí anota A LÁPIZ lo que
 * fraccionó o apartó, y con esa hoja vuelve y lo carga al sistema.
 * El formato (A4/Carta) y el membrete salen de Sistema › Impresión.
 */
function imprimirLista(t, store, tipo, filas) {
  const meta = LISTAS_PREP[tipo];
  const destino = store.getSucursal(t.destinoId)?.nombre ?? '';
  const rows = filas.map(({ it, p }) => `
    <tr>
      <td>${esc(p.nombre)}${it.agregado ? ' <em>(agregado)</em>' : ''}</td>
      <td class="chica">${esc(store.presLabel(p, it.presentacionId))}</td>
      <td class="chica n">${it.agregado ? '—' : esc(store.fmtCant(p, it.presentacionId, it.cantidad))}</td>
      <td class="prep"></td>
      <td class="obs">${esc(it.motivo || '')}</td>
      <td class="c">&#9744;</td>
    </tr>`).join('');
  imprimirDocumento('listaPreparacion', {
    titulo: `${t.codigo} — ${meta.titulo}`,
    cuerpo: `
      <h1>${esc(t.codigo)} · ${esc(meta.titulo)} — para ${esc(destino)}</h1>
      <div class="sub">Lista del ${esc(meta.encargado)} · ${filas.length} renglón(es) · impresa ${esc(new Date().toLocaleString('es-AR'))} · anotá lo preparado y cargalo al volver</div>
      <table><thead><tr><th>Producto</th><th>Present.</th><th>Pedido</th><th>Preparar</th><th>Observación</th><th>&#10003;</th></tr></thead><tbody>${rows}</tbody></table>`,
  });
}

/**
 * LA PANTALLA DE LOS ENCARGADOS. El pedido es UNO, pero acá se ve partido en
 * dos listas por tipo de producto — cada encargado imprime la suya, ajusta lo
 * preparado ("pidieron 20, hay 14"), agrega lo que llegó a último momento y
 * CONFIRMA. Confirmar reserva el stock; con todas las listas confirmadas se
 * habilita el despacho, que viaja con lo PREPARADO.
 */
export function PrepararTransferModal({ id }) {
  const { store, isAdmin, can, act, toast, closeModal, openModal } = useProductos();
  const t = store.state.transferencias.find((x) => x.id === id);
  /** Sobrescritura local por renglón; se persiste al salir del campo. */
  const [edits, setEdits] = useState({});
  /** Formulario de alta por lista (null = cerrado). */
  const [altas, setAltas] = useState({});
  const [ocupado, setOcupado] = useState(false);

  const grupos = useMemo(() => {
    const g = { enteros: [], granel: [] };
    for (const it of t?.items ?? []) {
      const p = store.getProducto(it.productoId);
      g[listaDeProducto(p)].push({ it, p });
    }
    return g;
  }, [t, store]);

  /** Quién puede TOCAR cada lista: el admin las dos, cada encargado la suya. */
  const puedeLista = (tipo) => isAdmin
    || (tipo === 'granel' && can('fraccionar'))
    || (tipo === 'enteros' && can('preparar'));

  /*
   * QUÉ LISTAS VE ESTE USUARIO.
   * --------------------------------------------------------------------------
   * El fraccionador ve Fraccionados y el preparador ve Enteros: la lista del
   * otro no le sirve para nada y le hace buscar sus renglones entre los ajenos.
   * El admin (y cualquiera que tenga los dos permisos) ve las dos, porque
   * necesita el pedido completo para despachar.
   *
   * Si alguien no puede tocar NINGUNA —un supervisor mirando— ve las dos en
   * lectura: esconderle todo dejaría el modal vacío, que es peor.
   */
  const misListas = (() => {
    const propias = ['enteros', 'granel'].filter(puedeLista);
    return propias.length ? propias : ['enteros', 'granel'];
  })();
  const soloMia = misListas.length === 1;

  if (!t) return null;
  const enPrep = t.estado === 'preparada';
  const destino = store.getSucursal(t.destinoId);

  const setEdit = (itemId, patch) => setEdits((e) => ({ ...e, [itemId]: { ...(e[itemId] || {}), ...patch } }));
  const limpiarEdit = (itemId) => setEdits((e) => { const n = { ...e }; delete n[itemId]; return n; });

  const guardarItem = async (it) => {
    const e = edits[it.id];
    if (!e) return true;
    const payload = {};
    if (e.prep != null) {
      const c = Math.max(parseFloat(e.prep) || 0, 0);
      if (Math.abs(c - it.cantidadPreparada) > 1e-9) payload.cantidadPreparada = c;
    }
    if (e.motivo != null && e.motivo.trim() !== (it.motivo || '')) payload.motivo = e.motivo.trim();
    if (!Object.keys(payload).length) { limpiarEdit(it.id); return true; }
    const res = await store.editarItemTransferencia(t.id, it.id, payload);
    if (!res.ok) { toast(res.error, 'err'); return false; }
    limpiarEdit(it.id);
    return true;
  };

  const confirmar = async (tipo, listo) => {
    setOcupado(true);
    // Lo tipeado y no guardado de ESA lista se persiste antes de confirmar.
    for (const { it } of grupos[tipo]) {
      if (!(await guardarItem(it))) { setOcupado(false); return; }
    }
    const res = await store.confirmarListaTransferencia(t.id, tipo, listo);
    setOcupado(false);
    if (!res.ok) { toast(res.error, 'err'); return; }
    toast(listo
      ? `${LISTAS_PREP[tipo].titulo} confirmada: stock reservado.`
      : `${LISTAS_PREP[tipo].titulo} desconfirmada: stock liberado.`, 'ok');
  };

  const quitar = async (it) => {
    const res = await store.quitarItemTransferencia(t.id, it.id);
    if (!res.ok) toast(res.error, 'err');
  };

  const agregar = async (tipo) => {
    const a = altas[tipo] || {};
    const prodId = parseInt(a.prodId, 10);
    const cant = parseFloat(a.cant) || 0;
    if (!prodId || cant <= 0) { toast('Elegí el producto y la cantidad que se agrega.', 'err'); return; }
    const res = await store.agregarItemTransferencia(t.id, {
      productoId: prodId, presId: a.presId ? parseInt(a.presId, 10) : null,
      cantidad: cant, motivo: (a.motivo || '').trim(),
    });
    if (!res.ok) { toast(res.error, 'err'); return; }
    setAltas((x) => ({ ...x, [tipo]: null }));
    toast('Renglón agregado al envío.', 'ok');
  };

  const completas = listasCompletas(t, store);
  const footer = [{ texto: 'Cerrar', clase: 'btn-ghost', onClick: closeModal }];
  if (isAdmin && enPrep) {
    footer.push({
      texto: 'Despachar',
      clase: completas ? 'btn-primary' : 'btn-ghost',
      onClick: () => {
        if (!completas) { toast('Cada encargado tiene que confirmar su lista antes de despachar.', 'err'); return; }
        act(store.avanzarTransferencia(t.id, 'preparada'), 'Despachada: en tránsito.');
      },
    });
  }

  const renderLista = (tipo) => {
    const meta = LISTAS_PREP[tipo];
    const confirmada = tipo === 'granel' ? t.granelListo : t.enterosListo;
    const puedeTocar = puedeLista(tipo);
    const editable = puedeTocar && enPrep && !confirmada;
    const filas = grupos[tipo];
    const alta = altas[tipo];
    const productosDeLista = store.state.productos.filter((p) => listaDeProducto(p) === tipo);
    const prodAlta = alta ? store.getProducto(parseInt(alta.prodId, 10)) : null;

    return (
      <div key={tipo} style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
          <h3 className={s['card-title']} style={{ margin: 0 }}>{meta.titulo}</h3>
          {/* Con una sola lista a la vista, aclarar de quién es sobra. */}
          {!soloMia && <span className={s.muted} style={{ fontSize: 12 }}>lista del {meta.encargado}</span>}
          <span className={cx(s.pill, confirmada ? s['st-disponible'] : s['est-pendiente'])}>
            {confirmada ? 'Confirmada · stock reservado' : 'En preparación'}
          </span>
          <span style={{ flex: 1 }} />
          {filas.length > 0 && <Btn small onClick={() => imprimirLista(t, store, tipo, filas)}>Imprimir</Btn>}
          {puedeTocar && enPrep && filas.length > 0 && (confirmada
            ? <Btn small onClick={() => confirmar(tipo, false)} disabled={ocupado}>Desconfirmar</Btn>
            : <Btn variant="btn-primary" small onClick={() => confirmar(tipo, true)} disabled={ocupado}>Confirmar lista</Btn>
          )}
        </div>

        <Table
          cols={[
            { h: 'Producto' }, { h: 'Present.' }, { h: 'Pedido', num: true }, { h: 'Preparado', num: true },
            { h: 'Motivo' }, { h: 'Disp. acá', num: true }, { h: '', cls: 'actions-col' },
          ]}
          /* Con las dos listas a la vista, "sin renglones" se entiende solo. Con
           * una sola, hay que decir que el pedido no trae nada tuyo — si no,
           * parece que la pantalla no cargó. */
          empty={soloMia
            ? `Este pedido no trae ${meta.titulo.toLowerCase()}: no hay nada para preparar de tu lado.`
            : 'Sin renglones en esta lista.'}
        >
          {filas.map(({ it, p }) => {
            const dispRow = store.cant(p.id, t.origenId, it.presentacionId || null, 'disponible');
            const granelSuelto = p.tipo === 'granel' && it.presentacionId
              ? store.cant(p.id, t.origenId, null, 'disponible') : null;
            const cero = !(it.cantidadPreparada > 1e-9) && edits[it.id]?.prep == null;
            return (
              <tr key={it.id} style={cero ? { opacity: 0.55 } : undefined}>
                <td>
                  <strong>{p.nombre}</strong>
                  {it.agregado && <span className={cx(s.pill, s['est-transito'])} style={{ marginLeft: 6 }}>Agregado</span>}
                </td>
                <td>{store.presLabel(p, it.presentacionId)}</td>
                <td className={cx(s.num, s.mono)}>{it.agregado ? '—' : store.fmtCant(p, it.presentacionId, it.cantidad)}</td>
                <td className={s.num}>
                  {editable ? (
                    <input
                      type="number" min="0" step={p.tipo === 'granel' && !it.presentacionId ? '0.001' : '1'}
                      value={edits[it.id]?.prep ?? String(it.cantidadPreparada)}
                      style={{ width: 84, textAlign: 'right' }}
                      onChange={(e) => setEdit(it.id, { prep: e.target.value })}
                      onBlur={() => guardarItem(it)}
                    />
                  ) : <strong className={s.mono}>{store.fmtCant(p, it.presentacionId, it.cantidadPreparada)}</strong>}
                </td>
                <td>
                  {editable ? (
                    <input
                      value={edits[it.id]?.motivo ?? (it.motivo || '')}
                      placeholder="sin stock, llegó tarde…"
                      style={{ width: 150 }}
                      onChange={(e) => setEdit(it.id, { motivo: e.target.value })}
                      onBlur={() => guardarItem(it)}
                    />
                  ) : (it.motivo || <span className={s.muted}>—</span>)}
                </td>
                <td className={cx(s.num, s.mono)}>
                  {store.fmtCant(p, it.presentacionId, dispRow)}
                  {granelSuelto != null && (
                    <div className={s.hint} style={{ margin: 0, whiteSpace: 'nowrap' }}>
                      granel: {num(granelSuelto, 2)} kg
                      {editable && (
                        <>
                          {' · '}
                          <a role="button" style={{ cursor: 'pointer', color: 'var(--crm-color-primary)', fontWeight: 600 }}
                            onClick={() => openModal('fraccionar', { prodId: p.id, sucId: t.origenId })}>
                            Fraccionar
                          </a>
                        </>
                      )}
                    </div>
                  )}
                </td>
                <td className={s['actions-col']}>
                  {editable && it.agregado && (
                    <button type="button" className={s['pres-remove']} title="Quitar renglón agregado" onClick={() => quitar(it)}>×</button>
                  )}
                </td>
              </tr>
            );
          })}
        </Table>

        {editable && (alta ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.1fr .7fr 1.2fr auto auto', gap: 8, marginTop: 8, alignItems: 'end' }}>
            <div>
              <div className={s['mini-label']}>Producto que llegó</div>
              <select value={alta.prodId} onChange={(e) => setAltas((x) => ({ ...x, [tipo]: { ...alta, prodId: e.target.value, presId: '' } }))}>
                <option value="">Elegí…</option>
                {productosDeLista.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div>
              <div className={s['mini-label']}>Present.</div>
              <select value={alta.presId} onChange={(e) => setAltas((x) => ({ ...x, [tipo]: { ...alta, presId: e.target.value } }))}>
                {prodAlta ? presentacionOptions(prodAlta, true) : <option value="">—</option>}
              </select>
            </div>
            <div>
              <div className={s['mini-label']}>Cantidad</div>
              <input type="number" min="0" step="1" value={alta.cant}
                onChange={(e) => setAltas((x) => ({ ...x, [tipo]: { ...alta, cant: e.target.value } }))} />
            </div>
            <div>
              <div className={s['mini-label']}>Motivo</div>
              <input value={alta.motivo} placeholder="Llegó del proveedor hoy"
                onChange={(e) => setAltas((x) => ({ ...x, [tipo]: { ...alta, motivo: e.target.value } }))} />
            </div>
            <Btn variant="btn-primary" small onClick={() => agregar(tipo)}>Agregar</Btn>
            <Btn small onClick={() => setAltas((x) => ({ ...x, [tipo]: null }))}>×</Btn>
          </div>
        ) : (
          <Btn small style={{ marginTop: 8 }} onClick={() => setAltas((x) => ({ ...x, [tipo]: { prodId: '', presId: '', cant: '', motivo: '' } }))}>
            + Agregar producto que llegó
          </Btn>
        ))}
      </div>
    );
  };

  return (
    <ModalShell
      title={`Preparación ${t.codigo} — para ${destino?.nombre ?? ''}`}
      wide
      onClose={closeModal}
      footer={footer}
    >
      {soloMia ? (
        <div className={cx(s.callout, s.info)}>
          Tu lista es <strong>{LISTAS_PREP[misListas[0]].titulo}</strong>. Ajustá lo <strong>preparado</strong>{' '}
          (si no hay, va 0 con su motivo), agregá lo que llegó a último momento y <strong>confirmá</strong>{' '}
          — recién ahí se reserva el stock. De{' '}
          <strong>{LISTAS_PREP[misListas[0] === 'granel' ? 'enteros' : 'granel'].titulo}</strong> se encarga el{' '}
          {LISTAS_PREP[misListas[0] === 'granel' ? 'enteros' : 'granel'].encargado}, y el pedido no se despacha
          hasta que estén las dos.
        </div>
      ) : (
        <div className={cx(s.callout, s.info)}>
          Un solo pedido, dos listas: <strong>Enteros</strong> para el preparador y{' '}
          <strong>Fraccionados</strong> para el fraccionador. Cada uno ajusta lo <strong>preparado</strong>{' '}
          (si no hay, va 0 con su motivo), agrega lo que llegó a último momento y <strong>confirma</strong>{' '}
          — recién ahí se reserva el stock. Con las dos confirmadas se despacha <strong>lo preparado</strong>.
        </div>
      )}
      {!enPrep && (
        <div className={cx(s.callout, s.warn)}>
          Esta transferencia ya no está en preparación (estado: <TransferPill estado={t.estado} />).
        </div>
      )}
      {misListas.map((tipo) => renderLista(tipo))}
    </ModalShell>
  );
}

/* ============================== RECEPCIÓN CONTADA ============================== */

export function RecibirTransferModal({ id }) {
  const { store, act, closeModal } = useProductos();
  const t = store.state.transferencias.find((x) => x.id === id);
  const [obs, setObs] = useState('');
  // Se recibe LO QUE VIAJÓ: renglones con cantidad preparada > 0.
  const viajaron = useMemo(() => (t?.items ?? []).filter((it) => (it.cantidadPreparada ?? it.cantidad) > 1e-9), [t]);
  const enviadoDe = (it) => it.cantidadPreparada ?? it.cantidad;
  /**
   * Recepción A CIEGAS: primero se cuenta, después se compara. Si ves el
   * número esperado, todo el mundo aprieta "conforme" y las diferencias no
   * aparecen nunca. Es opcional: apagada muestra lo enviado desde el arranque.
   */
  const [aCiegas, setACiegas] = useState(false);
  const [conteo, setConteo] = useState(() => Object.fromEntries(
    ((t?.items ?? []).filter((it) => (it.cantidadPreparada ?? it.cantidad) > 1e-9))
      .map((it) => [it.id, String(it.cantidadPreparada ?? it.cantidad)]),
  ));
  if (!t) return null;

  const setCant = (itemId, v) => setConteo((c) => ({ ...c, [itemId]: v }));
  const activarCiegas = () => {
    setACiegas(true);
    setConteo(Object.fromEntries(viajaron.map((it) => [it.id, ''])));
  };

  const ajustados = t.items.filter((it) => !it.agregado && Math.abs(enviadoDe(it) - it.cantidad) > 1e-9).length;
  const agregados = t.items.filter((it) => it.agregado).length;

  const faltantes = viajaron.filter((it) => {
    const rec = parseFloat(conteo[it.id]);
    return Number.isFinite(rec) && rec < enviadoDe(it) - 1e-9;
  }).length;

  const recibir = () => {
    const items = viajaron.map((it) => ({
      itemId: it.id,
      cantidadRecibida: Math.min(Math.max(parseFloat(conteo[it.id]) || 0, 0), enviadoDe(it)),
    }));
    act(
      store.recibirTransferencia(t.id, { items, usuarioId: store.state.ctx.usuarioId, observaciones: obs }),
      faltantes ? 'Recibida. La diferencia quedó en una incidencia para resolver.' : 'Recibida completa.',
    );
  };

  return (
    <ModalShell
      title={`Recibir ${t.codigo} — desde ${store.getSucursal(t.origenId).nombre}`}
      wide
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: faltantes ? `Recibir con ${faltantes} faltante(s)` : 'Recibir todo', clase: 'btn-primary', onClick: recibir },
      ]}
    >
      {!aCiegas && (
        <div className={cx(s.callout, s.info)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span>Contá lo que llegó. Lo que falte <strong>no se pierde</strong>: queda retenido en el origen con una incidencia.</span>
          <button type="button" className={s.btn + ' ' + s['btn-ghost'] + ' ' + s['btn-sm']} onClick={activarCiegas}>
            Contar a ciegas
          </button>
        </div>
      )}
      {aCiegas && (
        <div className={cx(s.callout, s.warn)}>
          <strong>A ciegas:</strong> las cantidades enviadas están ocultas — anotá lo que contás y la
          comparación se hace al confirmar.
        </div>
      )}
      {(ajustados > 0 || agregados > 0) && (
        <div className={cx(s.callout, s.warn)}>
          Este envío <strong>difiere de lo pedido</strong>:
          {ajustados > 0 && <> {ajustados} renglón(es) con otra cantidad</>}
          {ajustados > 0 && agregados > 0 && ' y'}
          {agregados > 0 && <> {agregados} agregado(s) por el origen</>}
          . El detalle de cada renglón muestra el motivo.
        </div>
      )}

      <Table cols={[{ h: 'Producto' }, { h: 'Present.' }, { h: 'Pedido', num: true }, { h: 'Enviado', num: true }, { h: 'Recibido', num: true }]}>
        {viajaron.map((it) => {
          const p = store.getProducto(it.productoId);
          const enviado = enviadoDe(it);
          const rec = parseFloat(conteo[it.id]);
          const falta = Number.isFinite(rec) && rec < enviado - 1e-9;
          const distinto = !it.agregado && Math.abs(enviado - it.cantidad) > 1e-9;
          return (
            <tr key={it.id}>
              <td>
                {p.nombre}
                {it.agregado && <span className={cx(s.pill, s['est-transito'])} style={{ marginLeft: 6 }}>Agregado</span>}
                {it.motivo && <div className={s.hint} style={{ margin: 0 }}>{it.motivo}</div>}
              </td>
              <td>{store.presLabel(p, it.presentacionId)}</td>
              <td className={cx(s.num, s.mono)}>{it.agregado ? '—' : store.fmtCant(p, it.presentacionId, it.cantidad)}</td>
              <td className={cx(s.num, s.mono)} style={distinto ? { color: 'var(--crm-color-accent-2)', fontWeight: 700 } : undefined}>
                {aCiegas ? '•••' : store.fmtCant(p, it.presentacionId, enviado)}
              </td>
              <td className={s.num}>
                <input
                  type="number" min="0" step={p.tipo === 'granel' && !it.presentacionId ? '0.001' : '1'}
                  value={conteo[it.id]}
                  style={{ width: 90, ...(falta ? { borderColor: 'var(--crm-color-accent-2)' } : {}) }}
                  onChange={(e) => setCant(it.id, e.target.value)}
                />
              </td>
            </tr>
          );
        })}
      </Table>

      <div className={s.field} style={{ marginTop: 12 }}>
        <label>Observaciones de la recepción</label>
        <input value={obs} placeholder="Caja abierta, faltaban 2…" onChange={(e) => setObs(e.target.value)} />
      </div>
    </ModalShell>
  );
}

/* ============================== DETALLE ============================== */

export function DetalleTransferModal({ id }) {
  const { store, isAdmin, act, closeModal, openModal } = useProductos();
  const t = store.state.transferencias.find((x) => x.id === id);
  const miId = store.state.ctx.sucursalId;
  const montos = useMemo(() => {
    if (!t) return { enviado: 0, recibido: 0 };
    let enviado = 0; let recibido = 0;
    for (const it of t.items) {
      const env = it.cantidadPreparada ?? it.cantidad;
      enviado += env * (it.costoUnitario || 0);
      recibido += (it.cantidadRecibida ?? env) * (it.costoUnitario || 0);
    }
    return { enviado, recibido };
  }, [t]);
  if (!t) return null;

  const items = t.items.map((it, i) => {
    const p = store.getProducto(it.productoId);
    const enviado = it.cantidadPreparada ?? it.cantidad;
    const falto = it.cantidadRecibida != null && it.cantidadRecibida < enviado - 1e-9;
    const distinto = !it.agregado && Math.abs(enviado - it.cantidad) > 1e-9;
    return (
      <tr key={i}>
        <td>
          {p.nombre}
          {it.agregado && <span className={cx(s.pill, s['est-transito'])} style={{ marginLeft: 6 }}>Agregado</span>}
          {it.motivo && <div className={s.hint} style={{ margin: 0 }}>{it.motivo}</div>}
        </td>
        <td>{store.presLabel(p, it.presentacionId)}</td>
        <td className={cx(s.num, s.mono)}>{it.agregado ? '—' : store.fmtCant(p, it.presentacionId, it.cantidad)}</td>
        <td className={cx(s.num, s.mono)} style={distinto ? { color: 'var(--crm-color-accent-2)', fontWeight: 700 } : undefined}>
          {store.fmtCant(p, it.presentacionId, enviado)}
        </td>
        <td className={cx(s.num, falto && s.mono)} style={falto ? { color: 'var(--crm-color-accent-2)', fontWeight: 700 } : undefined}>
          {it.cantidadRecibida != null ? store.fmtCant(p, it.presentacionId, it.cantidadRecibida) : '—'}
        </td>
        <td className={cx(s.num, s.mono)}>{it.costoUnitario > 0 ? money(enviado * it.costoUnitario) : '—'}</td>
      </tr>
    );
  });

  const hist = t.hist.map((h, i) => (
    <tr key={i}>
      <td><TransferPill estado={h.estado} /></td>
      <td>{fmtFechaHora(h.fecha)}</td>
      <td>{(store.getUsuario(h.usuarioId) || {}).nombre || '—'}</td>
    </tr>
  ));

  // Las acciones dependen del LADO: preparar/despachar son del origen, recibir
  // del destino. El detalle ofrece solo lo que corresponde a mi sucursal.
  const footer = [];
  const puedePreparar = isAdmin || store.can('preparar') || store.can('fraccionar');
  if (puedePreparar && t.origenId === miId && t.estado === 'pendiente') {
    footer.push({
      texto: 'Preparar',
      clase: 'btn-primary',
      onClick: async () => {
        const ok = await act(store.avanzarTransferencia(t.id, 'pendiente'), 'En preparación: cada encargado tiene su lista.');
        if (ok) openModal('prepararTransfer', { id: t.id });
      },
    });
  }
  if (t.origenId === miId && t.estado === 'preparada') {
    footer.push({ texto: 'Preparación…', clase: 'btn-primary', onClick: () => openModal('prepararTransfer', { id: t.id }) });
    if (isAdmin && listasCompletas(t, store)) {
      footer.push({ texto: 'Despachar', clase: 'btn-primary', onClick: () => act(store.avanzarTransferencia(t.id, 'preparada'), 'Despachada: en tránsito.') });
    }
  }
  if ((isAdmin || store.can('pedidos')) && t.destinoId === miId && t.estado === 'transito') {
    footer.push({ texto: 'Recibir…', clase: 'btn-primary', onClick: () => openModal('recibirTransfer', { id: t.id }) });
  }
  footer.push({ texto: 'Cerrar', clase: 'btn-ghost', onClick: closeModal });

  return (
    <ModalShell title={'Transferencia ' + t.codigo} wide onClose={closeModal} footer={footer}>
      <div className={s['detalle-grid']}>
        <div className={s.di}><div className={s.l}>Ruta</div><div className={s.v}>{store.getSucursal(t.origenId).nombre} → {store.getSucursal(t.destinoId).nombre}</div></div>
        <div className={s.di}><div className={s.l}>Estado</div><div className={s.v}><TransferPill estado={t.estado} /></div></div>
        <div className={s.di}><div className={s.l}>Monto a costo</div><div className={s.v + ' ' + s.mono}>{montos.enviado > 0 ? money(montos.enviado) : '— (se congela al despachar)'}</div></div>
      </div>
      {t.observaciones && (
        <div className={cx(s.callout, s.info)} style={{ marginTop: 8 }}>{t.observaciones}</div>
      )}
      <h3 className={s['card-title']}>Ítems</h3>
      <Table cols={[{ h: 'Producto' }, { h: 'Present.' }, { h: 'Pedido', num: true }, { h: 'Enviado', num: true }, { h: 'Recibido', num: true }, { h: 'Costo', num: true }]}>{items}</Table>
      <h3 className={s['card-title']} style={{ marginTop: 12 }}>Historial de estados</h3>
      <Table cols={[{ h: 'Estado' }, { h: 'Fecha' }, { h: 'Usuario' }]}>{hist}</Table>
    </ModalShell>
  );
}
