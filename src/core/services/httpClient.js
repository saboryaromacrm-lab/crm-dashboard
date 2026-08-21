import { appConfig } from '@core/config/app.config.js';
import { leerSesion, limpiarSesion } from '@core/auth/sesion.js';

/**
 * Thin, dependency-free HTTP client built on fetch.
 *
 * Every module's service layer goes through this single client so that
 * cross-cutting concerns (base URL, auth header, timeout, error normalization,
 * future retry/telemetry) are configured in ONE place. Swapping to axios or
 * adding interceptors later means editing this file only.
 *
 * ACÁ VIAJA LA CREDENCIAL. Desde que la API se cerró, cada llamada tiene que
 * llevar el token de la sesión: es el único lugar por donde pasan todas, así
 * que es el único lugar donde hay que ponerlo.
 */

class HttpError extends Error {
  constructor(message, { status, data, sinRespuesta = false } = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.data = data;
    /**
     * NO LLEGÓ RESPUESTA, que no es lo mismo que "el servidor dijo que no".
     *
     * Sin esta marca los dos casos eran indistinguibles para quien llama: un
     * 400 con su mensaje y un corte de red daban los dos `e.data.message`
     * vacío, así que el POS mostraba "No se pudo registrar la venta" en los
     * dos. Y no son lo mismo ni de cerca: si el servidor rechazó, la venta NO
     * existe; si no llegó la respuesta, **la venta pudo haberse hecho igual**
     * —el servidor no se entera de que el navegador cortó y sigue— y la cajera
     * no tiene forma de saberlo. Con la conexión colgada del celular de la
     * cajera, esto pasa de verdad.
     *
     * Lo marca el `catch` del fetch: fetch SOLO rechaza cuando no hubo
     * respuesta (red caída, DNS, o el `AbortController` del timeout). Un 4xx o
     * un 5xx no pasan por ahí — esos llegan como respuesta y se tratan abajo.
     */
    this.sinRespuesta = sinRespuesta;
  }
}

/**
 * Los endpoints que la API abre a propósito. Un 401 acá NO es una sesión
 * vencida: es "la contraseña está mal". Si no se distinguiera, escribir mal la
 * clave en el login limpiaría la sesión y recargaría la pantalla.
 */
const PUBLICOS = ['/auth/login', '/auth/opciones', '/health'];

/**
 * La sesión venció del lado del SERVIDOR (la cortaron, se desactivó el usuario,
 * pasaron las 12 h). Se limpia lo local y se recarga: el arranque ve que no hay
 * sesión y muestra el login, sin inventar una ruta ni duplicar esa lógica.
 *
 * El candado del `yaAvisado` es lo que evita el bucle: varias llamadas en vuelo
 * fallan casi juntas, y sin él cada una dispararía su propia recarga.
 */
let yaAvisado = false;
function sesionVencida() {
  if (yaAvisado) return;
  yaAvisado = true;
  limpiarSesion();
  try {
    window.dispatchEvent(new CustomEvent('crm:sesion-vencida'));
    window.location.reload();
  } catch { /* sin window (tests) */ }
}

async function request(method, path, { body, headers, signal, sinRedirigir = false } = {}) {
  const url = path.startsWith('http')
    ? path
    : `${appConfig.api.baseUrl}${path}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), appConfig.api.timeoutMs);

  const token = leerSesion()?.token;

  try {
    let response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : null),
          ...headers,
        },
        body: body != null ? JSON.stringify(body) : undefined,
        signal: signal ?? controller.signal,
      });
    } catch (e) {
      /* Acá SOLO se cae cuando no hubo respuesta: se cortó la red, el servidor
       * no contestó, o se agotó el timeout de arriba y abortamos nosotros. Se
       * re-tira como `HttpError` para que quien llama no tenga que distinguir
       * un `AbortError` de un `TypeError` de red — lo que necesita saber es
       * una sola cosa, y es que **no sabe si la operación se hizo o no**. */
      throw new HttpError(`Sin respuesta del servidor: ${method} ${path}`, {
        sinRespuesta: true,
        data: { message: 'No llegó la respuesta del servidor.' },
      });
    }

    /*
     * 401 = la credencial no sirve → afuera. 403 = la credencial está bien pero
     * el rol no alcanza → NO se cierra la sesión. Confundirlos echaría a la
     * cajera al login por haber tocado algo que no le corresponde.
     */
    if (response.status === 401 && !sinRedirigir && !PUBLICOS.some((p) => path.startsWith(p))) {
      sesionVencida();
    }

    const isJson = (response.headers.get('content-type') ?? '').includes(
      'application/json',
    );
    const data = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      throw new HttpError(`Request failed: ${response.status}`, {
        status: response.status,
        data,
      });
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

export const httpClient = {
  /** Se llama al entrar: una sesión nueva vuelve a habilitar el aviso. */
  reiniciarAvisoDeSesion: () => { yaAvisado = false; },
  get: (path, opts) => request('GET', path, opts),
  post: (path, body, opts) => request('POST', path, { ...opts, body }),
  put: (path, body, opts) => request('PUT', path, { ...opts, body }),
  patch: (path, body, opts) => request('PATCH', path, { ...opts, body }),
  delete: (path, opts) => request('DELETE', path, opts),
};

export { HttpError };
