/* Proveedor local (0164): la regla del desplegable de proveedor que comparten los filtros. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { proveedoresDelFiltro, SOLO_LOCALES } from './proveedorLocal.js';

const provs = [{ id: 1, esLocal: true }, { id: 2, esLocal: false }, { id: 3, esLocal: true }, { id: 4 }];

test('sin elegir: no filtra', () => {
  assert.equal(proveedoresDelFiltro('', provs), null);
});

test('«Solo proveedores locales»: los marcados, nada más', () => {
  assert.deepEqual([...proveedoresDelFiltro(SOLO_LOCALES, provs)], [1, 3]);
  assert.equal(proveedoresDelFiltro(SOLO_LOCALES, []).size, 0);
});

test('un proveedor elegido: ese solo (el valor del select llega como texto)', () => {
  assert.deepEqual([...proveedoresDelFiltro('2', provs)], [2]);
});
