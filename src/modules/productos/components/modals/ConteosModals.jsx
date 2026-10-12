/**
 * CONTROL DE STOCK — el alta y la sesión de conteo (0066)
 * ============================================================================
 * Dos modales:
 *
 *  · `ConteoNuevoModal` — los FILTROS del alcance (una o varias marcas,
 *    categoría, proveedor, tipo, solo con stock) con la vista previa de cuántos
 *    renglones nacen. El dueño cuenta por marca, no todo junto. Lo que ya se
 *    está contando en otro control queda afuera (y la marca sin nada libre ni
 *    se ofrece).
 *
 *  · `ConteoModal` — la sesión. En curso es la pantalla de CONTAR, pensada
 *    para el lector: escanear → cae en el renglón → cantidad → Enter →
 *    siguiente. Cerrada es el REPORTE de diferencias (para el que puede
 *    aplicar) valorizado a costo, con recontar, reabrir y aplicar.
 *
 * EL CIEGO NO SE DECIDE ACÁ: la API no manda el virtual mientras la sesión
 * está en curso y el que mira no tiene la llave de aplicar. Esta pantalla
 * pinta lo que llega — si no llega, no existe.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../../context/ProductosContext.jsx';
import { cuerpoPlanillaConteo, imprimirDocumento } from '@core/services/imprimir.js';
import { money } from '../../domain/format.js';
import { norm } from '../CatalogoPicker.jsx';
import { ModalShell } from '../Modal.jsx';
import { Table, Btn, s } from '../ui.jsx';

/* ------------------------------------------------------------------ *
 * Alta: el alcance
 * ------------------------------------------------------------------ */

export function ConteoNuevoModal({ alCrear }) {
  const { store, isAdmin, closeModal, toast } = useProductos();
  const puedeAplicar = isAdmin || store.can('conteos_aplicar');
  const [f, setF] = useState({
    responsable: '', nombre: '', marcaIds: [], categoriaId: '', proveedorId: '', tipo: '',
    // Por defecto destildados (10/10/2026, decisión del dueño): entra todo el alcance y se ve el sistema.
    soloConStock: false, ciego: false,
  });
  const [creando, setCreando] = useState(false);
  const [ocupados, setOcupados] = useState(null);
  const set = (patch) => setF((x) => ({ ...x, ...patch }));

  /* Lo que ya se está contando en la sucursal (en curso o cerrado sin aplicar):
   * queda afuera del control nuevo, y la marca que no tiene nada libre ni se ofrece. */
  useEffect(() => {
    let vivo = true;
    store.conteosOcupados().then((r) => {
      if (!vivo) return;
      if (r.ok) setOcupados(r.data);
      else { toast(r.error, 'err'); setOcupados({ controles: [], formas: [] }); }
    });
    return () => { vivo = false; };
  }, [store, toast]);

  /*
   * LA VISTA PREVIA, EN MEMORIA: el store ya tiene productos y stock, así que
   * se estima acá con los mismos criterios que usa el servidor (que decide).
   * Una pasada por el catálogo da, por marca, cuántos renglones quedan libres y
   * cuántos ya están en otro control; con eso se arma la lista de marcas y el
   * total del botón.
   */
  const analisis = useMemo(() => {
    const enUso = new Map((ocupados?.formas ?? []).map(([p, pr, c]) => [`${p}:${pr || ''}`, c]));
    const porMarca = new Map();
    for (const p of store.state.productos) {
      if (p.estado === 'archivado') continue;
      if (f.categoriaId && String(p.categoriaId ?? '') !== String(f.categoriaId)) continue;
      if (f.tipo && p.tipo !== f.tipo) continue;
      if (f.proveedorId && !(p.formatosCompra || []).some((e) => String(e.proveedorId) === String(f.proveedorId))) continue;
      const k = p.marcaId ?? 0;
      const m = porMarca.get(k) ?? { libres: 0, ocupadas: 0, controles: new Set() };
      for (const presId of [null, ...(p.presentaciones || []).map((pr) => pr.id)]) {
        if (f.soloConStock && !(Math.abs(store.cant(p.id, store.state.ctx.sucursalId, presId, 'disponible')) > 1e-9)) continue;
        const c = enUso.get(`${p.id}:${presId ?? ''}`);
        if (c) { m.ocupadas += 1; m.controles.add(c); } else m.libres += 1;
      }
      porMarca.set(k, m);
    }
    return porMarca;
  }, [store, f.categoriaId, f.tipo, f.proveedorId, f.soloConStock, ocupados]);

  /* Las marcas que todavía tienen algo para contar; las que no, ni aparecen. */
  const marcas = useMemo(() => (store.state.catalogos?.marcas ?? [])
    .map((m) => ({ ...m, ...(analisis.get(m.id) ?? { libres: 0, ocupadas: 0 }) }))
    .filter((m) => m.libres > 0)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')), [store, analisis]);
  const ocultas = (store.state.catalogos?.marcas ?? []).filter((m) => (analisis.get(m.id)?.ocupadas ?? 0) > 0 && !(analisis.get(m.id)?.libres > 0)).length;
  /* Una marca elegida que se quedó sin nada libre (cambió el tipo, por ejemplo) deja de contar sola. */
  const elegidas = f.marcaIds.filter((id) => marcas.some((m) => m.id === id));

  const resumen = useMemo(() => {
    const claves = elegidas.length ? elegidas : [...analisis.keys()];
    const r = { libres: 0, afuera: 0, controles: new Set() };
    for (const k of claves) {
      const m = analisis.get(k);
      if (!m) continue;
      r.libres += m.libres; r.afuera += m.ocupadas;
      m.controles.forEach((c) => r.controles.add(c));
    }
    return r;
  }, [analisis, elegidas]);
  const controlesAfuera = (ocupados?.controles ?? []).filter((c) => resumen.controles.has(c.id));

  const crear = async () => {
    setCreando(true);
    const r = await store.crearConteo({
      responsable: f.responsable.trim(),
      nombre: f.nombre.trim() || undefined,
      marcaIds: elegidas.length ? elegidas : undefined,
      categoriaId: f.categoriaId ? Number(f.categoriaId) : undefined,
      proveedorId: f.proveedorId ? Number(f.proveedorId) : undefined,
      tipo: f.tipo || undefined,
      soloConStock: f.soloConStock,
      ciego: f.ciego,
    });
    setCreando(false);
    if (!r.ok) { toast(r.error, 'err'); return; }
    toast(`Control abierto: ${r.data.total} renglones para contar${r.data.afuera ? ` (${r.data.afuera} quedaron afuera: ya están en otro control)` : ''}.`, 'ok');
    closeModal();
    alCrear?.(r.data.id);
  };

  const cargando = ocupados === null;
  return (
    <ModalShell
      title="Nuevo control de stock"
      subtitle="El alcance define qué se cuenta. La lista se congela al abrir: lo que entre al catálogo después no se cuela."
      wide
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        {
          texto: creando ? 'Abriendo…' : cargando ? 'Revisando lo que ya se cuenta…' : `Abrir control (≈${resumen.libres} renglones)`,
          clase: 'btn-primary', onClick: crear, disabled: creando || cargando || resumen.libres === 0 || !f.responsable.trim(),
        },
      ]}
    >
      <div className={s['form-grid']}>
        {/* Quién responde por el conteo (0154): a mano, puede no tener usuario. Sale en la planilla. */}
        <div className={s.field}>
          <label htmlFor="conteo-responsable">Responsable <span className={s.req}>*</span></label>
          <input id="conteo-responsable" value={f.responsable} maxLength={80} autoFocus placeholder="Ej: Juan Pérez" onChange={(e) => set({ responsable: e.target.value })} />
        </div>
        <div className={s.field}>
          <label htmlFor="conteo-nombre">Nombre (opcional)</label>
          <input id="conteo-nombre" value={f.nombre} placeholder="Ej: Góndola CUMANA" onChange={(e) => set({ nombre: e.target.value })} />
        </div>
      </div>

      <SelectorMarcas
        marcas={marcas} elegidas={elegidas} ocultas={ocultas} cargando={cargando}
        onChange={(marcaIds) => set({ marcaIds })}
      />

      <div className={s['form-grid']}>
        <div className={s.field}>
          <label htmlFor="conteo-categoria">Categoría</label>
          <select id="conteo-categoria" value={f.categoriaId} onChange={(e) => set({ categoriaId: e.target.value })}>
            <option value="">Todas</option>
            {(store.state.catalogos?.categorias ?? []).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div className={s.field}>
          <label htmlFor="conteo-proveedor">Proveedor</label>
          <select id="conteo-proveedor" value={f.proveedorId} onChange={(e) => set({ proveedorId: e.target.value })}>
            <option value="">Todos</option>
            {store.state.proveedores.filter((p) => p.proveeMercaderia !== false)
              .map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
        <div className={s.field}>
          <label htmlFor="conteo-tipo">Tipo</label>
          <select id="conteo-tipo" value={f.tipo} onChange={(e) => set({ tipo: e.target.value })}>
            <option value="">Enteros y granel</option>
            <option value="entero">Solo enteros</option>
            <option value="granel">Solo granel</option>
          </select>
        </div>
      </div>

      {resumen.afuera > 0 && (
        <div className={cx(s.callout, s.info)}>
          Quedan <strong>afuera {resumen.afuera} renglón(es)</strong> que ya se están contando en{' '}
          {controlesAfuera.map((c, i) => (
            <span key={c.id}>{i > 0 && ', '}<strong>«{c.nombre || `#${c.id}`}»</strong>{c.responsable ? ` (${c.responsable})` : ''}</span>
          ))}. Un producto no puede estar en dos controles abiertos: se contaría y se ajustaría dos veces.
        </div>
      )}

      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13 }}>
        <input type="checkbox" checked={f.soloConStock} onChange={(e) => set({ soloConStock: e.target.checked })} style={{ marginTop: 2 }} />
        <span>
          Solo lo que <strong>el sistema cree que tiene stock</strong>. Destildalo para un conteo a fondo:
          también entra lo que figura en cero (así aparece el sobrante que el sistema no sabe que existe).
        </span>
      </label>

      {puedeAplicar && (
        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13 }}>
          <input type="checkbox" checked={f.ciego} onChange={(e) => set({ ciego: e.target.checked })} style={{ marginTop: 2 }} />
          <span>
            <strong>Conteo ciego</strong> — el que cuenta no ve cuánto debería haber. Es la práctica
            correcta: se cuenta lo que hay, no lo que dice el sistema. Destildarlo muestra el virtual en vivo.
          </span>
        </label>
      )}

      <div className={s.hint}>
        El control se hace con el <strong>local cerrado</strong>. Se guarda solo renglón por renglón:
        podés cerrar la ventana y retomarlo, y otra persona puede seguir donde dejaste.
      </div>
    </ModalShell>
  );
}

/**
 * VARIAS MARCAS EN UN CONTROL (12/10/2026). Ninguna tildada = todas. Se busca
 * escribiendo (Enter tilda la primera que aparece) y las elegidas quedan arriba
 * como etiquetas. Cada marca dice cuánto le queda para contar.
 */
function SelectorMarcas({ marcas, elegidas, ocultas, cargando, onChange }) {
  const [q, setQ] = useState('');
  const elegidasSet = new Set(elegidas);
  const visibles = q.trim() ? marcas.filter((m) => norm(m.nombre).includes(norm(q))) : marcas;
  const alternar = (id) => onChange(elegidasSet.has(id) ? elegidas.filter((x) => x !== id) : [...elegidas, id]);
  const nombreDe = (id) => marcas.find((m) => m.id === id)?.nombre ?? `#${id}`;

  return (
    <div className={s.field}>
      <label htmlFor="conteo-marcas-buscar">
        Marcas {elegidas.length > 0 ? <strong>({elegidas.length} elegida{elegidas.length > 1 ? 's' : ''})</strong> : <span className={s.hint} style={{ margin: 0 }}>— ninguna tildada = todas</span>}
      </label>
      {elegidas.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
          {elegidas.map((id) => (
            <button
              key={id} type="button" onClick={() => alternar(id)} title="Sacar esta marca"
              style={{ border: '1px solid var(--crm-color-primary)', background: 'var(--crm-color-primary-soft, #dcfce7)', color: 'var(--crm-color-text)', borderRadius: 999, padding: '2px 10px', fontSize: 12.5, cursor: 'pointer' }}
            >
              {nombreDe(id)} ×
            </button>
          ))}
          <Btn small onClick={() => onChange([])}>Quitar todas</Btn>
        </div>
      )}
      <input
        id="conteo-marcas-buscar" value={q} placeholder={cargando ? 'Revisando lo que ya se cuenta…' : 'Buscar marca… (Enter tilda la primera)'}
        disabled={cargando}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          if (visibles[0]) { alternar(visibles[0].id); setQ(''); }
        }}
      />
      <div style={{ maxHeight: 210, overflowY: 'auto', border: '1px solid var(--crm-color-border)', borderRadius: 8, marginTop: 6 }}>
        {visibles.map((m) => (
          <label
            key={m.id}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', cursor: 'pointer', borderBottom: '1px solid var(--crm-color-border)', background: elegidasSet.has(m.id) ? 'var(--crm-color-primary-soft, #f0fdf4)' : undefined }}
          >
            <input type="checkbox" checked={elegidasSet.has(m.id)} onChange={() => alternar(m.id)} />
            <span style={{ flex: 1 }}>{m.nombre}</span>
            <span className={s.hint} style={{ margin: 0, whiteSpace: 'nowrap' }}>
              {m.libres} para contar{m.ocupadas > 0 ? ` · ${m.ocupadas} ya en otro control` : ''}
            </span>
          </label>
        ))}
        {!cargando && visibles.length === 0 && <div className={s.hint} style={{ padding: 10, margin: 0 }}>Ninguna marca con ese nombre tiene algo para contar.</div>}
      </div>
      {ocultas > 0 && (
        <div className={s.hint} style={{ margin: '4px 0 0' }}>
          {ocultas} marca{ocultas > 1 ? 's no aparecen' : ' no aparece'}: todo lo suyo (con estos filtros) ya se está contando en otro control.
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * La sesión: contar / revisar / aplicar
 * ------------------------------------------------------------------ */

export function ConteoModal({ conteoId, alTerminar }) {
  const { store, isAdmin, closeModal, toast } = useProductos();
  const puedeAplicar = isAdmin || store.can('conteos_aplicar');
  const [data, setData] = useState(null);
  const [q, setQ] = useState('');
  const [vista, setVista] = useState('pendientes'); // pendientes | contados | todos
  const [cantidades, setCantidades] = useState({}); // itemId → texto tipeado
  const [ocupado, setOcupado] = useState(false);
  /* El candado del doble clic va con `useRef`: el estado de React recién se ve
   * en el dibujo siguiente, y dos clics seguidos leían los dos "libre" (así se
   * aplicaba un control dos veces). La API ahora también lo frena. */
  const enVuelo = useRef(false);
  /* Aplicar mueve stock y plata: se confirma dos veces (27/9/2026). */
  const [confirmarAplicar, setConfirmarAplicar] = useState(false);
  const buscadorRef = useRef(null);
  const inputRefs = useRef({});

  const recargar = useCallback(async () => {
    const r = await store.getConteo(conteoId);
    if (!r.ok) { toast(r.error, 'err'); closeModal(); return; }
    setData(r.data);
  }, [store, conteoId, toast, closeModal]);
  useEffect(() => { recargar(); }, [recargar]);

  const enCurso = data?.estado === 'en_curso';
  const items = data?.items ?? [];

  /*
   * EL BUSCADOR ES EL LECTOR. Un lector USB tipea el código y manda Enter: si
   * el texto matchea UN renglón por código (del producto o del paquete), el
   * foco salta directo a su campo de cantidad. Tipear a mano filtra la lista,
   * que es lo mismo con menos apuro.
   */
  const codigoDe = (it) => {
    const p = store.getProducto(it.productoId);
    if (it.presentacionId) {
      const pr = (p?.presentaciones || []).find((x) => x.id === it.presentacionId);
      return pr?.codigoBarras || '';
    }
    return p?.codigoBarras || p?.codigoPropio || '';
  };

  const visibles = useMemo(() => {
    const ql = norm(q);
    return items.filter((it) => {
      if (vista === 'pendientes' && it.contado != null && !it.recontar) return false;
      if (vista === 'contados' && it.contado == null) return false;
      if (!ql) return true;
      return norm(it.nombre).includes(ql) || norm(it.presLabel).includes(ql)
        || codigoDe(it).includes(q.trim());
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, q, vista]);

  /*
   * LA PLANILLA — el papel que se lleva a la góndola.
   *
   * Sale lo que muestra la PESTAÑA elegida (Pendientes / Contados / Todos),
   * NO lo que dejó el buscador: ese campo es el lector, se llena y se vacía a
   * cada rato, y una hoja de un solo renglón porque quedó texto tipeado es
   * exactamente el papel que nadie quiere descubrir en el estante. Por eso el
   * botón lleva el número adelante: lo que dice es lo que sale.
   *
   * El "sistema dice" no viaja acá ni cuando el control no es ciego: ver
   * `cuerpoPlanillaConteo`.
   */
  const paraImprimir = useMemo(() => items.filter((it) => {
    if (vista === 'pendientes') return it.contado == null || it.recontar;
    if (vista === 'contados') return it.contado != null;
    return true;
  }), [items, vista]);

  const imprimirPlanilla = async () => {
    const marcas = new Map((store.state.catalogos?.marcas ?? []).map((m) => [m.id, m.nombre]));
    const ok = await imprimirDocumento('planillaConteo', {
      titulo: data.nombre || `Control #${data.id}`,
      cuerpo: cuerpoPlanillaConteo({
        titulo: data.nombre || `Control #${data.id}`,
        alcance: data.alcance,
        sucursal: store.getSucursal(data.sucursalId)?.nombre ?? '',
        responsable: data.responsable,
        impresa: new Date().toLocaleString('es-AR'),
        hoja: vista === 'pendientes' ? 'pendientes de contar'
          : vista === 'contados' ? 'ya contados' : 'lista completa',
        filas: paraImprimir.map((it) => ({ ...it, codigo: codigoDe(it), marca: marcas.get(store.getProducto(it.productoId)?.marcaId) ?? '' })),
      }),
    });
    if (!ok) toast('El navegador bloqueó la ventana de impresión. Permitila y probá de nuevo.', 'err');
  };

  const alBuscar = (e) => {
    if (e.key !== 'Enter') return;
    const cod = q.trim();
    if (!cod) return;
    const match = items.filter((it) => codigoDe(it) && codigoDe(it) === cod);
    if (match.length === 1) {
      const el = inputRefs.current[match[0].id];
      if (el) { el.focus(); el.select(); }
    }
  };

  /** El Enter del renglón: PUT, tilde, y el foco vuelve al lector. */
  const contar = async (it) => {
    const texto = cantidades[it.id];
    if (texto == null || texto === '') return;
    const v = Number(String(texto).replace(',', '.'));
    if (!(v >= 0)) { toast('La cantidad no puede ser negativa.', 'err'); return; }
    const r = await store.contarItemConteo(conteoId, it.id, v);
    if (!r.ok) { toast(r.error, 'err'); return; }
    setCantidades((x) => ({ ...x, [it.id]: undefined }));
    setQ('');
    await recargar();
    buscadorRef.current?.focus();
  };

  const descontar = async (it) => {
    const r = await store.contarItemConteo(conteoId, it.id, null);
    if (!r.ok) { toast(r.error, 'err'); return; }
    await recargar();
  };

  const accion = async (fn, msgOk) => {
    if (enVuelo.current) return null;
    enVuelo.current = true;
    setOcupado(true);
    let r;
    try { r = await fn(); } finally { enVuelo.current = false; setOcupado(false); }
    if (r?.ok === false) { toast(r.error, 'err'); return null; }
    if (msgOk) toast(msgOk, 'ok');
    return r;
  };

  const cerrarControl = async () => {
    const pendientes = items.filter((i) => i.contado == null).length;
    const r = await accion(() => store.cerrarConteo(conteoId));
    if (!r) return;
    toast(pendientes
      ? `Control cerrado con ${pendientes} sin contar (quedan como están).`
      : 'Control cerrado: listo para revisar.', 'ok');
    await recargar();
    alTerminar?.();
  };

  const aplicar = async () => {
    if (!confirmarAplicar) { setConfirmarAplicar(true); return; }
    setConfirmarAplicar(false);
    const r = await accion(() => store.aplicarConteo(conteoId));
    if (!r) return;
    const avisos = r.avisos ?? r.data?.avisos ?? [];
    toast(`Aplicado: ${r.ajustes ?? r.data?.ajustes ?? 0} ajustes.${avisos.length ? ` ⚠ ${avisos.length} avisos.` : ''}`, avisos.length ? 'err' : 'ok');
    await recargar();
    alTerminar?.();
  };

  if (!data) return null;

  /* ---------- Reporte (cerrado/aplicado, con la llave) ---------- */
  const conDiferencias = data.puedeVerVirtual && data.estado !== 'en_curso';
  /* Control NO ciego: mientras se cuenta se ve lo que dice el sistema (la API lo manda solo en ese caso). */
  const verSistema = enCurso && !data.ciego;
  const contadas = items.filter((i) => i.contado != null);
  const sinContar = items.filter((i) => i.contado == null);
  const conDif = conDiferencias ? contadas.filter((i) => Math.abs(i.diferencia ?? 0) > 1e-9) : [];
  const faltante = conDif.filter((i) => (i.diferencia ?? 0) < 0).reduce((a, i) => a + (i.diferenciaPlata ?? 0), 0);
  const sobrante = conDif.filter((i) => (i.diferencia ?? 0) > 0).reduce((a, i) => a + (i.diferenciaPlata ?? 0), 0);
  const movidos = conDiferencias ? contadas.filter((i) => i.seMovio) : [];

  const footer = [];
  if (enCurso) {
    footer.push({ texto: 'Cerrar y seguir después', clase: 'btn-ghost', onClick: () => { closeModal(); alTerminar?.(); } });
    footer.push({ texto: ocupado ? '…' : 'Cerrar el control', clase: 'btn-primary', onClick: cerrarControl, disabled: ocupado || data.contados === 0 });
  } else if (data.estado === 'cerrado') {
    footer.push({ texto: 'Volver', clase: 'btn-ghost', onClick: () => { closeModal(); alTerminar?.(); } });
    /* Reabrir es del que revisa (la API lo exige): si no, el que contaba podía
     * cambiar números después de la revisión. */
    if (puedeAplicar) {
      footer.push({ texto: 'Reabrir para seguir contando', clase: 'btn-ghost', onClick: () => accion(() => store.reabrirConteo(conteoId)).then((r) => r && recargar()), disabled: ocupado });
      footer.push({ texto: 'Descartar', clase: 'btn-delete', onClick: () => accion(() => store.descartarConteo(conteoId), 'Control descartado.').then((r) => { if (r) { closeModal(); alTerminar?.(); } }), disabled: ocupado });
      if (confirmarAplicar) footer.push({ texto: 'No, revisar', clase: 'btn-ghost', onClick: () => setConfirmarAplicar(false), disabled: ocupado });
      footer.push({
        texto: ocupado ? 'Aplicando…' : confirmarAplicar ? `Sí, aplicar ${conDif.length} ajuste(s) al stock` : `Aplicar ${conDif.length} ajuste(s)…`,
        clase: 'btn-primary', onClick: aplicar, disabled: ocupado,
      });
    }
  } else {
    footer.push({ texto: 'Cerrar', clase: 'btn-ghost', onClick: () => { closeModal(); alTerminar?.(); } });
  }

  return (
    <ModalShell
      title={data.nombre || `Control #${data.id}`}
      subtitle={`${data.alcance} · ${store.getSucursal(data.sucursalId)?.nombre ?? ''}${data.responsable ? ` · Responsable: ${data.responsable}` : ''} · ${data.contados} de ${data.total} contados${data.ciego ? ' · ciego' : ''}`}
      size="xl"
      onClose={() => { closeModal(); alTerminar?.(); }}
      footer={footer}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16, overflow: 'hidden', flex: 1 }}>

        {confirmarAplicar && (
          <div className={cx(s.callout, s.warn)}>
            <strong>Segunda confirmación.</strong> Vas a ajustar el stock de{' '}
            <strong>{store.getSucursal(data.sucursalId)?.nombre ?? 'la sucursal'}</strong> en {conDif.length} producto(s):
            faltantes por {money(Math.abs(faltante))} y sobrantes por {money(Math.abs(sobrante))}. Lo no contado no se toca.
            Esto no se deshace: si algo no te cierra, tocá <strong>No, revisar</strong>.
          </div>
        )}

        {enCurso && (
          <>
            <div className={s.toolbar}>
              <input
                ref={buscadorRef}
                value={q}
                placeholder="Escaneá un código o buscá por nombre…"
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={alBuscar}
                autoFocus
                style={{ flex: 1, minWidth: 240, padding: '9px 12px', border: '1px solid var(--crm-color-border)', borderRadius: 'var(--crm-radius-sm)', background: 'var(--crm-color-surface)', color: 'var(--crm-color-text)' }}
              />
              {['pendientes', 'contados', 'todos'].map((v) => (
                <Btn key={v} small variant={vista === v ? 'btn-primary' : 'btn-ghost'} onClick={() => setVista(v)}>
                  {v === 'pendientes' ? `Pendientes (${data.total - data.contados})` : v === 'contados' ? `Contados (${data.contados})` : 'Todos'}
                </Btn>
              ))}
              {/* Imprime la pestaña elegida, no el buscador: el número del botón
                  es el del papel. */}
              <Btn small variant="btn-ghost" onClick={imprimirPlanilla} disabled={paraImprimir.length === 0}>
                🖨 Imprimir planilla ({paraImprimir.length})
              </Btn>
            </div>
            {/* La pestaña Pendientes muestra también lo marcado "recontar":
                para el contador ES trabajo pendiente, venga de donde venga. */}
          </>
        )}

        {conDiferencias && (
          <div className={s.toolbar} style={{ gap: 16 }}>
            <span>Faltante: <strong style={{ color: 'var(--crm-color-danger)' }}>{money(Math.abs(faltante))}</strong></span>
            <span>Sobrante: <strong style={{ color: 'var(--crm-color-success)' }}>{money(sobrante)}</strong></span>
            <span>Neto: <strong>{money(sobrante + faltante)}</strong></span>
            {sinContar.length > 0 && <span className={s.muted}>Sin contar: {sinContar.length} (quedan como están)</span>}
            {movidos.length > 0 && (
              <span style={{ color: 'var(--crm-color-danger)', fontWeight: 700 }}>
                ⚠ {movidos.length} se movieron después de contarlos — ¿se vendió algo con el local cerrado?
              </span>
            )}
          </div>
        )}

        <div style={{ overflow: 'auto', flex: 1 }}>
          <Table
            cols={enCurso ? [
              { h: 'Producto' }, ...(verSistema ? [{ h: 'Sistema', num: true }] : []),
              { h: 'Apartados', num: true }, { h: 'Contado', num: true }, { h: '', cls: 'actions-col' },
            ] : [
              { h: 'Producto' }, { h: 'Contado', num: true },
              ...(conDiferencias ? [{ h: 'Sistema', num: true }, { h: 'Diferencia', num: true }, { h: '$', num: true }] : []),
              { h: 'Contó' }, ...(conDiferencias && data.estado === 'cerrado' ? [{ h: '', cls: 'actions-col' }] : []),
            ]}
            empty={enCurso && vista === 'pendientes' ? '¡Todo contado! Pasá a "Cerrar el control".' : 'Nada por acá.'}
          >
            {(enCurso ? visibles : (conDiferencias ? [...conDif, ...contadas.filter((i) => Math.abs(i.diferencia ?? 0) <= 1e-9), ...sinContar] : items)).map((it) => (
              <tr key={it.id} style={it.recontar ? { background: 'color-mix(in srgb, var(--crm-color-danger) 8%, transparent)' } : undefined}>
                <td>
                  <strong>{it.nombre}</strong>
                  {it.presLabel && <strong> · {it.presLabel}</strong>}
                  <span className={s.muted}> ({it.unidad})</span>
                  {it.recontar && <div className={s.hint} style={{ margin: 0, color: 'var(--crm-color-danger)' }}>⚠ Volver a contar</div>}
                </td>

                {verSistema && (
                  <td className={cx(s.num, s.mono)}>{it.virtual != null ? it.virtual : <span className={s.muted}>—</span>}</td>
                )}

                {enCurso && (
                  <td className={cx(s.num, s.mono)}>
                    {it.apartados > 1e-9
                      ? <span title="Separado para envíos: NO lo cuentes">{it.apartados} ⚠</span>
                      : <span className={s.muted}>—</span>}
                  </td>
                )}

                <td className={cx(s.num, s.mono)}>
                  {enCurso ? (
                    <input
                      ref={(el) => { inputRefs.current[it.id] = el; }}
                      type="number" step={it.unidad === 'kg' ? 'any' : '1'} min="0"
                      value={cantidades[it.id] ?? ''}
                      placeholder={it.contado != null ? String(it.contado) : ''}
                      onChange={(e) => setCantidades((x) => ({ ...x, [it.id]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') contar(it); }}
                      style={{ width: 92, padding: '6px 8px', textAlign: 'right', border: '1px solid var(--crm-color-border)', borderRadius: 'var(--crm-radius-sm)', background: 'var(--crm-color-surface)', color: 'var(--crm-color-text)' }}
                    />
                  ) : (
                    it.contado != null ? `${it.contado} ${it.unidad}` : <span className={s.muted}>sin contar</span>
                  )}
                </td>

                {!enCurso && conDiferencias && (
                  <>
                    <td className={cx(s.num, s.mono)}>{it.contado != null ? it.virtualAlContar : <span className={s.muted}>—</span>}</td>
                    <td className={cx(s.num, s.mono)}>
                      {it.diferencia == null || Math.abs(it.diferencia) <= 1e-9
                        ? <span className={s.muted}>{it.contado != null ? '✓ cuadra' : '—'}</span>
                        : (
                          <strong style={{ color: it.diferencia < 0 ? 'var(--crm-color-danger)' : 'var(--crm-color-success)' }}>
                            {it.diferencia > 0 ? '+' : ''}{it.diferencia}
                            {it.seMovio && ' ⚠'}
                          </strong>
                        )}
                    </td>
                    <td className={cx(s.num, s.mono)}>
                      {it.diferenciaPlata != null && Math.abs(it.diferencia ?? 0) > 1e-9 ? money(it.diferenciaPlata) : ''}
                    </td>
                  </>
                )}

                {!enCurso && <td>{store.getUsuario(it.contadoPor)?.nombre ?? '—'}</td>}

                {enCurso && (
                  <td className={s['actions-col']}>
                    {it.contado != null
                      ? <><span title={`Contado por ${store.getUsuario(it.contadoPor)?.nombre ?? '—'}`}>✓</span>{' '}<Btn small onClick={() => descontar(it)}>Deshacer</Btn></>
                      : null}
                  </td>
                )}

                {!enCurso && conDiferencias && data.estado === 'cerrado' && (
                  <td className={s['actions-col']}>
                    {it.contado != null && Math.abs(it.diferencia ?? 0) > 1e-9 && (
                      <Btn small onClick={() => accion(() => store.marcarRecontarConteo(conteoId, it.id, !it.recontar)).then((r) => r && recargar())}>
                        {it.recontar ? 'Quitar marca' : 'Recontar'}
                      </Btn>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </Table>
        </div>

        {!enCurso && !data.puedeVerVirtual && (
          <div className={s.hint}>
            El control está cerrado. Las diferencias las revisa quien tiene la llave de aplicar;
            si te piden recontar algo, reabrilo y los renglones marcados aparecen resaltados.
          </div>
        )}
      </div>
    </ModalShell>
  );
}
