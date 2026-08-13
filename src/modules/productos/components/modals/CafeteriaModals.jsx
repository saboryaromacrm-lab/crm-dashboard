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
import { ESTADOS_ENVIO_CAFE, ESTADOS_PEDIDO_CAFE } from '../../domain/constants.js';
import { ModalShell } from '../Modal.jsx';
import { sucursalOptions } from '../selectOptions.jsx';
import { Table, Btn, Pill, s } from '../ui.jsx';

function Di({ label, children }) {
  return <div className={s.di}><div className={s.l}>{label}</div><div className={s.v}>{children}</div></div>;
}

const norm = (v) => (v || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

/**
 * Buscador sobre TODO el catálogo (nombre, código interno o barras — también
 * el de las presentaciones fraccionadas, que llevan etiqueta propia).
 * Exportado: también lo usa el formulario del PEDIDO de la cafetería.
 */
export function BuscadorCatalogo({ store, onElegir, autoFocus }) {
  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(false);
  const blurTimer = useRef(null);

  const matches = useMemo(() => {
    const ql = norm(texto);
    const digitos = texto.replace(/\D/g, '');
    /* Sin ARCHIVADOS: no se piden, no se envían al café y no se les controla el
     * vencimiento (la API además los rechaza). El discontinuado SÍ aparece:
     * mientras quede stock, sigue circulando. */
    const todos = store.state.productos.filter((p) => (p.estado || 'activo') !== 'archivado');
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

/* ============================== NUEVO ENVÍO / EDICIÓN ============================== */

/**
 * El MISMO formulario para las dos cosas: `envio` en null = alta; con valor =
 * edición de un envío ya enviado. En la edición, el costo que se muestra es el
 * CONGELADO de cada renglón que ya estaba (la API lo conserva); un renglón
 * nuevo se muestra —y se valúa— al costo de hoy, y el formulario lo dice.
 */
export function EnvioCafeteriaFormModal({ envio = null, pedido = null }) {
  const { store, closeModal, toast, sucOperativa } = useProductos();
  const esEdicion = !!envio;

  const [sucId, setSucId] = useState(() => String(envio?.sucursalId ?? sucOperativa() ?? store.distribuidora()?.id ?? ''));
  const [fecha, setFecha] = useState(() => isoDate(envio ? new Date(envio.fecha) : new Date()));
  const [obs, setObs] = useState(envio?.observaciones ?? pedido?.observaciones ?? '');
  /** { prodId, presId, cantidad } — el costo lo maneja la API (congelado/hoy).
   * El detalle inicial sale del envío (edición) o del PEDIDO que se convierte:
   * lo pedido es la propuesta, y el que arma corrige a lo que de verdad va. */
  const [items, setItems] = useState(() => ((envio?.items ?? pedido?.items) ?? []).map((it) => ({
    prodId: it.productoId, presId: it.presentacionId ?? null, cantidad: String(it.cantidad),
  })));
  const [busquedaLote, setBusquedaLote] = useState(false);

  /** Costo congelado por renglón que ya estaba: clave prod-pres. */
  const congelados = useMemo(() => new Map(
    (envio?.items ?? []).map((it) => [`${it.productoId}-${it.presentacionId ?? 0}`, it.costoUnitario]),
  ), [envio]);

  const setItem = (i, patch) => setItems((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  const delItem = (i) => setItems((r) => r.filter((_, j) => j !== i));
  const agregar = (prod, presId) => setItems((r) => [...r, { prodId: prod.id, presId: presId ?? null, cantidad: '' }]);

  /** Ingreso en lote desde el buscador global: un renglón por producto tildado. */
  const agregarLote = (elegidos) => {
    setItems((r) => [...r, ...elegidos.map((p) => ({ prodId: p.id, presId: null, cantidad: '' }))]);
    setBusquedaLote(false);
    toast(`${elegidos.length} producto(s) agregados al envío.`, 'ok');
  };

  /** El costo del renglón: congelado si ya estaba en el envío; el de hoy si es nuevo. */
  const costoDe = (it) => {
    const clave = `${it.prodId}-${it.presId ?? 0}`;
    if (congelados.has(clave)) return { costo: congelados.get(clave), congelado: true };
    const prod = store.getProducto(it.prodId);
    if (!prod) return { costo: 0, congelado: false };
    const cn = store.costoNeto(prod);
    const pres = it.presId ? store.presDe(prod, it.presId) : null;
    return { costo: pres ? cn * (pres.tamKg || 1) : cn, congelado: false };
  };
  const total = items.reduce((a, it) => a + costoDe(it).costo * (Number(it.cantidad) || 0), 0);

  const guardar = async () => {
    const parsed = items
      .filter((it) => Number(it.cantidad) > 0)
      .map((it) => ({
        productoId: it.prodId,
        presentacionId: it.presId || undefined,
        cantidad: Number(it.cantidad),
      }));
    if (!parsed.length) { toast('Agregá al menos un renglón con cantidad.', 'err'); return; }

    const res = esEdicion
      ? await store.editarEnvioCafeteria(envio.id, {
        version: envio.version, fecha, observaciones: obs.trim(), items: parsed,
      })
      : await store.crearEnvioCafeteria({
        sucursalId: parseInt(sucId, 10) || undefined, fecha,
        observaciones: obs.trim(), items: parsed,
        // El pedido que este envío cumple: la API lo cierra en el mismo acto.
        pedidoId: pedido?.id ?? undefined,
      });
    if (!res.ok) { toast(res.error || 'No se pudo registrar.', 'err'); return; }
    toast(
      esEdicion
        ? `${res.codigo} corregido (versión ${res.version}) · nuevo total ${money(res.totalCosto)}. Coffit lo ve en su próxima sincronización.`
        : pedido
          ? `${res.codigo} enviado · cumple el pedido ${pedido.codigo}, que quedó cerrado.`
          : `${res.codigo} enviado · ${money(res.totalCosto)} a costo. La mercadería ya egresó del stock.`,
      'ok',
    );
    closeModal();
  };

  return (
    <>
    <ModalShell
      title={esEdicion ? `Editar ${envio.codigo}` : (pedido ? `Armar envío — pedido ${pedido.codigo}` : 'Nuevo envío a Cafetería')}
      subtitle={esEdicion
        ? `Versión actual: ${envio.version}. La corrección revierte el envío anterior y aplica este detalle — el stock acompaña.`
        : pedido
          ? 'Lo pedido es la propuesta: corregí a lo que de verdad va. Al enviar, el pedido queda cerrado.'
          : 'El envío egresa el stock y congela el costo en el mismo acto: con esto ya se da por hecho que el café lo recibió'}
      wide
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: esEdicion ? 'Guardar corrección' : 'Enviar', clase: 'btn-primary', onClick: guardar },
      ]}
    >
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Sale de la sucursal <span className={s.req}>*</span></label>
          {/* En la edición la sucursal no se cambia: el stock ya salió de UNA. */}
          <select value={sucId} disabled={esEdicion} onChange={(e) => setSucId(e.target.value)}>
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
        Qué es cada cosa (góndola o insumo) <strong>lo decide coffit al recibir</strong> en su
        almacén “Sabor y Aroma” — acá solo viaja el detalle completo.{' '}
        {esEdicion
          ? <>El costo congelado de cada renglón <strong>se conserva</strong>; un renglón nuevo entra al costo de hoy.</>
          : <>El costo se congela al enviar, con el costo de hoy.</>}
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
            <input
              type="number" min="0" step="any" value={it.cantidad}
              title={u === 'kg' ? 'Kilos' : 'Unidades / paquetes'}
              onChange={(e) => setItem(i, { cantidad: e.target.value })}
            />
            <div style={{ alignSelf: 'center' }}>
              <span className={cx(s.mono)}>{money(costoU)}</span>
              {esEdicion && (
                <div className={s.hint} style={{ margin: 0 }}>{congelado ? 'congelado' : 'costo de hoy'}</div>
              )}
            </div>
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
        <span>Total a costo: <strong>{money(total)}</strong></span>
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
  const { store, act, closeModal, openModal, toast, isAdmin } = useProductos();
  const [envio, setEnvio] = useState(null);
  const [motivoAnular, setMotivoAnular] = useState('');

  const cargar = useCallback(async () => {
    try { setEnvio(await store.envioCafeteria(id)); }
    catch { toast('No se pudo cargar el envío.', 'err'); }
  }, [store, id, toast]);
  useEffect(() => { cargar(); }, [cargar]);

  const anular = async () => {
    if (!motivoAnular.trim()) { toast('Escribí por qué se anula.', 'err'); return; }
    await act(store.anularEnvioCafeteria(id, motivoAnular.trim()), 'Anulado — todo el stock volvió a su lugar. Coffit lo ve en su próxima sincronización.');
  };

  const footerBase = [{ texto: 'Cerrar', clase: 'btn-ghost', onClick: closeModal }];
  if (!envio) {
    return <ModalShell title="Envío a Cafetería" onClose={closeModal} footer={footerBase}>
      <div className={s['empty-state']}>Cargando…</div>
    </ModalShell>;
  }

  const est = ESTADOS_ENVIO_CAFE[envio.estado] || {};
  const vivo = envio.estado !== 'anulado';
  return (
    <ModalShell
      title={`${envio.codigo} · Envío a Cafetería`}
      subtitle={envio.observaciones || undefined}
      wide
      onClose={closeModal}
      footer={[
        ...(isAdmin && vivo
          ? [{ texto: 'Editar', clase: 'btn-primary', onClick: () => { closeModal(); openModal('envioCafeteria', { envio }); } }]
          : []),
        { texto: 'Imprimir remito', clase: 'btn-ghost', onClick: () => imprimirRemito(envio) },
        ...footerBase,
      ]}
    >
      <div className={s['detalle-grid']}>
        <Di label="Estado"><Pill pill={est.pill} label={est.label || envio.estado} /></Di>
        <Di label="Fecha">{fmtFechaHora(envio.fecha)}</Di>
        <Di label="Salió de">{envio.sucursalNombre || '—'}</Di>
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
        Los costos quedaron <strong>congelados al enviar</strong>: este remito dice lo mismo aunque
        después cambien los proveedores. Qué es cada cosa lo decide coffit al recibirlo en su
        almacén “Sabor y Aroma” — la clave del mapeo es el código.
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
            <Btn variant="btn-delete" small onClick={anular}>Anular</Btn>
          </div>
          <div className={s.hint} style={{ margin: '8px 0 0' }}>
            Anular revierte TODO: la mercadería reingresa al stock y coffit tiene que deshacer su
            ingreso (le llega por sincronización). Para corregir cantidades, usá <strong>Editar</strong>.
          </div>
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
export function PedidoCafeteriaFormModal() {
  const { store, closeModal, toast } = useProductos();
  const [obs, setObs] = useState('');
  /** { prodId, presId, cantidad } */
  const [items, setItems] = useState([]);

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
    const res = await store.crearPedidoCafeteria({ observaciones: obs.trim(), items: parsed });
    if (!res.ok) { toast(res.error || 'No se pudo enviar el pedido.', 'err'); return; }
    toast(`${res.codigo} enviado a la distribuidora. Te avisa el estado en esta pantalla.`, 'ok');
    closeModal();
  };

  return (
    <ModalShell
      title="Pedido a la distribuidora"
      subtitle="Elegí qué necesitás y en qué cantidad. La distribuidora lo arma y te lo manda — el detalle final es el del envío."
      wide
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Enviar pedido', clase: 'btn-primary', onClick: guardar },
      ]}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr .8fr auto', gap: 8, marginBottom: 6 }}>
        {['Producto', 'Presentación', 'Cantidad', ''].map((h, i) => (
          <div key={i} className={s['mini-label']}>{h}</div>
        ))}
      </div>
      {items.map((it, i) => {
        const prod = store.getProducto(it.prodId);
        if (!prod) return null;
        const u = store.unidadDe(prod, it.presId);
        const disp = store.suma({ productoId: prod.id, presentacionId: it.presId ?? null, estado: 'disponible' });
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr .8fr auto', gap: 8, marginBottom: 8, alignItems: 'start' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{prod.nombre}</div>
              <div className={s.hint} style={{ margin: 0 }}>
                disponible en la distribuidora: {store.fmtCant(prod, it.presId, disp)}
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
              type="number" min="0" step="any" value={it.cantidad}
              title={u === 'kg' ? 'Kilos' : 'Unidades / paquetes'}
              onChange={(e) => setItem(i, { cantidad: e.target.value })}
            />
            <button type="button" className={s['pres-remove']} onClick={() => delItem(i)}>×</button>
          </div>
        );
      })}
      <BuscadorCatalogo store={store} onElegir={agregar} autoFocus={items.length === 0} />

      <div className={cx(s.callout, s.ok)} style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
        <span>{items.length} renglón(es)</span>
        <span>El pedido no mueve stock: es la demanda del café.</span>
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
  const { store, act, closeModal, openModal, toast, isAdmin } = useProductos();
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
  const puedeAnular = abierto && (isAdmin || pedido.estado === 'pendiente');

  const anular = async () => {
    if (!motivoAnular.trim()) { toast('Escribí por qué se anula.', 'err'); return; }
    await act(store.anularPedidoCafeteria(id, motivoAnular.trim()), 'Pedido anulado.');
  };

  return (
    <ModalShell
      title={`${pedido.codigo} · Pedido de la cafetería`}
      subtitle={pedido.observaciones || undefined}
      wide
      onClose={closeModal}
      footer={[
        ...(isAdmin && pedido.estado === 'pendiente'
          ? [{ texto: 'Tomar (lo estoy armando)', clase: 'btn-ghost', onClick: () => act(store.tomarPedidoCafeteria(id), 'Tomado: el café lo ve como "armando".') }]
          : []),
        ...(isAdmin && abierto
          ? [{ texto: 'Convertir en envío', clase: 'btn-primary', onClick: () => { closeModal(); openModal('envioCafeteria', { pedido }); } }]
          : []),
        ...footerBase,
      ]}
    >
      <div className={s['detalle-grid']}>
        <Di label="Estado"><Pill pill={est.pill} label={est.label || pedido.estado} /></Di>
        <Di label="Pedido">{fmtFechaHora(pedido.fecha)}</Di>
        <Di label="Quién">{pedido.usuarioNombre || '—'}</Di>
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
        reemplazos), y el café lo recibe por su sincronización.
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
