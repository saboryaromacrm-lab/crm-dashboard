/**
 * WEB — la administración de la tienda online (mayorista y minorista)
 * ============================================================================
 * Módulo propio del sidebar (grupo Catálogo), con su sub-menú de secciones a la
 * izquierda igual que Compras, Ventas, Almacén y Gastos: moverse entre módulos
 * no cambia de idioma visual.
 *
 * Las secciones y sus responsabilidades:
 *
 *   - OFERTAS: las promos que llegan al sitio (solo las que valen para la
 *     lista Mayorista). Solo lectura: se editan en Ventas › Ofertas.
 *   - CONTENIDO: los slides de la portada, el banner y las imágenes de
 *     categorías y marcas.
 *   - ESTADÍSTICAS: visitas, qué se mira y qué se busca.
 *   - CONFIGURACIÓN (16/10/2026): todo lo de la tienda en un lugar —general
 *     (vista del catálogo y datos del sitio: logo, favicon, contacto, redes y
 *     cartel), mayorista y minorista—. Ver `ConfiguracionTiendaPanel`.
 *
 * TODO lo del producto se maneja en Compras › Productos —nombre, precio,
 * stock, etiquetas y, desde el 19/10/2026, la foto, el destacado y el mínimo
 * web (pestaña «Tienda online» del detalle)—: una sola fuente de verdad por
 * dato. Acá ya no hay «Productos del sitio».
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'react-router-dom';
import { httpClient } from '@core/services/httpClient.js';
import { usePermissions } from '@core/permissions/PermissionContext.jsx';
import { PageHeader } from '@shared/components/PageHeader/PageHeader.jsx';
import { cx } from '@shared/utils/classNames.js';
import { Table, PanelHead, Btn, s } from '@modules/productos/components/ui.jsx';
import { WEB_SECCIONES } from '../config/web.config.js';
import { SubirImagenBtn } from '../components/SubirImagenBtn.jsx';
import { AccesosTiendaPanel } from '../components/AccesosTiendaPanel.jsx';
import { ConfiguracionTiendaPanel } from '../components/ConfiguracionTiendaPanel.jsx';
import { BuscadoresEditor } from '../components/BuscadoresEditor.jsx';
import { LocalesEditor } from '../components/LocalesEditor.jsx';
import { MetricasTiendaPanel } from '../panels/MetricasTiendaPanel.jsx';
import { accesosTienda, sinSuscripcion } from '@core/services/accesosTienda.js';
import { PRESETS_IMAGEN, srcImagen } from '../services/imagenes.js';
import { Miniatura } from '../components/Miniatura.jsx';

const money = (n) => new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(Number(n) || 0);


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

  /**
   * La MISMA regla que aplica el sitio: activa, para TODA lista, de un solo
   * precio. `listas` vacío = corre en todas — es el reemplazo exacto del viejo
   * `!soloPrecioBase` (0065), y tiene que seguir espejando a `tienda.module`:
   * si las dos se separan, esta tabla promete lo que el sitio no muestra.
   */
  const delSitio = useMemo(
    () => (ofertas ?? []).filter((o) => o.activa && !String(o.listas ?? '').trim()
      && o.tipo !== 'combo' && o.tipo !== 'ticket'),
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
                <Miniatura url={t.imagenUrl} alt={t.nombre} size={48} />
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
            {PRESETS_IMAGEN[tipo].vacio}
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
        title="Datos del sitio"
        desc="La identidad y los datos que ve el cliente: logo, favicon, imagen para compartir, contacto, redes, cartel, lo que muestra Google y los locales con sus horarios. Cada bloque se guarda con su propio botón."
      />

      <div className={s['section-title']}>Identidad</div>
      {identidad('logo', catalogo?.sitio?.logoUrl, 54)}
      {identidad('favicon', catalogo?.sitio?.faviconUrl, 42)}
      {identidad('compartir', catalogo?.sitio?.seo?.imagenUrl, 63)}

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

      <CartelBienvenida web={web} setWeb={setWeb} recargar={recargar} avisar={avisar} />
      <BuscadoresEditor web={web} setWeb={setWeb} imagenUrl={catalogo?.sitio?.seo?.imagenUrl} avisar={avisar} />
      <LocalesEditor web={web} setWeb={setWeb} avisar={avisar} />
    </div>
  );
}

/** Los topes del cartel: los mismos que aplica el servidor (configuracion.module, `web.popup*`). */
const TOPE_POPUP = { popupEtiqueta: 40, popupTitulo: 90, popupTexto: 400 };

/**
 * EL CARTEL DE BIENVENIDA DE LA TIENDA (3/10/2026, pedido del dueño: «hacelo
 * editable desde el ERP»). Es el que aparece al entrar al sitio y el que abre
 * el botón «Info de compra». Se guarda aparte de los datos de contacto: cada
 * botón guarda SOLO lo suyo, así un cambio a medio hacer en uno no viaja con
 * el otro. La vista previa usa los mismos textos que se van a guardar.
 */
function CartelBienvenida({ web, setWeb, recargar, avisar }) {
  const [guardando, setGuardando] = useState(false);
  const enVuelo = useRef(false);
  const activo = web.popupActivo !== false;
  const etiqueta = web.popupEtiqueta ?? '';
  const titulo = web.popupTitulo ?? '';
  const texto = web.popupTexto ?? '';
  const set = (k) => (e) => setWeb((w) => ({ ...w, [k]: e.target.value.slice(0, TOPE_POPUP[k]) }));

  const guardar = async () => {
    if (enVuelo.current) return;
    if (!titulo.trim()) { avisar('err', 'El cartel necesita un título.'); return; }
    enVuelo.current = true; setGuardando(true);
    try {
      const r = await httpClient.put('/configuracion/web', {
        popupActivo: activo, popupEtiqueta: etiqueta, popupTitulo: titulo, popupTexto: texto,
      });
      // Lo que quedó guardado de verdad (el servidor recorta y limpia espacios).
      if (r && typeof r === 'object') {
        setWeb((w) => ({ ...w, popupActivo: r.popupActivo, popupEtiqueta: r.popupEtiqueta, popupTitulo: r.popupTitulo, popupTexto: r.popupTexto }));
      }
      avisar('ok', `Cartel de bienvenida guardado${activo ? '' : ' (apagado: solo se ve con «Info de compra»)'}: se ve al recargar el sitio.`);
      await recargar();
    } catch (e) {
      avisar('err', e?.data?.message || 'No se pudo guardar el cartel.');
    } finally {
      enVuelo.current = false; setGuardando(false);
    }
  };

  const contador = (k, v) => <span className={s.hint} style={{ margin: 0, float: 'right' }}>{v.length}/{TOPE_POPUP[k]}</span>;

  return (
    <>
      <div className={s['section-title']}>Cartel de bienvenida</div>
      <div className={s.hint} style={{ margin: 0 }}>
        El cartel que aparece al entrar a la tienda (una vez por visita) y el que abre el botón «Info de compra».
        Los botones «Ver catálogo» y «Consultar por WhatsApp» quedan siempre.
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, cursor: 'pointer' }}>
        <input type="checkbox" checked={activo} onChange={(e) => setWeb((w) => ({ ...w, popupActivo: e.target.checked }))} />
        Mostrarlo al entrar a la tienda
      </label>
      {!activo && <div className={s.hint} style={{ margin: 0 }}>Apagado no aparece solo, pero el botón «Info de compra» lo sigue abriendo.</div>}
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label htmlFor="popup-etiqueta">Etiqueta (opcional) {contador('popupEtiqueta', etiqueta)}</label>
          <input id="popup-etiqueta" value={etiqueta} placeholder="Ej: 🍃 Bienvenido" onChange={set('popupEtiqueta')} />
        </div>
        <div className={s.field}>
          <label htmlFor="popup-titulo">Título {contador('popupTitulo', titulo)}</label>
          <input id="popup-titulo" value={titulo} onChange={set('popupTitulo')} />
        </div>
      </div>
      <div className={s.field}>
        <label htmlFor="popup-texto">Texto (opcional) {contador('popupTexto', texto)}</label>
        <textarea id="popup-texto" rows={3} value={texto} onChange={set('popupTexto')} style={{ resize: 'vertical' }} />
        <div className={s.hint} style={{ margin: '6px 0 0' }}>Con Enter se hace un salto de línea. Vacío, el cartel queda solo con el título y los botones.</div>
      </div>

      {/* Vista previa: los mismos colores y el mismo orden que el cartel del sitio. */}
      <div className={s.hint} style={{ margin: 0 }}>Así se va a ver:</div>
      <div style={{ display: 'flex', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,.45)', borderRadius: 10 }}>
        <div style={{ background: '#fff', borderRadius: 14, padding: '24px 22px', width: 'min(420px, 100%)', textAlign: 'center', boxSizing: 'border-box' }}>
          {etiqueta.trim() && (
            <span style={{ display: 'inline-block', background: '#e8f7ee', color: '#086633', fontWeight: 700, fontSize: 12, borderRadius: 999, padding: '4px 12px', marginBottom: 10 }}>{etiqueta}</span>
          )}
          <div style={{ fontSize: 19, fontWeight: 800, color: '#1a1a1a', margin: '0 0 8px', overflowWrap: 'anywhere' }}>{titulo.trim() || <span style={{ color: 'var(--crm-color-danger)' }}>Falta el título</span>}</div>
          {texto.trim() && <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6, whiteSpace: 'pre-line', overflowWrap: 'anywhere', marginBottom: 14 }}>{texto}</div>}
          <div style={{ background: '#086633', color: '#fff', fontWeight: 700, borderRadius: 8, padding: '9px 0', fontSize: 13, marginBottom: 6 }}>Ver catálogo</div>
          <div style={{ border: '1px solid #ddd', color: '#333', fontWeight: 600, borderRadius: 8, padding: '8px 0', fontSize: 13 }}>Consultar por WhatsApp</div>
        </div>
      </div>

      <div>
        <Btn variant="btn-primary" onClick={guardar} disabled={guardando || !titulo.trim()}>
          {guardando ? 'Guardando…' : 'Guardar cartel de bienvenida'}
        </Btn>
      </div>
    </>
  );
}

/* ==================================================================== *
 * Página del módulo
 * ==================================================================== */

/**
 * Página del módulo Tienda online (ex «Web»). Las secciones van en un SUB-SIDEBAR a la izquierda,
 * como en el resto de los módulos: el sistema tiene un solo patrón de
 * navegación interna y este no es la excepción.
 *
 * A diferencia de Ventas o Gastos no hace falta un contexto: el catálogo del
 * sitio es UNA sola llamada (`GET /web/catalogo`: el mismo catálogo que ve un
 * cliente habilitado, con precios), y las secciones que necesitan más lo piden
 * por su cuenta.
 */
export function WebPage() {
  const { can } = usePermissions();
  const secciones = useMemo(() => WEB_SECCIONES.filter((x) => can(x.permiso)), [can]);
  /* `?seccion=accesos` abre esa sección (el cartel de pedidos de ingreso), también con la página ya abierta. */
  const pedida = useSearchParams()[0].get('seccion');
  const [seccion, setSeccion] = useState(secciones[0]?.id);
  useEffect(() => { if (pedida) setSeccion(pedida); }, [pedida]);
  const [catalogo, setCatalogo] = useState(null);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  /* El globito de «Accesos a la tienda online»: solo si el rol ve la sección (si no, un 403 por minuto). */
  const veAccesos = secciones.some((x) => x.id === 'accesos');
  const pedidosIngreso = useSyncExternalStore(veAccesos ? accesosTienda.subscribe : sinSuscripcion, accesosTienda.count, accesosTienda.count);

  const recargar = useCallback(async () => {
    try {
      setCatalogo(await httpClient.get('/web/catalogo'));
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
        <PageHeader title="Tienda online" subtitle="Administración de la tienda online" />
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
        title="Tienda online"
        subtitle="La tienda online, mayorista y minorista: ofertas, contenido, quién puede comprar, cómo viene andando y su configuración. Lo de cada producto (foto, destacado) está en Compras › Productos."
      />

      <div className={s.shell}>
        <nav className={s.subnav} aria-label="Secciones de Tienda online">
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
                {x.badge === 'accesos' && pedidosIngreso > 0 && <span className={s.subnavBadge}>{pedidosIngreso}</span>}
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
                {activa === 'ofertas' && <OfertasWebPanel avisar={avisar} />}
                {activa === 'contenido' && <ContenidoPanel catalogo={catalogo} recargar={recargar} avisar={avisar} />}
                {activa === 'estadisticas' && <MetricasTiendaPanel />}
                {activa === 'accesos' && <AccesosTiendaPanel avisar={avisar} />}
                {activa === 'configuracion' && (
                  <ConfiguracionTiendaPanel avisar={avisar} sitio={<ConfiguracionSitioPanel catalogo={catalogo} recargar={recargar} avisar={avisar} />} />
                )}
              </>
            )}
        </div>
      </div>
    </div>
  );
}
