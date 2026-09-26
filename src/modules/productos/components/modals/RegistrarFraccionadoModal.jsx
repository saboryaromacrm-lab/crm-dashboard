/**
 * REGISTRAR FRACCIONADO (23/9/2026, pedido del dueño) — el registro como un
 * comprobante: arriba la CABECERA (dónde, quién lo hizo, quién lo carga), abajo
 * los RENGLONES que se van agregando. Reemplaza a la tabla que listaba TODO el
 * granel con un botón por fila: para cargar lo que se fraccionó no hace falta
 * ver 160 productos, hace falta encontrar el que se tiene en la mano.
 *
 * Una tanda puede traer varios productos, y se guarda TODO O NADA: si a uno no
 * le alcanza el granel, no queda registrado ninguno.
 *
 * Buscar es instantáneo: el granel disponible de cada producto se arma UNA vez
 * (una pasada por el stock en memoria) y cada tecla filtra sobre eso.
 */
import { useMemo, useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../../context/ProductosContext.jsx';
import { money, num, fmtTam } from '../../domain/format.js';
import { ModalShell } from '../Modal.jsx';
import { Table, Btn, s } from '../ui.jsx';
import { SelectorOperador, useOperadoresFraccion } from '../OperadorFraccion.jsx';
import { AvisoMomento, CamposMomento, useMomentoFraccion } from '../MomentoFraccion.jsx';

const norm = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

const MAX_RESULTADOS = 8;
/*
 * PAQUETES ENTEROS, SIN REDONDEAR EN SILENCIO (26/9/2026). La pantalla hacía
 * `Math.round` de lo tipeado: "2,5" se registraba como 3 paquetes sin que nadie
 * lo viera. Ahora un número que no es entero se marca y no deja registrar.
 */
const esEntero = (v) => /^\d+$/.test(String(v ?? '').trim());
const noEntero = (v) => String(v ?? '').trim() !== '' && !esEntero(v);
let secuencia = 0;
const clave = () => ++secuencia;

/**
 * `inicial`: renglones ya cargados — [{ productoId, presId, cant }]. Lo usa la
 * preparación de un pedido, que ya sabe cuántos paquetes faltan.
 * `volverA`: el modal al que se vuelve al terminar (el pedido).
 */
export function RegistrarFraccionadoModal({ sucId: sucInit, inicial = [], volverA = null, onRegistrado = null }) {
  const { store, closeModal, openModal, toast, isAdmin } = useProductos();
  /* Todo se fracciona en la DISTRIBUIDORA (ahí llega el granel): no se elige.
   * Si quien abre trae otra (el origen de un pedido), se respeta. Para el que
   * no es jefe manda LA SUCURSAL CON LA QUE ENTRÓ: es la que usa el servidor,
   * y mostrar el granel de otra era registrar en una mirando los números de
   * la otra (25/9/2026). */
  const sucId = Number(sucInit || (isAdmin ? store.distribuidora()?.id : null) || store.state.ctx.sucursalId);
  const sucursal = store.getSucursal(sucId);
  const cargadoPor = store.getUsuario(store.state.ctx.usuarioId)?.nombre;

  const ops = useOperadoresFraccion(sucId);
  const [operadorId, setOperadorId] = useState(null);
  const [motivo, setMotivo] = useState('');
  /*
   * CUÁNDO SE HIZO: por defecto, ahora. Se puede asentar otro día y turno
   * porque muchas veces se carga después ("lo de ayer a la mañana"). La fecha
   * de carga queda igual guardada, así que se sabe que se asentó tarde.
   */
  const momento = useMomentoFraccion();
  const { fechaMal } = momento;
  const [items, setItems] = useState(() => inicial
    .filter((x) => x.productoId && x.presId && Math.round(Number(x.cant)) > 0)
    .map((x) => ({ k: clave(), productoId: x.productoId, presId: x.presId, cant: String(Math.round(Number(x.cant))) })));
  const [busca, setBusca] = useState('');
  const [prodSel, setProdSel] = useState(null);
  const [cants, setCants] = useState({});
  const [guardando, setGuardando] = useState(false);
  const enVuelo = useRef(false);
  const buscador = useRef(null);

  /* Granel disponible por producto en esta sucursal: una sola pasada. */
  const granelDe = useMemo(() => {
    const m = new Map();
    for (const st of store.state.stock) {
      if (st.sucursalId === sucId && !st.presentacionId && st.estado === 'disponible') m.set(st.productoId, st.cantidad);
    }
    return m;
  }, [store.state.stock, sucId]);

  /* Lo que se puede fraccionar: granel activo, con tamaños definidos. */
  const candidatos = useMemo(() => store.state.productos
    .filter((p) => p.tipo === 'granel' && (p.presentaciones || []).length && (p.estado || 'activo') !== 'archivado')
    .map((p) => ({ p, texto: norm(`${p.nombre} ${p.marca || ''} ${p.codigoPropio || ''}`) })), [store.state.productos]);

  const resultados = useMemo(() => {
    const t = busca.trim();
    if (!t) return [];
    // Un código de barras de paquete lleva directo a su producto.
    const porCodigo = candidatos.find(({ p }) => p.presentaciones.some((pr) => pr.codigoBarras && pr.codigoBarras === t));
    if (porCodigo) return [porCodigo.p];
    const palabras = norm(t).split(/\s+/).filter(Boolean);
    const out = [];
    for (const c of candidatos) {
      if (palabras.every((w) => c.texto.includes(w))) out.push(c.p);
      if (out.length >= MAX_RESULTADOS) break;
    }
    return out;
  }, [busca, candidatos]);

  /* Kilos que ya comprometen los renglones cargados, por producto. */
  const kgCargados = useMemo(() => {
    const m = new Map();
    for (const it of items) {
      const p = store.getProducto(it.productoId);
      const tam = p?.presentaciones?.find((x) => x.id === it.presId)?.tamKg || 0;
      m.set(it.productoId, (m.get(it.productoId) || 0) + Math.max(0, Math.round(Number(it.cant) || 0)) * tam);
    }
    return m;
  }, [items, store]);

  const excedidos = [...kgCargados].filter(([pid, kg]) => kg > (granelDe.get(pid) || 0) + 1e-9).map(([pid]) => pid);
  const totalPaquetes = items.reduce((a, it) => a + Math.max(0, Math.round(Number(it.cant) || 0)), 0);
  const totalKg = [...kgCargados.values()].reduce((a, x) => a + x, 0);
  const faltaOperador = ops.disponibles.length > 0 && !operadorId;

  const elegir = (p) => {
    setProdSel(p);
    setCants({});
    setBusca('');
  };

  /* Lo que se está por agregar del producto elegido. */
  const sel = prodSel ? store.getProducto(prodSel.id) : null;
  const kgNuevo = sel ? sel.presentaciones.reduce((a, pr) => a + Math.max(0, Math.round(Number(cants[pr.id]) || 0)) * pr.tamKg, 0) : 0;
  const quedaGranel = sel ? (granelDe.get(sel.id) || 0) - (kgCargados.get(sel.id) || 0) : 0;
  const excedeNuevo = kgNuevo > quedaGranel + 1e-9;
  const decimalesNuevo = !!sel && sel.presentaciones.some((pr) => noEntero(cants[pr.id]));

  const agregar = () => {
    if (!sel || !(kgNuevo > 0) || excedeNuevo || decimalesNuevo) return;
    setItems((xs) => {
      const nuevos = [...xs];
      for (const pr of sel.presentaciones) {
        const q = Math.round(Number(cants[pr.id]) || 0);
        if (!(q > 0)) continue;
        const ya = nuevos.findIndex((x) => x.productoId === sel.id && x.presId === pr.id);
        if (ya >= 0) nuevos[ya] = { ...nuevos[ya], cant: String(Math.round(Number(nuevos[ya].cant) || 0) + q) };
        else nuevos.push({ k: clave(), productoId: sel.id, presId: pr.id, cant: String(q) });
      }
      return nuevos;
    });
    setProdSel(null);
    setCants({});
    buscador.current?.focus();
  };

  const cambiarCant = (k, v) => setItems((xs) => xs.map((x) => (x.k === k ? { ...x, cant: v } : x)));
  const quitar = (k) => setItems((xs) => xs.filter((x) => x.k !== k));

  const volver = () => { if (volverA) openModal(volverA.type, volverA.props); else closeModal(); };

  const validos = items.filter((it) => Math.round(Number(it.cant) || 0) > 0);
  const conDecimales = items.some((it) => noEntero(it.cant));
  const puedeRegistrar = validos.length > 0 && !conDecimales && !excedidos.length && !faltaOperador && !fechaMal && !guardando;

  const registrar = async () => {
    if (!puedeRegistrar || enVuelo.current) return;
    enVuelo.current = true;
    setGuardando(true);
    const res = await store.opFraccionarRegistro({
      sucursalId: sucId,
      ...(operadorId ? { operadorId } : {}),
      ...(motivo.trim() ? { motivo: motivo.trim() } : {}),
      // En el momento no se manda nada: la hora la pone el servidor.
      ...momento.payload,
      items: validos.map((it) => ({ productoId: it.productoId, presId: it.presId, cant: Math.round(Number(it.cant)) })),
    });
    enVuelo.current = false;
    setGuardando(false);
    if (!res.ok) { toast(res.error || 'No se pudo registrar.', 'err'); return; }
    toast(`Fraccionado registrado: ${num(res.paquetes, 0)} paquete(s), ${num(res.kg, 3)} kg.`, 'ok');
    onRegistrado?.();
    volver();
  };

  return (
    <ModalShell
      title="Registrar fraccionado"
      subtitle={volverA ? 'Para completar el pedido — al terminar volvés a él' : undefined}
      wide
      onClose={volver}
      footer={[
        { texto: volverA ? 'Volver al pedido' : 'Cancelar', clase: 'btn-ghost', onClick: volver },
        {
          texto: guardando
            ? 'Registrando…'
            : totalPaquetes > 0
              ? `Registrar fraccionado · ${num(totalPaquetes, 0)} paq. · ${num(totalKg, 3)} kg`
              : 'Registrar fraccionado',
          clase: 'btn-primary',
          onClick: registrar,
          disabled: !puedeRegistrar,
        },
      ]}
    >
      {/* ------------------------------ Cabecera ------------------------------ */}
      <div
        className={cx(s.card, s.cardPad)}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, alignItems: 'end', marginBottom: 14 }}
      >
        <div className={s.field} style={{ marginBottom: 0 }}>
          <label>Se fracciona en</label>
          <strong style={{ fontSize: 14 }}>{sucursal?.nombre ?? '—'}</strong>
        </div>
        <CamposMomento m={momento} />
        <div className={s.field} style={{ marginBottom: 0 }}>
          <label>Cargado por</label>
          <strong style={{ fontSize: 14 }}>{cargadoPor || '—'}</strong>
        </div>
        {ops.disponibles.length > 0 && (
          <div style={{ marginBottom: 0 }}>
            <SelectorOperador ops={ops} value={operadorId} onChange={setOperadorId} />
          </div>
        )}
        <div className={s.field} style={{ marginBottom: 0 }}>
          <label htmlFor="fracc-obs">Observaciones</label>
          <input id="fracc-obs" value={motivo} maxLength={300} placeholder="Opcional" onChange={(e) => setMotivo(e.target.value)} />
        </div>
      </div>

      <AvisoMomento m={momento} style={{ marginTop: -4, marginBottom: 14 }} />

      {/* --------------------------- Agregar renglón --------------------------- */}
      <div className={s['mini-label']}>Agregar producto</div>
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <input
          ref={buscador}
          id="fracc-buscar"
          type="search"
          autoFocus={!items.length}
          value={busca}
          placeholder="Buscá el granel por nombre, marca, código… o escaneá el código del paquete"
          onChange={(e) => setBusca(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && resultados.length === 1) { e.preventDefault(); elegir(resultados[0]); } }}
          aria-label="Buscar producto a granel"
        />
        {busca.trim() && (
          <div
            className={s.card}
            style={{ position: 'absolute', left: 0, right: 0, top: '100%', zIndex: 5, maxHeight: 280, overflowY: 'auto', marginTop: 4 }}
          >
            {resultados.length === 0 && (
              <div className={s.hint} style={{ margin: 0, padding: '10px 12px' }}>
                Ningún granel con tamaños de paquete coincide. Los tamaños se cargan en la ficha del producto, pestaña Presentaciones.
              </div>
            )}
            {resultados.map((p) => {
              const g = granelDe.get(p.id) || 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => elegir(p)}
                  style={{
                    display: 'flex', width: '100%', justifyContent: 'space-between', gap: 12, padding: '9px 12px',
                    background: 'transparent', border: 0, borderBottom: '1px solid var(--crm-color-border)',
                    cursor: 'pointer', textAlign: 'left', color: 'inherit',
                  }}
                >
                  <span>
                    <strong>{p.nombre}</strong>
                    {p.marca && <span className={s.muted}> · {p.marca}</span>}
                  </span>
                  <span className={s.mono} style={{ whiteSpace: 'nowrap', opacity: g > 1e-9 ? 1 : 0.5 }}>
                    {num(g, 3)} kg a granel
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {sel && (
        <div className={cx(s.card, s.cardPad)} style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
            <strong>{sel.nombre}{sel.marca ? <span className={s.muted}> · {sel.marca}</span> : null}</strong>
            <span className={s.hint} style={{ margin: 0 }}>
              Granel disponible: <strong>{num(quedaGranel, 3)} kg</strong>
              {(kgCargados.get(sel.id) || 0) > 0 && ' (ya descontado lo cargado abajo)'}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
            {[...sel.presentaciones].sort((a, b) => b.tamKg - a.tamKg).map((pr, i) => (
              <div key={pr.id} className={s.field} style={{ marginBottom: 0 }}>
                <label htmlFor={`fracc-pres-${pr.id}`}>
                  {fmtTam(pr.tamKg)}
                  <span className={s.muted} style={{ fontWeight: 400 }}>
                    {' · '}{pr.precioFinal != null ? money(pr.precioFinal) : 'sin precio'}
                  </span>
                </label>
                <input
                  id={`fracc-pres-${pr.id}`}
                  type="number" min="0" step="1" placeholder="0"
                  autoFocus={i === 0}
                  value={cants[pr.id] ?? ''}
                  style={noEntero(cants[pr.id]) ? { borderColor: 'var(--crm-color-danger)' } : undefined}
                  onChange={(e) => setCants((c) => ({ ...c, [pr.id]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregar(); } }}
                />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
            <span className={cx(s.hint)} style={{ margin: 0, color: excedeNuevo || decimalesNuevo ? 'var(--crm-color-danger)' : undefined }}>
              {decimalesNuevo ? 'Los paquetes van enteros: no existe medio paquete.' : kgNuevo > 0
                ? excedeNuevo
                  ? `Son ${num(kgNuevo, 3)} kg y quedan ${num(quedaGranel, 3)} kg a granel.`
                  : `Suman ${num(kgNuevo, 3)} kg · quedarían ${num(quedaGranel - kgNuevo, 3)} kg a granel.`
                : 'Cargá cuántos paquetes de cada tamaño se armaron.'}
            </span>
            <span style={{ flex: 1 }} />
            <Btn small onClick={() => { setProdSel(null); setCants({}); }}>Cancelar</Btn>
            <Btn small variant="btn-primary" onClick={agregar} disabled={!(kgNuevo > 0) || excedeNuevo || decimalesNuevo}>Agregar</Btn>
          </div>
        </div>
      )}

      {/* ------------------------------ Renglones ------------------------------ */}
      <Table
        cols={[{ h: 'Producto' }, { h: 'Paquete' }, { h: 'Cantidad', num: true }, { h: 'Kg', num: true }, { h: '', cls: 'actions-col' }]}
        empty="Todavía no agregaste nada: buscá el producto arriba."
      >
        {items.map((it) => {
          const p = store.getProducto(it.productoId);
          const pr = p?.presentaciones?.find((x) => x.id === it.presId);
          const q = Math.max(0, Math.round(Number(it.cant) || 0));
          const excede = excedidos.includes(it.productoId);
          return (
            <tr key={it.k} style={excede ? { background: 'rgba(220,38,38,.06)' } : undefined}>
              <td>
                {p?.nombre ?? '—'}
                {excede && (
                  <div className={s.hint} style={{ margin: 0, color: 'var(--crm-color-danger)' }}>
                    No alcanza el granel: hay {num(granelDe.get(it.productoId) || 0, 3)} kg
                  </div>
                )}
              </td>
              <td>{pr ? fmtTam(pr.tamKg) : '—'}</td>
              <td className={s.num}>
                <input
                  type="number" min="0" step="1" value={it.cant}
                  aria-label={`Cantidad de ${p?.nombre ?? ''} ${pr ? fmtTam(pr.tamKg) : ''}`}
                  style={{ width: 90, textAlign: 'right', ...(noEntero(it.cant) ? { borderColor: 'var(--crm-color-danger)' } : {}) }}
                  onChange={(e) => cambiarCant(it.k, e.target.value)}
                />
                {noEntero(it.cant) && (
                  <div className={s.hint} style={{ margin: 0, color: 'var(--crm-color-danger)' }}>Entero</div>
                )}
              </td>
              <td className={cx(s.num, s.mono)}>{num(q * (pr?.tamKg || 0), 3)}</td>
              <td className={s['actions-col']}>
                <button type="button" className={s['pres-remove']} title="Quitar renglón" onClick={() => quitar(it.k)}>×</button>
              </td>
            </tr>
          );
        })}
      </Table>
      {faltaOperador && validos.length > 0 && (
        <div className={cx(s.callout, s.warn)} style={{ marginTop: 10 }}>Elegí quién fraccionó para poder registrar.</div>
      )}
    </ModalShell>
  );
}
