/**
 * SESIÓN POR PESTAÑA
 * ============================================================================
 * La sesión (`crm_sesion`) y el contexto operativo de los módulos
 * (`crm_inv_ctx`, `crm_ventas_ctx`) viven en **sessionStorage**, que es propio
 * de CADA pestaña/ventana. En localStorage queda solo una COPIA compartida —
 * "el último login de este navegador" — para que una pestaña nueva herede la
 * sesión sin volver a loguearse.
 *
 * Por qué: localStorage es UNO por navegador. Cuando todo vivía ahí, dos
 * ventanas logueadas con usuarios distintos se pisaban — el login de Carla en
 * Express 2 sobreescribía el de Marta en Express 3, y la ventana de Carla
 * terminaba operando (y viendo la caja) de la sucursal de Marta. Con la sesión
 * por pestaña, cada ventana queda clavada al usuario y sucursal con los que se
 * logueó, sin importar qué se haga en las demás.
 *
 * Regla de la copia compartida: solo la toca la pestaña DUEÑA del último login
 * (mismo usuario). Refrescar permisos o cambiar de sucursal en una ventana
 * vieja no debe pisar el login más reciente de otra.
 */

export const SESION_KEY = 'crm_sesion';
export const CTX_KEYS = ['crm_inv_ctx', 'crm_ventas_ctx'];

/**
 * CUÁNTO DURA LA COPIA HEREDABLE, y por qué existe este tope.
 *
 * La copia compartida vive en localStorage, que sobrevive a cerrar el navegador:
 * en la PC del mostrador eso significaba que apagar y prender no cerraba nada —
 * el que abría Chrome a la mañana entraba como el último que se había logueado
 * la tarde anterior. Con este tope, la copia se puede heredar durante un turno y
 * después deja de servir.
 *
 * El tope limita SOLO la herencia hacia una pestaña nueva: la pestaña que ya
 * está trabajando tiene su propia sesión en sessionStorage y no se toca. O sea
 * que a nadie se le corta el trabajo por este número; lo único que pasa al
 * pasarse es que una ventana nueva pide login. El vencimiento de verdad lo
 * sigue mandando el servidor.
 */
const HEREDABLE_MS = 10 * 60 * 60 * 1000; // 10 horas: un turno largo

function parse(raw) {
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

/* La marca de vencimiento va en una clave APARTE para no cambiarle la forma al
 * objeto guardado: quien lea la copia compartida sigue viendo la sesión tal cual. */
const claveVence = (k) => `${k}_hasta`;

/** Borra la copia compartida de una clave (y su marca). */
function olvidarCompartida(k) {
  try {
    localStorage.removeItem(k);
    localStorage.removeItem(claveVence(k));
  } catch { /* modo privado */ }
}

/**
 * ¿La copia compartida todavía se puede heredar? Sin marca se considera
 * VENCIDA: una copia guardada por una versión anterior no tiene por qué
 * sobrevivir para siempre, y equivocarse para el lado de pedir login es el
 * error barato.
 */
function heredable(k) {
  try {
    const hasta = Number(localStorage.getItem(claveVence(k)));
    return Number.isFinite(hasta) && hasta > Date.now();
  } catch { return false; }
}

/**
 * Lee una clave con la regla por-pestaña: lo propio (sessionStorage) manda; si
 * la pestaña es nueva, hereda la copia compartida y la fija como propia — a
 * partir de ahí los logins de otras ventanas ya no la afectan.
 */
export function leerClave(k) {
  try {
    const propio = sessionStorage.getItem(k);
    if (propio != null) return parse(propio);
    const heredado = localStorage.getItem(k);
    if (heredado == null) return null;
    // Vencida: no se hereda, y se limpia para no dejarla dando vueltas.
    if (!heredable(k)) { olvidarCompartida(k); return null; }
    sessionStorage.setItem(k, heredado);
    return parse(heredado);
  } catch { return null; }
}

/** Escribe una clave de ESTA pestaña. `compartir` también la deja como copia
 *  compartida (solo el login usa eso sin condiciones), con su vencimiento. */
export function escribirClave(k, valor, { compartir = false } = {}) {
  const raw = JSON.stringify(valor);
  try { sessionStorage.setItem(k, raw); } catch { /* modo privado */ }
  if (compartir) {
    try {
      localStorage.setItem(k, raw);
      localStorage.setItem(claveVence(k), String(Date.now() + HEREDABLE_MS));
    } catch { /* modo privado */ }
  }
}

/** ¿La copia compartida pertenece al usuario de esta pestaña? */
function esDuenaDeLaCompartida(usuarioId) {
  const compartida = parse((() => { try { return localStorage.getItem(SESION_KEY); } catch { return null; } })());
  return compartida?.usuario?.id === usuarioId;
}

export function leerSesion() {
  return leerClave(SESION_KEY);
}

/** Login: la sesión es de esta pestaña Y queda como "último login" heredable. */
export function guardarSesion(sesion) {
  escribirClave(SESION_KEY, sesion, { compartir: true });
}

/**
 * Refresco de una sesión ya iniciada (permisos vivos, cambio de sucursal del
 * jefe): actualiza esta pestaña siempre; la copia compartida solo si sigue
 * siendo del mismo usuario.
 */
export function actualizarSesion(sesion) {
  escribirClave(SESION_KEY, sesion, { compartir: esDuenaDeLaCompartida(sesion?.usuario?.id) });
}

/** Contexto operativo de los módulos, con la misma regla que la sesión. */
export function actualizarCtx(ctx, usuarioId) {
  const compartir = esDuenaDeLaCompartida(usuarioId);
  for (const k of CTX_KEYS) escribirClave(k, ctx, { compartir });
}

/** Cierra la sesión de ESTA pestaña; la copia compartida solo si era suya. */
export function limpiarSesion() {
  const propia = leerSesion();
  const duena = propia && esDuenaDeLaCompartida(propia.usuario?.id);
  try {
    sessionStorage.removeItem(SESION_KEY);
    for (const k of CTX_KEYS) sessionStorage.removeItem(k);
  } catch { /* modo privado */ }
  if (duena) {
    olvidarCompartida(SESION_KEY);
    for (const k of CTX_KEYS) olvidarCompartida(k);
  }
}
