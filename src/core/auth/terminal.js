/**
 * LA TERMINAL: qué equipo es este
 * ============================================================================
 * El token que dice "esta máquina es la Caja 2 de la Distribuidora". Lo genera
 * el servidor una sola vez, cuando un jefe registra el equipo, y desde ahí el
 * login **deja de preguntar la sucursal**: la muestra fija.
 *
 * VA EN localStorage, no en sessionStorage — al revés que la sesión, y por el
 * motivo exactamente opuesto. La sesión es por pestaña porque dos personas
 * pueden estar trabajando en dos ventanas y no tienen que pisarse. La terminal
 * es del APARATO: no cambia entre pestañas, ni al cerrar el navegador, ni
 * cuando cambia el turno. Guardarla por pestaña obligaría a registrar el equipo
 * cada vez que se abre una ventana nueva, que es justo lo que este cambio vino
 * a sacar del medio.
 *
 * NO ES UNA CREDENCIAL DE PRIVILEGIO. Lo único que decide es en qué sucursal se
 * para el que entra, y eso hasta ayer lo elegía cualquiera libremente de un
 * desplegable. Que se pueda leer del navegador no abre ninguna puerta: no
 * saltea el login ni da permisos.
 *
 * SI SE BORRA (limpieza del navegador, modo incógnito, perfil nuevo,
 * reinstalación) no se rompe nada: el login vuelve a mostrar el desplegable de
 * sucursales como antes, y un jefe registra el equipo de nuevo. Es una molestia
 * ocasional, no una caída.
 */

export const TERMINAL_KEY = 'crm_terminal';

/** El token del equipo, o `''` si esta máquina no está registrada. */
export function leerTokenTerminal() {
  try { return localStorage.getItem(TERMINAL_KEY) ?? ''; } catch { return ''; }
}

export function guardarTokenTerminal(token) {
  try { localStorage.setItem(TERMINAL_KEY, String(token ?? '')); } catch { /* modo privado */ }
}

/** Desregistra el equipo en ESTE navegador. El registro del servidor no se toca. */
export function olvidarTerminal() {
  try { localStorage.removeItem(TERMINAL_KEY); } catch { /* modo privado */ }
}
