import test from 'node:test';
import assert from 'node:assert/strict';
import { imagenesPegadas } from './pegarFactura.js';

const ahora = new Date(2026, 10, 24, 9, 5, 7);
const archivo = (nombre, type) => new File(['x'], nombre, { type });

test('una captura pegada entra con nombre de fecha y hora', () => {
  const [f] = imagenesPegadas({ files: [archivo('image.png', 'image/png')] }, ahora);
  assert.equal(f.name, 'pegada-20261124-090507.png');
  assert.equal(f.type, 'image/png');
});

test('varias a la vez se numeran; el JPEG queda .jpg', () => {
  const fs = imagenesPegadas({ files: [archivo('a', 'image/jpeg'), archivo('b', 'image/webp')] }, ahora);
  assert.deepEqual(fs.map((f) => f.name), ['pegada-20261124-090507-1.jpg', 'pegada-20261124-090507-2.webp']);
});

test('texto pegado o un tipo que no se lee: nada', () => {
  assert.deepEqual(imagenesPegadas({ files: [] }, ahora), []);
  assert.deepEqual(imagenesPegadas({ files: [archivo('x.gif', 'image/gif')] }, ahora), []);
  assert.deepEqual(imagenesPegadas(null, ahora), []);
});
