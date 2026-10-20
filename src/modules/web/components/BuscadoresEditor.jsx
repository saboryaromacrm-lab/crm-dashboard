/**
 * GOOGLE Y EL LINK COMPARTIDO (20/10/2026, pedido del dueño): el título y la
 * descripción con que aparece la tienda en Google y en la vista previa de
 * WhatsApp o Facebook. Se guarda con su propio botón, como el cartel de
 * bienvenida. La imagen para compartir se sube arriba, en Identidad; acá se
 * ve cómo queda todo junto.
 */
import { useRef, useState } from 'react';
import { httpClient } from '@core/services/httpClient.js';
import { env } from '@core/config/env.js';
import { Btn, s } from '@modules/productos/components/ui.jsx';
import { srcImagen } from '../services/imagenes.js';

/* Los topes son los del servidor (configuracion.module.ts, `web.seo*`). Google muestra ~60 y ~160. */
const TOPE = { seoTitulo: 70, seoDescripcion: 170 };
const VISIBLE = { seoTitulo: 60, seoDescripcion: 160 };
const dominio = env.tiendaUrl.replace(/^https?:\/\//, '');

function Contador({ k, v }) {
  const pasado = v.length > VISIBLE[k];
  return (
    <span className={s.hint} style={{ margin: 0, float: 'right', color: pasado ? 'var(--crm-color-warning)' : undefined }}>
      {v.length}/{VISIBLE[k]}{pasado ? ' · Google lo corta' : ''}
    </span>
  );
}

export function BuscadoresEditor({ web, setWeb, imagenUrl, avisar }) {
  const [guardando, setGuardando] = useState(false);
  const enVuelo = useRef(false);
  const titulo = web.seoTitulo ?? '';
  const descripcion = web.seoDescripcion ?? '';
  const set = (k) => (e) => setWeb((w) => ({ ...w, [k]: e.target.value.slice(0, TOPE[k]) }));
  const corte = (v, n) => (v.length > n ? `${v.slice(0, n - 1).trimEnd()}…` : v);

  const guardar = async () => {
    if (enVuelo.current) return;
    if (!titulo.trim() || !descripcion.trim()) { avisar('err', 'Completá el título y la descripción.'); return; }
    enVuelo.current = true; setGuardando(true);
    try {
      const r = await httpClient.put('/configuracion/web', { seoTitulo: titulo, seoDescripcion: descripcion });
      if (r && typeof r === 'object') setWeb((w) => ({ ...w, seoTitulo: r.seoTitulo, seoDescripcion: r.seoDescripcion }));
      avisar('ok', 'Guardado. Google lo toma la próxima vez que pase por la tienda (puede tardar unos días); WhatsApp, en los links nuevos.');
    } catch (e) {
      avisar('err', e?.data?.message || 'No se pudo guardar.');
    } finally {
      enVuelo.current = false; setGuardando(false);
    }
  };

  return (
    <>
      <div className={s['section-title']}>Google y el link compartido</div>
      <div className={s.hint} style={{ margin: 0 }}>
        Cómo aparece la tienda en Google y cuando alguien manda el link por WhatsApp. Conviene que el título diga qué es y dónde
        («Dietética en Formosa»); la descripción, qué se encuentra y cómo se compra. Cada producto, categoría y marca arma su propio título solo.
      </div>
      <div className={s.field}>
        <label htmlFor="seo-titulo">Título <Contador k="seoTitulo" v={titulo} /></label>
        <input id="seo-titulo" value={titulo} maxLength={TOPE.seoTitulo} onChange={set('seoTitulo')} />
      </div>
      <div className={s.field}>
        <label htmlFor="seo-desc">Descripción <Contador k="seoDescripcion" v={descripcion} /></label>
        <textarea id="seo-desc" rows={2} style={{ resize: 'vertical' }} value={descripcion} maxLength={TOPE.seoDescripcion} onChange={set('seoDescripcion')} />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <div className={s.card} style={{ flex: '1 1 300px', padding: '12px 14px', fontFamily: 'arial, sans-serif' }}>
          <div className={s.hint} style={{ margin: '0 0 6px' }}>Así en Google</div>
          <div style={{ fontSize: 12, color: '#4d5156' }}>{dominio}</div>
          <div style={{ fontSize: 18, color: '#1a0dab', lineHeight: 1.3, margin: '2px 0' }}>{corte(titulo, VISIBLE.seoTitulo) || 'Sin título'}</div>
          <div style={{ fontSize: 13, color: '#4d5156', lineHeight: 1.5 }}>{corte(descripcion, VISIBLE.seoDescripcion)}</div>
        </div>
        <div className={s.card} style={{ flex: '0 1 300px', padding: 0, overflow: 'hidden', background: '#e7f8dc' }}>
          <div className={s.hint} style={{ margin: 0, padding: '8px 12px 6px' }}>Así en WhatsApp</div>
          {imagenUrl
            ? <img src={srcImagen(imagenUrl)} alt="Imagen para compartir" style={{ display: 'block', width: '100%', aspectRatio: '1200 / 630', objectFit: 'cover' }} />
            : <div className={s.hint} style={{ margin: 0, padding: '18px 12px', textAlign: 'center', background: '#d9efcc' }}>Sin imagen para compartir: subila arriba, en Identidad.</div>}
          <div style={{ padding: '8px 12px 10px', fontSize: 13 }}>
            <div style={{ fontWeight: 700, color: '#111' }}>{titulo}</div>
            <div style={{ color: '#555', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{descripcion}</div>
            <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>{dominio}</div>
          </div>
        </div>
      </div>

      <div>
        <Btn variant="btn-primary" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar título y descripción'}</Btn>
      </div>
    </>
  );
}
