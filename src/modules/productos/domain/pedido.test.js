import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BAJO_STOCK_PEDIDO, disponibleTotal, hayParaMandar, listaDeProducto, pasaStockDestino, puedeMandar, stockFila } from './pedido.js';

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

test('hayParaMandar: con stock para mandar, o sin control de stock; el granel por el suelto', () => {
  const stock = [
    { productoId: 1, sucursalId: 1, presentacionId: 50, estado: 'disponible', cantidad: 10 },
    { productoId: 2, sucursalId: 1, presentacionId: null, estado: 'disponible', cantidad: 3 },
  ];
  const conControl = { ...storeCon(stock), stockLibre: () => false };
  assert.equal(hayParaMandar(conControl, entero, 1), true);
  assert.equal(hayParaMandar(conControl, entero, 2), false, 'en otra sucursal no hay');
  assert.equal(hayParaMandar(conControl, granel, 1), false, 'solo paquetes armados: no hay suelto para mandar');
  const sinControl = { ...storeCon(stock), stockLibre: () => true };
  assert.equal(hayParaMandar(sinControl, entero, 2), true, 'sin control de stock se puede pedir igual');
});

test('stockFila: el entero en unidades, el paquete por su tamaño, el granel sin tamaños en kg', () => {
  const store = storeCon([
    { productoId: 1, sucursalId: 2, presentacionId: null, estado: 'disponible', cantidad: 4 },
    { productoId: 1, sucursalId: 2, presentacionId: 50, estado: 'disponible', cantidad: 2 },
    { productoId: 2, sucursalId: 2, presentacionId: null, estado: 'disponible', cantidad: 7 },
  ]);
  assert.equal(stockFila(store, granel, granel.presentaciones[0], 2), 2, 'los paquetes de 500 g, no los kg del suelto');
  assert.equal(stockFila(store, granel, null, 2), 4);
  assert.equal(stockFila(store, entero, null, 2), 7);
  assert.equal(stockFila(store, entero, null, null), 0);
});

test('pasaStockDestino: sin stock, bajos (menos de 3) o los dos juntos', () => {
  assert.equal(BAJO_STOCK_PEDIDO, 3);
  const f = (stock, o) => pasaStockDestino(stock, o);
  assert.equal(f(5, { sinStock: false, bajos: false }), true, 'sin tildes pasa todo');
  assert.equal(f(0, { sinStock: true, bajos: false }), true);
  assert.equal(f(-1, { sinStock: true, bajos: false }), true, 'el negativo también es sin stock');
  assert.equal(f(2, { sinStock: true, bajos: false }), false);
  assert.equal(f(2, { sinStock: false, bajos: true }), true);
  assert.equal(f(3, { sinStock: false, bajos: true }), false, '3 ya no es bajo');
  assert.equal(f(0, { sinStock: false, bajos: true }), true, 'cero también es bajo');
  assert.equal(f(2, { sinStock: true, bajos: true }), true, 'los dos juntos suman, no se pisan');
});
