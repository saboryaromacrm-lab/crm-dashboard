/**
 * Fábricas de <option> reutilizables para los <select> nativos de los modales.
 * Devuelven arrays de elementos <option> listos para poner como children.
 */
import { fmtTam } from '../domain/format.js';

export function sucursalOptions(store, incTodas) {
  const arr = incTodas ? [<option key="_all" value="">Todas las sucursales</option>] : [];
  store.state.sucursales.forEach((s) => arr.push(<option key={s.id} value={s.id}>{s.nombre}</option>));
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
  return store.state.usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>);
}

export function proveedorOptions(store) {
  return [<option key="_none" value="">— Sin proveedor —</option>].concat(
    store.state.proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>),
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
