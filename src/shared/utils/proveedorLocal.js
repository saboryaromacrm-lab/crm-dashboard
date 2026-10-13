/**
 * PROVEEDOR LOCAL (13/10/2026, migración 0164): los de la misma localidad que
 * el negocio, marcados en la ficha. En los desplegables de proveedor es una
 * opción más («Solo proveedores locales»), con este valor especial.
 */
export const SOLO_LOCALES = 'locales';

/**
 * Los ids de proveedor que deja pasar el valor de un desplegable de proveedor:
 * `null` = todos (sin filtro); «locales» = los marcados; un id = ese solo.
 */
export function proveedoresDelFiltro(valor, proveedores) {
  if (!valor) return null;
  if (valor === SOLO_LOCALES) return new Set(proveedores.filter((p) => p.esLocal).map((p) => p.id));
  return new Set([Number(valor)]);
}
