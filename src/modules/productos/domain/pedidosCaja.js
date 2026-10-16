/**
 * PEDIDOS DE LA CAJA A FRACCIONADO (0170) — estados, textos y tiempos que usan
 * la caja, el aviso de fraccionado y el historial.
 */
import { fmtTam } from './format.js';

/** Cada cuánto preguntan la caja y fraccionado. */
export const CADA_MS = 10_000;

export const ESTADO_PEDIDO_CAJA = {
  pendiente: { label: 'Pedido', pill: 'est-pendiente' },
  armando: { label: 'En preparación', pill: 'est-transito' },
  hecho: { label: 'Listo', pill: 'est-recibida' },
  rechazado: { label: 'No se puede', pill: 'est-cancelada' },
};

/** Los motivos de un toque de «No se puede» (también se puede escribir otro). */
export const MOTIVOS_NO_SE_PUEDE = ['No hay granel', 'No hay bolsas', 'No hay etiquetas'];

/** «2 × Avena Instantánea 400 g». */
export const textoRenglon = (it) => `${it.paquetes} × ${it.nombre} ${fmtTam(it.tamKg)}`;

/** Minutos enteros de `desde` a `hasta` (ahora si falta); null sin `desde`. */
export function minutos(desde, hasta) {
  if (!desde) return null;
  return Math.max(0, Math.round(((hasta ? new Date(hasta) : new Date()) - new Date(desde)) / 60000));
}

/** «recién», «hace 4 min», «hace 1 h 10 min». */
export function haceCuanto(desde) {
  const m = minutos(desde);
  if (m == null) return '';
  if (m < 1) return 'recién';
  return m < 60 ? `hace ${m} min` : `hace ${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;
}

