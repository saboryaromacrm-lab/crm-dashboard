import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emparejarPercepciones, tipoDe, tipoSegunNombre } from './percepciones.js';

// El caso real (21/11/2026): La Serenísima, factura A 6683-1612.
const ivaCf = { nombre: 'PERCEPCION IVA CF', alicuota: 3, importe: 9764.24 };
const iibbFsa = { nombre: 'PER IIBB FORMOSA', alicuota: 3, importe: 12951.34 };
const fichaIva = { nombre: 'Perc. IVA RG 5329', alicuota: 3, tipo: '' };

test('de qué impuesto es: por la marca o por el nombre', () => {
  assert.equal(tipoSegunNombre('PERCEPCION IVA CF'), 'iva');
  assert.equal(tipoSegunNombre('PER IIBB FORMOSA'), 'iibb');
  assert.equal(tipoSegunNombre('Percepción 3%'), 'otro');
  assert.equal(tipoDe({ nombre: 'Percepción 3%', tipo: 'iibb' }), 'iibb', 'la marca manda');
});

test('dos del 3 %: la de IVA de la ficha toma la de IVA del papel, venga primera o segunda', () => {
  for (const papel of [[ivaCf, iibbFsa], [iibbFsa, ivaCf]]) {
    const { pares, sueltas } = emparejarPercepciones([fichaIva], papel);
    assert.equal(pares.get(0), ivaCf);
    assert.deepEqual(sueltas, [iibbFsa], 'la de IIBB queda suelta: el proveedor no la tiene en la ficha');
  }
});

test('con las dos en la ficha, cada una con la suya', () => {
  const fichaIibb = { nombre: 'Percepción IIBB Formosa', alicuota: 3, tipo: 'iibb' };
  const { pares, sueltas } = emparejarPercepciones([fichaIibb, fichaIva], [ivaCf, iibbFsa]);
  assert.equal(pares.get(0), iibbFsa);
  assert.equal(pares.get(1), ivaCf);
  assert.deepEqual(sueltas, []);
});

test('el nombre manda y cada una del papel se usa una sola vez', () => {
  const a = { nombre: 'Perc IIBB Corrientes', alicuota: 2, importe: 100 };
  const b = { nombre: 'Perc IIBB Formosa', alicuota: 2, importe: 200 };
  const ficha = [{ nombre: 'IIBB Formosa', alicuota: 2, tipo: 'iibb' }, { nombre: 'IIBB Corrientes', alicuota: 2, tipo: 'iibb' }];
  const { pares } = emparejarPercepciones(ficha, [a, b]);
  assert.equal(pares.get(0), b);
  assert.equal(pares.get(1), a);
});

test('en la duda no adivina: dos de IIBB del mismo % y la ficha con un nombre que no coincide', () => {
  const a = { nombre: 'Perc IIBB Corrientes', alicuota: 2, importe: 100 };
  const b = { nombre: 'Perc IIBB Formosa', alicuota: 2, importe: 200 };
  const { pares, sueltas } = emparejarPercepciones([{ nombre: 'Ingresos brutos', alicuota: 2, tipo: '' }], [a, b]);
  assert.equal(pares.size, 0);
  assert.equal(sueltas.length, 2);
});

test('una de la ficha sin impuesto reconocible se empareja por su alícuota, si es la única', () => {
  const ficha = [{ nombre: 'Percepción', alicuota: 1.5, tipo: '' }];
  const otra = { nombre: 'Percep. municipal', alicuota: 1.5, importe: 50 };
  assert.equal(emparejarPercepciones(ficha, [otra, ivaCf]).pares.get(0), otra);
  assert.equal(emparejarPercepciones(ficha, [otra, { ...otra, nombre: 'Otra 1,5' }]).pares.size, 0, 'dos con la misma alícuota: no');
});

test('sin papel o sin ficha no rompe', () => {
  assert.deepEqual(emparejarPercepciones([fichaIva], undefined).sueltas, []);
  assert.deepEqual(emparejarPercepciones(undefined, [ivaCf]).sueltas, [ivaCf]);
});
