import { BuscadorOpcion } from './BuscadorOpcion.jsx';

/**
 * EL PROVEEDOR SE ELIGE ESCRIBIENDO, EN TODO EL SISTEMA (25/11/2026, pedido
 * del dueño: «todo lo que sea buscar proveedores que sea escribiendo»). Es el
 * `BuscadorOpcion` con lo de siempre para un proveedor: ocupa el ancho del
 * campo, se escribe el nombre y se elige. `value`/`onChange` con el id como
 * texto ('' = ninguno), como el <select> que reemplaza. `vacio`: qué dice sin
 * elegir («Elegí el proveedor…», «Todos», «Sin proveedor»). `proveedores`:
 * `{ id, nombre }` (el nombre puede traer algo más, p. ej. la letra que factura).
 */
export function BuscadorProveedor({ proveedores, value, onChange, vacio = 'Elegí el proveedor…', style, ...resto }) {
  return (
    <BuscadorOpcion
      ariaLabel="Proveedor" placeholder="Escribí el proveedor…" {...resto}
      opciones={proveedores} value={value ?? ''} onChange={onChange} todos={vacio}
      style={{ width: '100%', minWidth: 0, ...style }}
    />
  );
}
