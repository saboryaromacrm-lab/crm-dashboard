import { appConfig } from '@core/config/app.config.js';
import { httpClient } from '@core/services/httpClient.js';
import { leerTokenTerminal } from '@core/auth/terminal.js';
import {
  leerSesion, guardarSesion, actualizarSesion, actualizarCtx, limpiarSesion,
} from './sesion.js';

/**
 * Authentication service.
 *
 * Login REAL contra la API (`POST /auth/login`): usuario + contraseña + la
 * SUCURSAL con la que se va a operar. La sesión es POR PESTAÑA (ver
 * `sesion.js`) y, al entrar, fija el contexto operativo de Compras/Almacén y
 * Ventas — esta ventana trabaja como ese usuario en esa sucursal hasta cerrar
 * sesión, sin importar quién se loguee en otra ventana.
 */

function aUsuarioSesion(s) {
  return {
    // `email` y `tenantId` eran restos del andamio multi-inquilino del arranque:
    // un string vacío y una constante que nadie leía en todo el dashboard.
    id: s.usuario.id,
    name: s.usuario.nombre,
    roles: [s.usuario.rolClave],
    permissions: s.usuario.permisos ?? [],
    rolNombre: s.usuario.rolNombre,
    sucursalId: s.sucursal.id,
    sucursalNombre: s.sucursal.nombre,
  };
}

export const authService = {
  /**
   * Returns the current session user, or null if unauthenticated.
   *
   * Los PERMISOS se refrescan contra la API en cada carga: si el superadmin
   * ajustó el rol, el menú y las pantallas cambian con un F5 — sin re-login.
   * Si la API no responde, vale la foto guardada al entrar (mejor operar con
   * permisos de ayer que dejar el sistema en blanco por un corte).
   */
  async getCurrentUser() {
    const s = leerSesion();
    // Sin token no hay sesión que valga: las de antes del cierre de la API
    // quedaron obsoletas y hay que volver a entrar una vez.
    if (!s?.token) return null;
    try {
      /*
       * `/auth/yo` y no `/usuarios`: es EL SERVIDOR el que dice si el token
       * todavía vale y con qué permisos, en vez de que el frontend se busque a
       * sí mismo en un listado. Dos razones concretas:
       *
       *  - `/usuarios` ahora exige permiso de gerencia, así que a un cajero le
       *    daría 403 y su sesión quedaría con los permisos del día que entró;
       *  - la sucursal también viene del servidor, que es donde vive el candado.
       *
       * `sinRedirigir`: acá el 401 se maneja devolviendo null para que el router
       * muestre el login. Sin eso, la llamada del arranque dispararía la
       * recarga del cliente HTTP y quedaría en un bucle.
       */
      const yo = await httpClient.get('/auth/yo', { sinRedirigir: true });
      const sesion = { ...s, usuario: yo.usuario, sucursal: yo.sucursal };
      actualizarSesion(sesion);
      return aUsuarioSesion(sesion);
    } catch (e) {
      // El token murió: lo cortaron, venció, o desactivaron al usuario.
      if (e?.status === 401) {
        limpiarSesion();
        return null;
      }
      // La API no contesta (corte de red, servicio caído): vale la foto
      // guardada al entrar. Mejor operar con los permisos de ayer que dejar el
      // sistema en blanco por un corte de internet.
      return aUsuarioSesion(s);
    }
  },

  /** credentials: { usuarioId, password, sucursalId } */
  async login(credentials) {
    /*
     * EL TOKEN DEL EQUIPO VIAJA SIEMPRE, y se agrega acá y no en la pantalla
     * porque es del navegador, no de lo que se tipeó. Si esta máquina está
     * registrada, **el servidor descarta el `sucursalId` de arriba** y usa la
     * de la terminal: la cajera no puede entrar en el local equivocado ni
     * queriendo. Si no está registrada, esto va vacío y todo sigue igual.
     */
    const res = await httpClient.post('/auth/login', {
      ...credentials,
      terminalToken: leerTokenTerminal() || undefined,
    });
    // EL TOKEN ES LA SESIÓN. Sin él, guardar usuario y sucursal solo alcanzaría
    // para pintar el menú: la API no contestaría ni una llamada.
    const sesion = {
      token: res.token, usuario: res.usuario, sucursal: res.sucursal, terminal: res.terminal ?? null,
    };
    guardarSesion(sesion);
    httpClient.reiniciarAvisoDeSesion();
    // La elección del login ES el contexto de trabajo: los módulos arrancan
    // parados en esa sucursal y operando como ese usuario.
    actualizarCtx({ sucursalId: res.sucursal.id, usuarioId: res.usuario.id }, res.usuario.id);
    return aUsuarioSesion(sesion);
  },

  async logout() {
    /*
     * Avisarle al servidor es lo que hace que salir signifique algo: sin esto,
     * la sesión quedaría viva en la base 12 horas más y el token, si alguien lo
     * copió del navegador, seguiría entrando.
     *
     * Corta SOLO esta sesión, no las otras del mismo usuario: salir en la caja
     * no puede cerrar la tablet del depósito.
     *
     * Si falla (sin red), se limpia igual del lado del cliente: dejar al usuario
     * adentro porque no hubo internet sería peor.
     */
    try { await httpClient.post('/auth/salir'); } catch { /* se limpia igual */ }
    limpiarSesion();
    return true;
  },

  get defaultRoute() {
    return appConfig.routes.defaultAuthenticatedRoute;
  },
};
