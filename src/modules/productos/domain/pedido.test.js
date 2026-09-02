import { test } from 'node:test';
import assert from 'node:assert/strict';
import { disponibleTotal, listaDeProducto, puedeMandar } from './pedido.js';

/** Un store de inventario mínimo, con la misma superficie que usan las reglas. */
function storeCon(stock) {
  return {
    state: { stock },
    suma: ({ productoId, sucursalId, estado }) => stock
      .filter((s) => s.productoId === productoId && s.sucursalId === sucursalId && s.estado === estado)
      .reduce((a, s) => a + s.cantidad, 0),
    cant: (productoId, sucursalId, presentacionId, estado) => stock
      .filter((s) => s.productoId === productoId && s.sucursalId === sucursalId
        && s.presentacionId === presentacionId && s.estado === estado)
      .reduce((a, s) => a + s.cantidad, 0),
  };
}

const granel = { id: 1, tipo: 'granel', presentaciones: [{ id: 50, tamKg: 0.5 }] };
const entero = { id: 2, tipo: 'entero' };

test('listaDeProducto: granel se fracciona, el resto va entero', () => {
  assert.equal(listaDeProducto(granel), 'granel');
  assert.equal(listaDeProducto(entero), 'enteros');
  assert.equal(listaDeProducto(null), 'enteros');
});

test('puedeMandar: para granel solo respalda el suelto en kg, no los paquetes armados', () => {
  const store = storeCon([
    { productoId: 1, sucursalId: 1, presentacionId: null, estado: 'disponible', cantidad: 45 },
    { productoId: 1, sucursalId: 1, presentacionId: 50, estado: 'disponible', cantidad: 10 },
    { productoId: 2, sucursalId: 1, presentacionId: null, estado: 'disponible', cantidad: 8 },
    { productoId: 2, sucursalId: 1, presentacionId: null, estado: 'transito', cantidad: 3 },
  ]);
  assert.equal(puedeMandar(store, granel, 1), 45, 'los 10 paquetes son góndola, no viajan');
  assert.equal(puedeMandar(store, entero, 1), 8, 'solo lo disponible, no lo en tránsito');
  assert.equal(puedeMandar(store, entero, null), 0);
  assert.equal(puedeMandar(store, null, 1), 0);
});

test('disponibleTotal: el destino mide en kg equivalentes (suelto + paquetes × tamaño)', () => {
  const store = storeCon([
    { productoId: 1, sucursalId: 2, presentacionId: null, estado: 'disponible', cantidad: 2 },
    { productoId: 1, sucursalId: 2, presentacionId: 50, estado: 'disponible', cantidad: 6 },
    { productoId: 1, sucursalId: 2, presentacionId: 50, estado: 'vencido', cantidad: 4 },
  ]);
  assert.equal(disponibleTotal(store, granel, 2), 5, '2 kg + 6 × 0,5 kg');
  assert.equal(disponibleTotal(store, entero, 2), 0);
});
