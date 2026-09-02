/**
 * Tests de las utilidades puras de Ventas. Corren con el runner nativo de
 * Node (`npm test`): sin React, sin navegador, sin dependencias nuevas.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { direccionOrden, esNotaCredito, norm, telefonoWa } from './constants.js';

test('telefonoWa: arma el número de WhatsApp o devuelve vacío', () => {
  assert.equal(telefonoWa('370 4123456'), '5493704123456');
  assert.equal(telefonoWa('0370 15 4123456'), '5493704123456', 'con 0 y 15');
  assert.equal(telefonoWa('+54 9 370 4123456'), '5493704123456', 'ya internacional');
  assert.equal(telefonoWa('4123456'), '', 'sin área: link roto, mejor nada');
  assert.equal(telefonoWa(''), '');
  assert.equal(telefonoWa(null), '');
});

test('direccionOrden: calle, localidad y referencia del pedido web', () => {
  assert.equal(direccionOrden({ webCliente: { direccion: 'Av. 25 de Mayo 1234', localidad: 'Formosa' } }), 'Av. 25 de Mayo 1234, Formosa');
  assert.equal(
    direccionOrden({ webCliente: { direccion: 'Calle 5 nº 20', localidad: 'B° San Martín', referencia: 'portón verde' } }),
    'Calle 5 nº 20, B° San Martín (portón verde)',
  );
  assert.equal(direccionOrden({ webCliente: { direccion: '  Sola  ' } }), 'Sola', 'sin localidad igual sirve');
  assert.equal(direccionOrden({ webCliente: { nombre: 'Ana', dni: '1' } }), '', 'orden vieja o retiro: vacío');
  assert.equal(direccionOrden({}), '');
  assert.equal(direccionOrden(null), '');
});

test('norm: sin acentos ni mayúsculas', () => {
  assert.equal(norm('Azúcar Orgánica'), 'azucar organica');
  assert.equal(norm('ÑANDÚ'), 'nandu');
});

test('esNotaCredito: por el prefijo del tipo', () => {
  assert.equal(esNotaCredito('nota_credito_a'), true);
  assert.equal(esNotaCredito('ticket'), false);
  assert.equal(esNotaCredito(undefined), false);
});
