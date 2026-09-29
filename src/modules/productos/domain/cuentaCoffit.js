/**
 * La cuenta corriente con Coffit (0120): el vocabulario que comparten la
 * pestaña y sus ventanas. Datos y textos, sin componentes.
 */
import { money } from './format.js';

/** Qué significa cada tipo, y cómo se lee «a favor de quién» en cada uno. */
export const TIPOS_MOV_COFFIT = {
  pago: {
    label: 'Pago',
    lados: { coffit: 'Coffit le pagó a Sabor y Aroma', sya: 'Sabor y Aroma le pagó a Coffit' },
  },
  compensacion: {
    label: 'Compensación',
    lados: { coffit: 'Baja lo que Coffit debe', sya: 'Sube lo que Coffit debe' },
  },
  ajuste: {
    label: 'Ajuste',
    lados: { coffit: 'Baja lo que Coffit debe (a favor de Coffit)', sya: 'Sube lo que Coffit debe (a favor de Sabor y Aroma)' },
  },
  saldo_inicial: {
    label: 'Saldo inicial',
    lados: { sya: 'Coffit le debía a Sabor y Aroma', coffit: 'Sabor y Aroma le debía a Coffit' },
  },
};


/** Quién le debe a quién, en palabras. */
export function textoSaldo(saldo) {
  if (Math.abs(saldo) < 0.005) return 'Están al día';
  return saldo > 0 ? `Coffit le debe ${money(saldo)} a Sabor y Aroma` : `Sabor y Aroma le debe ${money(-saldo)} a Coffit`;
}
