import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  agruparPorProveedor, sugerirImporteCuenta, textoResumenCuenta, validarTransferenciaProveedor,
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
