import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kgPorUnidadDe, vieneAlPeso, unidadesSugeridas, unidadesAlPeso, yaEntraronSegunHistorial } from './alPeso.js';

test('los kg de la horma salen del nombre', () => {
  assert.equal(kgPorUnidadDe('Queso Danbo S/lact la Serenisima Horma 3.5k Primacof'), 3.5);
  assert.equal(kgPorUnidadDe('Queso Pategras S/lact la Serenisima Horma x4kg Primacof'), 4);
  assert.equal(kgPorUnidadDe('QUESO AZUL HORMA SANTA ROSA X2.560KG'), 2.56);
  assert.equal(kgPorUnidadDe('Manteca Clasica la Serenisima x200g Primacof'), 0.2);
  assert.equal(kgPorUnidadDe('Leche Barista la Serenisima x1l Botella'), null);
  assert.equal(kgPorUnidadDe('Queso sin peso'), null);
});

test('viene al peso: por unidad, con kg en el nombre y cantidad con decimales', () => {
  const danbo = { tipo: 'entero', nombre: 'Queso Danbo Horma 3.5k' };
  assert.equal(vieneAlPeso(danbo, 18.53), true);
  assert.equal(vieneAlPeso(danbo, 5), false);
  assert.equal(vieneAlPeso({ tipo: 'granel', nombre: 'Queso x 3.5kg' }, 18.53), false);
  assert.equal(vieneAlPeso({ tipo: 'entero', nombre: 'Leche x1l' }, 1.5), false);
});

test('las hormas que graba el renglón', () => {
  assert.equal(unidadesSugeridas(18.53, 3.5), 5);
  assert.equal(unidadesSugeridas(1, 3.5), 1);
  // Ya entraron: exacto, para que el $/kg quede igual al del papel.
  assert.equal(unidadesAlPeso({ bultos: '18.53', kgPorUnidad: '3.5', yaEntraron: true }), 5.294286);
  // Entran ahora: enteras, las sugeridas o las que se escribieron.
  assert.equal(unidadesAlPeso({ bultos: '18.53', kgPorUnidad: '3.5', yaEntraron: false }), 5);
  assert.equal(unidadesAlPeso({ bultos: '18.53', kgPorUnidad: '3.5', yaEntraron: false, unidadesPeso: '6' }), 6);
  assert.equal(unidadesAlPeso({ bultos: '18.53', kgPorUnidad: '3.5', unidadesPeso: '5.5' }), 5);
  assert.equal(unidadesAlPeso({ bultos: '18.53', kgPorUnidad: '' }), 0);
});

test('ya entraron si el último papel del proveedor las trajo a menos de $1', () => {
  const c = (id, fecha, costo, extra = {}) => ({
    id, fecha, proveedorId: 126, estado: 'confirmado', tipo: 'factura', items: [{ productoId: 2187, costoUnitario: costo }], ...extra,
  });
  assert.equal(yaEntraronSegunHistorial([c(1, '2026-10-21', 0)], 2187, 126), true);
  assert.equal(yaEntraronSegunHistorial([c(1, '2026-10-21', 0), c(2, '2026-11-02', 43125.6)], 2187, 126), false);
  assert.equal(yaEntraronSegunHistorial([c(1, '2026-10-21', 0, { estado: 'anulado' })], 2187, 126), false);
  assert.equal(yaEntraronSegunHistorial([c(1, '2026-10-21', 0, { proveedorId: 9 })], 2187, 126), false);
  assert.equal(yaEntraronSegunHistorial([], 2187, 126), false);
});
