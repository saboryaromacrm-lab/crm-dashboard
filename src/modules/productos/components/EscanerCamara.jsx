/**
 * ESCÁNER DE CÓDIGO DE BARRAS CON LA CÁMARA
 * ============================================================================
 * La ventana de escaneo: abre la cámara trasera, mira los frames buscando un
 * código de góndola (EAN/UPC/Code-128) y avisa al primero que encuentra.
 *
 * Decisiones que valen la pena:
 *   · **No se escanea de continuo con `setInterval`**: se usa
 *     `requestAnimationFrame` con un piso de ~120 ms entre intentos. Escanear
 *     cada frame calienta el teléfono y no lee más rápido; y con la pestaña en
 *     segundo plano el rAF se pausa solo (un interval seguiría gastando).
 *   · **Se corta al primer acierto** y se cierra la cámara en el acto: dejar el
 *     stream abierto deja la luz prendida y come batería.
 *   · **Vibra y suena** al leer: caminando la góndola nadie mira la pantalla
 *     para confirmar.
 *   · Si el navegador NO puede (HTTP en la red local, permiso denegado), el
 *     cartel dice POR QUÉ y qué hacer — no un botón que falla en silencio.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { abrirCamara, cerrarCamara, leerFrame, motivoSinCamara } from '../domain/leerCodigoBarras.js';
import { ModalShell } from './Modal.jsx';
import { s } from './ui.jsx';

/** Bip corto de confirmación (WebAudio: sin archivos que cargar). */
function bip() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ac = new Ctx();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'square';
    osc.frequency.value = 1320;
    gain.gain.setValueAtTime(0.0001, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, ac.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.12);
    osc.connect(gain); gain.connect(ac.destination);
    osc.start(); osc.stop(ac.currentTime + 0.13);
    setTimeout(() => ac.close?.(), 400);
  } catch { /* sin sonido, no es grave */ }
}

const MS_ENTRE_INTENTOS = 120;

export function EscanerCamara({ onLeido, onCerrar, titulo = 'Escanear código de barras' }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const vivoRef = useRef(true);
  const ultimoRef = useRef(0);

  const [estado, setEstado] = useState('abriendo'); // abriendo | buscando | error
  const [error, setError] = useState('');
  const [leido, setLeido] = useState('');

  const cerrar = useCallback(() => {
    vivoRef.current = false;
    cerrarCamara(streamRef.current);
    streamRef.current = null;
  }, []);

  useEffect(() => {
    const impedimento = motivoSinCamara();
    if (impedimento) { setEstado('error'); setError(impedimento); return undefined; }

    vivoRef.current = true;
    let rafId = 0;

    const tick = async () => {
      if (!vivoRef.current) return;
      const ahora = performance.now();
      if (ahora - ultimoRef.current >= MS_ENTRE_INTENTOS) {
        ultimoRef.current = ahora;
        const codigo = await leerFrame(videoRef.current, canvasRef.current);
        if (codigo && vivoRef.current) {
          vivoRef.current = false;
          setLeido(codigo);
          bip();
          try { navigator.vibrate?.(60); } catch { /* sin vibración */ }
          cerrarCamara(streamRef.current);
          streamRef.current = null;
          onLeido(codigo);
          return;
        }
      }
      if (vivoRef.current) rafId = requestAnimationFrame(tick);
    };

    (async () => {
      try {
        const stream = await abrirCamara();
        if (!vivoRef.current) { cerrarCamara(stream); return; }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play().catch(() => undefined);
        }
        setEstado('buscando');
        rafId = requestAnimationFrame(tick);
      } catch (e) {
        setEstado('error');
        setError(
          e?.name === 'NotAllowedError'
            ? 'No diste permiso para usar la cámara. Habilitalo en el candado de la barra de direcciones y volvé a intentar.'
            : e?.name === 'NotFoundError'
              ? 'No se encontró ninguna cámara en este dispositivo.'
              : `No se pudo abrir la cámara (${e?.name || 'error'}).`,
        );
      }
    })();

    return () => { cancelAnimationFrame(rafId); cerrar(); };
  }, [cerrar, onLeido]);

  const salir = () => { cerrar(); onCerrar(); };

  return (
    <ModalShell
      title={titulo}
      onClose={salir}
      footer={[{ texto: 'Cerrar', clase: 'btn-ghost', onClick: salir }]}
    >
      {estado === 'error' ? (
        <div className={cx(s.callout, s.warn)}>{error}</div>
      ) : (
        <>
          <div
            style={{
              position: 'relative', width: '100%', aspectRatio: '4 / 3', overflow: 'hidden',
              borderRadius: 10, background: '#000',
            }}
          >
            {/* playsInline es obligatorio en iOS: sin él el video se va a pantalla completa. */}
            <video
              ref={videoRef}
              muted
              playsInline
              autoPlay
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            {/* La mira: ayuda a encuadrar; el lector mira el frame entero. */}
            <div
              style={{
                position: 'absolute', left: '8%', right: '8%', top: '34%', height: '32%',
                border: '2px solid rgba(255,255,255,.9)', borderRadius: 8,
                boxShadow: '0 0 0 9999px rgba(0,0,0,.28)',
              }}
            />
          </div>
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          <div className={cx(s.callout, leido ? s.ok : s.info)} style={{ marginTop: 10 }}>
            {leido
              ? <>Leído: <strong>{leido}</strong></>
              : estado === 'abriendo'
                ? 'Abriendo la cámara…'
                : 'Apuntá al código de barras del paquete. Se agrega solo al leerlo.'}
          </div>
        </>
      )}
    </ModalShell>
  );
}
