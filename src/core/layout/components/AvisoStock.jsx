/**
 * EL CARTEL DEL STOCK (13/10/2026, pedido del dueño). Pantalla roja casi
 * completa, para todos menos el superadmin: sale al abrir el ERP (cada inicio
 * de sesión) y vuelve a salir cada 2 horas. «Entendido» se habilita a los 7
 * segundos, para que se lea y no se cierre de un clic.
 *
 * · Lo que se recuerda es el último «Entendido» de ESTA sesión (una clave por
 *   huella del token): F5 o abrir otra pestaña no lo repiten antes de las 2
 *   horas; un login nuevo, sí. Aceptado en una pestaña, se cierra en las demás
 *   de la misma sesión.
 * · Mientras está abierto se traga el TECLADO entero (en captura, antes que
 *   nadie): la caja escucha F2/F8/F10 en la ventana, y un atajo o el Enter del
 *   lector no puede cobrar ni confirmar nada con el cartel adelante. Solo pasan
 *   Tab/Enter/Espacio sobre el propio botón. Al cerrarse, el foco vuelve a
 *   donde estaba (el buscador de la caja sigue escaneando).
 */
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@core/auth/AuthContext.jsx';
import { leerSesion } from '@core/auth/sesion.js';

const CADA_MS = 2 * 60 * 60 * 1000;
const TRABA_S = 7;
const TECLAS_DEL_BOTON = new Set(['Tab', 'Enter', ' ']);

const PREFIJO = 'erp.avisoStock.';
const leer = (clave) => { try { return JSON.parse(localStorage.getItem(clave) || 'null'); } catch { return null; } };
/** Cuándo fue el último «Entendido» de esta sesión, si todavía vale (0 = ya toca). */
function vigente(clave, enMemoria) {
  const t = (leer(clave) ?? enMemoria)?.t ?? 0;
  return Date.now() - t < CADA_MS ? t : 0;
}
/** Anota el «Entendido» y barre los de sesiones viejas (ya vencidos). */
function anotar(clave, v) {
  try {
    localStorage.setItem(clave, JSON.stringify(v));
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith(PREFIJO) && k !== clave && !vigente(k)) localStorage.removeItem(k);
    }
  } catch { /* sin storage: queda la memoria de la pestaña */ }
}

export function AvisoStock() {
  const { user } = useAuth();
  const activo = !!user && !(user.roles ?? []).includes('superadmin');
  /* Una clave por sesión (huella del token): un login nuevo vuelve a mostrarlo. */
  const clave = PREFIJO + String(leerSesion()?.token ?? user?.id).slice(-16);
  const [abierto, setAbierto] = useState(false);
  /* Respaldo si el navegador no deja guardar: al menos esta pestaña respeta las 2 h. */
  const memoria = useRef(null);

  /* Cerrado: sale ya si no hay un «Entendido» vigente; si no, cuando venza.
     Abierto: solo escucha, por si lo aceptan en otra pestaña. */
  useEffect(() => {
    if (!activo) return undefined;
    let t;
    const revisar = () => {
      clearTimeout(t);
      const ultimo = vigente(clave, memoria.current);
      if (!ultimo) { setAbierto(true); return; }
      setAbierto(false);
      t = setTimeout(revisar, ultimo + CADA_MS - Date.now() + 500);
    };
    const onStorage = (e) => { if (e.key === clave) revisar(); };
    if (!abierto) revisar();
    window.addEventListener('storage', onStorage);
    return () => { clearTimeout(t); window.removeEventListener('storage', onStorage); };
  }, [activo, clave, abierto]);

  if (!activo || !abierto) return null;
  return (
    <Cartel
      onEntendido={() => {
        memoria.current = { t: Date.now() };
        anotar(clave, memoria.current);
        setAbierto(false);
      }}
    />
  );
}

function Cartel({ onEntendido }) {
  const caja = useRef(null);
  const [falta, setFalta] = useState(TRABA_S);

  useEffect(() => {
    const previo = document.activeElement;
    caja.current?.focus();
    const tragar = (e) => {
      const propio = caja.current?.contains(e.target);
      e.stopPropagation();
      if (!(propio && TECLAS_DEL_BOTON.has(e.key))) e.preventDefault();
    };
    window.addEventListener('keydown', tragar, true);
    window.addEventListener('keyup', tragar, true);
    const desde = Date.now();
    const reloj = setInterval(() => {
      const quedan = Math.max(0, TRABA_S - Math.floor((Date.now() - desde) / 1000));
      setFalta(quedan);
      if (!quedan) clearInterval(reloj);
    }, 250);
    return () => {
      window.removeEventListener('keydown', tragar, true);
      window.removeEventListener('keyup', tragar, true);
      clearInterval(reloj);
      if (previo?.isConnected) previo.focus?.();
    };
  }, []);

  return (
    <div
      role="alertdialog" aria-modal="true" aria-labelledby="aviso-stock-titulo" aria-describedby="aviso-stock-texto"
      ref={caja} tabIndex={-1}
      style={{
        position: 'fixed', inset: 0, zIndex: 3000, display: 'grid', placeItems: 'center',
        padding: 'clamp(10px, 3vw, 32px)', background: 'rgba(40, 0, 0, .55)', outline: 'none',
      }}
    >
      <div
        style={{
          width: '100%', height: '100%', boxSizing: 'border-box', overflow: 'auto',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 'clamp(16px, 4vh, 40px)', padding: 'clamp(20px, 5vw, 64px)', textAlign: 'center',
          background: '#c62828', color: '#fff', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,.45)',
        }}
      >
        <div aria-hidden="true" style={{ fontSize: 'clamp(56px, 12vh, 120px)', lineHeight: 1 }}>⚠</div>
        <h1 id="aviso-stock-titulo" style={{ margin: 0, fontSize: 'clamp(30px, 6vw, 76px)', fontWeight: 900, lineHeight: 1.05, letterSpacing: '.02em', textWrap: 'balance' }}>
          ATENCIÓN CON EL STOCK
        </h1>
        <div id="aviso-stock-texto" style={{ fontSize: 'clamp(20px, 3.2vw, 40px)', fontWeight: 600, lineHeight: 1.3, maxWidth: '24em', textWrap: 'balance' }}>
          <p style={{ margin: 0 }}>Cada producto que falta o sobra es plata que se pierde.</p>
          <p style={{ margin: '.6em 0 0' }}>Contá bien, cargá bien, avisá si algo no cierra.</p>
        </div>
        <button
          type="button" disabled={falta > 0} onClick={onEntendido}
          style={{
            minWidth: 'min(100%, 280px)', padding: '16px 40px', border: 'none', borderRadius: 12,
            background: '#fff', color: '#b71c1c', fontSize: 'clamp(20px, 2.4vw, 28px)', fontWeight: 800,
            cursor: falta > 0 ? 'not-allowed' : 'pointer', opacity: falta > 0 ? 0.6 : 1,
          }}
        >
          {falta > 0 ? `Entendido (${falta})` : 'Entendido'}
        </button>
      </div>
    </div>
  );
}
