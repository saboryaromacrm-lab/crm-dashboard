/**
 * LA SUCURSAL GUARDADA QUE YA NO SE OFRECE (0143, 8/10/2026).
 *
 * Los desplegables de sucursal listan solo las activas. Al editar algo viejo de
 * un local que cerró (un gasto, un pago, un cliente, un operador…), su valor
 * no estaba en la lista y el navegador mostraba la PRIMERA opción: parecía de
 * otro local aunque se guardara el correcto. Esta opción lo muestra tal cual
 * —«Express 2 (desactivada)»— y no deja volver a elegirlo.
 *
 * Va dentro del <select>, antes de las opciones activas.
 */
export function OpcionSucursalGuardada({ valor, lista, nombre }) {
  const id = Number(valor);
  if (!id || (lista ?? []).some((x) => x.id === id)) return null;
  return <option value={valor} disabled>{nombre ? `${nombre} (desactivada)` : 'Sucursal desactivada'}</option>;
}
