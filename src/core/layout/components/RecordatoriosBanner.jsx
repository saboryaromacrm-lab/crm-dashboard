/**
 * LOS RECORDATORIOS DE LAS ANOTACIONES (0219, 5/11/2026, pedido del dueño):
 * «que avise con banner y poder elegir a qué usuario avisarle». Arriba de toda
 * la app, para cualquier usuario al que le avisaron: desde la hora del
 * recordatorio hasta que toca «Listo» (eso queda asentado y quien la escribió
 * ve que lo vio). Se lee al entrar, cada minuto, al volver a la pestaña y
 * cuando se anota algo en el Dashboard (`EVENTO_RECORDATORIOS`).
 */
import { useEffect, useRef, useState } from 'react';
import { httpClient } from '@core/services/httpClient.js';
import { fmtFechaHora } from '@modules/productos/domain/format.js';

export const EVENTO_RECORDATORIOS = 'erp:recordatorios';
const CADA_MS = 60_000;

export function RecordatoriosBanner() {
  const [avisos, setAvisos] = useState([]);
  const marcando = useRef(new Set());

  useEffect(() => {
    let vivo = true;
    const leer = () => httpClient.get('/anotaciones/mis-avisos')
      .then((d) => { if (vivo) setAvisos(d); })
      .catch(() => { /* el próximo intento */ });
    const alVolver = () => { if (document.visibilityState === 'visible') leer(); };
    leer();
    const t = setInterval(leer, CADA_MS);
    window.addEventListener(EVENTO_RECORDATORIOS, leer);
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      vivo = false;
      clearInterval(t);
      window.removeEventListener(EVENTO_RECORDATORIOS, leer);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, []);

  if (!avisos.length) return null;

  const listo = async (id) => {
    if (marcando.current.has(id)) return;
    marcando.current.add(id);
    try {
      await httpClient.post(`/anotaciones/${id}/visto`, {});
      setAvisos((xs) => xs.filter((a) => a.id !== id));
    } catch {
      /* Ya estaba marcado (otra pestaña) o se borró: la próxima lectura lo acomoda. */
      window.dispatchEvent(new Event(EVENTO_RECORDATORIOS));
    } finally { marcando.current.delete(id); }
  };

  return (
    <div
      role="alert"
      style={{
        display: 'grid', gap: 6, padding: '8px 16px', fontSize: 13.5,
        background: 'color-mix(in srgb, var(--crm-color-warning, #b45309) 12%, var(--crm-color-surface))',
        borderBottom: '1px solid color-mix(in srgb, var(--crm-color-warning, #b45309) 40%, transparent)', color: 'var(--crm-color-text)',
      }}
    >
      {avisos.map((a) => (
        <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px 12px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <strong>⏰ Recordatorio de {a.usuarioNombre}</strong>
            <span style={{ color: 'var(--crm-color-text-secondary)' }}> · {fmtFechaHora(a.recordarEn)}</span>
            <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{a.texto}</div>
          </div>
          <button
            type="button" onClick={() => listo(a.id)}
            style={{ border: '1px solid var(--crm-color-border)', background: 'var(--crm-color-surface)', color: 'var(--crm-color-text)', borderRadius: 6, padding: '4px 12px', fontWeight: 700, cursor: 'pointer' }}
          >
            Listo
          </button>
        </div>
      ))}
    </div>
  );
}
