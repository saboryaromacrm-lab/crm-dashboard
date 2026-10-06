/* El bulto en los pedidos y envíos (5-6/10/2026). Lo que se prueba es lo que
 * protege el stock: que el renglón guarde SIEMPRE unidades, que medio bulto no
 * pase, y de dónde sale el tamaño del bulto. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BULTO, bultoDe, bultoOfrecible, valorPresentacion, cambioPresentacion, bultosDe, unidadesDeBultos, bultosPartidos, kgBolsa,
} from './bulto.js';

const BRACEMA = { id: 1, tipo: 'entero', unidadesPorBulto: 1, formatosCompra: [{ id: 7, cantidad: 6 }, { id: 9, cantidad: 20, usarParaPrecio: true }] };
const CON_FICHA = { id: 2, tipo: 'entero', unidadesPorBulto: 12, formatosCompra: [{ id: 3, cantidad: 24, usarParaPrecio: true }] };
const SIN_BULTO = { id: 3, tipo: 'entero', unidadesPorBulto: 1, formatosCompra: [{ id: 4, cantidad: 1, usarParaPrecio: true }] };
const GRANEL = { id: 4, tipo: 'granel', unidadesPorBulto: 1, formatosCompra: [{ id: 5, cantidad: 25, usarParaPrecio: true }], presentaciones: [{ id: 50, tamKg: 0.5 }] };
const catalogo = { 1: BRACEMA, 2: CON_FICHA, 3: SIN_BULTO, 4: GRANEL };
const getProducto = (id) => catalogo[id];

test('el tamaño del bulto: la ficha gana; si no, el formato que fija el precio', () => {
  assert.equal(bultoDe(CON_FICHA), 12);
  assert.equal(bultoDe(BRACEMA), 20);
  assert.equal(bultoDe(SIN_BULTO), 0, 'caja x1 no es bulto');
  assert.equal(bultoDe(GRANEL), 0, 'el granel no tiene bulto de unidades');
  assert.equal(kgBolsa(GRANEL), 25, 'el granel tiene bolsa en kg');
});

test('el bulto se ofrece en salidas y pedidos, nunca en una ENTRADA de Coffit', () => {
  assert.equal(bultoOfrecible(BRACEMA), 20);
  assert.equal(bultoOfrecible(BRACEMA, true), 0);
  assert.equal(bultoOfrecible(GRANEL), 0);
  assert.equal(bultoOfrecible(undefined), 0);
});

test('pasar a bulto redondea PARA ARRIBA al bulto entero y guarda UNIDADES', () => {
  assert.deepEqual(cambioPresentacion({ cantidad: '25' }, BULTO, 20), { presId: null, modo: 'bulto', cantidad: '40' });
  assert.deepEqual(cambioPresentacion({ cantidad: '40' }, BULTO, 20), { presId: null, modo: 'bulto', cantidad: '40' });
  assert.deepEqual(cambioPresentacion({ cantidad: '' }, BULTO, 20), { presId: null, modo: 'bulto', cantidad: '' });
  // Volver a unidad NO toca el número: lo pedido, pedido.
  assert.deepEqual(cambioPresentacion({ cantidad: '40', modo: 'bulto' }, '', 20), { presId: null, modo: 'unidad' });
  // Una presentación (paquete de granel) sale del modo bulto.
  assert.deepEqual(cambioPresentacion({ cantidad: '3', modo: 'bulto' }, '50', 20), { presId: 50, modo: 'unidad' });
  // Sin bulto (el producto cambió con el formulario abierto): queda en unidad, nunca un id inválido.
  assert.deepEqual(cambioPresentacion({ cantidad: '5' }, BULTO, 0), { presId: null, modo: 'unidad' });
  assert.deepEqual(cambioPresentacion({ cantidad: '5' }, 'cualquier-cosa', 20), { presId: null, modo: 'unidad' });
});

test('la casilla: se tipean bultos y se guardan unidades (ida y vuelta exacta)', () => {
  assert.equal(unidadesDeBultos('2', 20), '40');
  assert.equal(unidadesDeBultos('', 20), '');
  assert.equal(bultosDe({ cantidad: '40' }, 20), '2');
  assert.equal(bultosDe({ cantidad: '' }, 20), '');
  for (const b of ['1', '3', '7', '15']) assert.equal(bultosDe({ cantidad: unidadesDeBultos(b, 12) }, 12), b);
});

test('lo que muestra el desplegable', () => {
  assert.equal(valorPresentacion({ presId: 50 }), '50');
  assert.equal(valorPresentacion({ presId: null, modo: 'bulto' }, 20), BULTO);
  assert.equal(valorPresentacion({ presId: null, modo: 'bulto' }, 0), '', 'sin bulto ofrecible se lee como unidad');
  assert.equal(valorPresentacion({ presId: null }), '');
});

test('medio bulto no pasa; unidades sueltas en modo unidad sí', () => {
  const items = [
    { prodId: 1, modo: 'bulto', cantidad: '40' }, // 2 bultos: bien
    { prodId: 1, modo: 'bulto', cantidad: '30' }, // 1,5 bultos: mal
    { prodId: 2, modo: 'unidad', cantidad: '5' }, // suelto en unidades: bien
    { prodId: 2, modo: 'bulto', cantidad: '' }, // vacío: no cuenta
  ];
  assert.equal(bultosPartidos(items, getProducto), 1);
  assert.equal(bultosPartidos([{ prodId: 1, modo: 'bulto', cantidad: unidadesDeBultos('1.5', 20) }], getProducto), 1);
  assert.equal(bultosPartidos([{ prodId: 3, modo: 'bulto', cantidad: '7' }], getProducto), 0, 'sin bulto no se mide');
});
