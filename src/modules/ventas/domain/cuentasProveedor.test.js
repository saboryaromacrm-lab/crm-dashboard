import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  agruparPorProveedor, saldoCuenta, seOfrece, sugerirImporteCuenta, textoResumenCuenta, validarTransferenciaProveedor,
} from './cuentasProveedor.js';

const cuenta = (extra = {}) => ({
  id: 1, proveedorId: 7, proveedorNombre: 'Coca-Cola', titular: 'Juan Pérez', cbuAlias: 'juan.perez',
  importe: 120000, pagado: 70000, falta: 50000, minimo: 20000, ...extra,
});

test('sin cuenta elegida, el mensaje pide la cuenta', () => {
  assert.match(validarTransferenciaProveedor(1000, null), /Elegí/);
});

test('sin importe todavía no hay rechazo', () => {
  assert.equal(validarTransferenciaProveedor('', cuenta()), null);
  assert.equal(validarTransferenciaProveedor(0, cuenta()), null);
});

test('nunca de más: lo que falta es el techo', () => {
  assert.equal(validarTransferenciaProveedor(50000, cuenta()), null);
  assert.match(validarTransferenciaProveedor(50000.01, cuenta()), /faltan \$50\.000/);
});

test('el mínimo del proveedor se respeta, salvo el resto que cierra', () => {
  assert.match(validarTransferenciaProveedor(10000, cuenta()), /no recibe menos de \$20\.000/);
  assert.equal(validarTransferenciaProveedor(20000, cuenta()), null);
  // falta 15.000 < mínimo 20.000: solo entra el resto exacto
  assert.match(validarTransferenciaProveedor(10000, cuenta({ falta: 15000 })), /resto completo \(\$15\.000\)/);
  assert.equal(validarTransferenciaProveedor(15000, cuenta({ falta: 15000 })), null);
  // sin mínimo, cualquier parte vale
  assert.equal(validarTransferenciaProveedor(100, cuenta({ minimo: 0 })), null);
});

test('la sugerencia es lo que falta, recortado a lo que resta de la venta', () => {
  assert.equal(sugerirImporteCuenta(cuenta(), 30000), 30000);
  assert.equal(sugerirImporteCuenta(cuenta(), 80000), 50000);
  assert.equal(sugerirImporteCuenta(cuenta(), 0), 50000);
});

test('agrupa por proveedor respetando el orden de llegada dentro de cada uno', () => {
  const g = agruparPorProveedor([
    cuenta({ id: 1, proveedorId: 7, proveedorNombre: 'Pecanes' }),
    cuenta({ id: 2, proveedorId: 3, proveedorNombre: 'Danjul' }),
    cuenta({ id: 3, proveedorId: 7, proveedorNombre: 'Pecanes' }),
  ]);
  assert.deepEqual(g.map((x) => x.proveedorNombre), ['Danjul', 'Pecanes']);
  assert.deepEqual(g[1].cuentas.map((c) => c.id), [1, 3]);
});

test('el texto del resumen lleva cabecera y una línea por transferencia', () => {
  const t = textoResumenCuenta(cuenta({ cant: 2 }), [
    { fecha: 'a', importe: 40000, observaciones: '' },
    { fecha: 'b', importe: 30000, observaciones: 'Lucas' },
  ], (f) => `F${f}`);
  assert.match(t, /Titular: Juan Pérez/);
  assert.match(t, /Transferido: \$70\.000 en 2 transferencias/);
  assert.match(t, /Fa — \$40\.000\n/);
  assert.match(t, /Fb — \$30\.000 \(Lucas\)/);
});

test('solo para ventas desde (0168): se ofrece desde ese total, y la validación lo frena por debajo', () => {
  const c = { id: 9, proveedorNombre: 'CARLOS OLIVAA', falta: 200000, minimo: 0, ventaMinima: 50000 };
  assert.equal(seOfrece(c, 49999.99), false);
  assert.equal(seOfrece(c, 50000), true, 'desde: el total justo entra');
  assert.equal(seOfrece({ ...c, ventaMinima: 0 }, 10), true, 'sin piso: siempre');
  assert.match(validarTransferenciaProveedor(30000, c, 40000), /solo para ventas desde \$50\.000/);
  assert.equal(validarTransferenciaProveedor(30000, c, 60000), null, 'venta de $60.000: la cuenta entra aunque la transferencia sea de $30.000');
});

test('puede pasarse del monto (0177): entra más de lo que falta y ese pago cierra', () => {
  const c = cuenta({ importe: 100000, pagado: 90000, falta: 10000, minimo: 20000, puedePasarse: true });
  assert.equal(validarTransferenciaProveedor(30000, c), null, '$30.000 sobre $10.000 que faltan: entra');
  assert.equal(validarTransferenciaProveedor(10000, c), null, 'el resto exacto también, aunque sea menor al mínimo');
  assert.equal(validarTransferenciaProveedor(12000, c), null, 'más que el resto y menos que el mínimo: cierra, entra');
  assert.match(validarTransferenciaProveedor(5000, c), /salvo que cubra el resto \(\$10\.000 o más\)/, 'menos que el resto y que el mínimo: no');
  assert.match(validarTransferenciaProveedor(30000, { ...c, puedePasarse: false }), /no puede recibir de más/, 'sin el tilde, igual que siempre');
});

test('puede pasarse: la sugerencia toma lo que resta de la venta', () => {
  const c = cuenta({ falta: 10000, puedePasarse: true });
  assert.equal(sugerirImporteCuenta(c, 30000), 30000);
  assert.equal(sugerirImporteCuenta(c, 5000), 5000);
  assert.equal(sugerirImporteCuenta(c, 0), 10000, 'sin tope (recibo): lo que falta');
  assert.equal(sugerirImporteCuenta({ ...c, puedePasarse: false }, 30000), 10000);
});

test('saldo de la cuenta: lo que falta o por cuánto se pasó', () => {
  assert.deepEqual(saldoCuenta(cuenta()), ['Falta', 50000]);
  assert.deepEqual(saldoCuenta(cuenta({ falta: 0, pasado: 20000 })), ['Pasada por', 20000]);
  const t = textoResumenCuenta(cuenta({ importe: 100000, pagado: 120000, falta: 0, pasado: 20000, cant: 2 }), [], (f) => f);
  assert.match(t, /Pasada por: \$20\.000/);
  assert.doesNotMatch(t, /Falta:/);
});
