/**
 * QUÉ MUESTRA CADA SLIDE (23/10/2026, pedido del dueño: «elegir marcas o
 * productos y que se arme el contenido solo, en las dos tiendas»). Un slide es
 * de imagen propia (la subida, como siempre), de marcas (hasta 5: sus logos y
 * las fotos de sus productos con stock) o de productos elegidos; y va en la tienda
 * mayorista, en la minorista o en las dos. La tienda lo arma con el catálogo
 * del momento (`bannersTienda` en la web): lo que se queda sin stock sale solo.
 * Los textos vacíos de una marca o de productos los completa la tienda.
 */
import { useMemo, useState } from 'react';
import { s } from '@modules/productos/components/ui.jsx';
import { srcImagen } from '../services/imagenes.js';

export const CONTENIDOS = [['marca', 'Marcas que elijo'], ['productos', 'Productos que elijo'], ['imagen', 'Imagen propia (la subo)']];
export const TIENDAS = [['mayorista', 'Tienda mayorista'], ['minorista', 'Tienda minorista'], ['ambas', 'Las dos tiendas']];
const POSICIONES = [['left', 'Izquierda'], ['center', 'Centro'], ['right', 'Derecha']];
/** Los topes del servidor (MAX_PRODUCTOS_SLIDE y MAX_MARCAS_SLIDE en configuracion.module.ts). */
const MAX_PRODUCTOS = 12;
const MAX_MARCAS = 5;
const MAX_RESULTADOS = 8;

/** Un slide vacío para el alta: de marca y para la mayorista. El id lo asigna quien lo guarda. */
export const SLIDE_NUEVO = {
  badge: '', titulo: '', texto: '', cta: '', ctaUrl: '', posicion: 'left',
  contenido: 'marca', marcaId: 0, marcaIds: '', productoIds: '', tiendas: 'mayorista',
};

/** Los slides de antes no tienen `contenido` ni `tiendas`: eran de imagen y de la mayorista. */
export const contenidoDe = (sl) => sl.contenido || 'imagen';
const idsDe = (sl) => String(sl.productoIds ?? '').split(',').map(Number).filter(Boolean);
/** Las marcas del slide: «3,7», o la `marcaId` de los de una sola marca (los primeros, 23/10/2026). */
const marcasDe = (sl) => (sl.marcaIds ? String(sl.marcaIds).split(',').map(Number).filter(Boolean) : sl.marcaId ? [sl.marcaId] : []);
const etiqueta = (lista, v) => lista.find(([k]) => k === v)?.[1] ?? '';

/** Por qué no se puede guardar, o null. */
export function problemaSlide(f) {
  const c = contenidoDe(f);
  if (c === 'marca' && !marcasDe(f).length) return 'Elegí al menos una marca.';
  if (c === 'productos' && !idsDe(f).length) return 'Elegí al menos un producto.';
  if (c !== 'marca' && !f.titulo.trim()) return 'El slide necesita un título.';
  return null;
}

/** La línea de abajo de la tarjeta: qué muestra, dónde va y adónde lleva. */
export function resumenSlide(sl, catalogo) {
  const c = contenidoDe(sl);
  const que = c === 'marca' ? `Marcas: ${marcasDe(sl).map((id) => catalogo?.marcas?.find((m) => m.id === id)?.nombre ?? '(ya no está)').join(', ')}`
    : c === 'productos' ? `${idsDe(sl).length} producto(s) elegido(s)`
      : `Imagen propia · texto ${etiqueta(POSICIONES, sl.posicion).toLowerCase() || 'izquierda'}`;
  return `${que} · ${etiqueta(TIENDAS, sl.tiendas || 'mayorista')} · botón «${sl.cta || 'automático'}» → ${sl.ctaUrl || 'automático'}`;
}

const MINI = { width: 120, height: 54, borderRadius: 8, border: '1px solid var(--crm-color-border)', background: '#fff', flexShrink: 0 };

/** La miniatura de la tarjeta: la imagen subida, el logo de la marca o las fotos de los productos. */
export function SlideMiniatura({ sl, bannerUrl, catalogo }) {
  const c = contenidoDe(sl);
  const marca = c === 'marca' ? catalogo?.marcas?.find((m) => m.id === marcasDe(sl)[0]) : null;
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
  const elegidas = marcasDe(form).map((id) => marcas.find((m) => m.id === id)).filter(Boolean);
  const marca = elegidas.length === 1 ? elegidas[0] : null;
  /* Se guarda siempre en `marcaIds`; `marcaId` queda en 0 (era el de una sola). */
  const guardarMarcas = (ids) => setForm((f) => ({ ...f, marcaIds: ids.join(','), marcaId: 0 }));
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
          <label htmlFor="slide-marca">Marcas <span className={s.req}>*</span> <span className={s.hint} style={{ margin: 0 }}>({elegidas.length} de {MAX_MARCAS})</span></label>
          {elegidas.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {elegidas.map((m) => (
                <span key={m.id} className={s.badge} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px' }}>
                  {m.imagenUrl && <img src={srcImagen(m.imagenUrl)} alt="" style={{ width: 34, height: 17, objectFit: 'contain' }} />}
                  {m.nombre}
                  <button type="button" aria-label={`Sacar ${m.nombre}`} onClick={() => guardarMarcas(marcasDe(form).filter((x) => x !== m.id))} style={{ border: 0, background: 'none', cursor: 'pointer', fontWeight: 700 }}>×</button>
                </span>
              ))}
            </div>
          )}
          {elegidas.length < MAX_MARCAS && (
            <select id="slide-marca" value="" onChange={(e) => e.target.value && guardarMarcas([...marcasDe(form), Number(e.target.value)])}>
              <option value="">{elegidas.length ? 'Agregar otra marca…' : 'Elegí la marca…'}</option>
              {marcas.filter((m) => !marcasDe(form).includes(m.id)).map((m) => <option key={m.id} value={m.id}>{m.nombre} ({m.count}){m.imagenUrl ? '' : ' · sin logo'}</option>)}
            </select>
          )}
          <div className={s.hint} style={{ margin: '4px 0 0' }}>
            Se arma con sus logos y las fotos de sus productos con stock, mezcladas. Una marca sin nada con foto y stock no aparece hasta que vuelva.
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
        <input id="slide-titulo" value={form.titulo} placeholder={c === 'marca' ? `Vacío: «${elegidas.map((m) => m.nombre).join(', ') || 'los nombres de las marcas'}»` : 'Ej: Lo nuevo de la semana'} onChange={set('titulo')} />
      </div>
      <div className={s.field}>
        <label htmlFor="slide-texto">Texto</label>
        <input id="slide-texto" value={form.texto} placeholder={c === 'marca' ? 'Vacío: cuántos productos tienen, según la tienda' : ''} onChange={set('texto')} />
      </div>
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label htmlFor="slide-cta">Texto del botón</label>
          <input id="slide-cta" value={form.cta} placeholder={c === 'marca' ? `Vacío: «${marca ? `Ver ${marca.nombre}` : 'Ver la tienda'}»` : c === 'productos' ? 'Vacío: «Ver en la tienda»' : 'Vacío: «Ver catálogo»'} onChange={set('cta')} />
        </div>
        <div className={s.field}>
          <label htmlFor="slide-url">Adónde lleva el botón</label>
          <select id="slide-url" value={form.ctaUrl} onChange={set('ctaUrl')}>
            {auto && <option value="">{c === 'marca' ? 'A la marca, o a la tienda si son varias (automático)' : 'A su marca o a la tienda (automático)'}</option>}
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
