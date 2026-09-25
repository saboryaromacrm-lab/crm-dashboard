/**
 * La aritmética del ticket del POS: lo que la cajera ve y lo que se cobra.
 * Mismo criterio que el backend — por eso vale la pena fijarlo con números.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buscarEnCatalogo, bultoAbajo, bultoArriba, bultoDeFila, calcularRenglon, desgloseBulto,
  empujonMayorista, porBulto, textoBulto, totalesTicket,
  unidadesDeLista, ticketDesdeBorrador, ticketReducer, ticketInicial,
} from './pos.js';

test('cantidad: lo que se vende por unidad va entero; el granel suelto admite decimales', () => {
  const base = { precioUnitario: 100, precioLista: 100, descuento: 0, ofertaDescuento: 0, iva: 21 };
  let t = {
    ...ticketInicial,
    renglones: [
      { ...base, uid: 1, key: 'p1', productoId: 1, fraccionable: false, cantidad: 1 },
      { ...base, uid: 2, key: 'p2', productoId: 2, fraccionable: true, cantidad: 1 },
    ],
  };
  t = ticketReducer(t, { tipo: 'cantidad', uid: 1, valor: '2.7' });
  t = ticketReducer(t, { tipo: 'cantidad', uid: 2, valor: '2.7' });
  assert.equal(t.renglones.find((r) => r.uid === 1).cantidad, 2, 'por unidad: se descarta el decimal');
  assert.equal(t.renglones.find((r) => r.uid === 2).cantidad, 2.7, 'granel suelto: se respeta');
});

test('ticketDesdeBorrador: un recargo de cuotas que quedó de un cobro fallido no se levanta como cargo', () => {
  const t = ticketDesdeBorrador({
    items: [],
    extras: [
      { concepto: 'Envío', importe: 1000, iva: 21 },
      { concepto: 'Recargo 3 cuotas (20%)', importe: 111.74, iva: 21 },
      { concepto: 'Recargo 1 cuota (10%)', importe: 50, iva: 21 },
    ],
  }, []);
  assert.deepEqual(t.extras.map((e) => e.concepto), ['Envío']);
});

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

test('buscarEnCatalogo: por nombre sale UNA fila por producto, sin sus listas', () => {
  const r = buscarEnCatalogo(CATALOGO, 'gaseosa');
  assert.equal(r.length, 1, 'el mismo artículo repetido por lista tapa a los demás productos');
  assert.equal(r[0].key, 'p1');
  assert.equal(r[0]._bulto, undefined, 'el precio se elige después, en el renglón del ticket');
});

test('buscarEnCatalogo: dos productos distintos siguen siendo dos filas', () => {
  const r = buscarEnCatalogo(CATALOGO, 'a');
  assert.deepEqual(r.map((x) => x.key), ['p1', 'p2']);
});

test('buscarEnCatalogo: escanear el EAN del artículo lo agrega suelto', () => {
  const r = buscarEnCatalogo(CATALOGO, '7790001');
  assert.equal(r.length, 1);
  assert.equal(r[0]._escaneoUnidades, undefined, 'una botella es una botella');
});

test('buscarEnCatalogo: escanear el EAN de la CAJA carga las 12 y lo dice', () => {
  const r = buscarEnCatalogo(CATALOGO, '17790001');
  assert.equal(r.length, 1, 'un escaneo resuelve en un solo resultado');
  assert.equal(r[0]._escaneoUnidades, 12);
  assert.equal(r[0]._escaneoListaId, 2, 'llevarse la caja ES elegir el precio mayorista');
  assert.deepEqual(
    r[0]._bulto, { unidades: 12, precioFormato: 11616 },
    'antes la fila decía "Unidad $1.210" mientras cargaba 12 al precio mayorista',
  );
});

test('buscarEnCatalogo: el límite cuenta productos', () => {
  const muchos = Array.from({ length: 5 }, (_, n) => ({
    ...CATALOGO[0], key: `p${n + 10}`, nombre: `Gaseosa ${n}`,
  }));
  assert.equal(buscarEnCatalogo(muchos, 'gaseosa', 3).length, 3);
});

/* ==================================================================== *
 * "Vende por 12" también vale en la caja (18/9/2026)
 * ==================================================================== */

test('porBulto: elegir una lista de a 12 nunca deja media caja', () => {
  assert.equal(porBulto(1, 12), 12, 'una sola al precio de la caja es regalar la diferencia');
  assert.equal(porBulto(0, 12), 12);
  assert.equal(porBulto(12, 12), 12, 'lo que ya es un bulto justo no se toca');
  assert.equal(porBulto(24, 12), 24);
  assert.equal(porBulto(15, 12), 24, 'sube al múltiplo de arriba: 15 no es una cantidad que sepa vender');
  assert.equal(porBulto(13, 12), 24);
});

test('porBulto: una lista que vende suelto no toca la cantidad', () => {
  assert.equal(porBulto(5, 1), 5);
  assert.equal(porBulto(5, 0), 5, 'dato sucio = suelto');
  assert.equal(porBulto(0.5, 1), 0.5, 'el granel conserva sus decimales');
});

test('unidadesDeLista: saca el "vende por" de la lista puesta', () => {
  const precios = [
    { listaId: 1, precio: 1500, unidades: 1 },
    { listaId: 2, precio: 800, unidades: 12 },
  ];
  assert.equal(unidadesDeLista(precios, 2), 12);
  assert.equal(unidadesDeLista(precios, 1), 1);
  assert.equal(unidadesDeLista(precios, 99), 1, 'lista que el artículo no tiene: suelto');
  assert.equal(unidadesDeLista(undefined, 2), 1, 'sin formato cargado: suelto');
});

/* ==================================================================== *
 * El empujón al mayorista (18/9/2026)
 * ==================================================================== */

const CAT = { montoMayorista: { monto: 100000, modalidadId: 2, modalidad: 'Mayorista' } };

test('empujonMayorista: aparece pasada la mitad y dice cuánto falta', () => {
  const e = empujonMayorista(60000, CAT);
  assert.equal(e.falta, 40000);
  assert.equal(e.modalidad, 'Mayorista');
  assert.equal(e.avance, 0.6);
});

test('empujonMayorista: callado antes de la mitad', () => {
  assert.equal(empujonMayorista(49999, CAT), null, '"te falta el 80%" no empuja a nadie');
  assert.notEqual(empujonMayorista(50000, CAT), null, 'justo en la mitad ya habla');
});

test('empujonMayorista: callado al llegar — ahí manda la sugerencia', () => {
  assert.equal(empujonMayorista(100000, CAT), null);
  assert.equal(empujonMayorista(150000, CAT), null);
});

test('empujonMayorista: sin umbral configurado no molesta', () => {
  assert.equal(empujonMayorista(60000, { montoMayorista: null }), null);
  assert.equal(empujonMayorista(60000, {}), null);
  assert.equal(empujonMayorista(60000, undefined), null);
  assert.equal(empujonMayorista(60000, { montoMayorista: { monto: 0 } }), null);
});

test('empujonMayorista: el ticket vacío no muestra nada', () => {
  assert.equal(empujonMayorista(0, CAT), null);
  assert.equal(empujonMayorista(null, CAT), null);
});

/* ==================================================================== *
 * EL BULTO DEL RENGLÓN (21/9/2026)
 * ==================================================================== */

test('el bulto de la lista gana, y es obligatorio', () => {
  const r = { fraccionable: false, unidadesPorBulto: 10 };
  assert.deepEqual(bultoDeFila(r, 16), { unidades: 16, exigido: true });
});

test('sin bulto de lista manda el de la ficha, y NO es obligatorio', () => {
  // Mostrador: vender 5 sueltos de una caja de 10 es normal, no se avisa nada.
  assert.deepEqual(bultoDeFila({ fraccionable: false, unidadesPorBulto: 10 }, 1), { unidades: 10, exigido: false });
});

test('sin ninguno de los dos, no hay bulto', () => {
  assert.deepEqual(bultoDeFila({ fraccionable: false, unidadesPorBulto: 1 }, 1), { unidades: 0, exigido: false });
  assert.deepEqual(bultoDeFila({ fraccionable: false }, 1), { unidades: 0, exigido: false });
});

test('el granel no tiene bulto: se vende por kg', () => {
  assert.deepEqual(bultoDeFila({ fraccionable: true, unidadesPorBulto: 10 }, 16), { unidades: 0, exigido: false });
});

test('el desglose parte la cantidad en bultos y sueltos', () => {
  assert.deepEqual(desgloseBulto(32, 16), { bultos: 2, sueltas: 0, exacto: true });
  assert.deepEqual(desgloseBulto(37, 16), { bultos: 2, sueltas: 5, exacto: false });
  assert.deepEqual(desgloseBulto(5, 16), { bultos: 0, sueltas: 5, exacto: false });
  assert.deepEqual(desgloseBulto(16, 16), { bultos: 1, sueltas: 0, exacto: true });
  // Cantidad 0: no es "exacto" — no hay nada cargado todavía.
  assert.deepEqual(desgloseBulto(0, 16), { bultos: 0, sueltas: 0, exacto: false });
  // Sin bulto, todo es suelto.
  assert.deepEqual(desgloseBulto(7, 1), { bultos: 0, sueltas: 7, exacto: false });
});

test('el texto dice la cantidad como la lee el cajero', () => {
  assert.equal(textoBulto(32, 16), '2 × bulto de 16');
  assert.equal(textoBulto(37, 16), '2 bultos + 5 u');
  assert.equal(textoBulto(21, 16), '1 bulto + 5 u');
  assert.equal(textoBulto(5, 16), '5 u · bulto de 16');
  // Miles con punto, como en el resto de la caja.
  assert.equal(textoBulto(16000, 16), '1.000 × bulto de 16');
});

test('el + va al bulto redondo de arriba (el primero da un bulto justo, no 17)', () => {
  assert.equal(bultoArriba(1, 16), 16);
  assert.equal(bultoArriba(16, 16), 32);
  assert.equal(bultoArriba(37, 16), 48);
  assert.equal(bultoArriba(0, 16), 16);
  assert.equal(bultoArriba(5, 1), 5);   // sin bulto no mueve nada
});

test('el − va al bulto redondo de abajo y nunca borra la cantidad', () => {
  assert.equal(bultoAbajo(37, 16), 32);
  assert.equal(bultoAbajo(32, 16), 16);
  assert.equal(bultoAbajo(17, 16), 16);
  // Piso en un bulto: bajar a 0 vaciaría un renglón cargado sin que nadie lo pida.
  assert.equal(bultoAbajo(16, 16), 16);
  assert.equal(bultoAbajo(3, 16), 16);
});
