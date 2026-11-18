/**
 * NOMBRES LEGIBLES DE LO QUE CONTESTA MERCADO PAGO (lo desconocido se muestra
 * tal cual). Los usan Gerencia › Pagos electrónicos (el diagnóstico) y
 * Ventas › Conciliación MP.
 */
export const TIPO_MP = { account_money: 'Dinero en cuenta', credit_card: 'Tarjeta de crédito', debit_card: 'Tarjeta de débito', prepaid_card: 'Tarjeta prepaga', bank_transfer: 'Transferencia', ticket: 'Efectivo (cupón)', atm: 'Cajero', digital_currency: 'Crédito de Mercado Pago', digital_wallet: 'Billetera digital' };
export const OPERACION_MP = { regular_payment: 'Cobro', money_transfer: 'Transferencia', pos_payment: 'Cobro en local', account_fund: 'Ingreso de dinero', recurring_payment: 'Débito automático', payment_addition: 'Agregado' };
export const ESTADO_MP = { approved: 'Aprobado', rejected: 'Rechazado', refunded: 'Devuelto', cancelled: 'Cancelado', pending: 'Pendiente', in_process: 'En proceso', charged_back: 'Contracargo', in_mediation: 'En reclamo' };
export const nombreMp = (dic, k) => (k ? dic[k] ?? k : '—');
