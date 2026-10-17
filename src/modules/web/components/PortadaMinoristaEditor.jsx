/**
 * LOS TEXTOS DE LA PORTADA MINORISTA (17/10/2026, pedido del dueño: «que todo
 * sea configurable»): los avisos que rotan arriba, el hero con sus dos
 * botones, los sellos, los tres beneficios y el cierre. Viven en la config
 * `web` (claves `min*`) y los guarda este bloque con su propio botón, igual que
 * los datos del sitio. Las fotos del hero y los productos salen solos del
 * catálogo; el envío gratis es un sello automático si está puesto.
 */
import { useEffect, useRef, useState } from 'react';
import { httpClient } from '@core/services/httpClient.js';
import { Btn, s } from '@modules/productos/components/ui.jsx';

/* Los topes son los del servidor (configuracion.module.ts): acá se avisa antes de guardar. */
const TOPE = { aviso: 90, eyebrow: 50, titulo: 80, texto: 220, cta: 30, sello: 24, beneficio: 120, beneficiosTitulo: 70, cierreTitulo: 70, cierreTexto: 160 };
const MAX = { avisos: 5, sellos: 4, beneficios: 3 };
/** Los botones enlazan solo dentro del sitio (el servidor lo vuelve a controlar). */
const RUTAS = [['/#ofertas', 'Las NutriOfertas de la portada'], ['/tienda', 'La tienda (todo el catálogo)'], ['/tienda?oferta=1', 'La página de NutriOfertas'], ['/', 'La portada']];
const CLAVES = ['minAvisos', 'minHeroEyebrow', 'minHeroTitulo', 'minHeroTexto', 'minHeroCta1', 'minHeroCta1Url', 'minHeroCta2', 'minHeroCta2Url', 'minSellos', 'minBeneficiosTitulo', 'minBeneficios', 'minCierreTitulo', 'minCierreTexto', 'minCierreCta'];

const soloMin = (web) => Object.fromEntries(CLAVES.map((k) => [k, web?.[k]]));

function Campo({ id, label, value, tope, onChange, rows, hint }) {
  const props = { id, value: value ?? '', maxLength: tope, onChange: (e) => onChange(e.target.value) };
  return (
    <div className={s.field}>
      <label htmlFor={id}>{label} <span className={s.hint} style={{ margin: 0, float: 'right' }}>{(value ?? '').length}/{tope}</span></label>
      {rows ? <textarea rows={rows} style={{ resize: 'vertical' }} {...props} /> : <input {...props} />}
      {hint && <div className={s.hint} style={{ margin: '6px 0 0' }}>{hint}</div>}
    </div>
  );
}

/** Una lista de textos cortos con agregar y quitar (avisos, sellos). */
function Lista({ titulo, hint, items, max, tope, placeholder, onChange }) {
  const set = (i, v) => onChange(items.map((x, j) => (j === i ? v : x)));
  return (
    <div className={s.field}>
      <label>{titulo} <span className={s.hint} style={{ margin: 0, float: 'right' }}>{items.length}/{max}</span></label>
      {hint && <div className={s.hint} style={{ margin: '0 0 6px' }}>{hint}</div>}
      {items.map((x, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <input value={x} maxLength={tope} placeholder={placeholder} onChange={(e) => set(i, e.target.value)} aria-label={`${titulo} ${i + 1}`} />
          <Btn small onClick={() => onChange(items.filter((_, j) => j !== i))} title="Quitar">×</Btn>
        </div>
      ))}
      {items.length < max && <Btn small onClick={() => onChange([...items, ''])}>+ Agregar</Btn>}
    </div>
  );
}

export function PortadaMinoristaEditor({ avisar }) {
  const [web, setWeb] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const enVuelo = useRef(false);

  useEffect(() => {
    let activo = true;
    httpClient.get('/configuracion/web')
      .then((w) => { if (activo) setWeb(soloMin(w)); })
      .catch(() => { if (activo) avisar('err', 'No se pudieron leer los textos de la portada.'); });
    return () => { activo = false; };
  }, [avisar]);

  if (!web) return <div className={s['empty-state']}>Cargando la portada minorista…</div>;
  const set = (k) => (v) => setWeb((w) => ({ ...w, [k]: v }));
  const setBeneficio = (i, k) => (v) => setWeb((w) => ({ ...w, minBeneficios: w.minBeneficios.map((b, j) => (j === i ? { ...b, [k]: v } : b)) }));
  const beneficios = web.minBeneficios ?? [];

  const guardar = async () => {
    if (enVuelo.current) return;
    if (!String(web.minHeroTitulo ?? '').trim()) { avisar('err', 'La portada necesita el título del hero.'); return; }
    enVuelo.current = true; setGuardando(true);
    try {
      const r = await httpClient.put('/configuracion/web', {
        ...web,
        minAvisos: (web.minAvisos ?? []).map((x) => x.trim()).filter(Boolean),
        minSellos: (web.minSellos ?? []).map((x) => x.trim()).filter(Boolean),
        minBeneficios: beneficios.filter((b) => String(b.titulo ?? '').trim()),
      });
      /* Lo que quedó guardado de verdad (el servidor recorta y limpia). */
      if (r && typeof r === 'object') setWeb(soloMin(r));
      avisar('ok', 'Portada minorista guardada: se ve al recargar la tienda.');
    } catch (e) {
      avisar('err', e?.data?.message || 'No se pudo guardar la portada.');
    } finally {
      enVuelo.current = false; setGuardando(false);
    }
  };

  return (
    <div className={s.card} style={{ padding: 'var(--crm-space-4) var(--crm-space-5)', display: 'grid', gap: 'var(--crm-space-3)' }}>
      <div>
        <div className={s['section-title']} style={{ margin: 0 }}>Portada minorista</div>
        <div className={s.hint} style={{ margin: '4px 0 0' }}>
          Los textos de la portada. Las fotos del hero son las de los productos destacados con imagen; los productos y las categorías salen del catálogo.
          Si hay envío gratis desde un monto, aparece solo como un sello más.
        </div>
      </div>

      <Lista
        titulo="Avisos de la barra de arriba" hint="Rotan de a uno cada pocos segundos."
        items={web.minAvisos ?? []} max={MAX.avisos} tope={TOPE.aviso} placeholder="Ej: 🚚 Retiro en el local o envío a domicilio" onChange={set('minAvisos')}
      />

      <div className={s['section-title']}>Hero (lo primero que se ve)</div>
      <div className={s['form-grid']}>
        <Campo id="min-eyebrow" label="Etiqueta chica (opcional)" value={web.minHeroEyebrow} tope={TOPE.eyebrow} onChange={set('minHeroEyebrow')} />
        <Campo id="min-titulo" label="Título" value={web.minHeroTitulo} tope={TOPE.titulo} onChange={set('minHeroTitulo')} />
      </div>
      <Campo id="min-texto" label="Texto (opcional)" value={web.minHeroTexto} tope={TOPE.texto} rows={2} onChange={set('minHeroTexto')} />
      <div className={s['form-grid']}>
        {[['1', 'Botón principal (naranja)'], ['2', 'Botón secundario (verde)']].map(([n, label]) => (
          <div key={n} className={s.field}>
            <label>{label}</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 6 }}>
              <input value={web[`minHeroCta${n}`] ?? ''} maxLength={TOPE.cta} placeholder="Texto (vacío = sin botón)" onChange={(e) => set(`minHeroCta${n}`)(e.target.value)} aria-label={`${label}: texto`} />
              <select value={web[`minHeroCta${n}Url`] ?? '/'} onChange={(e) => set(`minHeroCta${n}Url`)(e.target.value)} aria-label={`${label}: a dónde lleva`}>
                {RUTAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
        ))}
      </div>
      <Lista
        titulo="Sellos" hint="Círculos con borde de sello debajo de los botones: cortos («Sin TACC», «100 % natural»)."
        items={web.minSellos ?? []} max={MAX.sellos} tope={TOPE.sello} placeholder="Ej: Sin TACC" onChange={set('minSellos')}
      />

      <div className={s['section-title']}>Beneficios (franja verde)</div>
      <Campo id="min-ben-titulo" label="Título de la franja (opcional)" value={web.minBeneficiosTitulo} tope={TOPE.beneficiosTitulo} onChange={set('minBeneficiosTitulo')} />
      <div className={s.hint} style={{ margin: 0 }}>Hasta {MAX.beneficios}. Uno sin título no se muestra.</div>
      {beneficios.map((b, i) => (
        <div key={i} className={s['form-grid']} style={{ alignItems: 'end' }}>
          <div className={s.field} style={{ maxWidth: 90 }}>
            <label htmlFor={`min-ben-ic-${i}`}>Ícono</label>
            <input id={`min-ben-ic-${i}`} value={b.icono ?? ''} maxLength={4} placeholder="🌿" onChange={(e) => setBeneficio(i, 'icono')(e.target.value)} />
          </div>
          <Campo id={`min-ben-t-${i}`} label={`Beneficio ${i + 1}: título`} value={b.titulo} tope={TOPE.beneficio} onChange={setBeneficio(i, 'titulo')} />
          <Campo id={`min-ben-x-${i}`} label="Texto" value={b.texto} tope={TOPE.beneficio} onChange={setBeneficio(i, 'texto')} />
        </div>
      ))}
      {beneficios.length < MAX.beneficios && (
        <div><Btn small onClick={() => set('minBeneficios')([...beneficios, { icono: '', titulo: '', texto: '' }])}>+ Agregar beneficio</Btn></div>
      )}

      <div className={s['section-title']}>Cierre (al final de la portada)</div>
      <div className={s['form-grid']}>
        <Campo id="min-cierre-t" label="Título (vacío = sin cierre)" value={web.minCierreTitulo} tope={TOPE.cierreTitulo} onChange={set('minCierreTitulo')} />
        <Campo id="min-cierre-cta" label="Botón de WhatsApp" value={web.minCierreCta} tope={TOPE.cta} onChange={set('minCierreCta')} hint="Abre el WhatsApp del negocio (el de Datos del sitio)." />
      </div>
      <Campo id="min-cierre-x" label="Texto (opcional)" value={web.minCierreTexto} tope={TOPE.cierreTexto} onChange={set('minCierreTexto')} />

      <div>
        <Btn variant="btn-primary" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar portada minorista'}</Btn>
      </div>
    </div>
  );
}
