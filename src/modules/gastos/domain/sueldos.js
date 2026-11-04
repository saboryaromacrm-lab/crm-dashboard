/**
 * EL COSTO DE UN EMPLEADO (0152) — la misma cuenta que hace el servidor en
 * Resultados (`reglas.ts › costoEmpleadoMes`), para mostrarla al cargar:
 * sueldo bruto + cargas del empleador + 1/12 de aguinaldo sobre los dos
 * (0217: sin el aguinaldo si no le corresponde). Si se cambia una, cambiar la otra.
 */
export const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export function costoMensual(bruto, cargas, conAguinaldo = true) {
  const b = Number(bruto) || 0;
  const conCargas = b * (1 + (Number(cargas) || 0) / 100);
  const aguinaldo = conAguinaldo ? conCargas / 12 : 0;
  return { cargas: r2(conCargas - b), aguinaldo: r2(aguinaldo), total: r2(conCargas + aguinaldo) };
}

/** La plata como se lee en pantalla («$127.242,83»). */
const moneda = (n) => `$${(Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Lo que explica el costo del mes debajo del número (4/11/2026, pedido del
 * dueño: «aclarame que es parte del aguinaldo»): el sueldo con sus cargas y el
 * 1/12 de aguinaldo que Resultados le suma, o que no le corresponde.
 */
export function detalleCosto(c, conAguinaldo = true) {
  if (!conAguinaldo) return 'sin aguinaldo';
  return `${c.cargas > 0 ? 'sueldo + cargas' : 'sueldo'} + 1/12 de aguinaldo (${moneda(c.aguinaldo)})`;
}

/** La cuota mensual de un bien de uso (línea recta). */
export const cuotaMensual = (valor, vidaMeses) => r2((Number(valor) || 0) / Math.max(1, Number(vidaMeses) || 1));
