/**
 * Guardar algo y avisar (Sistema › Usuarios y roles y Sucursales): corre `fn`,
 * muestra el aviso de la sección y recarga. Devuelve si salió bien, para que
 * la ventana que lo pidió sepa si cerrarse.
 */
export async function mutarConAviso(fn, okMsg, { onAviso, cargar }) {
  try {
    await fn();
    onAviso({ tipo: 'ok', texto: okMsg });
    await cargar();
    return true;
  } catch (e) {
    onAviso({ tipo: 'err', texto: e?.data?.message || 'No se pudo guardar.' });
    return false;
  }
}
