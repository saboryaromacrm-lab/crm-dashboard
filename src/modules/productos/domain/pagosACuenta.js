/**
 * QUÉ PAGOS A CUENTA SE OFRECEN AL CARGAR O ABRIR UNA FACTURA (3/11/2026, pedido del dueño).
 * ============================================================================
 * «Le pago por adelantado, a los días llega la mercadería y ahí cargo la
 * factura: ¿me da para aplicar ese pago?». Se ofrecían solo los pagos de LA
 * SUCURSAL de la factura, y quedaban afuera:
 *   · los SIN SUCURSAL (Cash Flow › Pagar a un proveedor, una transferencia que
 *     no salió de ninguna caja): son de toda la empresa, se ofrecen siempre;
 *   · los de OTRA SUCURSAL: un administrador los ve, con su origen a la vista,
 *     porque corregir lo cargado en el mostrador equivocado es su trabajo. Es la
 *     misma regla del servidor (`cruzaSucursales` en pagos.module).
 * Los FLETES nunca: se descuentan al pagar la cuenta corriente (decisión del 18/8).
 */
export function pagoSeOfrece(pago, sucursalDoc, esJefe) {
  if (pago.esFlete) return false;
  return !sucursalDoc || pago.sucursalId == null || pago.sucursalId === sucursalDoc || esJefe;
}

/** ¿Es de otra sucursal que la de la factura? (se marca en la lista). */
export const deOtraSucursal = (pago, sucursalDoc) => !!sucursalDoc && pago.sucursalId != null && pago.sucursalId !== sucursalDoc;

/** Admin o superadmin, según la sesión. */
export const esJefeSesion = (sesion) => ['admin', 'superadmin'].includes(sesion?.usuario?.rolClave ?? '');
