/**
 * QUÉ MUESTRA CADA SLIDE (23/10/2026, pedido del dueño: «elegir marcas o
 * productos y que se arme el contenido solo, en las dos tiendas»). Un slide es
 * de imagen propia (la subida, como siempre), de una marca (su logo y las
 * fotos de sus productos con stock) o de productos elegidos; y va en la tienda
 * mayorista, en la minorista o en las dos. La tienda lo arma con el catálogo
 * del momento (`bannersTienda` en la web): lo que se queda sin stock sale solo.
 * Los textos vacíos de una marca o de productos los completa la tienda.
 */
import { useMemo, useState } from 'react';
import { s } from '@modules/productos/components/ui.jsx';
import { srcImagen } from '../services/imagenes.js';

export const CONTENIDOS = [['marca', 'Una marca'], ['productos', 'Productos que elijo'], ['imagen', 'Imagen propia (la subo)']];
export const TIENDAS = [['mayorista', 'Tienda mayorista'], ['minorista', 'Tienda minorista'], ['ambas', 'Las dos tiendas']];
const POSICIONES = [['left', 'Izquierda'], ['center', 'Centro'], ['right', 'Derecha']];
/** El tope del servidor (MAX_PRODUCTOS_SLIDE en configuracion.module.ts). */
const MAX_PRODUCTOS = 12;
const MAX_RESULTADOS = 8;

/** Un slide vacío para el alta: de marca y para la mayorista. El id lo asigna quien lo guarda. */
export const SLIDE_NUEVO = {
  badge: '', titulo: '', texto: '', cta: '', ctaUrl: '', posicion: 'left',
  contenido: 'marca', marcaId: 0, productoIds: '', tiendas: 'mayorista',
};

/** Los slides de antes no tienen `contenido` ni `tiendas`: eran de imagen y de la mayorista. */
export const contenidoDe = (sl) => sl.contenido || 'imagen';
const idsDe = (sl) => String(sl.productoIds ?? '').split(',').map(Number).filter(Boolean);
const etiqueta = (lista, v) => lista.find(([k]) => k === v)?.[1] ?? '';

/** Por qué no se puede guardar, o null. */
export function problemaSlide(f) {
  const c = contenidoDe(f);
  if (c === 'marca' && !f.marcaId) return 'Elegí la marca del slide.';
  if (c === 'productos' && !idsDe(f).length) return 'Elegí al menos un producto.';
  if (c !== 'marca' && !f.titulo.trim()) return 'El slide necesita un título.';
  return null;
}

/** La línea de abajo de la tarjeta: qué muestra, dónde va y adónde lleva. */
export function resumenSlide(sl, catalogo) {
  const c = contenidoDe(sl);
  const que = c === 'marca' ? `Marca ${catalogo?.marcas?.find((m) => m.id === sl.marcaId)?.nombre ?? '(ya no está en la tienda)'}`
    : c === 'productos' ? `${idsDe(sl).length} producto(s) elegido(s)`
      : `Imagen propia · texto ${etiqueta(POSICIONES, sl.posicion).toLowerCase() || 'izquierda'}`;
  return `${que} · ${etiqueta(TIENDAS, sl.tiendas || 'mayorista')} · botón «${sl.cta || 'automático'}» → ${sl.ctaUrl || 'automático'}`;
}

const MINI = { width: 120, height: 54, borderRadius: 8, border: '1px solid var(--crm-color-border)', background: '#fff', flexShrink: 0 };

/** La miniatura de la tarjeta: la imagen subida, el logo de la marca o las fotos de los productos. */
export function SlideMiniatura({ sl, bannerUrl, catalogo }) {
  const c = contenidoDe(sl);
  const marca = c === 'marca' ? catalogo?.marcas?.find((m) => m.id === sl.marcaId) : null;
  const fotos = c === 'productos' ? idsDe(sl).map((id) => catalogo?.items?.find((p) => p.id === id)?.imagenUrl).filter(Boolean).slice(0, 3) : [];
  const url = c === 'imagen' ? bannerUrl : marca?.imagenUrl;
  if (url) return <img src={srcImagen(url)} alt="" style={{ ...MINI, objectFit: c === 'imagen' ? 'cover' : 'contain' }} />;
  if (fotos.length) {
    return (
      <span style={{ ...MINI, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 2, padding: 2 }}>
        {fotos.map((f) => <img key={f} src={srcImagen(f)} alt="" style={{ width: 36, height: 48, objectFit: 'contain' }} />)}
      </span>
    );
  }
  return (
    <span style={{ ...MINI, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', background: 'var(--crm-color-bg)', fontSize: 10.5, color: 'var(--crm-color-text-muted)', textAlign: 'center' }}>
      {c === 'imagen' ? 'sin imagen: no se muestra' : marca ? marca.nombre : 'sin fotos'}
    </span>
  );
}

/** Los campos del slide según lo que muestra. */
export function SlideForm({ form, setForm, catalogo }) {
  const c = contenidoDe(form);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const marcas = useMemo(() => [...(catalogo?.marcas ?? [])].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')), [catalogo]);
  const marca = marcas.find((m) => m.id === form.marcaId);
  const auto = c !== 'imagen';

  return (
    <>
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label htmlFor="slide-contenido">¿Qué muestra?</label>
          <select id="slide-contenido" value={c} onChange={set('contenido')}>
            {CONTENIDOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className={s.field}>
          <label htmlFor="slide-tiendas">¿En qué tienda?</label>
          <select id="slide-tiendas" value={form.tiendas || 'mayorista'} onChange={set('tiendas')}>
            {TIENDAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>

      {c === 'marca' && (
        <div className={s.field}>
          <label htmlFor="slide-marca">Marca <span className={s.req}>*</span></label>
          <select id="slide-marca" value={form.marcaId || ''} onChange={(e) => setForm((f) => ({ ...f, marcaId: Number(e.target.value) || 0 }))}>
            <option value="">Elegí la marca…</option>
            {marcas.map((m) => <option key={m.id} value={m.id}>{m.nombre} ({m.count}){m.imagenUrl ? '' : ' · sin logo'}</option>)}
          </select>
          <div className={s.hint} style={{ margin: '4px 0 0' }}>
            Se arma con su logo y las fotos de sus productos con stock. Sin ninguno con foto y stock, el slide no se muestra hasta que vuelva.
          </div>
        </div>
      )}
      {c === 'productos' && <ElegirProductos form={form} setForm={setForm} catalogo={catalogo} />}

      <div className={s['form-grid']}>
        <div className={s.field}>
          <label htmlFor="slide-badge">Etiqueta chica (badge)</label>
          <input id="slide-badge" value={form.badge} placeholder={c === 'marca' ? 'Vacío: «Marca destacada»' : 'Ej: Ofertas activas'} onChange={set('badge')} />
        </div>
        {c === 'imagen' && (
          <div className={s.field}>
            <label htmlFor="slide-posicion">Posición del texto</label>
            <select id="slide-posicion" value={form.posicion} onChange={set('posicion')}>
              {POSICIONES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        )}
      </div>
      <div className={s.field}>
        <label htmlFor="slide-titulo">Título {c !== 'marca' && <span className={s.req}>*</span>}</label>
        <input id="slide-titulo" value={form.titulo} placeholder={c === 'marca' ? `Vacío: «${marca?.nombre ?? 'el nombre de la marca'}»` : 'Ej: Lo nuevo de la semana'} onChange={set('titulo')} />
      </div>
      <div className={s.field}>
        <label htmlFor="slide-texto">Texto</label>
        <input id="slide-texto" value={form.texto} placeholder={c === 'marca' ? 'Vacío: cuántos productos tiene, según la tienda' : ''} onChange={set('texto')} />
      </div>
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label htmlFor="slide-cta">Texto del botón</label>
          <input id="slide-cta" value={form.cta} placeholder={c === 'marca' ? `Vacío: «Ver ${marca?.nombre ?? 'la marca'}»` : c === 'productos' ? 'Vacío: «Ver en la tienda»' : 'Vacío: «Ver catálogo»'} onChange={set('cta')} />
        </div>
        <div className={s.field}>
          <label htmlFor="slide-url">Adónde lleva el botón</label>
          <select id="slide-url" value={form.ctaUrl} onChange={set('ctaUrl')}>
            {auto && <option value="">{c === 'marca' ? 'A la marca (automático)' : 'A su marca o a la tienda (automático)'}</option>}
            <option value="/tienda">La tienda</option>
            <option value="/tienda?oferta=1">Las ofertas</option>
            <option value="/#marcas">Las marcas de la portada</option>
            <option value="/carrito">El carrito</option>
            <option value="/">La portada</option>
          </select>
        </div>
      </div>
    </>
  );
}

/** El buscador de productos (de la tienda, con foto primero) y los elegidos, en orden. */
function ElegirProductos({ form, setForm, catalogo }) {
  const [buscar, setBuscar] = useState('');
  const items = catalogo?.items ?? [];
  const ids = idsDe(form);
  const elegidos = ids.map((id) => items.find((p) => p.id === id)).filter(Boolean);
  const guardar = (nuevos) => setForm((f) => ({ ...f, productoIds: nuevos.join(',') }));
  const resultados = useMemo(() => {
    const t = buscar.trim().toLowerCase();
    if (t.length < 2) return [];
    const ya = new Set(String(form.productoIds ?? '').split(',').map(Number));
    return items
      .filter((p) => !ya.has(p.id) && `${p.nombre} ${p.marca}`.toLowerCase().includes(t))
      .sort((a, b) => Number(!!b.imagenUrl && b.enStock) - Number(!!a.imagenUrl && a.enStock))
      .slice(0, MAX_RESULTADOS);
  }, [buscar, items, form.productoIds]);

  return (
    <div className={s.field}>
      <label htmlFor="slide-buscar">Productos <span className={s.req}>*</span> <span className={s.hint} style={{ margin: 0 }}>({ids.length} de {MAX_PRODUCTOS})</span></label>
      {elegidos.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {elegidos.map((p) => (
            <span key={p.id} className={s.badge} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px' }}>
              {p.imagenUrl && <img src={srcImagen(p.imagenUrl)} alt="" style={{ width: 22, height: 22, objectFit: 'contain' }} />}
              {p.nombre}{!(p.imagenUrl && p.enStock) && <span className={s.muted}> · {p.imagenUrl ? 'sin stock' : 'sin foto'}</span>}
              <button type="button" aria-label={`Sacar ${p.nombre}`} onClick={() => guardar(ids.filter((x) => x !== p.id))} style={{ border: 0, background: 'none', cursor: 'pointer', fontWeight: 700 }}>×</button>
            </span>
          ))}
        </div>
      )}
      {ids.length < MAX_PRODUCTOS && (
        <input id="slide-buscar" value={buscar} placeholder="Buscá por nombre o marca…" autoComplete="off" onChange={(e) => setBuscar(e.target.value)} />
      )}
      {resultados.length > 0 && (
        <div className={s.card} style={{ padding: 4, display: 'grid', gap: 2 }}>
          {resultados.map((p) => (
            <button
              key={p.id} type="button" onClick={() => { guardar([...ids, p.id]); setBuscar(''); }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', border: 0, background: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: 6 }}
            >
              {p.imagenUrl ? <img src={srcImagen(p.imagenUrl)} alt="" style={{ width: 32, height: 32, objectFit: 'contain' }} /> : <span style={{ width: 32 }} />}
              <span style={{ flex: 1 }}>{p.nombre}<span className={s.muted}> · {p.marca || 'sin marca'}</span></span>
              {!(p.imagenUrl && p.enStock) && <span className={s.muted} style={{ fontSize: 11.5 }}>{p.imagenUrl ? 'sin stock' : 'sin foto: no se ve'}</span>}
            </button>
          ))}
        </div>
      )}
      <div className={s.hint} style={{ margin: '4px 0 0' }}>
        En el banner se ven los que tienen foto y stock, en este orden; los demás aparecen solos cuando vuelvan.
      </div>
    </div>
  );
}
