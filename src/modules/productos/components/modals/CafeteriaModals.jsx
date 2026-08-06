/**
 * CAFETERÍA — modales del envío a coffit.
 * ============================================================================
 * El envío es un PUNTO DE SALIDA a costo, no una transferencia: la cafetería
 * vive en otro sistema (coffit, dueño de su stock) y el CRM nunca muestra sus
 * existencias. Cada renglón viaja con su destino — PARA VENDER (reventa tal
 * cual) o PARA USAR (insumo de receta) — que es el dato que le dice a coffit
 * cómo importarlo. El costo lo congela la API al confirmar; lo que se ve acá
 * es el estimado con el costo de hoy.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { imprimirDocumento } from '@core/services/imprimir.js';
import { useProductos } from '../../context/ProductosContext.jsx';
import { money, num, fmtFechaHora, isoDate } from '../../domain/format.js';
import { ModalShell } from '../Modal.jsx';
import { sucursalOptions } from '../selectOptions.jsx';
import { Table, Btn, Pill, s } from '../ui.jsx';

function Di({ label, children }) {
  return <div className={s.di}><div className={s.l}>{label}</div><div className={s.v}>{children}</div></div>;
}

const norm = (v) => (v || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

export const DESTINOS_CAFE = {
  venta: { label: 'Para vender', pill: 'est-recibida' },
  uso: { label: 'Para usar', pill: 'est-pendiente' },
};

/**
 * Buscador sobre TODO el catálogo (nombre, código interno o barras — también
 * el de las presentaciones fraccionadas, que llevan etiqueta propia).
 */
function BuscadorCatalogo({ store, onElegir, autoFocus }) {
  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(false);
  const blurTimer = useRef(null);

  const matches = useMemo(() => {
    const ql = norm(texto);
    const digitos = texto.replace(/\D/g, '');
    const todos = store.state.productos;
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
  }, [store, texto]);

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
                {' · '}{money(store.costoNeto(m.prod))}/{store.unidadDe(m.prod, null) === 'kg' ? 'kg' : 'u'} de costo
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

/* ============================== NUEVO ENVÍO / DEVOLUCIÓN ============================== */

export function EnvioCafeteriaFormModal({ tipo = 'envio' }) {
  const { store, closeModal, toast, sucOperativa } = useProductos();
  const esDevolucion = tipo === 'devolucion';

  const [sucId, setSucId] = useState(() => String(sucOperativa() ?? store.distribuidora()?.id ?? ''));
  const [fecha, setFecha] = useState(isoDate(new Date()));
  const [obs, setObs] = useState('');
  /** { prodId, presId, destino, cantidad } — el costo lo congela la API. */
  const [items, setItems] = useState([]);
  const [busquedaLote, setBusquedaLote] = useState(false);

  const setItem = (i, patch) => setItems((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  const delItem = (i) => setItems((r) => r.filter((_, j) => j !== i));
  const agregar = (prod, presId) => setItems((r) => [...r, {
    prodId: prod.id, presId: presId ?? null, destino: 'venta', cantidad: '',
  }]);

  /** Ingreso en lote desde el buscador global: un renglón por producto tildado. */
  const agregarLote = (elegidos) => {
    setItems((r) => [...r, ...elegidos.map((p) => ({
      prodId: p.id, presId: null, destino: 'venta', cantidad: '',
    }))]);
    setBusquedaLote(false);
    toast(`${elegidos.length} producto(s) agregados al envío.`, 'ok');
  };

  /** Costo estimado del renglón con el costo de HOY ($/kg × tamaño si es paquete). */
  const costoDe = (it) => {
    const prod = store.getProducto(it.prodId);
    if (!prod) return 0;
    const cn = store.costoNeto(prod);
    const pres = it.presId ? store.presDe(prod, it.presId) : null;
    return pres ? cn * (pres.tamKg || 1) : cn;
  };
  const total = items.reduce((a, it) => a + costoDe(it) * (Number(it.cantidad) || 0), 0);

  const guardar = async () => {
    const parsed = items
      .filter((it) => Number(it.cantidad) > 0)
      .map((it) => ({
        productoId: it.prodId,
        presentacionId: it.presId || undefined,
        destino: it.destino,
        cantidad: Number(it.cantidad),
      }));
    if (!parsed.length) { toast('Agregá al menos un renglón con cantidad.', 'err'); return; }
    const res = await store.crearEnvioCafeteria({
      tipo, sucursalId: parseInt(sucId, 10) || undefined, fecha,
      observaciones: obs.trim(), items: parsed,
    });
    if (!res.ok) { toast(res.error || 'No se pudo registrar.', 'err'); return; }
    toast(`${res.codigo} registrado · ${money(res.totalCosto)} a costo.`, 'ok');
    closeModal();
  };

  return (
    <>
    <ModalShell
      title={esDevolucion ? 'Devolución desde Cafetería' : 'Nuevo envío a Cafetería'}
      subtitle={esDevolucion
        ? 'La mercadería vuelve al stock, valorizada a costo'
        : 'Sale del stock a costo — el stock del café lo maneja coffit'}
      wide
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: esDevolucion ? 'Registrar devolución' : 'Registrar envío', clase: 'btn-primary', onClick: guardar },
      ]}
    >
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>{esDevolucion ? 'Vuelve a la sucursal' : 'Sale de la sucursal'} <span className={s.req}>*</span></label>
          <select value={sucId} onChange={(e) => setSucId(e.target.value)}>{sucursalOptions(store, false)}</select>
        </div>
        <div className={s.field}>
          <label>Fecha</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
      </div>

      <div className={s['section-title']}>Renglones</div>
      <div className={s.hint} style={{ marginTop: 0 }}>
        <strong>Para vender</strong> = coffit lo revende tal cual (la gaseosa, el alfajor).{' '}
        <strong>Para usar</strong> = insumo de sus recetas (la leche, el café en grano). Ese dato
        le dice a coffit cómo cargarlo. El costo se congela al confirmar, con el costo de hoy.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr .8fr 1fr 1fr auto', gap: 8, marginBottom: 6 }}>
        {['Producto', 'Presentación', 'Destino', 'Cantidad', 'Costo unit.', 'Subtotal', ''].map((h, i) => (
          <div key={i} className={s['mini-label']}>{h}</div>
        ))}
      </div>
      {items.map((it, i) => {
        const prod = store.getProducto(it.prodId);
        if (!prod) return null;
        const u = store.unidadDe(prod, it.presId);
        const disp = store.cant(prod.id, parseInt(sucId, 10), it.presId, 'disponible');
        const costoU = costoDe(it);
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr .8fr 1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'start' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{prod.nombre}</div>
              <div className={s.hint} style={{ margin: 0 }}>
                disponible: {store.fmtCant(prod, it.presId, disp)}
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
            <select value={it.destino} onChange={(e) => setItem(i, { destino: e.target.value })}>
              {Object.entries(DESTINOS_CAFE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <input
              type="number" min="0" step="any" value={it.cantidad}
              title={u === 'kg' ? 'Kilos' : 'Unidades / paquetes'}
              onChange={(e) => setItem(i, { cantidad: e.target.value })}
            />
            <div className={cx(s.mono, s.num)} style={{ alignSelf: 'center' }}>{money(costoU)}</div>
            <div className={cx(s.mono, s.num)} style={{ fontWeight: 700, alignSelf: 'center' }}>
              {money(costoU * (Number(it.cantidad) || 0))}
            </div>
            <button type="button" className={s['pres-remove']} onClick={() => delItem(i)}>×</button>
          </div>
        );
      })}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <BuscadorCatalogo store={store} onElegir={agregar} autoFocus={items.length === 0} />
        </div>
        <button type="button" className={cx(s.btn, s['btn-ghost'], s['btn-sm'])} onClick={() => setBusquedaLote(true)}>
          Buscar en lote (marca / categoría)
        </button>
      </div>

      <div className={cx(s.callout, s.ok)} style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
        <span>{items.length} renglón(es)</span>
        <span>Total estimado a costo: <strong>{money(total)}</strong></span>
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
      <td>${it.nombre}</td>
      <td class="chica">${it.codigoBarras || it.codigoPropio || '—'}</td>
      <td class="chica">${DESTINOS_CAFE[it.destino]?.label || it.destino}</td>
      <td class="n">${num(it.cantidad, 3)} ${it.unidad}</td>
      <td class="n">${money(it.costoUnitario)}</td>
      <td class="n">${money(it.costoUnitario * it.cantidad)}</td>
    </tr>`).join('');
  imprimirDocumento('remitoCafeteria', {
    titulo: `${envio.codigo} — ${envio.tipo === 'devolucion' ? 'Devolución desde Cafetería' : 'Remito a Cafetería'}`,
    cuerpo: `
      <h1>${envio.codigo} · ${envio.tipo === 'devolucion' ? 'Devolución desde Cafetería' : 'Remito a Cafetería'}</h1>
      <div class="sub">${new Date(envio.fecha).toLocaleString('es-AR')} · ${envio.tipo === 'devolucion' ? 'vuelve a' : 'sale de'} ${envio.sucursalNombre || ''}${envio.usuarioNombre ? ` · ${envio.usuarioNombre}` : ''}</div>
      <table>
        <thead><tr><th>Producto</th><th>Código</th><th>Destino</th><th>Cantidad</th><th>Costo unit.</th><th>Subtotal</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
      <div class="tot"><strong>Total a costo: ${money(envio.totalCosto)}</strong></div>
      ${envio.observaciones ? `<div class="nota">${envio.observaciones}</div>` : ''}
      <div class="fiscal">TRASPASO INTERNO VALORIZADO A COSTO — DOCUMENTO NO FISCAL</div>`,
  });
}

export function EnvioCafeteriaDetalleModal({ id }) {
  const { store, act, closeModal, toast } = useProductos();
  const [envio, setEnvio] = useState(null);
  const [motivoAnular, setMotivoAnular] = useState('');

  const cargar = useCallback(async () => {
    try { setEnvio(await store.envioCafeteria(id)); }
    catch { toast('No se pudo cargar el envío.', 'err'); }
  }, [store, id, toast]);
  useEffect(() => { cargar(); }, [cargar]);

  const anular = async () => {
    if (!motivoAnular.trim()) { toast('Escribí por qué se anula.', 'err'); return; }
    await act(store.anularEnvioCafeteria(id, motivoAnular.trim()), 'Anulado — el stock volvió a su lugar.');
  };

  const footerBase = [{ texto: 'Cerrar', clase: 'btn-ghost', onClick: closeModal }];
  if (!envio) {
    return <ModalShell title="Envío a Cafetería" onClose={closeModal} footer={footerBase}>
      <div className={s['empty-state']}>Cargando…</div>
    </ModalShell>;
  }

  const vivo = envio.estado === 'confirmado';
  return (
    <ModalShell
      title={`${envio.codigo} · ${envio.tipo === 'devolucion' ? 'Devolución desde Cafetería' : 'Envío a Cafetería'}`}
      subtitle={envio.observaciones || undefined}
      wide
      onClose={closeModal}
      footer={[
        { texto: 'Imprimir remito', clase: 'btn-ghost', onClick: () => imprimirRemito(envio) },
        ...footerBase,
      ]}
    >
      <div className={s['detalle-grid']}>
        <Di label="Estado">
          {vivo ? <Pill pill="est-recibida" label="Confirmado" /> : <Pill pill="est-cancelada" label="Anulado" />}
        </Di>
        <Di label="Fecha">{fmtFechaHora(envio.fecha)}</Di>
        <Di label={envio.tipo === 'devolucion' ? 'Volvió a' : 'Salió de'}>{envio.sucursalNombre || '—'}</Di>
        <Di label="Quién">{envio.usuarioNombre || '—'}</Di>
        <Di label="Total a costo"><strong>{money(envio.totalCosto)}</strong></Di>
      </div>
      {!vivo && envio.motivoAnulacion && (
        <div className={cx(s.callout, s.warn)}>Anulado: {envio.motivoAnulacion}</div>
      )}

      <Table
        cols={[
          { h: 'Producto' }, { h: 'Código' }, { h: 'Destino' },
          { h: 'Cantidad', num: true }, { h: 'Costo unit.', num: true }, { h: 'Subtotal', num: true },
        ]}
      >
        {(envio.items || []).map((it) => (
          <tr key={it.id}>
            <td>{it.nombre}</td>
            <td className={s.mono}>{it.codigoBarras || it.codigoPropio || '—'}</td>
            <td><Pill pill={DESTINOS_CAFE[it.destino]?.pill} label={DESTINOS_CAFE[it.destino]?.label || it.destino} /></td>
            <td className={s.num}>{num(it.cantidad, 3)} {it.unidad}</td>
            <td className={s.num}>{money(it.costoUnitario)}</td>
            <td className={cx(s.num, s.mono)}>{money(it.costoUnitario * it.cantidad)}</td>
          </tr>
        ))}
      </Table>

      <div className={s.hint}>
        Los costos quedaron <strong>congelados</strong> al confirmar: este remito dice lo mismo
        aunque después cambien los proveedores. El código es la clave para cargarlo en coffit.
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
            <Btn variant="btn-delete" small onClick={anular}>Anular</Btn>
          </div>
          <div className={s.hint} style={{ margin: '8px 0 0' }}>
            Anular revierte el stock con la operación contraria: el envío reingresa; la
            devolución vuelve a salir (si ese stock ya no está, se rechaza).
          </div>
        </div>
      )}
    </ModalShell>
  );
}
