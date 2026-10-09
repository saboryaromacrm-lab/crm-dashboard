/**
 * Los días de las pantallas de Caja (turnos e ingresos y egresos), en la hora
 * de esta PC: 'AAAA-MM-DD'.
 */
/** Hoy menos `atras` días. */
export const diaAtras = (atras) => {
  const d = new Date();
  d.setDate(d.getDate() - atras);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
/** El 1° del mes en curso. */
export const primeroDelMes = () => `${diaAtras(0).slice(0, 8)}01`;
/* Los atajos de fecha (6/10/2026, pedido del dueño): un día entero cada uno. */
export const ATAJOS = [['Hoy', 0], ['Ayer', 1], ['Antes de ayer', 2]];
