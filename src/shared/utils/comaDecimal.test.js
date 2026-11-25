import { test } from 'node:test';
import assert from 'node:assert/strict';
import { numeroPegado } from './comaDecimal.js';

test('lo pegado con coma decimal entra como número con punto', () => {
  assert.equal(numeroPegado('12321,60'), '12321.60');
  assert.equal(numeroPegado('12.321,60'), '12321.60');
  assert.equal(numeroPegado('$ 1.234.567,8'), '1234567.8');
  assert.equal(numeroPegado('-0,5'), '-0.5');
});

test('sin coma, o si no es un número, lo resuelve el navegador', () => {
  assert.equal(numeroPegado('12321.60'), null);
  assert.equal(numeroPegado('18'), null);
  assert.equal(numeroPegado('1,2,3'), null);
  assert.equal(numeroPegado('abc,5'), null);
  assert.equal(numeroPegado(''), null);
});
