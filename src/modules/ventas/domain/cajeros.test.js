import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cerroOtro, textoCajeros } from './cajeros.js';

const nombres = { 11: 'Cristian', 15: 'Daniela' };
const nombreDe = (id) => nombres[id] ?? '';

test('mismo que abrió y cerró: un solo nombre', () => {
  assert.equal(textoCajeros({ usuarioId: 11, cerradoPor: 11 }, nombreDe), 'Cristian');
  assert.equal(cerroOtro({ usuarioId: 11, cerradoPor: 11 }), null);
});

test('abrió uno y cerró otro: los dos', () => {
  assert.equal(textoCajeros({ usuarioId: 11, cerradoPor: 15 }, nombreDe), 'Cristian (abrió) · Daniela (cerró)');
  assert.equal(cerroOtro({ usuarioId: 11, cerradoPor: 15 }), 15);
});

test('turno abierto o viejo sin quién cerró: el que abrió', () => {
  assert.equal(textoCajeros({ usuarioId: 11, cerradoPor: null }, nombreDe), 'Cristian');
  assert.equal(textoCajeros({ usuarioId: null }, nombreDe), '—');
});
