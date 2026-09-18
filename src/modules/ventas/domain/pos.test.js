/**
 * La aritmética del ticket del POS: lo que la cajera ve y lo que se cobra.
 * Mismo criterio que el backend — por eso vale la pena fijarlo con números.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buscarEnCatalogo, calcularRenglon, totalesTicket } from './pos.js';

test('calcularRenglon: bruto → descuento % → oferta (importe) → IVA', () => {
  const c = calcularRenglon({ cantidad: 3, precioUnitario: 1000, descuento: 10, ofertaDescuento: 200, iva: 21 });
  assert.equal(c.bruto, 3000);
  assert.equal(c.oferta, 200);
  assert.equal(c.neto, 2500, '3000 − 10% = 2700, − 200 de oferta');
  assert.equal(c.iva, 525, '21% sobre lo que se cobra');
  assert.equal(c.total, 3025);
});

test('calcularRenglon: la oferta nunca deja el renglón en negativo', () => {
  const c = calcularRenglon({ cantidad: 1, precioUnitario: 100, descuento: 0, ofertaDescuento: 500, iva: 21 });
  assert.equal(c.oferta, 100, 'se topea en el neto');
  assert.equal(c.neto, 0);
  assert.equal(c.total, 0);
});

test('calcularRenglon: datos sucios cuentan como 0', () => {
  const c = calcularRenglon({ cantidad: 'x', precioUnitario: null, iva: undefined });
  assert.deepEqual(c, { bruto: 0, oferta: 0, neto: 0, iva: 0, total: 0 });
});

test('totalesTicket: suma renglones y extras con su propia alícuota', () => {
  const t = totalesTicket(
    [
      { cantidad: 2, precioUnitario: 1000, descuento: 0, iva: 21 },
      { cantidad: 1, precioUnitario: 500, descuento: 20, ofertaDescuento: 50, iva: 10.5 },
    ],
    [{ importe: 300, iva: 21 }],
  );
  assert.equal(t.bruto, 2500);
  assert.equal(t.descuento, 150, '100 del 20% + 50 de la oferta');
  assert.equal(t.ahorro, 50, 'solo lo que ahorraron las ofertas');
  assert.equal(t.extras, 300);
  assert.equal(t.neto, 2650, '2000 + 350 + 300 de envío');
  assert.equal(t.iva, 519.75, '420 + 36,75 + 63');
  assert.equal(t.total, 3169.75);
  assert.equal(t.renglones, 2);
  assert.equal(t.unidades, 3);
});

test('totalesTicket: vacío es todo cero', () => {
  const t = totalesTicket([]);
  assert.equal(t.total, 0);
  assert.equal(t.renglones, 0);
});

/* ==================================================================== *
 * El bulto en el buscador (18/9/2026)
 * ==================================================================== */

/** Gaseosa que se vende suelta y en caja de 12 (Mayorista), con su EAN propio. */
const CATALOGO = [
  {
    key: 'p1', nombre: 'Gaseosa Cola 2,25 L', marca: 'Cola', detalle: 'Unidad', unidad: 'u',
    codigoBarras: '7790001', stock: 30, precio: 1000, precioFinal: 1210,
    precios: [
      { listaId: 1, precio: 1000, precioFinal: 1210, unidades: 1, unidadesMinimas: 0 },
      { listaId: 2, precio: 800, precioFinal: 968, unidades: 12, unidadesMinimas: 12 },
    ],
    formatosVenta: [{ listaId: 2, codigoBarras: '17790001', unidades: 12, precioFormato: 11616 }],
  },
  {
    key: 'p2', nombre: 'Yerba Suelta', marca: 'Nativa', detalle: 'Unidad', unidad: 'u',
    codigoBarras: '7790002', stock: 5, precio: 500, precioFinal: 605,
    precios: [{ listaId: 1, precio: 500, precioFinal: 605, unidades: 1, unidadesMinimas: 0 }],
    formatosVenta: [],
  },
];

test('buscarEnCatalogo: buscando por nombre, el bulto aparece como su propia opción', () => {
  const r = buscarEnCatalogo(CATALOGO, 'gaseosa');
  assert.equal(r.length, 2, 'la unidad y la caja de 12');
  assert.equal(r[0]._escaneoUnidades, undefined, 'primero la unidad: es la venta de todos los días');
  assert.equal(r[1]._escaneoUnidades, 12);
  assert.equal(r[1]._escaneoListaId, 2, 'llevarse la caja ES elegir el precio mayorista');
  assert.equal(r[1]._bulto.precioFormato, 11616, 'el precio del bulto cerrado, exacto');
});

test('buscarEnCatalogo: el bulto conserva la clave del ticket y cambia la de la lista', () => {
  const [unidad, caja] = buscarEnCatalogo(CATALOGO, 'gaseosa');
  assert.equal(caja.key, unidad.key, 'mismo artículo: 12 sueltas + 1 caja suman en UN renglón');
  assert.notEqual(caja._uiKey, unidad._uiKey, 'pero React tiene que poder distinguirlas');
});

test('buscarEnCatalogo: un artículo sin bultos sigue dando una sola fila', () => {
  const r = buscarEnCatalogo(CATALOGO, 'yerba');
  assert.equal(r.length, 1);
  assert.equal(r[0]._bulto, undefined);
});

test('buscarEnCatalogo: escanear NO abre los bultos (tiene que resolver en uno solo)', () => {
  const porEan = buscarEnCatalogo(CATALOGO, '7790001');
  assert.equal(porEan.length, 1, 'el código del artículo agrega el artículo, sin ofrecer nada más');
  assert.equal(porEan[0]._escaneoUnidades, undefined);

  const porEanCaja = buscarEnCatalogo(CATALOGO, '17790001');
  assert.equal(porEanCaja.length, 1, 'y el de la caja sigue cargando las 12 de una');
  assert.equal(porEanCaja[0]._escaneoUnidades, 12);
  assert.equal(porEanCaja[0]._escaneoListaId, 2);
  assert.deepEqual(
    porEanCaja[0]._bulto, { unidades: 12, precioFormato: 11616 },
    'y AHORA la fila se muestra como bulto: escaneaba una caja y leia "Unidad $1.210"',
  );
});

test('buscarEnCatalogo: el límite se mide en ARTÍCULOS, no en filas', () => {
  const muchos = Array.from({ length: 5 }, (_, n) => ({
    ...CATALOGO[0], key: `p${n + 10}`, nombre: `Gaseosa ${n}`,
  }));
  const r = buscarEnCatalogo(muchos, 'gaseosa', 3);
  assert.equal(new Set(r.map((x) => x.key)).size, 3, 'tres artículos distintos');
  assert.equal(r.length, 6, 'cada uno con su unidad y su caja');
});
