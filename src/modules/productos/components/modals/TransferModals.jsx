/**
 * TRANSFERENCIAS — pedido (pull), recepción contada y detalle
 * ============================================================================
 * El pedido lo arma el que NECESITA (destino = mi sucursal): por eso no valida
 * stock del origen — es demanda, y la realidad entra recién cuando el origen
 * prepara. La recepción es el paso con plata en juego: se cuenta lo que llegó
 * y la diferencia genera una incidencia sola.
 */
import { useMemo, useState } from 'react';
import { useProductos } from '../../context/ProductosContext.jsx';
import { fmtFechaHora, money, num } from '../../domain/format.js';
import { cx } from '@shared/utils/classNames.js';
import { imprimirDocumento } from '@core/services/imprimir.js';
import { leerSesion } from '@core/auth/sesion.js';
import { ModalShell } from '../Modal.jsx';
import { sucursalOptions, presentacionOptions, usuarioOptions } from '../selectOptions.jsx';
import { Table, TransferPill, Btn, s } from '../ui.jsx';

/* ---------------- Preparación: helpers compartidos ---------------- */

export const LISTAS_PREP = {
  enteros: { titulo: 'Enteros', encargado: 'preparador' },
  granel: { titulo: 'Fraccionados', encargado: 'fraccionador' },
};

/** A qué lista de preparación pertenece un producto (misma regla que la API). */
export const listaDeProducto = (prod) => (prod?.tipo === 'granel' ? 'granel' : 'enteros');

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

/**
 * El pedido se arma con un BUSCADOR (como el legacy): se tipea, se agrega y el
 * último queda arriba. Cada renglón muestra el stock de las DOS puntas — lo
 * que tiene el origen (¿puede mandarme?) y lo que me queda a mí (¿necesito
 * pedir?). "Ver solo sin stock" lista lo que se me acabó, para reponer.
 */
export function TransferenciaModal({ itemsIniciales, observaciones: obsInicial }) {
  const { store, act, closeModal } = useProductos();
  const dist = store.distribuidora();
  // Los defaults salen de la SESIÓN: quien pide es el que se logueó, para SU
  // sucursal. (Un admin parado en otra sucursal puede cambiarlos igual.)
  const sesion = leerSesion();
  const miId = (sesion?.sucursal?.id != null && store.getSucursal(sesion.sucursal.id) ? sesion.sucursal.id : null)
    ?? store.state.ctx.sucursalId;
  // Pull: el destino soy YO; el origen arranca en la Distribuidora, que es el
  // depósito central — pero puede ser cualquier otra sucursal.
  const [destinoId, setDestinoId] = useState(miId ?? dist?.id);
  const [origenId, setOrigenId] = useState(() => {
    const candidato = dist && dist.id !== miId ? dist.id : store.state.sucursales.find((su) => su.id !== miId)?.id;
    return candidato ?? '';
  });
  const [userId, setUserId] = useState(
    (sesion?.usuario?.id != null && store.getUsuario(sesion.usuario.id) ? sesion.usuario.id : null)
      ?? store.state.ctx.usuarioId,
  );
  const [obs, setObs] = useState(obsInicial ?? '');
  const [items, setItems] = useState(() => (itemsIniciales?.length ? itemsIniciales : []));
  const [q, setQ] = useState('');
  const [soloSinStock, setSoloSinStock] = useState(false);

  const origenNum = parseInt(origenId, 10) || null;
  const destinoNum = parseInt(destinoId, 10) || null;
  const origen = store.getSucursal(origenNum);
  const destino = store.getSucursal(destinoNum);

  /**
   * Total disponible en una sucursal. Para granel se convierte a KG
   * equivalentes (suelto + paquetes × tamaño): sumar "45 kg + 2 paquetes"
   * como 47 dice algo; sumarlo crudo no.
   */
  const dispTotal = (p, sucId) => {
    if (!sucId) return 0;
    if (p.tipo !== 'granel') return store.suma({ productoId: p.id, sucursalId: sucId, estado: 'disponible' });
    return store.state.stock.reduce((a, st) => {
      if (st.productoId !== p.id || st.sucursalId !== sucId || st.estado !== 'disponible') return a;
      const pres = st.presentacionId ? (p.presentaciones || []).find((x) => x.id === st.presentacionId) : null;
      return a + st.cantidad * (pres ? pres.tamKg : 1);
    }, 0);
  };

  const resultados = useMemo(() => {
    const ql = normTxt(q);
    if (!ql && !soloSinStock) return [];
    const out = [];
    for (const p of store.state.productos) {
      if (soloSinStock && dispTotal(p, destinoNum) > 1e-9) continue;
      if (ql && !(normTxt(p.nombre).includes(ql) || normTxt(p.marca).includes(ql)
        || (p.codigoBarras || '').includes(q.trim()) || (p.codigoPropio || '').includes(q.trim()))) continue;
      out.push(p);
      if (out.length >= 8) break;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.state.productos, store.state.stock, q, soloSinStock, destinoNum]);

  /** Agrega arriba de todo; si ya está (misma presentación base), suma 1. */
  const agregar = (p) => {
    if (!p) return;
    setItems((rows) => {
      const i = rows.findIndex((r) => parseInt(r.prodId, 10) === p.id && !r.presId);
      if (i >= 0) return rows.map((r, j) => (j === i ? { ...r, cant: String((parseFloat(r.cant) || 0) + 1) } : r));
      return [{ prodId: String(p.id), presId: '', cant: '1' }, ...rows];
    });
    setQ('');
  };

  const setItem = (i, patch) => setItems((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const delItem = (i) => setItems((rows) => rows.filter((_, j) => j !== i));

  const crear = () => {
    const parsed = items.map((it) => ({
      productoId: parseInt(it.prodId, 10),
      presId: it.presId ? parseInt(it.presId, 10) : null,
      cantidad: parseFloat(it.cant) || 0,
    })).filter((it) => it.productoId && it.cantidad > 0);
    act(store.crearTransferencia({
      origenId: origenNum, destinoId: destinoNum,
      usuarioId: parseInt(userId, 10), observaciones: obs, items: parsed,
    }), 'Pedido creado (Pendiente). El origen lo ve en su bandeja de envíos.');
  };

  return (
    <ModalShell
      title="Nuevo pedido de mercadería"
      wide
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: items.length ? `Crear pedido (${items.length})` : 'Crear pedido', clase: 'btn-primary', onClick: crear },
      ]}
    >
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Pedir a (origen) <span className={s.req}>*</span></label>
          <select value={origenId} onChange={(e) => setOrigenId(parseInt(e.target.value, 10))}>{sucursalOptions(store, false)}</select>
        </div>
        <div className={s.field}>
          <label>Entregar en (destino) <span className={s.req}>*</span></label>
          <select value={destinoId} onChange={(e) => setDestinoId(parseInt(e.target.value, 10))}>{sucursalOptions(store, false)}</select>
        </div>
      </div>
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Responsable</label>
          <select value={userId} onChange={(e) => setUserId(parseInt(e.target.value, 10))}>{usuarioOptions(store)}</select>
        </div>
        <div className={s.field}>
          <label>Observaciones</label>
          <input value={obs} placeholder="Reposición semanal, urgente…" onChange={(e) => setObs(e.target.value)} />
        </div>
      </div>

      <div className={s.toolbar} style={{ marginTop: 4 }}>
        <input
          type="search"
          autoFocus
          placeholder="Buscar producto por nombre, marca o código y agregarlo con Enter…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregar(resultados[0]); } }}
        />
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, whiteSpace: 'nowrap', cursor: 'pointer' }}>
          <input type="checkbox" checked={soloSinStock} onChange={(e) => setSoloSinStock(e.target.checked)} />
          Ver solo sin stock en {destino?.nombre ?? 'mi sucursal'}
        </label>
      </div>

      {resultados.length > 0 && (
        <div className={s.card} style={{ padding: 0, marginTop: 6, overflow: 'hidden' }}>
          {resultados.map((p) => {
            const enOrigen = dispTotal(p, origenNum);
            const aca = dispTotal(p, destinoNum);
            return (
              <div
                key={p.id}
                className={s.clickable}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', borderBottom: '1px solid var(--crm-color-border)', cursor: 'pointer' }}
                onClick={() => agregar(p)}
              >
                <span style={{ flex: 1 }}>
                  <strong>{p.nombre}</strong>
                  <span className={s.muted}> · {p.marca || 'Sin marca'}</span>
                </span>
                <span className={cx(s.mono)} style={{ fontSize: 12.5, color: enOrigen > 0 ? 'var(--crm-color-text-secondary)' : 'var(--crm-color-accent-2)' }}>
                  {origen?.nombre}: {store.fmtCant(p, null, enOrigen)}
                </span>
                <span className={cx(s.mono)} style={{ fontSize: 12.5, color: aca > 0 ? 'var(--crm-color-text-secondary)' : 'var(--crm-color-accent-2)' }}>
                  acá: {store.fmtCant(p, null, aca)}
                </span>
                <span style={{ color: 'var(--crm-color-primary)', fontWeight: 700 }}>+ Agregar</span>
              </div>
            );
          })}
        </div>
      )}
      {q && !resultados.length && (
        <div className={s.hint}>Nada coincide{soloSinStock ? ' entre los productos sin stock' : ''}.</div>
      )}

      <div className={s['section-title']} style={{ marginTop: 12 }}>
        Pedido ({items.length}) — el último agregado queda arriba
      </div>
      <Table
        cols={[
          { h: 'Producto' }, { h: 'Present.' },
          { h: `En ${origen?.nombre ?? 'origen'}`, num: true }, { h: `En ${destino?.nombre ?? 'destino'}`, num: true },
          { h: 'Cantidad', num: true }, { h: '', cls: 'actions-col' },
        ]}
        empty="Todavía no agregaste productos. Buscá arriba y agregá con un clic o Enter."
      >
        {items.map((it, i) => {
          const prod = store.getProducto(parseInt(it.prodId, 10));
          if (!prod) return null;
          const presNum = it.presId ? parseInt(it.presId, 10) : null;
          const enOrigen = origenNum ? store.cant(prod.id, origenNum, presNum, 'disponible') : 0;
          const aca = destinoNum ? store.cant(prod.id, destinoNum, presNum, 'disponible') : 0;
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
              <td className={cx(s.num, s.mono)} style={enOrigen > 0 ? undefined : { color: 'var(--crm-color-accent-2)', fontWeight: 700 }}>
                {store.fmtCant(prod, presNum, enOrigen)}
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

      <div className={s.hint}>
        El pedido es <strong>demanda</strong>: no toca ni exige stock. El origen lo divide en sus dos
        listas al preparar y la reserva llega recién cuando cada encargado confirma la suya.
      </div>
    </ModalShell>
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
      <td>${p.nombre}${it.agregado ? ' <em>(agregado)</em>' : ''}</td>
      <td class="chica">${store.presLabel(p, it.presentacionId)}</td>
      <td class="chica n">${it.agregado ? '—' : store.fmtCant(p, it.presentacionId, it.cantidad)}</td>
      <td class="prep"></td>
      <td class="obs">${it.motivo || ''}</td>
      <td class="c">&#9744;</td>
    </tr>`).join('');
  imprimirDocumento('listaPreparacion', {
    titulo: `${t.codigo} — ${meta.titulo}`,
    cuerpo: `
      <h1>${t.codigo} · ${meta.titulo} — para ${destino}</h1>
      <div class="sub">Lista del ${meta.encargado} · ${filas.length} renglón(es) · impresa ${new Date().toLocaleString('es-AR')} · anotá lo preparado y cargalo al volver</div>
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
