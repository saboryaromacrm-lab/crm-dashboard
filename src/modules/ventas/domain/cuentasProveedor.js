/**
 * TRANSFERENCIA A CUENTA DE PROVEEDOR — las reglas del lado de la caja.
 * ============================================================================
 * El cliente le transfiere directo a un proveedor al que se le debe (Proveedores
 * › Cuentas disponibles). La API es la que manda y revalida todo con candado;
 * esto existe para que el cajero vea el rechazo ANTES de apretar, con el cliente
 * enfrente, y no después. Mismos números, mismos mensajes.
 */
const EPS = 0.005;
export const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * ¿Esta cuenta se ofrece en una venta (o un recibo) de este total? (0168) Las
 * que son «solo para ventas desde $X» esperan a que el total llegue a X.
 */
export const seOfrece = (cuenta, total) => !(r2(cuenta?.ventaMinima) > 0) || r2(total) >= r2(cuenta.ventaMinima) - EPS;

/**
 * Por qué esta transferencia no entra en esta cuenta, o `null` si entra.
 *  - solo en ventas desde la venta mínima de la cuenta;
 *  - nunca más de lo que falta, salvo la cuenta que «puede pasarse» (0177):
 *    ahí entra más y ese pago la cierra;
 *  - nunca menos del mínimo del proveedor, salvo que CIERRE la cuenta
 *    (el resto final es lo que es).
 */
export function validarTransferenciaProveedor(importe, cuenta, total) {
  if (!cuenta) return 'Elegí a qué cuenta del proveedor va la transferencia.';
  if (!seOfrece(cuenta, total)) return `Esa cuenta es solo para ventas desde ${fmt(cuenta.ventaMinima)}: elegí otra.`;
  const imp = r2(importe);
  if (imp <= 0) return null; // sin importe todavía no hay nada que juzgar
  const falta = r2(cuenta.falta);
  if (!cuenta.puedePasarse && imp > falta + EPS) return `A esta cuenta le faltan ${fmt(falta)}: no puede recibir de más.`;
  const cierra = imp >= falta - EPS;
  const minimo = r2(cuenta.minimo);
  if (!cierra && minimo > 0 && imp < minimo - EPS) {
    return cuenta.puedePasarse
      ? `${cuenta.proveedorNombre} no recibe menos de ${fmt(minimo)} — salvo que cubra el resto (${fmt(falta)} o más).`
      : `${cuenta.proveedorNombre} no recibe menos de ${fmt(minimo)} — salvo el resto completo (${fmt(falta)}).`;
  }
  return null;
}

/**
 * Qué importe proponer al elegir la cuenta: lo que le falta, recortado al tope
 * (lo que le queda por pagar a la venta). Sin tope, todo el resto. La cuenta
 * que puede pasarse (0177) toma todo lo que resta de la venta.
 */
export function sugerirImporteCuenta(cuenta, tope) {
  const falta = r2(cuenta?.falta);
  const t = r2(tope);
  if (!(t > 0)) return falta;
  return cuenta?.puedePasarse ? t : Math.min(falta, t);
}

/**
 * La última línea de la cuenta: lo que le falta o, si se pasó (0177), por
 * cuánto. `[etiqueta, monto]`, la misma en la pantalla, el papel y la imagen.
 */
export function saldoCuenta(cuenta) {
  return r2(cuenta?.pasado) > 0 ? ['Pasada por', r2(cuenta.pasado)] : ['Falta', r2(cuenta?.falta)];
}

/** Las cuentas abiertas, agrupadas por proveedor y en el orden en que llegan (prioritarias primero). */
export function agruparPorProveedor(cuentas) {
  const grupos = new Map();
  for (const c of cuentas ?? []) {
    if (!grupos.has(c.proveedorId)) grupos.set(c.proveedorId, { proveedorId: c.proveedorId, proveedorNombre: c.proveedorNombre, cuentas: [] });
    grupos.get(c.proveedorId).cuentas.push(c);
  }
  return [...grupos.values()].sort((a, b) => a.proveedorNombre.localeCompare(b.proveedorNombre, 'es'));
}

/** Cómo se lee una cuenta en un desplegable: titular · alias · lo que falta. */
export function etiquetaCuenta(c) {
  return `${c.titular} · ${c.cbuAlias} · faltan ${fmt(c.falta)}${c.puedePasarse ? ' · puede pasarse' : ''}`;
}

/** Pesos sin decimales, con punto de miles: como se dicta por teléfono. */
export function fmt(n) {
  return `$${Math.round(Number(n) || 0).toLocaleString('es-AR')}`;
}

/**
 * El resumen que se le manda al proveedor por WhatsApp: qué cuenta, cuánto se
 * cubrió, y cada transferencia con su fecha. Texto plano a propósito.
 */
export function textoResumenCuenta(cuenta, pagos, fechaDe) {
  const lineas = [
    `*HISTORIAL DE TRANSFERENCIAS*`,
    `Proveedor: ${cuenta.proveedorNombre}`,
    `Titular: ${cuenta.titular}`,
    `Alias/CBU: ${cuenta.cbuAlias}`,
    `A cubrir: ${fmt(cuenta.importe)}`,
    `Transferido: ${fmt(cuenta.pagado)} en ${cuenta.cant} transferencia${cuenta.cant === 1 ? '' : 's'}`,
    `${saldoCuenta(cuenta)[0]}: ${fmt(saldoCuenta(cuenta)[1])}`,
    '',
  ];
  for (const p of pagos ?? []) {
    lineas.push(`${fechaDe(p.fecha)} — ${fmt(p.importe)}${p.observaciones ? ` (${p.observaciones})` : ''}`);
  }
  return lineas.join('\n');
}
