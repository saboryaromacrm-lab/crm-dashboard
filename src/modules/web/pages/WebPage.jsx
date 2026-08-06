/**
 * WEB — la administración de la tienda mayorista online
 * ============================================================================
 * Módulo propio del sidebar (grupo Catálogo), con su sub-menú de secciones a la
 * izquierda igual que Compras, Ventas, Almacén y Gastos: moverse entre módulos
 * no cambia de idioma visual.
 *
 * Cinco secciones, cinco responsabilidades:
 *
 *   - PRODUCTOS: lo que el sitio muestra. La lista ES la del sitio (mismo
 *     endpoint público `GET /tienda/catalogo`): un producto aparece si tiene
 *     precio en la lista Mayorista — acá no se publica ni se despublica, se
 *     ve. Lo único editable: `destacado`, la FOTO y el mínimo web.
 *   - OFERTAS: las promos que llegan al sitio (solo las que valen para la
 *     lista Mayorista). Solo lectura: se editan en Ventas › Ofertas.
 *   - CONTENIDO: los slides de la portada, el banner y las imágenes de
 *     categorías y marcas.
 *   - ESTADÍSTICAS: visitas, qué se mira y qué se busca.
 *   - CONFIGURACIÓN: logo, favicon, contacto y redes del sitio.
 *
 * Todo lo demás del producto (nombre, precio, stock, etiquetas) se maneja en
 * Compras › Productos — a propósito: una sola fuente de verdad por dato.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { httpClient } from '@core/services/httpClient.js';
import { appConfig } from '@core/config/app.config.js';
import { usePermissions } from '@core/permissions/PermissionContext.jsx';
import { PageHeader } from '@shared/components/PageHeader/PageHeader.jsx';
import { cx } from '@shared/utils/classNames.js';
import { Table, PanelHead, Stat, Btn, usePaginado, s } from '@modules/productos/components/ui.jsx';
import { WEB_SECCIONES } from '../config/web.config.js';
import { SubirImagenBtn } from '../components/SubirImagenBtn.jsx';
import { PRESETS_IMAGEN } from '../services/imagenes.js';

const money = (n) => new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(Number(n) || 0);


/** Src absoluto de una imagen del catálogo (las subidas llegan como ruta relativa a la API). */
function srcImagen(url) {
  if (!url) return '';
  return /^https?:|^data:/.test(url) ? url : `${appConfig.api.baseUrl}/${url}`;
}

/** Igual que el cartel del sitio: qué promete cada mecánica de oferta. */
function mecanicaOferta(o) {
  switch (o.tipo) {
    case 'porcentaje': return `${o.porcentaje}% OFF`;
    case 'precio_fijo': return `Precio oferta ${money(o.precio)}`;
    case 'nxm': return `${o.lleva}×${o.paga}`;
    case 'segunda_unidad': return `2ª unidad ${o.porcentaje}% OFF`;
    case 'pack': return `${o.lleva} por ${money(o.precio)}`;
    default: return o.tipo;
  }
}

function estadoVigencia(o) {
  const ahora = new Date();
  if (o.desde && ahora < new Date(o.desde)) return { label: 'Programada', pill: 'est-pendiente' };
  if (o.hasta && ahora > new Date(o.hasta)) return { label: 'Vencida', pill: 'est-cancelada' };
  return { label: 'Vigente', pill: 'st-disponible' };
}

/* El botón de subida vive en components/SubirImagenBtn.jsx: es EL estándar —
 * molde por preset, compresión WebP, quitar fondo y previsualización. */

/** Miniatura con el mismo fondo que usa el sitio; '—' honesto si no hay imagen. */
function Thumb({ url, alt, size = 42 }) {
  if (!url) {
    return (
      <span style={{
        width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--crm-color-bg)', border: '1px dashed var(--crm-color-border)',
        borderRadius: 8, fontSize: 10, color: 'var(--crm-color-text-muted)',
      }}
      >
        sin foto
      </span>
    );
  }
  return (
    <img
      src={srcImagen(url)}
      alt={alt}
      style={{ width: size, height: size, objectFit: 'contain', background: '#fff', border: '1px solid var(--crm-color-border)', borderRadius: 8 }}
    />
  );
}

/* ==================================================================== *
 * Productos del sitio
 * ==================================================================== */

/**
 * Input del piso de stock online: guarda al salir del campo o con Enter, solo
 * si cambió. Editar un número por fila no amerita un modal.
 */
function MinimoWebInput({ producto, admin, onGuardar }) {
  const [valor, setValor] = useState(String(admin?.webStockMin ?? 0));
  useEffect(() => { setValor(String(admin?.webStockMin ?? 0)); }, [admin?.webStockMin]);

  const confirmar = () => {
    const n = Number(valor);
    if (!Number.isFinite(n) || n < 0) { setValor(String(admin?.webStockMin ?? 0)); return; }
    if (n !== (admin?.webStockMin ?? 0)) onGuardar(producto, n);
  };

  return (
    <input
      type="number" min="0" step="1"
      value={valor}
      onChange={(e) => setValor(e.target.value)}
      onBlur={confirmar}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      title="Al llegar a este stock, el sitio muestra «Sin stock» y lo que queda se prioriza para fraccionar / mostrador. 0 = sin piso."
      style={{ width: 74, padding: '5px 8px', border: '1px solid var(--crm-color-border)', borderRadius: 8, textAlign: 'right' }}
    />
  );
}

function ProductosWebPanel({ catalogo, recargar, avisar }) {
  const [q, setQ] = useState('');
  const [ocupado, setOcupado] = useState(0); // id del producto en mutación
  const [admin, setAdmin] = useState(new Map()); // id → { webStockMin, stockDisp }

  /** Datos que NO viajan en el catálogo público: stock real y piso configurado. */
  const cargarAdmin = useCallback(async () => {
    try {
      const filas = await httpClient.get('/web/productos');
      setAdmin(new Map(filas.map((f) => [f.id, f])));
    } catch { /* sin datos admin, la tabla igual muestra el resto */ }
  }, []);
  useEffect(() => { cargarAdmin(); }, [cargarAdmin]);

  const items = useMemo(() => {
    const norm = (v) => String(v).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
    const nq = norm(q.trim());
    const base = catalogo?.items ?? [];
    return nq ? base.filter((p) => norm(p.nombre).includes(nq) || norm(p.marca).includes(nq)) : base;
  }, [catalogo, q]);

  const pag = usePaginado(items, 'webProductos', q);

  const mutar = async (id, fn, okMsg) => {
    setOcupado(id);
    try { await fn(); avisar('ok', okMsg); await Promise.all([recargar(), cargarAdmin()]); }
    catch (e) { avisar('err', e?.data?.message || 'No se pudo guardar.'); }
    finally { setOcupado(0); }
  };

  const guardarMinimo = (p, n) => mutar(
    p.id,
    () => httpClient.patch(`/web/productos/${p.id}`, { webStockMin: n }),
    n > 0
      ? `${p.nombre}: el sitio venderá hasta que queden ${n} en depósito.`
      : `${p.nombre}: sin piso — se vende online hasta la última unidad.`,
  );

  const toggleDestacado = (p) => mutar(
    p.id,
    () => httpClient.patch(`/web/productos/${p.id}`, { destacado: !p.destacado }),
    p.destacado ? `${p.nombre} ya no está destacado.` : `${p.nombre} destacado en la portada.`,
  );

  const subirImagen = (p, data) => mutar(
    p.id,
    () => httpClient.post(`/web/imagenes/producto/${p.id}`, { data }),
    `Imagen de ${p.nombre} actualizada.`,
  );

  const quitarImagen = (p) => mutar(
    p.id,
    () => httpClient.delete(`/web/imagenes/producto/${p.id}`),
    `Imagen de ${p.nombre} quitada.`,
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Productos del sitio"
        desc={`Lo que ve el cliente en la tienda online: ${catalogo?.items?.length ?? 0} productos con precio en la lista ${catalogo?.listaNombre || 'Mayorista'}. Publicar o despublicar = cargar o quitar ese precio (Ventas › Formato de venta); acá se manejan el destacado y la foto.`}
      />

      <div className={s.toolbar}>
        <input
          className={s['select-inline']}
          style={{ minWidth: 260 }}
          placeholder="Buscar por nombre o marca…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <Table
        cols={[
          { h: 'Foto' }, { h: 'Producto' }, { h: 'Marca' },
          { h: 'Precio web', num: true }, { h: 'Oferta' }, { h: 'Stock' }, { h: 'Mínimo web', num: true },
          { h: 'Destacado' }, { h: 'Imagen', cls: 'actions-col' },
        ]}
        empty="Ningún producto tiene precio en la lista Mayorista todavía."
        pag={pag}
      >
        {pag.visibles.map((p) => (
          <tr key={p.id} style={ocupado === p.id ? { opacity: 0.5 } : undefined}>
            <td><Thumb url={p.imagenUrl} alt={p.nombre} /></td>
            <td><strong>{p.nombre}</strong></td>
            <td>{p.marca || '—'}</td>
            <td className={s.num}>
              {money(p.precio)}{p.unidad === 'kg' ? ' /kg' : ''}
              {p.oferta?.precioOferta != null && (
                <div style={{ fontSize: 12, color: 'var(--crm-color-accent-2)', fontWeight: 700 }}>
                  {money(p.oferta.precioOferta)} en oferta
                </div>
              )}
            </td>
            <td>
              {p.oferta
                ? <span className={cx(s.pill, s['est-pendiente'])}>{p.oferta.badge}</span>
                : <span className={s.muted}>—</span>}
            </td>
            <td>
              <span className={cx(s.pill, p.enStock ? s['st-disponible'] : s['est-cancelada'])}>
                {p.enStock ? 'En stock' : 'Sin stock'}
              </span>
              {admin.get(p.id) && (
                <div className={s.muted} style={{ fontSize: 11.5, marginTop: 2 }}>
                  {admin.get(p.id).stockDisp} {p.unidad === 'kg' ? 'kg' : 'u.'} en depósito
                </div>
              )}
            </td>
            <td className={s.num}>
              <MinimoWebInput producto={p} admin={admin.get(p.id)} onGuardar={guardarMinimo} />
            </td>
            <td>
              <button
                type="button"
                onClick={() => toggleDestacado(p)}
                title={p.destacado ? 'Quitar de Destacados' : 'Destacar en la portada'}
                style={{
                  border: 'none', background: 'none', cursor: 'pointer', fontSize: 22, lineHeight: 1,
                  color: p.destacado ? 'var(--crm-color-accent-2)' : 'var(--crm-color-border)',
                }}
              >
                ★
              </button>
            </td>
            <td className={s['actions-col']}>
              <div className={s['row-actions']}>
                <SubirImagenBtn preset="producto" onData={(data) => subirImagen(p, data)}>
                  {p.imagenUrl ? 'Cambiar' : 'Subir'}
                </SubirImagenBtn>
                {p.imagenUrl && !/^https?:/.test(p.imagenUrl) && (
                  <Btn variant="btn-delete" small onClick={() => quitarImagen(p)}>Quitar</Btn>
                )}
              </div>
            </td>
          </tr>
        ))}
      </Table>

      <div className={s.hint}>
        <strong>★ Destacado</strong> arma el carrusel &ldquo;Destacados&rdquo; de la portada del sitio.
        <strong> Mínimo web</strong> es el piso de stock para la venta online: al llegar a ese número
        el sitio muestra &ldquo;Sin stock&rdquo; y lo que queda se prioriza para fraccionar o para el
        mostrador (0 = se vende hasta la última unidad). <strong>Fotos:</strong> {PRESETS_IMAGEN.producto.hint}{' '}
        Al subir podés <strong>quitarle el fondo</strong> y ver cómo queda antes de confirmar.
      </div>
    </div>
  );
}

/* ==================================================================== *
 * Ofertas del sitio (solo lectura)
 * ==================================================================== */

function OfertasWebPanel({ avisar }) {
  const [ofertas, setOfertas] = useState(null);

  useEffect(() => {
    let activo = true;
    httpClient.get('/ofertas')
      .then((os) => { if (activo) setOfertas(os); })
      .catch((e) => { if (activo) { setOfertas([]); avisar('err', e?.data?.message || 'No se pudieron cargar las ofertas.'); } });
    return () => { activo = false; };
  }, [avisar]);

  /** La MISMA regla que aplica el sitio: activa, para toda lista, de un solo precio. */
  const delSitio = useMemo(
    () => (ofertas ?? []).filter((o) => o.activa && !o.soloPrecioBase && o.tipo !== 'combo' && o.tipo !== 'ticket'),
    [ofertas],
  );

  const fmtFecha = (v) => (v ? new Date(v).toLocaleDateString('es-AR') : null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Ofertas del sitio"
        desc="Las promociones que ve el cliente en la tienda online: las que valen para la lista Mayorista (no solo para el mostrador). Solo lectura."
      />

      <Table
        cols={[{ h: 'Oferta' }, { h: 'Mecánica' }, { h: 'Vigencia' }, { h: 'Estado' }]}
        empty={ofertas === null ? 'Cargando…' : 'Ninguna oferta llega al sitio: todas son solo del mostrador o están inactivas.'}
      >
        {delSitio.map((o) => {
          const est = estadoVigencia(o);
          return (
            <tr key={o.id}>
              <td><strong>{o.nombre}</strong></td>
              <td>{mecanicaOferta(o)}</td>
              <td>
                {o.desde || o.hasta
                  ? `${fmtFecha(o.desde) ?? '…'} → ${fmtFecha(o.hasta) ?? 'sin fin'}`
                  : 'Siempre'}
              </td>
              <td><span className={cx(s.pill, s[est.pill])}>{est.label}</span></td>
            </tr>
          );
        })}
      </Table>

      <div className={cx(s.callout, s.info)}>
        Las ofertas se crean y editan en <strong>Ventas › Ofertas</strong>. Para que una promo
        llegue al sitio tiene que estar <strong>activa</strong> y valer para toda lista
        (desmarcar &ldquo;solo precio de mostrador&rdquo;). Combos y descuentos de ticket no
        se muestran en la tienda online.
      </div>
    </div>
  );
}

/* ==================================================================== *
 * Contenido del sitio (hero + banner + imágenes de categorías y marcas)
 * ==================================================================== */

/** Un slide vacío para el alta. El id lo asigna `agregarSlide` (máximo + 1, sin reciclar). */
const SLIDE_NUEVO = { badge: '', titulo: '', texto: '', cta: 'Ver catálogo', ctaUrl: '/tienda', posicion: 'left' };

const POSICIONES = [['left', 'Izquierda'], ['center', 'Centro'], ['right', 'Derecha']];

function ContenidoPanel({ catalogo, recargar, avisar }) {
  const [web, setWeb] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [editando, setEditando] = useState(null); // id del slide en edición | 'nuevo'
  const [form, setForm] = useState(SLIDE_NUEVO);

  useEffect(() => {
    let activo = true;
    httpClient.get('/configuracion/web')
      .then((w) => { if (activo) setWeb(w); })
      .catch(() => { if (activo) setWeb({ slides: [] }); });
    return () => { activo = false; };
  }, []);

  const slides = web?.slides ?? [];

  /** El banner por slide vive en el catálogo (URL versionada), no en la config. */
  const bannerDe = (id) => catalogo?.sitio?.slides?.find((sl) => sl.id === id)?.bannerUrl || '';

  const guardarSlides = async (nuevos, okMsg) => {
    setGuardando(true);
    try {
      await httpClient.put('/configuracion/web', { slides: nuevos });
      setWeb((w) => ({ ...w, slides: nuevos }));
      avisar('ok', okMsg);
      await recargar();
      return true;
    } catch (e) {
      avisar('err', e?.data?.message || 'No se pudo guardar.');
      return false;
    } finally { setGuardando(false); }
  };

  const abrirAlta = () => { setForm(SLIDE_NUEVO); setEditando('nuevo'); };
  const abrirEdicion = (sl) => { setForm({ ...sl }); setEditando(sl.id); };

  const confirmarForm = async () => {
    if (!form.titulo.trim()) { avisar('err', 'El slide necesita al menos un título.'); return; }
    if (editando === 'nuevo') {
      const id = slides.reduce((m, sl) => Math.max(m, sl.id), 0) + 1;
      const ok = await guardarSlides([...slides, { ...form, id }], 'Slide agregado a la portada.');
      if (ok) setEditando(null);
    } else {
      const ok = await guardarSlides(
        slides.map((sl) => (sl.id === editando ? { ...form, id: editando } : sl)),
        'Slide actualizado.',
      );
      if (ok) setEditando(null);
    }
  };

  const borrarSlide = async (sl) => {
    const ok = await guardarSlides(slides.filter((x) => x.id !== sl.id), `Slide "${sl.titulo}" eliminado.`);
    // Su imagen ya no se muestra en ningún lado: se limpia para no dejar huérfanos.
    if (ok && bannerDe(sl.id)) {
      try { await httpClient.delete(`/web/imagenes/banner/${sl.id}`); await recargar(); } catch { /* queda huérfana, sin efecto visible */ }
    }
  };

  const mover = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= slides.length) return;
    const nuevos = [...slides];
    [nuevos[i], nuevos[j]] = [nuevos[j], nuevos[i]];
    guardarSlides(nuevos, 'Orden actualizado.');
  };

  const subir = async (tipo, refId, data, okMsg) => {
    try { await httpClient.post(`/web/imagenes/${tipo}/${refId}`, { data }); avisar('ok', okMsg); await recargar(); }
    catch (e) { avisar('err', e?.data?.message || 'No se pudo subir la imagen.'); }
  };
  const quitar = async (tipo, refId, okMsg) => {
    try { await httpClient.delete(`/web/imagenes/${tipo}/${refId}`); avisar('ok', okMsg); await recargar(); }
    catch (e) { avisar('err', e?.data?.message || 'No se pudo quitar la imagen.'); }
  };

  const grillaImagenes = (titulo, tipo, terminos, hint) => (
    <>
      <div className={s['section-title']}>{titulo}</div>
      {terminos.length === 0
        ? <div className={s.hint}>Nada para mostrar: el sitio no tiene {titulo.toLowerCase()} todavía.</div>
        : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 'var(--crm-space-3)' }}>
            {terminos.map((t) => (
              <div key={t.id} className={s.card} style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Thumb url={t.imagenUrl} alt={t.nombre} size={48} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.nombre}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    <SubirImagenBtn preset={tipo} onData={(data) => subir(tipo, t.id, data, `Imagen de ${t.nombre} actualizada.`)}>
                      {t.imagenUrl ? 'Cambiar' : 'Subir'}
                    </SubirImagenBtn>
                    {t.imagenUrl && (
                      <Btn variant="btn-delete" small onClick={() => quitar(tipo, t.id, `Imagen de ${t.nombre} quitada.`)}>Quitar</Btn>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      {hint && <div className={s.hint}>{hint}</div>}
    </>
  );

  if (web === null) return <div className={s['empty-state']}>Cargando el contenido del sitio…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Contenido del sitio"
        desc="Los textos de la portada, el banner principal y las imágenes de categorías y marcas. Los cambios se ven en el sitio al recargarlo."
      />

      <div className={s['section-title']} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ flex: 1 }}>Slides de la portada ({slides.length})</span>
        <Btn variant="btn-primary" small onClick={abrirAlta} disabled={editando !== null}>+ Agregar slide</Btn>
      </div>

      {slides.length === 0 && editando === null && (
        <div className={cx(s.callout, s.warn)}>
          La portada no tiene ningún slide: el sitio arranca directo en las secciones de productos.
          Agregá al menos uno para tener un banner de bienvenida.
        </div>
      )}

      {slides.map((sl, i) => (
        <div key={sl.id} className={s.card} style={{ padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Btn small onClick={() => mover(i, -1)} disabled={i === 0 || guardando}>↑</Btn>
            <Btn small onClick={() => mover(i, +1)} disabled={i === slides.length - 1 || guardando}>↓</Btn>
          </div>
          {bannerDe(sl.id)
            ? <img src={srcImagen(bannerDe(sl.id))} alt="" style={{ width: 120, height: 54, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--crm-color-border)' }} />
            : (
              <span style={{
                width: 120, height: 54, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--crm-color-bg)', border: '1px dashed var(--crm-color-border)',
                borderRadius: 8, fontSize: 10.5, color: 'var(--crm-color-text-muted)', textAlign: 'center',
              }}
              >
                ilustración por defecto
              </span>
            )}
          <div style={{ flex: 1, minWidth: 0 }}>
            {sl.badge && <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--crm-color-accent-2)' }}>{sl.badge}</div>}
            <div style={{ fontWeight: 700 }}>{sl.titulo || <span className={s.muted}>(sin título)</span>}</div>
            <div className={s.muted} style={{ fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {sl.texto}
            </div>
            <div className={s.muted} style={{ fontSize: 11.5 }}>
              Botón «{sl.cta || '—'}» → {sl.ctaUrl || '—'} · texto {POSICIONES.find(([v]) => v === sl.posicion)?.[1]?.toLowerCase() ?? 'izquierda'}
            </div>
          </div>
          <div className={s['row-actions']} style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <SubirImagenBtn preset="banner" onData={(data) => subir('banner', sl.id, data, `Imagen del slide "${sl.titulo}" actualizada.`)}>
              {bannerDe(sl.id) ? 'Cambiar' : 'Imagen'}
            </SubirImagenBtn>
            {bannerDe(sl.id) && (
              <Btn variant="btn-delete" small onClick={() => quitar('banner', sl.id, 'Imagen del slide quitada.')}>Sin img</Btn>
            )}
            <Btn variant="btn-edit" small onClick={() => abrirEdicion(sl)} disabled={editando !== null}>Editar</Btn>
            <Btn variant="btn-delete" small onClick={() => borrarSlide(sl)} disabled={guardando || editando !== null}>Borrar</Btn>
          </div>
        </div>
      ))}

      {editando !== null && (
        <div className={s.card} style={{ padding: '14px 16px', borderColor: 'var(--crm-color-primary)' }}>
          <div className={s['mini-label']} style={{ marginBottom: 10 }}>
            {editando === 'nuevo' ? 'Nuevo slide' : 'Editar slide'}
          </div>
          <div className={s['form-grid']}>
            <div className={s.field}>
              <label>Etiqueta chica (badge)</label>
              <input value={form.badge} placeholder="Ej: Ofertas activas" onChange={(e) => setForm((f) => ({ ...f, badge: e.target.value }))} />
            </div>
            <div className={s.field}>
              <label>Posición del texto</label>
              <select value={form.posicion} onChange={(e) => setForm((f) => ({ ...f, posicion: e.target.value }))}>
                {POSICIONES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className={s.field}>
            <label>Título <span className={s.req}>*</span></label>
            <input autoFocus value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} />
          </div>
          <div className={s.field}>
            <label>Texto</label>
            <input value={form.texto} onChange={(e) => setForm((f) => ({ ...f, texto: e.target.value }))} />
          </div>
          <div className={s['form-grid']}>
            <div className={s.field}>
              <label>Texto del botón</label>
              <input value={form.cta} onChange={(e) => setForm((f) => ({ ...f, cta: e.target.value }))} />
            </div>
            <div className={s.field}>
              <label>Adónde lleva el botón</label>
              <select value={form.ctaUrl} onChange={(e) => setForm((f) => ({ ...f, ctaUrl: e.target.value }))}>
                <option value="/tienda">La tienda</option>
                <option value="/#ofertas">Las ofertas de la portada</option>
                <option value="/#marcas">Las marcas de la portada</option>
                <option value="/carrito">El carrito</option>
                <option value="/">La portada</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="btn-primary" onClick={confirmarForm} disabled={guardando}>
              {guardando ? 'Guardando…' : (editando === 'nuevo' ? 'Agregar slide' : 'Guardar cambios')}
            </Btn>
            <Btn onClick={() => setEditando(null)} disabled={guardando}>Cancelar</Btn>
          </div>
          {editando !== 'nuevo' && (
            <div className={s.hint} style={{ marginTop: 8 }}>
              La imagen del slide se cambia desde su tarjeta en la lista (botón Imagen / Cambiar).
            </div>
          )}
        </div>
      )}

      <div className={s.hint}>
        Los slides rotan solos en la portada, en este orden (usá ↑↓ para acomodarlos). Imagen
        {PRESETS_IMAGEN.banner.hint} Sin imagen, el slide usa una ilustración por defecto del sitio.
      </div>

      {grillaImagenes(
        'Imágenes de categorías', 'categoria', catalogo?.categorias ?? [],
        `Se muestran en las tarjetas de categoría de la portada. ${PRESETS_IMAGEN.categoria.hint}`,
      )}
      {grillaImagenes(
        'Logos de marcas', 'marca', catalogo?.marcas ?? [],
        `Se muestran en la franja "Nuestras marcas" de la portada. ${PRESETS_IMAGEN.marca.hint}`,
      )}
    </div>
  );
}

/* ==================================================================== *
 * Estadísticas del sitio
 * ==================================================================== */

const RANGOS = [[7, '7 días'], [30, '30 días'], [90, '90 días']];

function EstadisticasPanel({ avisar }) {
  const [dias, setDias] = useState(30);
  const [datos, setDatos] = useState(null);

  useEffect(() => {
    let activo = true;
    setDatos(null);
    httpClient.get(`/web/estadisticas?dias=${dias}`)
      .then((d) => { if (activo) setDatos(d); })
      .catch((e) => { if (activo) { setDatos({ vistas: 0, sesiones: 0, pedidos: 0, conversion: 0, porDia: [], productos: [] }); avisar('err', e?.data?.message || 'No se pudieron cargar las estadísticas.'); } });
    return () => { activo = false; };
  }, [dias, avisar]);

  if (datos === null) return <div className={s['empty-state']}>Contando visitas…</div>;

  const maxVistas = Math.max(1, ...datos.porDia.map((d) => d.vistas));
  const fmtDia = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Estadísticas del sitio"
        desc="Medición propia y anónima: el sitio reporta a esta misma base qué se visita, cuánto tiempo se mira cada producto y qué se agrega al carrito. Sin Google Analytics ni cookies de terceros."
        actions={(
          <div style={{ display: 'flex', gap: 6 }}>
            {RANGOS.map(([n, label]) => (
              <Btn key={n} small variant={dias === n ? 'btn-primary' : 'btn-ghost'} onClick={() => setDias(n)}>
                {label}
              </Btn>
            ))}
          </div>
        )}
      />

      <div className={s.stats}>
        <Stat label="Visitas (páginas vistas)" value={datos.vistas} />
        <Stat label="Sesiones (visitantes)" value={datos.sesiones} accent="accent-green" />
        <Stat label="Pedidos web" value={datos.pedidos} accent={datos.pedidos ? 'accent-amber' : undefined} />
        <Stat label="Conversión" value={`${datos.conversion}%`} />
      </div>
      {datos.conversion > 100 && (
        <div className={s.hint} style={{ marginTop: -8 }}>
          La conversión supera el 100% porque hay pedidos anteriores al inicio de la medición:
          se acomoda sola a medida que el contador junte tráfico real.
        </div>
      )}

      <div className={s['section-title']}>Visitas por día</div>
      <div className={s.card} style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 120 }}>
          {datos.porDia.map((d) => (
            <div
              key={d.fecha}
              title={`${fmtDia(d.fecha)}: ${d.vistas} vista(s), ${d.sesiones} sesión(es)`}
              style={{
                flex: 1,
                minWidth: 3,
                height: `${Math.max(2, (d.vistas / maxVistas) * 100)}%`,
                background: d.vistas ? 'var(--crm-color-primary)' : 'var(--crm-color-border)',
                borderRadius: '3px 3px 0 0',
                opacity: d.vistas ? 0.85 : 0.5,
              }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: 'var(--crm-color-text-muted)' }}>
          <span>{datos.porDia[0] ? fmtDia(datos.porDia[0].fecha) : ''}</span>
          <span>hoy</span>
        </div>
      </div>

      <div className={s['section-title']}>Productos: interés y pedidos</div>
      <Table
        cols={[
          { h: 'Producto' }, { h: 'Vistas', num: true }, { h: 'Seg. mirando (prom.)', num: true },
          { h: 'Al carrito', num: true }, { h: 'En pedidos', num: true }, { h: 'Unidades pedidas', num: true },
        ]}
        empty="Sin datos todavía: las estadísticas se juntan a medida que la gente navega el sitio."
      >
        {datos.productos.map((p) => (
          <tr key={p.id}>
            <td><strong>{p.nombre}</strong></td>
            <td className={s.num}>{p.vistas}</td>
            <td className={s.num}>{p.segundosProm ? `${p.segundosProm}s` : '—'}</td>
            <td className={s.num}>{p.carrito || '—'}</td>
            <td className={s.num}>{p.pedidos || '—'}</td>
            <td className={s.num}><strong>{p.unidades || '—'}</strong></td>
          </tr>
        ))}
      </Table>

      <div className={s.hint}>
        <strong>Vistas</strong> = veces que la tarjeta estuvo realmente en pantalla (≥50% visible).
        <strong> Seg. mirando</strong> = tiempo promedio con la tarjeta a la vista: el interés, aunque
        no compren. <strong>Unidades pedidas</strong> sale de las órdenes web no rechazadas del período.
      </div>

      {(datos.busquedas ?? []).length > 0 && (
        <>
          <div className={s['section-title']}>Lo más buscado</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--crm-space-2)' }}>
            {datos.busquedas.map((b) => (
              <div key={b.termino} className={s.card} style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.termino}</span>
                <span className={s.muted} style={{ fontSize: 12.5, flexShrink: 0 }}>{b.veces}×</span>
              </div>
            ))}
          </div>
          <div className={s.hint}>
            Lo que la gente escribe en el buscador del sitio. Un término repetido que no matchea
            ningún producto es un faltante del catálogo — la lista de compras que arma el cliente.
          </div>
        </>
      )}
    </div>
  );
}

/* ==================================================================== *
 * Configuración del sitio (logo, favicon, contacto y redes)
 * ==================================================================== */

/**
 * La identidad y los datos de contacto que muestra el sitio: logo del
 * encabezado, favicon de la pestaña, teléfonos, correo, ubicación y redes.
 * Los textos van a `configuracion/web`; las imágenes, al estándar de
 * imágenes (presets `logo` y `favicon`).
 */
function ConfiguracionSitioPanel({ catalogo, recargar, avisar }) {
  const [web, setWeb] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let activo = true;
    httpClient.get('/configuracion/web')
      .then((w) => { if (activo) setWeb(w); })
      .catch(() => { if (activo) setWeb({}); });
    return () => { activo = false; };
  }, []);

  const set = (k) => (e) => setWeb((w) => ({ ...w, [k]: e.target.value }));

  const guardar = async () => {
    setGuardando(true);
    try {
      await httpClient.put('/configuracion/web', {
        whatsapp: web.whatsapp, contactoTelefono: web.contactoTelefono,
        contactoEmail: web.contactoEmail, contactoUbicacion: web.contactoUbicacion,
        redInstagram: web.redInstagram, redFacebook: web.redFacebook,
      });
      avisar('ok', 'Datos del sitio guardados: se ven al recargar el sitio.');
      await recargar();
    } catch (e) {
      avisar('err', e?.data?.message || 'No se pudo guardar.');
    } finally { setGuardando(false); }
  };

  const subir = async (tipo, data, okMsg) => {
    try { await httpClient.post(`/web/imagenes/${tipo}/1`, { data }); avisar('ok', okMsg); await recargar(); }
    catch (e) { avisar('err', e?.data?.message || 'No se pudo subir la imagen.'); }
  };
  const quitar = async (tipo, okMsg) => {
    try { await httpClient.delete(`/web/imagenes/${tipo}/1`); avisar('ok', okMsg); await recargar(); }
    catch (e) { avisar('err', e?.data?.message || 'No se pudo quitar la imagen.'); }
  };

  const identidad = (tipo, url, alto) => (
    <div className={s.card} style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
      {url
        ? <img src={srcImagen(url)} alt={PRESETS_IMAGEN[tipo].titulo} style={{ maxHeight: alto, maxWidth: 220, borderRadius: 6, background: 'repeating-conic-gradient(#e8ebe9 0% 25%, #fff 0% 50%) 0 / 14px 14px' }} />
        : (
          <span style={{
            height: alto, minWidth: 100, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--crm-color-bg)', border: '1px dashed var(--crm-color-border)',
            borderRadius: 6, fontSize: 11, color: 'var(--crm-color-text-muted)', padding: '0 10px',
          }}
          >
            sin {tipo === 'logo' ? 'logo (se muestra el nombre en texto)' : 'favicon'}
          </span>
        )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13.5 }}>{PRESETS_IMAGEN[tipo].titulo}</div>
        <div className={s.hint} style={{ margin: '2px 0 0' }}>{PRESETS_IMAGEN[tipo].hint}</div>
      </div>
      <div className={s['row-actions']}>
        <SubirImagenBtn preset={tipo} onData={(data) => subir(tipo, data, `${PRESETS_IMAGEN[tipo].titulo} actualizado.`)}>
          {url ? 'Cambiar' : 'Subir'}
        </SubirImagenBtn>
        {url && <Btn variant="btn-delete" small onClick={() => quitar(tipo, `${PRESETS_IMAGEN[tipo].titulo} quitado.`)}>Quitar</Btn>}
      </div>
    </div>
  );

  if (web === null) return <div className={s['empty-state']}>Cargando la configuración del sitio…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Configuración del sitio"
        desc="La identidad y los datos de contacto que ve el cliente: logo, favicon, WhatsApp, correo, ubicación y redes."
      />

      <div className={s['section-title']}>Identidad</div>
      {identidad('logo', catalogo?.sitio?.logoUrl, 54)}
      {identidad('favicon', catalogo?.sitio?.faviconUrl, 42)}

      <div className={s['section-title']}>Contacto</div>
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>WhatsApp del negocio</label>
          <input value={web.whatsapp ?? ''} placeholder="Ej: 3704621563" onChange={set('whatsapp')} />
          <div className={s.hint} style={{ margin: '6px 0 0' }}>
            Con código de área, sin 0 ni 15 (10 dígitos). Arma los botones de WhatsApp de todo el sitio.
          </div>
        </div>
        <div className={s.field}>
          <label>Teléfono de contacto (opcional)</label>
          <input value={web.contactoTelefono ?? ''} placeholder="Ej: 370 4123456" onChange={set('contactoTelefono')} />
        </div>
      </div>
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Correo</label>
          <input value={web.contactoEmail ?? ''} onChange={set('contactoEmail')} />
        </div>
        <div className={s.field}>
          <label>Ubicación</label>
          <input value={web.contactoUbicacion ?? ''} onChange={set('contactoUbicacion')} />
        </div>
      </div>

      <div className={s['section-title']}>Redes sociales</div>
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Instagram</label>
          <input value={web.redInstagram ?? ''} placeholder="usuario o link completo" onChange={set('redInstagram')} />
        </div>
        <div className={s.field}>
          <label>Facebook</label>
          <input value={web.redFacebook ?? ''} placeholder="usuario o link completo" onChange={set('redFacebook')} />
        </div>
      </div>
      <div className={s.hint}>Las redes aparecen en el pie del sitio solo si están cargadas.</div>

      <div>
        <Btn variant="btn-primary" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar datos del sitio'}
        </Btn>
      </div>
    </div>
  );
}

/* ==================================================================== *
 * Página del módulo
 * ==================================================================== */

/**
 * Página del módulo Web. Las secciones van en un SUB-SIDEBAR a la izquierda,
 * como en el resto de los módulos: el sistema tiene un solo patrón de
 * navegación interna y este no es la excepción.
 *
 * A diferencia de Ventas o Gastos no hace falta un contexto: el catálogo del
 * sitio es UNA sola llamada (`GET /tienda/catalogo` — el mismo endpoint que
 * consume la tienda, así lo que se ve acá es literalmente lo que ve el
 * cliente), y las secciones que necesitan más lo piden por su cuenta.
 */
export function WebPage() {
  const { can } = usePermissions();
  const secciones = useMemo(() => WEB_SECCIONES.filter((x) => can(x.permiso)), [can]);
  const [seccion, setSeccion] = useState(secciones[0]?.id ?? 'productos');
  const [catalogo, setCatalogo] = useState(null);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);

  const recargar = useCallback(async () => {
    try {
      setCatalogo(await httpClient.get('/tienda/catalogo'));
      setError(null);
    } catch (e) {
      setError(e?.data?.message || 'No se pudo conectar con la API.');
      setCatalogo((c) => c ?? { items: [], categorias: [], marcas: [], sitio: {} });
    }
  }, []);
  useEffect(() => { recargar(); }, [recargar]);

  const avisar = useCallback((tipo, texto) => setAviso({ tipo, texto }), []);
  useEffect(() => {
    if (!aviso) return undefined;
    const t = setTimeout(() => setAviso(null), 4000);
    return () => clearTimeout(t);
  }, [aviso]);

  // El rol puede ver el módulo pero ninguna sección: lo dice en vez de
  // mostrarse vacío. (Sin NINGUNA sección el módulo ni aparece en el sidebar,
  // así que esto cubre el caso de perder los permisos con la pantalla abierta.)
  if (!secciones.length) {
    return (
      <div>
        <PageHeader title="Web" subtitle="Administración de la tienda mayorista online" />
        <div className={cx(s.callout, s.warn)}>Tu rol no tiene ninguna sección del sitio habilitada.</div>
      </div>
    );
  }

  // Si el rol pierde la sección activa (permisos vivos al recargar), cae en la
  // primera que sí tenga en vez de quedar en una que no existe.
  const activa = secciones.some((x) => x.id === seccion) ? seccion : secciones[0].id;

  return (
    <div>
      <PageHeader
        title="Web"
        subtitle="La tienda mayorista online: qué se ve, qué se destaca, con qué imágenes y cómo viene andando"
      />

      <div className={s.shell}>
        <nav className={s.subnav} aria-label="Secciones de Web">
          {secciones.map((x) => {
            const Icon = x.icon;
            return (
              <button
                key={x.id}
                type="button"
                className={cx(s.subnavItem, activa === x.id && s.subnavItemActive)}
                onClick={() => setSeccion(x.id)}
              >
                <span className={s.subnavIcon}><Icon fontSize="small" /></span>
                <span className={s.subnavLabel}>{x.label}</span>
              </button>
            );
          })}
        </nav>

        <div className={s.content}>
          {aviso && (
            <div className={cx(s.callout, aviso.tipo === 'ok' ? s.info : s.warn)} style={{ marginTop: 0 }}>
              {aviso.texto}
            </div>
          )}
          {error && (
            <div className={cx(s.callout, s.warn)}>
              No se pudo cargar el catálogo del sitio: <strong>{error}</strong>
            </div>
          )}

          {catalogo === null && !error
            ? <div className={s['empty-state']}>Cargando el catálogo del sitio…</div>
            : (
              <>
                {activa === 'productos' && <ProductosWebPanel catalogo={catalogo} recargar={recargar} avisar={avisar} />}
                {activa === 'ofertas' && <OfertasWebPanel avisar={avisar} />}
                {activa === 'contenido' && <ContenidoPanel catalogo={catalogo} recargar={recargar} avisar={avisar} />}
                {activa === 'estadisticas' && <EstadisticasPanel avisar={avisar} />}
                {activa === 'configuracion' && <ConfiguracionSitioPanel catalogo={catalogo} recargar={recargar} avisar={avisar} />}
              </>
            )}
        </div>
      </div>
    </div>
  );
}
