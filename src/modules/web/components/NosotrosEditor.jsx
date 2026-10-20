/**
 * NOSOTROS Y PREGUNTAS FRECUENTES (20/10/2026, pedido del dueño: «que me
 * encuentren cuando buscan en ChatGPT o similares»). Las IA y Google responden
 * con lo que leen escrito en la tienda: quiénes son, qué venden, cómo se
 * compra. Sale en la página /nosotros y en /llms.txt (el resumen para IA). Se
 * guarda con su propio botón, como el cartel de bienvenida.
 */
import { useRef, useState } from 'react';
import { httpClient } from '@core/services/httpClient.js';
import { env } from '@core/config/env.js';
import { Btn, s } from '@modules/productos/components/ui.jsx';

/* Los topes son los del servidor (configuracion.module.ts, `web.nosotrosTexto` y `web.faq`). */
const TOPE = { texto: 1500, pregunta: 150, respuesta: 600 };
const MAX_PREGUNTAS = 15;

export function NosotrosEditor({ web, setWeb, avisar }) {
  const [guardando, setGuardando] = useState(false);
  const enVuelo = useRef(false);
  const texto = web.nosotrosTexto ?? '';
  const faq = web.faq ?? [];
  const setFaq = (f) => setWeb((w) => ({ ...w, faq: f }));
  const setPregunta = (i, k) => (e) => setFaq(faq.map((f, j) => (j === i ? { ...f, [k]: e.target.value.slice(0, TOPE[k]) } : f)));

  const guardar = async () => {
    if (enVuelo.current) return;
    if (!texto.trim()) { avisar('err', 'Escribí quiénes son: es lo primero que leen Google y las IA.'); return; }
    const aMedias = faq.findIndex((f) => !f.pregunta?.trim() !== !f.respuesta?.trim());
    if (aMedias >= 0) { avisar('err', `A la pregunta ${aMedias + 1} le falta ${faq[aMedias].pregunta?.trim() ? 'la respuesta' : 'la pregunta'}.`); return; }
    enVuelo.current = true; setGuardando(true);
    try {
      const r = await httpClient.put('/configuracion/web', { nosotrosTexto: texto, faq: faq.filter((f) => f.pregunta?.trim()) });
      if (r && typeof r === 'object') setWeb((w) => ({ ...w, nosotrosTexto: r.nosotrosTexto, faq: r.faq }));
      avisar('ok', 'Guardado: se ve en la página Nosotros al recargar la tienda. Google y las IA lo toman cuando vuelven a pasar (puede tardar días o semanas).');
    } catch (e) {
      avisar('err', e?.data?.message || 'No se pudo guardar.');
    } finally {
      enVuelo.current = false; setGuardando(false);
    }
  };

  return (
    <>
      <div className={s['section-title']}>Nosotros y preguntas frecuentes (Google e IA)</div>
      <div className={s.hint} style={{ margin: 0 }}>
        Lo que leen Google, ChatGPT, Gemini y otras IA para responder sobre el negocio. Escribilo como se lo contarías a un cliente:
        qué venden, para quién, dónde y cómo se compra. Sale en{' '}
        <a href={`${env.tiendaUrl}/nosotros`} target="_blank" rel="noopener noreferrer">la página Nosotros</a>{' '}
        y en <a href={`${env.tiendaUrl}/llms.txt`} target="_blank" rel="noopener noreferrer">el resumen para IA</a>, junto con los locales y horarios.
      </div>
      <div className={s.field}>
        <label htmlFor="nos-texto">Quiénes somos <span className={s.hint} style={{ margin: 0, float: 'right' }}>{texto.length}/{TOPE.texto}</span></label>
        <textarea
          id="nos-texto" rows={5} style={{ resize: 'vertical' }} value={texto} maxLength={TOPE.texto}
          onChange={(e) => setWeb((w) => ({ ...w, nosotrosTexto: e.target.value }))}
        />
        <div className={s.hint} style={{ margin: '6px 0 0' }}>Un renglón en blanco separa los párrafos.</div>
      </div>

      <div className={s.field}>
        <label>Preguntas frecuentes <span className={s.hint} style={{ margin: 0, float: 'right' }}>{faq.length}/{MAX_PREGUNTAS}</span></label>
        <div className={s.hint} style={{ margin: '0 0 6px' }}>
          Las que más les hacen por WhatsApp: envíos, medios de pago, sin TACC, por mayor… Respuestas cortas y concretas.
        </div>
        {faq.map((f, i) => (
          <div key={i} className={s.card} style={{ padding: '10px 12px', display: 'grid', gap: 6, marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={f.pregunta ?? ''} maxLength={TOPE.pregunta} placeholder="Ej: ¿Hacen envíos a domicilio?" onChange={setPregunta(i, 'pregunta')} aria-label={`Pregunta ${i + 1}`} />
              <Btn small onClick={() => setFaq(faq.filter((_, j) => j !== i))} title="Quitar la pregunta">×</Btn>
            </div>
            <textarea rows={2} style={{ resize: 'vertical' }} value={f.respuesta ?? ''} maxLength={TOPE.respuesta} placeholder="La respuesta" onChange={setPregunta(i, 'respuesta')} aria-label={`Respuesta ${i + 1}`} />
          </div>
        ))}
        {faq.length < MAX_PREGUNTAS && <Btn small onClick={() => setFaq([...faq, { pregunta: '', respuesta: '' }])}>+ Agregar pregunta</Btn>}
      </div>

      <div>
        <Btn variant="btn-primary" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar nosotros y preguntas'}</Btn>
      </div>
    </>
  );
}
