/**
 * OFERTAS — administración de promociones
 * ============================================================================
 * La tabla muestra el estado CALCULADO (vigente, programada, vencida,
 * inactiva): una promo con fecha de fin en el pasado figura "Vencida" sin que
 * nadie tenga que acordarse de apagarla.
 *
 * El panel trae su propia lista (`/ofertas`) y el catálogo del POS una sola
 * vez: el catálogo aporta los nombres para el alcance y los precios reales que
 * usa la vista previa del formulario.
 *
 * QUIÉN LA CREÓ Y POR VENCIMIENTO (0187, 20/10/2026, pedido del dueño): una
 * columna con quién la creó y cuándo, y un filtro por las armadas para rematar
 * mercadería por vencer (`porVencer`).
 *
 * MÁS FILTROS E INFORMACIÓN (19/11/2026, pedido del dueño): arranca en las
 * VIGENTES, con los estados contados (aplican hoy, vencen en 7 días,
 * programadas, vencidas, inactivas); filtros por mecánica, local, origen y un
 * buscador; cuándo vence o empieza cada una, si hoy aplica, y cuánto se usó
 * desde que existe (unidades, descuento, última venta). Las reglas, en
 * `domain/ofertasLista.js` (con pruebas).
 *
 * EL INTERRUPTOR DE LAS AUTOMÁTICAS (23/11/2026, pedido del dueño): prende o
 * apaga que lo que está por vencer entre solo en oferta (las reglas de Almacén
 * › Vencimientos). Apagarlo saca en el acto las automáticas; las armadas a mano
 * no se tocan. Se lee de la config fresca, no de la del arranque del módulo.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { cx } from '@shared/utils/classNames.js';
import { useVentas } from '../context/VentasContext.jsx';
import { ventasApi, errorMsg } from '../services/ventas.api.js';
import { TIPOS_OFERTA, MEDIOS_PAGO } from '../domain/constants.js';
import { describirOferta } from '../domain/ofertas.js';
import { FILTROS_ESTADO, FILTROS_ORIGEN, ORDENES_OFERTA, correEnSucursal, cuandoDias, situacionOferta, textoSituacion } from '../domain/ofertasLista.js';
import { PanelHead, Table, Btn, usePaginado, money, num, s } from '../components/ui.jsx';

const fecha = (iso) => new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric', year: '2-digit' });
/** Un día 'AAAA-MM-DD' (la última venta) en corto, sin correrse por el huso. */
const fechaDia = (dia) => (dia ? `${Number(dia.slice(8, 10))}/${Number(dia.slice(5, 7))}/${dia.slice(2, 4)}` : '');

const PILL_ESTADO = {
  vigente: 'est-recibida',
  programada: 'est-pendiente',
  vencida: 'est-revision',
  inactiva: 'est-cancelada',
};

export function OfertasPanel() {
  const { ctx, openModal, toast, sucursalesTodas: sucursales } = useVentas();
  const [searchParams, setSearchParams] = useSearchParams();
  const [ofertas, setOfertas] = useState(null);
  const [catalogo, setCatalogo] = useState(null);
  /**
   * El cruce con el vigía de fechas (Almacén › Vencimientos). Se mira ACÁ
   * porque acá está el remedio: una oferta que está descontando mercadería ya
   * vencida se apaga desde esta pantalla, no desde el depósito.
   */
  const [venc, setVenc] = useState(null);
  /** Cuánto se usó cada oferta (por id). Accesorio: sin él, la columna dice «—». */
  const [uso, setUso] = useState(new Map());
  /** ¿Las reglas de vencimiento arman solas las ofertas? null = todavía sin leer. */
  const [autoVenc, setAutoVenc] = useState(null);
  const [cambiandoAuto, setCambiandoAuto] = useState(false);
  const cambiandoAutoRef = useRef(false);

  const cargar = useCallback(async () => {
    try {
      setOfertas(await ventasApi.ofertas());
    } catch (e) { toast(errorMsg(e), 'err'); }
    // El aviso es accesorio: si no se puede leer, la pantalla funciona igual.
    ventasApi.vencimientosEnOferta().then(setVenc).catch(() => setVenc(null));
    ventasApi.ofertasUso().then((l) => setUso(new Map(l.map((u) => [u.ofertaId, u])))).catch(() => setUso(new Map()));
    ventasApi.config().then((c) => setAutoVenc(c.ofertasVencimientoAuto !== false)).catch(() => setAutoVenc(null));
  }, [toast]);

  /** Prende o apaga las automáticas por vencimiento: cambia precios en todas las cajas, así que se confirma. */
  const cambiarAutoVenc = async (activas) => {
    if (cambiandoAutoRef.current) return;
    const vigentes = (ofertas ?? []).filter((o) => o.autoVencimiento && situacionOferta(o).estado.id === 'vigente').length;
    const pregunta = activas
      ? '¿Prender las ofertas automáticas por vencimiento? Lo que está por vencer entra en oferta según las reglas de Almacén › Vencimientos, en todas las cajas y la tienda.'
      : `¿Apagar las ofertas automáticas por vencimiento? Se sacan ${vigentes ? `las ${vigentes} automáticas vigentes` : 'las automáticas que haya'} y no se arman nuevas. Las armadas a mano siguen.`;
    if (!window.confirm(pregunta)) return;
    cambiandoAutoRef.current = true;
    setCambiandoAuto(true);
    try {
      const r = await ventasApi.ofertasAutomaticasVencimiento(activas);
      setAutoVenc(r.activas);
      toast(r.activas
        ? `Ofertas automáticas prendidas: ${r.aplicado.creadas} creada(s), ${r.aplicado.actualizadas} actualizada(s).`
        : `Ofertas automáticas apagadas: se sacaron ${r.aplicado.quitadas}.`, 'ok');
      cargar();
    } catch (e) {
      toast(errorMsg(e), 'err');
    } finally {
      cambiandoAutoRef.current = false;
      setCambiandoAuto(false);
    }
  };

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    if (!ctx.sucursalId) return;
    ventasApi.catalogo(ctx.sucursalId).then(setCatalogo).catch(() => setCatalogo({ items: [] }));
  }, [ctx.sucursalId]);

  const items = catalogo?.items ?? [];

  /**
   * El universo del buscador de alcance: cada producto, marca, categoría y
   * etiqueta UNA vez. Se deriva del catálogo que ya está en memoria.
   */
  const universo = useMemo(() => {
    const out = [];
    const vistos = new Set();
    const add = (tipo, refId, nombre) => {
      if (!refId || !nombre) return;
      const k = `${tipo}:${refId}`;
      if (!vistos.has(k)) { vistos.add(k); out.push({ tipo, refId, nombre }); }
    };
    for (const it of items) {
      if (it.presentacionId) {
        /* El PAQUETE fraccionado es un destino propio desde la 0054: "Lentejas
         * 500 g" en oferta sin tocar el kilo suelto ni los otros tamaños. */
        add('presentacion', it.presentacionId, `${it.nombre} · ${it.detalle}`);
      } else {
        add('producto', it.productoId, it.nombre);
      }
      add('marca', it.marcaId, it.marca);
      add('categoria', it.categoriaId, it.categoria);
    }
    for (const e of catalogo?.etiquetasCatalogo ?? []) add('etiqueta', e.id, e.nombre);
    return out;
  }, [items, catalogo]);

  const nombreDe = useCallback((a) =>
    universo.find((u) => u.tipo === a.tipo && u.refId === a.refId)?.nombre ?? `#${a.refId}`, [universo]);

  const alcanceLegible = (o) => {
    if (o.tipo === 'ticket') return 'Todo el ticket';
    if (o.tipo === 'combo') {
      return (o.componentes ?? [])
        .map((c) => `${c.cantidad}× ${items.find((i) => i.productoId === c.productoId && !i.presentacionId)?.nombre ?? `#${c.productoId}`}`)
        .join(' + ');
    }
    const base = (o.alcances ?? []).map(nombreDe).join(', ') || '—';
    /* Que la oferta alcance o no a los paquetes es parte de su alcance: si no se
     * ve en el listado, la única forma de saberlo es abrir cada oferta. */
    const porLaMadre = (o.alcances ?? []).some((a) => a.tipo !== 'presentacion');
    return porLaMadre && o.incluyeFraccionados ? `${base} (+ sus fraccionados)` : base;
  };

  const condiciones = (o) => {
    const parts = [];
    if (o.desde || o.hasta) {
      parts.push(`${o.desde ? new Date(o.desde).toLocaleDateString() : '…'} → ${o.hasta ? new Date(o.hasta).toLocaleDateString() : '…'}`);
    }
    if (cuandoDias(o.dias)) parts.push(cuandoDias(o.dias));
    if (o.sucursales) {
      const nombres = o.sucursales.split(',').map((id) => sucursales.find((x) => x.id === Number(id))?.nombre).filter(Boolean);
      if (nombres.length) parts.push(nombres.join(' / '));
    }
    if (o.mediosPago) parts.push(`solo ${o.mediosPago.split(',').map((m) => MEDIOS_PAGO[m.trim()] || m).join(' / ')}`);
    return parts.length ? parts.join(' · ') : 'Siempre';
  };

  const abrirForm = (oferta, vencimiento = null) =>
    openModal('ofertaForm', { oferta, items, universo, onListo: cargar, vencimiento });

  /**
   * `?nuevaOferta=<id de vencimiento>`: el vigía de fechas manda acá con el
   * formulario lleno. La API arma el borrador (es la que sabe las reglas: no se
   * ofrece lo vencido, ni lo ya ofertado, ni lo archivado) y esta pantalla solo
   * lo abre. Se espera a tener el catálogo para que la vista previa y la ficha
   * del alcance salgan con precios reales, y el parámetro se limpia enseguida:
   * un F5 no tiene que volver a abrir el mismo modal.
   */
  const pedido = searchParams.get('nuevaOferta');
  const yaAbierto = useRef(false);
  useEffect(() => {
    if (!pedido || yaAbierto.current || catalogo === null) return;
    yaAbierto.current = true;
    const sp = new URLSearchParams(searchParams);
    sp.delete('nuevaOferta');
    setSearchParams(sp, { replace: true });
    ventasApi.borradorOfertaVencimiento(pedido)
      .then((r) => abrirForm(r.borrador, r.registro))
      .catch((e) => toast(errorMsg(e), 'err'));
    // abrirForm cambia en cada render (usa items/universo): entra por la lista
    // de dependencias solo lo que decide SI hay que abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido, catalogo]);

  /** Las alarmas del cruce, indexadas por oferta para pintarlas en la tabla. */
  const alarmasPorOferta = useMemo(() => {
    const m = new Map();
    for (const f of venc?.filas ?? []) {
      if (f.alarma?.severidad !== 'grave') continue;
      if (!m.has(f.ofertaId)) m.set(f.ofertaId, []);
      m.get(f.ofertaId).push(f);
    }
    return m;
  }, [venc]);

  /* Los filtros. Arranca en las vigentes: es lo que se mira todos los días. */
  const [estado, setEstado] = useState('vigentes');
  const [origen, setOrigen] = useState('');
  const [tipo, setTipo] = useState('');
  const [sucursalId, setSucursalId] = useState('');
  const [q, setQ] = useState('');
  const [orden, setOrden] = useState('recientes');

  /** Cada oferta con su situación de hoy y su uso, una vez por carga. */
  const conSituacion = useMemo(() => {
    const ahora = new Date();
    return (ofertas ?? []).map((o) => ({ ...o, sit: situacionOferta(o, ahora), uso: uso.get(o.id) ?? null }));
  }, [ofertas, uso]);
  /* Todos los filtros menos el de estado: sobre esto se cuentan los estados, así los números cierran con lo que se ve. */
  const sinEstado = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const pasaOrigen = FILTROS_ORIGEN.find(([k]) => k === origen)[2];
    return conSituacion.filter((o) => pasaOrigen(o) && (!tipo || o.tipo === tipo) && correEnSucursal(o, sucursalId)
      && (!ql || `${o.nombre} ${alcanceLegible(o)}`.toLowerCase().includes(ql)));
    // alcanceLegible depende del catálogo (universo), que entra por `universo`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conSituacion, origen, tipo, sucursalId, q, universo]);
  const cuantas = useMemo(() => Object.fromEntries(FILTROS_ESTADO.map(([k, , f]) => [k, sinEstado.filter((o) => f(o.sit)).length])), [sinEstado]);
  const filtradas = useMemo(() => {
    const f = FILTROS_ESTADO.find(([k]) => k === estado)[2];
    return sinEstado.filter((o) => f(o.sit)).sort(ORDENES_OFERTA[orden].fn);
  }, [sinEstado, estado, orden]);
  const descuentoDado = filtradas.reduce((a, o) => a + (o.uso?.descuento ?? 0), 0);
  const pag = usePaginado(filtradas, 'ofertas', `${estado}|${origen}|${tipo}|${sucursalId}|${q}|${orden}`);
  const hayFiltros = origen || tipo || sucursalId || q;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Ofertas"
        desc="Las mecánicas por cantidad (3×2, 2ª unidad, pack, combo) se aplican solas en la caja; la de monto del ticket se sugiere y el cajero la aplica con un clic. Por renglón gana UNA sola: la de mayor beneficio."
        actions={(
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {autoVenc !== null && (
              <label
                style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, cursor: cambiandoAuto ? 'wait' : 'pointer' }}
                title="Lo que está por vencer entra solo en oferta, con las reglas de Almacén › Vencimientos › Reglas y rentabilidad. Las ofertas armadas a mano no dependen de esto."
              >
                <input
                  type="checkbox" checked={autoVenc} disabled={cambiandoAuto}
                  onChange={(e) => cambiarAutoVenc(e.target.checked)}
                />
                Ofertas automáticas por vencimiento
                <span className={s.muted} style={{ fontWeight: 400 }}>{autoVenc ? 'prendidas' : 'apagadas'}</span>
              </label>
            )}
            <Btn variant="btn-primary" onClick={() => abrirForm(null)}>+ Oferta</Btn>
          </div>
        )}
      />

      {/* Lo único urgente que esta pantalla puede resolver: apagar una oferta
          que está descontando mercadería que YA venció. */}
      {alarmasPorOferta.size > 0 && (
        <div className={cx(s.callout, s.warn)}>
          <strong>
            ⚠ {alarmasPorOferta.size === 1 ? 'Una oferta está descontando' : `${alarmasPorOferta.size} ofertas están descontando`}{' '}
            mercadería que ya venció
          </strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
            {[...alarmasPorOferta.entries()].map(([ofertaId, filas]) => (
              <li key={ofertaId} style={{ marginBottom: 2 }}>
                <strong>{filas[0].ofertaNombre}</strong> — {filas.map((f) => (
                  `${f.nombre} (venció hace ${Math.abs(f.diasParaVencer)} d, ${f.cantidad} ${f.unidad})`
                )).join(' · ')}
              </li>
            ))}
          </ul>
          <div className={s.hint} style={{ marginTop: 6 }}>
            Editá la oferta para apagarla o recortarle el alcance, y procesá el vencimiento en
            Almacén › Vencimientos. El dato sale del control de fechas, no de la oferta.
          </div>
        </div>
      )}

      {/* Los estados, contados: tocar uno filtra. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} role="group" aria-label="Estado de las ofertas">
        {FILTROS_ESTADO.map(([k, label]) => (
          <Btn key={k} small variant={estado === k ? 'btn-primary' : 'btn-ghost'} aria-pressed={estado === k} onClick={() => setEstado(k)}>
            {label} ({cuantas[k] ?? 0})
          </Btn>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <input
          type="search" placeholder="Buscar por nombre, producto o marca…" value={q} onChange={(e) => setQ(e.target.value)}
          aria-label="Buscar oferta" style={{ flex: '1 1 220px', maxWidth: 320 }}
        />
        <select aria-label="Mecánica" className={s['select-inline']} value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">Todas las mecánicas</option>
          {Object.entries(TIPOS_OFERTA).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
        </select>
        <select aria-label="Local" className={s['select-inline']} value={sucursalId} onChange={(e) => setSucursalId(e.target.value)}>
          <option value="">Todos los locales</option>
          {(sucursales ?? []).filter((x) => x.activa !== false).map((x) => <option key={x.id} value={x.id}>Corren en {x.nombre}</option>)}
        </select>
        <select id="ofertas-filtro-vencer" aria-label="Origen" className={s['select-inline']} value={origen} onChange={(e) => setOrigen(e.target.value)}>
          {FILTROS_ORIGEN.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
        <select aria-label="Ordenar" className={s['select-inline']} value={orden} onChange={(e) => setOrden(e.target.value)}>
          {Object.entries(ORDENES_OFERTA).map(([k, o]) => <option key={k} value={k}>Orden: {o.label.toLowerCase()}</option>)}
        </select>
        {hayFiltros && <Btn small onClick={() => { setOrigen(''); setTipo(''); setSucursalId(''); setQ(''); }}>Limpiar filtros</Btn>}
      </div>
      <div className={s.hint} style={{ margin: 0 }}>
        {filtradas.length} oferta{filtradas.length === 1 ? '' : 's'}
        {descuentoDado > 0.009 && <> · dieron <strong>{money(descuentoDado)}</strong> de descuento desde que existen (las notas de crédito restan; se actualiza cada 10 minutos)</>}
      </div>

      <Table
        cols={[
          { h: 'Oferta' }, { h: 'Mecánica' }, { h: 'Alcanza a' }, { h: 'Condiciones' },
          { h: 'Uso' }, { h: 'Creada por' }, { h: 'Estado' }, { h: 'Acciones' },
        ]}
        empty={ofertas === null ? 'Cargando…'
          : (ofertas ?? []).length ? 'Ninguna oferta con esos filtros.' : 'Sin ofertas todavía. Creá la primera.'}
        pag={pag}
      >
        {pag.visibles.map((o) => {
          const est = o.sit.estado;
          return (
            <tr key={o.id} style={{ opacity: est.id === 'vigente' || est.id === 'programada' ? 1 : 0.55 }}>
              <td>
                <strong>{o.nombre}</strong>
                {o.porVencer && (
                  <div>
                    <span
                      className={cx(s.pill, s['est-pendiente'])}
                      title={o.autoVencimiento
                        ? 'La arma y la escala sola la regla del rango (Almacén › Vencimientos › Reglas). Si la editás, pasa a manual.'
                        : 'Armada para rematar mercadería por vencer'}
                    >
                      ⏳ por vencimiento{o.autoVencimiento ? ' · automática' : ''}
                    </span>
                  </div>
                )}
                {alarmasPorOferta.has(o.id) && (
                  <div>
                    <span className={cx(s.pill, s['est-revision'])} title="Alcanza mercadería vencida">
                      ⚠ mercadería vencida
                    </span>
                  </div>
                )}
              </td>
              <td>
                {TIPOS_OFERTA[o.tipo]?.label ?? o.tipo}
                <div className={s.muted} style={{ fontSize: 12 }}>{describirOferta(o).replace(/\$(\d+)/, (_, n) => money(Number(n)))}</div>
              </td>
              <td style={{ maxWidth: 260 }}>{alcanceLegible(o)}</td>
              <td style={{ maxWidth: 220 }}>{condiciones(o)}</td>
              <td style={{ whiteSpace: 'nowrap' }}>
                {o.uso?.renglones ? (
                  <>
                    <strong>{num(o.uso.unidades, 3)}</strong> vendidas
                    <div className={s.muted} style={{ fontSize: 12 }}>{money(o.uso.descuento)} de descuento</div>
                    <div className={s.muted} style={{ fontSize: 12 }}>última: {fechaDia(o.uso.ultimo)}</div>
                  </>
                ) : <span className={s.muted}>Sin ventas</span>}
              </td>
              <td>
                {o.creadoPorNombre || <span className={s.muted} title="Creada antes de que se registrara quién la crea">Sin dato</span>}
                {o.creadoEn && <div className={s.muted} style={{ fontSize: 12 }}>{fecha(o.creadoEn)}</div>}
              </td>
              <td>
                <span className={cx(s.pill, s[PILL_ESTADO[est.id]])}>{est.label}</span>
                <div className={s.muted} style={{ fontSize: 12, maxWidth: 160 }}>{textoSituacion(o, o.sit)}</div>
              </td>
              <td>
                <div className={s['row-actions']}>
                  <Btn small onClick={() => abrirForm(o)}>Editar</Btn>
                  <Btn variant="btn-delete" small onClick={() => openModal('borrarOferta', { oferta: o, onListo: cargar })}>
                    Eliminar
                  </Btn>
                </div>
              </td>
            </tr>
          );
        })}
      </Table>
    </div>
  );
}
