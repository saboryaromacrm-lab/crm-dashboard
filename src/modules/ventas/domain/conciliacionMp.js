/**
 * VENTAS › CONCILIACIÓN MP — lo que la pantalla necesita saber (18/11/2026).
 * La cuenta la hace la API (`crm-api/src/mercadopago/conciliacion*.ts`): acá
 * solo nombres, el color de cada día y el calendario.
 */
import { TIPOS_VENTA, nroComprobante } from './constants.js';

export const FAMILIA = { qr: 'QR', tarjeta: 'Tarjeta (Point)', transferencia: 'Transferencia' };
export const MEDIO_ERP = { qr: 'QR', tarjeta_debito: 'Débito', tarjeta_credito: 'Crédito', transferencia: 'Transferencia' };
export const nombreMedio = (m) => MEDIO_ERP[m] ?? m;

/** ¿Los dos lados son la misma plata (al centavo)? */
export const mismoImporte = (cobro, pago) => Math.abs((cobro?.importe ?? 0) - (pago?.bruto ?? 0)) <= 0.009;

/**
 * «QR → Crédito» si atar este cobro con este pago le cambia el medio a la
 * venta; si no, null. La misma regla que la API: uno con uno, mismo importe,
 * Mercado Pago dice un medio claro (`pago.medioErp`) y distinto, y no es el QR
 * del ERP (referencia «MP n»).
 */
export const cambioDeMedio = (cobro, pago) => (cobro && pago?.medioErp && pago.medioErp !== cobro.medio
  && mismoImporte(cobro, pago) && !String(cobro.referencia ?? '').startsWith('MP ')
  ? `${nombreMedio(cobro.medio)} → ${nombreMedio(pago.medioErp)}` : null);

/** Por qué se sugiere un pago para un cobro (ver `sugerir` en la API). */
export const POR_QUE = {
  varios: 'Hay más de uno posible',
  otro_medio: 'Mismo importe, otro medio',
  monto_distinto: 'Misma hora, otro importe',
};
const TIPO_ATADO = { auto: 'Solo', manual: 'A mano', sin_venta: 'No es venta', sin_mp: 'No entró a MP' };

/*
 * «YA LO CONTROLÉ» (24/11/2026, pedido del dueño): lo que se resolvió por
 * otro lado sale de pendientes con una observación. Es un atado de un solo
 * lado (como «No entró» o «No es venta») cuyo motivo empieza con este prefijo:
 * así se distingue en lo ya atado sin otro tipo en la base.
 */
const CONTROLADO = 'Ya controlado: ';
export const motivoControlado = (observacion) => `${CONTROLADO}${String(observacion ?? '').trim()}`;
/** Cómo se llama un atado en la lista: «Controlado» si se marcó así, si no por su tipo. */
export const nombreAtado = (g) => (String(g?.motivo ?? '').startsWith(CONTROLADO) ? 'Controlado' : TIPO_ATADO[g?.tipo]);
/** Lo que se ofrece para explicar lo que quedó de un solo lado (siempre se puede escribir otra cosa). */
export const MOTIVOS = {
  sin_venta: ['Plata propia / aporte', 'Devolución o reintegro de un proveedor', 'Cobro de algo que no pasa por el ERP', 'Prueba'],
  sin_mp: ['Se cobró en efectivo (se marcó mal el medio)', 'Fue a otra cuenta', 'El cobro no pasó'],
};

/**
 * El color del día: rojo si quedó un cobro sin pago y sin candidato; amarillo
 * si hay algo para confirmar o mirar; verde si cerró. Sin datos, nada.
 */
export function estadoDia(d) {
  if (!d || (!d.vendido && !d.entro)) return 'vacio';
  if (d.faltan > 0.009) return 'falta';
  if (d.sugeridos > 0 || d.sinVenta > 0.009 || d.avisos > 0) return 'revisar';
  return 'ok';
}

const diaIso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** «2026-11» → primer y último día. */
export function rangoMes(mes) {
  const [y, m] = mes.split('-').map(Number);
  return { desde: diaIso(y, m, 1), hasta: diaIso(y, m, new Date(Date.UTC(y, m, 0)).getUTCDate()) };
}

/** «2026-11» y ±n meses. */
export function moverMes(mes, n) {
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Las semanas del mes, de lunes a domingo: cada una 7 días ('YYYY-MM-DD') o null fuera del mes. */
export function semanasDelMes(mes) {
  const [y, m] = mes.split('-').map(Number);
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const corrimiento = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // lunes = 0
  const celdas = [...Array(corrimiento).fill(null), ...Array.from({ length: ultimo }, (_, i) => diaIso(y, m, i + 1))];
  while (celdas.length % 7) celdas.push(null);
  return Array.from({ length: celdas.length / 7 }, (_, i) => celdas.slice(i * 7, i * 7 + 7));
}

/** «Factura B 00030-00000431» o «Recibo 0001-00000012». */
export const comprobanteDe = (c) => `${c.origen === 'recibo' ? 'Recibo' : TIPOS_VENTA[c.tipoDoc]?.label ?? c.tipoDoc} ${nroComprobante(c)}`;

/**
 * Lo de alrededor de un día para atar a mano. Una transferencia llega hasta 3
 * días ANTES de la venta: desde un cobro se mira 3 días atrás y 1 adelante;
 * desde un pago, 1 atrás y 3 adelante (las ventas que vinieron después).
 */
export function alrededor(dia, desdePago = false) {
  const d = new Date(`${dia}T12:00:00Z`);
  const mover = (n) => new Date(d.getTime() + n * 86_400_000).toISOString().slice(0, 10);
  return desdePago ? { desde: mover(-1), hasta: mover(3) } : { desde: mover(-3), hasta: mover(1) };
}

/* ===========================================================================
 * SEGÚN MERCADO PAGO, EN EL DETALLE DE UNA VENTA (19/11/2026, pedido del
 * dueño: «distinguir bien si pagaron por el QR del mostrador o por el QR del
 * posnet»). La API manda, por renglón de pago, `mp` (ver `mp-del-pago.ts`):
 * lo atado en la Conciliación o el cobro con el QR del ERP. Acá se dice en
 * palabras. De dónde vino lo dice Mercado Pago, no la cajera:
 *   · familia 'qr'            → el QR de una caja del mostrador (INSTORE);
 *   · familia 'tarjeta'       → el Point (posnet): con tarjeta, o con el QR
 *                               que muestra el posnet si pagó con billetera;
 *   · familia 'transferencia' → fuera del local (transferencia, link de pago).
 * ======================================================================== */

const MARCAS = {
  visa: 'Visa', debvisa: 'Visa', master: 'Mastercard', debmaster: 'Mastercard', maestro: 'Maestro',
  cabal: 'Cabal', debcabal: 'Cabal', naranja: 'Naranja', amex: 'American Express', argencard: 'Argencard',
  nativa: 'Nativa', cencosud: 'Cencosud', tarshop: 'Tarjeta Shopping', cordobesa: 'Cordobesa', cmr: 'CMR',
};
/** Con qué paga el cliente con billetera (no es una tarjeta física). */
const TIPOS_BILLETERA = ['account_money', 'bank_transfer', 'digital_currency'];

const marca = (m) => MARCAS[m] ?? (m ? m.charAt(0).toUpperCase() + m.slice(1) : '');

/** Con qué pagó el cliente: «dinero en cuenta de Mercado Pago», «crédito Visa en 3 cuotas»… '' si Mercado Pago no lo dijo. */
export function conQuePago(p) {
  switch (p.tipo) {
    case 'account_money': return 'dinero en cuenta de Mercado Pago';
    case 'bank_transfer':
      return p.metodo === 'interop_transfer' ? 'transferencia desde otro banco o billetera'
        : p.metodo === 'cvu' ? 'transferencia al CVU' : 'transferencia';
    case 'digital_currency': return 'cuotas sin tarjeta de Mercado Pago';
    case 'credit_card': return `crédito ${marca(p.metodo)}${p.cuotas > 1 ? ` en ${p.cuotas} cuotas` : ''}`.trim();
    case 'debit_card': return `débito ${marca(p.metodo)}`.trim();
    case 'prepaid_card': return `prepaga ${marca(p.metodo)}`.trim();
    default: return p.tipo || '';
  }
}

/** Dónde se cobró: el QR de qué caja, el posnet (con tarjeta o con su QR), o fuera del local. */
export function dondeSeCobro(p) {
  if (p.familia === 'qr') return `QR del mostrador${p.caja ? ` · ${p.caja}` : ''}`;
  if (p.familia === 'tarjeta') return TIPOS_BILLETERA.includes(p.tipo) ? 'QR del posnet (Point)' : 'Posnet (Point) con tarjeta';
  if (p.familia === 'transferencia') return 'Fuera del local (transferencia o link de pago)';
  return 'Mercado Pago';
}

/** El medio del ERP que corresponde a ese pago; null si no hay uno claro. */
export function medioQueCorresponde(p) {
  if (p.familia === 'qr') return 'qr';
  if (p.familia === 'tarjeta') {
    if (p.tipo === 'credit_card') return 'tarjeta_credito';
    if (p.tipo === 'debit_card' || p.tipo === 'prepaid_card') return 'tarjeta_debito';
    return TIPOS_BILLETERA.includes(p.tipo) ? 'qr' : null;
  }
  if (p.familia === 'transferencia' && (p.tipo === 'account_money' || p.tipo === 'bank_transfer')) return 'transferencia';
  return null;
}

const ESTADO_MP = { refunded: 'Devuelto', charged_back: 'Contracargo', in_mediation: 'En reclamo', cancelled: 'Cancelado', rejected: 'Rechazado' };
const MEDIOS_ELECTRONICOS = ['qr', 'tarjeta_debito', 'tarjeta_credito', 'transferencia'];
const pesos = (n) => n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });

/**
 * Todo lo que el detalle muestra de un renglón de pago según Mercado Pago, o
 * null si no hay nada que decir (efectivo, cheque, o antes de que arrancara la
 * conciliación). `nombreDelMedio` traduce el medio del ERP («QR / billetera»).
 */
export function segunMercadoPago(pago, { fechaVenta, arranque = '2026-11-01', nombreDelMedio = nombreMedio } = {}) {
  const mp = pago?.mp ?? null;
  if (!mp) {
    if (!MEDIOS_ELECTRONICOS.includes(pago?.medio) || !fechaVenta || String(fechaVenta).slice(0, 10) < arranque) return null;
    return { pagos: [], fuente: 'Todavía no está atado a un pago de Mercado Pago (Ventas › Conciliación MP).', avisos: [], sinDato: true };
  }
  if (mp.atado === 'sin_mp') {
    return {
      pagos: [], avisos: [`En la Conciliación MP se marcó que NO entró a Mercado Pago${mp.motivo ? `: ${mp.motivo}` : ''}.`],
      fuente: '', sinDato: false,
    };
  }
  const pagos = (mp.pagos ?? []).map((p) => ({
    id: p.id,
    donde: dondeSeCobro(p),
    como: conQuePago(p),
    operacion: p.id && /^\d+$/.test(p.id) ? p.id : '',
    estado: ESTADO_MP[p.estado] ?? (p.devuelto > 0.009 ? `Devolvió ${pesos(p.devuelto)}` : ''),
    bruto: p.bruto,
  }));
  const avisos = [];
  const distintos = [...new Set((mp.pagos ?? []).map(medioQueCorresponde).filter((m) => m && m !== pago.medio))];
  if (distintos.length) {
    avisos.push(`En el ERP figura «${nombreDelMedio(pago.medio)}», pero Mercado Pago dice ${distintos.map((m) => `«${nombreDelMedio(m)}»`).join(' y ')}.`);
  }
  if (mp.medioAnterior) avisos.push(`El medio se corrigió con lo que dijo Mercado Pago (antes figuraba «${nombreDelMedio(mp.medioAnterior)}»).`);
  const fuente = mp.atado === 'auto' ? 'Confirmado por la Conciliación MP.'
    : mp.atado === 'manual' ? `Atado a mano en la Conciliación MP${mp.motivo ? `: ${mp.motivo}` : ''}.`
      : 'Cobrado con el botón QR del ERP (todavía sin conciliar).';
  return { pagos, avisos, fuente, sinDato: false };
}
