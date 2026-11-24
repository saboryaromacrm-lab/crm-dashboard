import test from 'node:test';
import assert from 'node:assert/strict';
import { dudasDelProducto, palabras, pesoDe } from './parecidoPapel.js';

const PROV = ['ANA HERNANDEZ PRODUCTOS ALIMEN SANTA MARIA'];

test('el caso real: Premezcla Verde atada a Gallet Saladitas → no se parece y el peso no coincide', () => {
  assert.deepEqual(
    dudasDelProducto('Premezcla Verde (sin lactosa) x 1000 g', 'Gallet Saladitas Santa Maria x100g', [...PROV, 'Santa Maria']),
    ['el nombre no se parece al del papel', 'el papel dice 1 kg y el producto 100 g'],
  );
});

test('lo que sí es: comparte una palabra (o una abreviatura) y el mismo peso con otra unidad', () => {
  assert.deepEqual(dudasDelProducto('Premezcla Roja x 1000 g', 'Premezcla Univ Santa Maria x1kg', PROV), []);
  assert.deepEqual(dudasDelProducto('GALLETITAS CACAO CHOCOLATE 200 gr', 'Gallet de Chocolate Santa Maria x200g', PROV), []);
  assert.deepEqual(dudasDelProducto('YACAI - HELADO ACAI (6X450G)', 'Helado Acai Yacai 450 grs'), []);
});

test('la marca y el proveedor no cuentan como parecido', () => {
  assert.deepEqual(dudasDelProducto('Santa Maria Premezcla Verde', 'Gallet Saladitas Santa Maria', PROV), ['el nombre no se parece al del papel']);
});

test('sin con qué comparar (sin palabras o sin peso en uno de los dos), no hay duda', () => {
  assert.deepEqual(dudasDelProducto('FLETE', '', []), []);
  assert.deepEqual(dudasDelProducto('Almendras x 10 KG', 'Almendras Non Pareil'), []);
});

test('el peso: kg, g, litros y el «6X450G»', () => {
  assert.deepEqual(pesoDe('x1kg'), { valor: 1000, unidad: 'g' });
  assert.deepEqual(pesoDe('(6X450G)'), { valor: 450, unidad: 'g' });
  assert.deepEqual(pesoDe('Aceite x 1,5 lts'), { valor: 1500, unidad: 'ml' });
  assert.equal(pesoDe('Gallet Saladitas'), null);
  assert.equal(dudasDelProducto('Aceite oliva 500 ml', 'Aceite oliva 1 lt').length, 1);
});

test('las palabras: sin acentos, números ni palabras vacías', () => {
  assert.deepEqual(palabras('Avena Instantánea x 20 kgs'), ['avena', 'instantanea']);
});
