import test from 'node:test';
import assert from 'node:assert/strict';
import { cargaDelRenglon } from './renglonPapel.js';

test('Bracema: 1 bulto de 45 con precio por unidad entra como 1 bulto de 45 (no 45 de 45)', () => {
  const r = cargaDelRenglon({ cantidad: 45, costoPapel: 1426.14, bultosPapel: 1 }, { porBulto: 45, costoFormato: 0 });
  assert.deepEqual(r, { bultos: 1, porBulto: 45, costoBulto: 64176.3, modo: 'bulto', porUnidad: true });
});

test('sin columna de bultos, el precio parecido al costo por unidad del formato también convierte', () => {
  const r = cargaDelRenglon({ cantidad: 24, costoPapel: 1961.57 }, { porBulto: 24, costoFormato: 24 * 1800 });
  assert.equal(r.bultos, 1);
  assert.equal(r.costoBulto, +(1961.57 * 24).toFixed(4));
});

test('precio por bulto (parecido al costo del bulto) queda como siempre', () => {
  const r = cargaDelRenglon({ cantidad: 2, costoPapel: 12000 }, { porBulto: 12, costoFormato: 11500 });
  assert.deepEqual(r, { bultos: 2, porBulto: 12, costoBulto: 12000, modo: 'bulto', porUnidad: false });
});

test('unidades que no completan bultos: modo unidad, a precio por unidad', () => {
  const r = cargaDelRenglon({ cantidad: 30, costoPapel: 1426.14, bultosPapel: 1 }, { porBulto: 45 });
  assert.deepEqual(r, { bultos: 30, porBulto: 45, costoBulto: 1426.14, modo: 'unidad', porUnidad: true });
});

test('formato de 1, sin precio o sin cantidad: como siempre', () => {
  assert.equal(cargaDelRenglon({ cantidad: 10, costoPapel: 1448.8, bultosPapel: 0 }, { porBulto: 1 }).porUnidad, false);
  assert.equal(cargaDelRenglon({ cantidad: 10, costoPapel: 0, bultosPapel: 1 }, { porBulto: 45 }).porUnidad, false);
  assert.equal(cargaDelRenglon({ cantidad: 0, costoPapel: 100, bultosPapel: 1 }, { porBulto: 45 }).porUnidad, false);
});

test('bulto chico (2): sin columna de bultos no se adivina por el precio', () => {
  assert.equal(cargaDelRenglon({ cantidad: 4, costoPapel: 500 }, { porBulto: 2, costoFormato: 1000 }).porUnidad, false);
});
