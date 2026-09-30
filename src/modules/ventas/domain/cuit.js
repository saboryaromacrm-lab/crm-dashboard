/**
 * CUIT (0125): el mismo control que hace la API (`arca/padron.ts`), acá para
 * avisar ANTES de ir a ARCA que el número está mal tipeado.
 */
export const soloDigitos = (v) => String(v ?? '').replace(/\D/g, '');

/** Once dígitos y el dígito verificador (módulo 11, pesos 5-4-3-2-7-6-5-4-3-2). */
export function cuitValido(v) {
  const c = soloDigitos(v);
  if (c.length !== 11) return false;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((a, p, i) => a + p * Number(c[i]), 0);
  const resto = 11 - (suma % 11);
  const dv = resto === 11 ? 0 : resto === 10 ? 9 : resto;
  return dv === Number(c[10]);
}

/** 20123456786 → 20-12345678-6 (mientras se escribe, lo que haya). */
export function formatearCuit(v) {
  const c = soloDigitos(v).slice(0, 11);
  if (c.length <= 2) return c;
  if (c.length <= 10) return `${c.slice(0, 2)}-${c.slice(2)}`;
  return `${c.slice(0, 2)}-${c.slice(2, 10)}-${c.slice(10)}`;
}

export const CONDICION_IVA = {
  responsable_inscripto: 'Responsable Inscripto',
  monotributo: 'Monotributista',
  exento: 'IVA Exento',
  consumidor_final: 'Consumidor Final',
  no_categorizado: 'No categorizado',
};

/** La letra que va a salir, desde una empresa Responsable Inscripta (la regla de `letraFacturaPara`). */
export const letraPara = (condicionIva, condicionEmpresa) => {
  if (condicionEmpresa === 'monotributo' || condicionEmpresa === 'exento') return 'C';
  return condicionIva === 'responsable_inscripto' || condicionIva === 'monotributo' ? 'A' : 'B';
};
