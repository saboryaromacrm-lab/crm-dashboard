import { SOLO_LOCALES } from '@shared/utils/proveedorLocal.js';

/** La opción «Solo proveedores locales (N)» de un desplegable de proveedor (0164). */
export function OpcionLocales({ proveedores }) {
  const n = proveedores.filter((p) => p.esLocal).length;
  return <option value={SOLO_LOCALES}>Solo proveedores locales ({n})</option>;
}
