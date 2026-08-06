/**
 * VOCABULARIO DEL CIRCUITO DE VENTA
 * ============================================================================
 * Espejo exacto de los enums del backend (`crm-api/src/db/schema.ts`). Si allá
 * se agrega un valor, se agrega acá: son las dos puntas del mismo contrato.
 *
 * `pill`/`tag` son claves de clase del CSS del módulo — se resuelven con
 * `styles[key]` (ver components/ui.jsx).
 */

/**
 * Condición frente al IVA. Es el campo más importante del cliente: junto con la
 * condición propia de la empresa define la LETRA del comprobante a emitir.
 */
export const CONDICIONES_IVA = {
  responsable_inscripto: { label: 'Responsable Inscripto', corto: 'RI' },
  monotributo: { label: 'Monotributo', corto: 'MT' },
  consumidor_final: { label: 'Consumidor Final', corto: 'CF' },
  exento: { label: 'Exento', corto: 'EX' },
  no_categorizado: { label: 'No categorizado', corto: '—' },
};

/** `largo` 0 = sin validación de longitud. */
export const TIPOS_DOC = {
  cuit: { label: 'CUIT', largo: 11 },
  cuil: { label: 'CUIL', largo: 11 },
  dni: { label: 'DNI', largo: 0 },
  sin_identificar: { label: 'Sin identificar', largo: 0 },
};

export const MEDIOS_PAGO = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta_debito: 'Tarjeta de débito',
  tarjeta_credito: 'Tarjeta de crédito',
  cheque: 'Cheque',
  qr: 'QR / billetera',
  otro: 'Otro',
};

export const TIPOS_VENTA = {
  ticket: { label: 'Ticket', tag: 'tag-venta' },
  factura_a: { label: 'Factura A', tag: 'tag-ingreso' },
  factura_b: { label: 'Factura B', tag: 'tag-ingreso' },
  factura_c: { label: 'Factura C', tag: 'tag-ingreso' },
  nota_credito: { label: 'Nota de crédito', tag: 'tag-baja' },
  nota_debito: { label: 'Nota de débito', tag: 'tag-transf' },
};

export const ESTADOS_VENTA = {
  borrador: { label: 'Borrador', pill: 'est-pendiente' },
  confirmada: { label: 'Confirmada', pill: 'est-recibida' },
  anulada: { label: 'Anulada', pill: 'est-cancelada' },
  pendiente_cae: { label: 'Pendiente CAE', pill: 'est-revision' },
};

export const ESTADOS_COBRANZA = {
  confirmada: { label: 'Confirmada', pill: 'est-recibida' },
  anulada: { label: 'Anulada', pill: 'est-cancelada' },
};

export const CONDICIONES_PAGO = { contado: 'Contado', cuenta_corriente: 'Cuenta corriente' };

/** Opciones de redondeo de efectivo (para plazas sin monedas chicas). */
export const OPCIONES_REDONDEO = [
  { valor: 0, label: 'Sin redondeo' },
  { valor: 10, label: 'A $10' },
  { valor: 50, label: 'A $50' },
  { valor: 100, label: 'A $100' },
];

/**
 * Redondeo del precio de góndola. Incluye "al entero" —el caso habitual— que no
 * tiene sentido para el vuelto en efectivo, por eso es una lista aparte.
 */
export const OPCIONES_REDONDEO_PRECIO = [
  { valor: 0, label: 'Sin redondeo (con centavos)' },
  { valor: 1, label: 'Al entero ($1)' },
  { valor: 10, label: 'A $10' },
  { valor: 50, label: 'A $50' },
  { valor: 100, label: 'A $100' },
];

/**
 * Mecánicas de oferta. `campos` es lo que el formulario muestra para cada una
 * (espejo de la validación del backend: la respuesta a "qué usa este tipo" es
 * un dato, no dos ifs en dos lados). `alcance` = necesita elegir a qué
 * artículos les toca.
 */
export const TIPOS_OFERTA = {
  porcentaje: {
    label: 'Descuento %', campos: ['porcentaje'], alcance: true,
    ayuda: 'Un porcentaje directo sobre los artículos del alcance.',
  },
  precio_fijo: {
    label: 'Precio de oferta', campos: ['precio'], alcance: true,
    ayuda: 'El artículo pasa a valer este precio (final, con IVA). Si es más caro que el actual, no se aplica.',
  },
  nxm: {
    label: 'Llevá N, pagá M (3×2)', campos: ['lleva', 'paga'], alcance: true,
    ayuda: 'Cada N unidades del mismo artículo, se cobran M. Se aplica sola: se mide en cantidades.',
  },
  segunda_unidad: {
    label: '2ª unidad con descuento', campos: ['porcentaje'], alcance: true,
    ayuda: 'Cada par del mismo artículo, la segunda unidad lleva este descuento.',
  },
  pack: {
    label: 'Pack: N por $X', campos: ['lleva', 'precio'], alcance: true,
    ayuda: 'N unidades del mismo artículo a un precio de conjunto (final, con IVA).',
  },
  combo: {
    label: 'Combo de productos', campos: ['precio'], alcance: false,
    ayuda: 'Productos DISTINTOS que juntos valen un precio de conjunto. Las unidades del combo no cuentan para otras promos.',
  },
  ticket: {
    label: '% al total del ticket', campos: ['porcentaje', 'montoMinimo'], alcance: false,
    ayuda: 'Desde un monto de compra, un % a todo el ticket. Se SUGIERE en la caja (nunca sola) y puede exigir medio de pago.',
  },
};

/** Texto comparable: sin mayúsculas ni acentos. Para los buscadores de los paneles. */
export function norm(v) {
  return (v || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

/** Nº de comprobante con el formato de plaza: 0001-00000123. */
export function nroComprobante(doc) {
  if (!doc) return '—';
  return `${doc.puntoVenta || '0001'}-${String(doc.numero ?? 0).padStart(8, '0')}`;
}

/**
 * Teléfono en formato wa.me: `549` + área + abonado, sin símbolos.
 *
 * Contempla lo que la gente escribe de verdad: con o sin `+54`, con el `0` de
 * larga distancia y con el viejo `15` del celular (0370 15 4621563). Ningún
 * código de área argentino empieza con 9, así que un 9 adelante solo puede ser
 * el de celular — se saca para no duplicarlo al rearmar.
 *
 * Devuelve '' si no llega a un número argentino completo (área + abonado = 10
 * dígitos): mejor sin link que con un link que abre un chat inexistente.
 */
export function telefonoWa(tel) {
  let d = String(tel ?? '').replace(/\D/g, '');
  if (d.startsWith('54')) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  if (d.startsWith('9')) d = d.slice(1);
  d = d.replace(/^(\d{2,4})15(\d{6,8})$/, '$1$2');
  return d.length === 10 ? `549${d}` : '';
}

/** Documento legible: "CUIT 30-71234567-8". Vacío → guion. */
export function docLegible(cliente) {
  if (!cliente?.numeroDoc) return '—';
  const t = TIPOS_DOC[cliente.tipoDoc]?.label || '';
  const n = cliente.numeroDoc;
  const fmt = n.length === 11 ? `${n.slice(0, 2)}-${n.slice(2, 10)}-${n.slice(10)}` : n;
  return `${t} ${fmt}`.trim();
}

/**
 * Por qué un renglón terminó con la lista que tiene. Es lo que hace explicable
 * el precio: el cajero ve el motivo sin tener que preguntar.
 *
 * `auto` marca la distinción que sostiene todo el motor: los orígenes que se
 * miden sobre CANTIDADES son estables (12 unidades siguen siendo 12 aunque
 * cambie el precio) y por eso se aplican solos. El de MONTO se mide sobre
 * precios, y como aplicar el beneficio baja el total, auto-aplicarlo podría
 * dejar el ticket por debajo del umbral y revertirse en un ciclo — por eso se
 * sugiere y se aplica con un clic.
 */
export const ORIGEN_LISTA = {
  base: {
    label: 'Mostrador', corto: 'Piso', auto: true, pill: 'est-pendiente',
    ayuda: 'El precio de siempre: no se habilitó ninguna otra lista.',
  },
  cliente: {
    label: 'Lista del cliente', corto: 'Cliente', auto: true, pill: 'est-recibida',
    ayuda: 'El cliente tiene esta lista asignada. No hay nada que cumplir.',
  },
  auto: {
    label: 'Por cantidad del producto', corto: 'Cantidad', auto: true, pill: 'est-recibida',
    ayuda: 'El ticket llegó al mínimo de unidades que ese producto pide para esta lista.',
  },
  marca: {
    label: 'Por regla de marca', corto: 'Marca', auto: true, pill: 'est-recibida',
    ayuda: 'Se juntaron las unidades que pide la regla de esa marca y quedó abierta la modalidad entera.',
  },
  monto: {
    label: 'Por monto de compra', corto: 'Monto', auto: false, pill: 'est-revision',
    ayuda: 'El ticket superó el umbral configurado. Se aplica con un clic y puede exigir un medio de pago.',
  },
  manual: {
    label: 'Elegida a mano', corto: 'Manual', auto: false, pill: 'est-revision',
    ayuda: 'La eligió una persona. El automático no se la pisa.',
  },
};
