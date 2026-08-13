/**
 * Fábricas de <option> reutilizables para los <select> nativos de los modales.
 * Devuelven arrays de elementos <option> listos para poner como children.
 */
import { leerSesion } from '@core/auth/sesion.js';
import { fmtTam } from '../domain/format.js';

/**
 * Las sucursales que ESTE usuario puede elegir.
 *
 * El que no es jefe ve SOLO la suya, y el filtro vive acá y no en cada uno de
 * los dieciséis lugares que arman el desplegable. Ofrecerle las cinco no era un
 * detalle cosmético: era el ataque completo sin necesidad de consola —el
 * repositor de Fontana elegía "Express 2" en el combo del movimiento manual y
 * le bajaba 80 unidades a un local donde no pisa—. El servidor ahora lo rechaza
 * igual (`sucursalDeOperacion`), pero una pantalla que ofrece lo que la API va a
 * negar es una pantalla que miente.
 *
 * "Todas las sucursales" también desaparece para el no-jefe: su "todas" es una.
 */
export function sucursalOptions(store, incTodas) {
  const sesion = leerSesion();
  const rol = sesion?.usuario?.rolClave ?? '';
  const esJefe = rol === 'admin' || rol === 'superadmin';
  const propia = sesion?.sucursal?.id ?? null;

  const visibles = esJefe || propia == null
    ? store.state.sucursales
    : store.state.sucursales.filter((s) => s.id === propia);

  const arr = incTodas && visibles.length > 1
    ? [<option key="_all" value="">Todas las sucursales</option>]
    : [];
  visibles.forEach((s) => arr.push(<option key={s.id} value={s.id}>{s.nombre}</option>));
  return arr;
}

export function productoOptions(store, incTodos, soloTipo) {
  const arr = incTodos ? [<option key="_all" value="">Todos los productos</option>] : [];
  store.state.productos
    .filter((p) => !soloTipo || p.tipo === soloTipo)
    .forEach((p) => arr.push(<option key={p.id} value={p.id}>{p.nombre}</option>));
  return arr;
}

export function usuarioOptions(store) {
  // Los desactivados no pueden operar, pero el seleccionado se muestra igual
  // para no dejar el select apuntando a una opción que no existe.
  return store.state.usuarios
    .filter((u) => u.activo !== false || u.id === store.state.ctx.usuarioId)
    .map((u) => (
      <option key={u.id} value={u.id}>
        {u.nombre}{u.rolNombre ? ` — ${u.rolNombre}` : ''}
      </option>
    ));
}

export function proveedorOptions(store) {
  // Solo los de MERCADERÍA: en el subsistema de inventario, un proveedor que
  // únicamente factura gastos (el plomero) no tiene nada que elegir.
  return [<option key="_none" value="">— Sin proveedor —</option>].concat(
    store.state.proveedores
      .filter((p) => p.proveeMercaderia !== false)
      .map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>),
  );
}

export function presentacionOptions(prod, incBase) {
  const arr = [];
  if (incBase) arr.push(<option key="_base" value="">{prod.tipo === 'granel' ? 'Granel (kg)' : 'Unidad'}</option>);
  if (prod.tipo === 'granel') {
    prod.presentaciones.forEach((pr) => arr.push(<option key={pr.id} value={pr.id}>{fmtTam(pr.tamKg)}</option>));
  }
  return arr;
}
