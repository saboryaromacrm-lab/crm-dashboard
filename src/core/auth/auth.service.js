import { appConfig } from '@core/config/app.config.js';
import { httpClient } from '@core/services/httpClient.js';
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
    id: s.usuario.id,
    name: s.usuario.nombre,
    email: '',
    roles: [s.usuario.rolClave],
    permissions: s.usuario.permisos ?? [],
    rolNombre: s.usuario.rolNombre,
    sucursalId: s.sucursal.id,
    sucursalNombre: s.sucursal.nombre,
    tenantId: 'tnt_default',
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
    if (!s) return null;
    try {
      const usuarios = await httpClient.get('/usuarios');
      const vivo = usuarios.find((u) => u.id === s.usuario.id);
      // Usuario borrado o desactivado: la sesión ya no vale.
      if (!vivo || vivo.activo === false) {
        limpiarSesion();
        return null;
      }
      const sesion = { ...s, usuario: vivo };
      actualizarSesion(sesion);
      return aUsuarioSesion(sesion);
    } catch {
      return aUsuarioSesion(s);
    }
  },

  /** credentials: { usuarioId, password, sucursalId } */
  async login(credentials) {
    const res = await httpClient.post('/auth/login', credentials);
    const sesion = { usuario: res.usuario, sucursal: res.sucursal };
    guardarSesion(sesion);
    // La elección del login ES el contexto de trabajo: los módulos arrancan
    // parados en esa sucursal y operando como ese usuario.
    actualizarCtx({ sucursalId: res.sucursal.id, usuarioId: res.usuario.id }, res.usuario.id);
    return aUsuarioSesion(sesion);
  },

  async logout() {
    limpiarSesion();
    return true;
  },

  get defaultRoute() {
    return appConfig.routes.defaultAuthenticatedRoute;
  },
};
