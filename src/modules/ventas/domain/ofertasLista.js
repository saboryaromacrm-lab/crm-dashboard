/**
 * VENTAS › OFERTAS: LA LISTA (19/11/2026, pedido del dueño: «más filtros e
 * información: qué está vigente, qué no»). Lo que la pantalla de
 * administración necesita saber de cada oferta HOY, para filtrarla, ordenarla
 * y decirlo en palabras. El motor que aplica las ofertas en la caja es otro
 * (`ofertas.js`): acá solo se reusa su regla de vigencia.
 */
import { estadoOferta, textoDias, valeElDia } from './ofertas.js';

const DIA = 86_400_000;

/**
 * Los días de una oferta en corto: «solo los lunes» o, si faltan uno o dos,
 * «todos menos los domingos». Sin restricción (todos los días), ''.
 */
export function cuandoDias(dias) {
  if (!dias || dias.length !== 7 || !dias.includes('0')) return '';
  const faltan = [...dias].filter((d) => d !== '1').length;
  if (faltan <= 2) return `todos menos ${textoDias([...dias].map((d) => (d === '1' ? '0' : '1')).join(''))}`;
  return `solo ${textoDias(dias)}`;
}

/**
 * La situación de una oferta hoy: su estado de siempre (vigente, programada,
 * vencida, inactiva) más si aplica HOY (una vigente de «solo los miércoles» un
 * martes no descuenta), en cuántos días vence o empieza, y hace cuánto venció.
 */
export function situacionOferta(o, ahora = new Date()) {
  const estado = estadoOferta(o, ahora);
  const vigente = estado.id === 'vigente';
  return {
    estado,
    aplicaHoy: vigente && valeElDia(o.dias, ahora),
    venceEn: vigente && o.hasta ? Math.max(0, Math.ceil((new Date(o.hasta) - ahora) / DIA)) : null,
    empiezaEn: estado.id === 'programada' ? Math.max(0, Math.ceil((new Date(o.desde) - ahora) / DIA)) : null,
    vencioHace: estado.id === 'vencida' ? Math.floor((ahora - new Date(o.hasta)) / DIA) : null,
  };
}

/** La línea de abajo del estado: «vence en 3 días», «hoy no aplica (solo los miércoles)», «venció hace 4 días». */
export function textoSituacion(o, sit) {
  const dias = (n) => `${n} día${n === 1 ? '' : 's'}`;
  if (sit.estado.id === 'vigente') {
    const partes = [];
    if (!sit.aplicaHoy) partes.push(`hoy no aplica (${cuandoDias(o.dias)})`);
    if (sit.venceEn != null) partes.push(sit.venceEn === 0 ? 'vence hoy' : `vence en ${dias(sit.venceEn)}`);
    return partes.join(' · ') || 'sin fecha de fin';
  }
  if (sit.estado.id === 'programada') return sit.empiezaEn === 0 ? 'empieza hoy' : `empieza en ${dias(sit.empiezaEn)}`;
  if (sit.estado.id === 'vencida') return sit.vencioHace === 0 ? 'venció hoy' : `venció hace ${dias(sit.vencioHace)}`;
  return 'apagada a mano';
}

/** Los filtros de estado, con lo que cuenta cada uno. «Vencen en 7 días» son vigentes que terminan en una semana. */
export const FILTROS_ESTADO = [
  ['vigentes', 'Vigentes', (s) => s.estado.id === 'vigente'],
  ['hoy', 'Aplican hoy', (s) => s.aplicaHoy],
  ['por_vencer', 'Vencen en 7 días', (s) => s.venceEn != null && s.venceEn <= 7],
  ['programadas', 'Programadas', (s) => s.estado.id === 'programada'],
  ['vencidas', 'Vencidas', (s) => s.estado.id === 'vencida'],
  ['inactivas', 'Inactivas', (s) => s.estado.id === 'inactiva'],
  ['todas', 'Todas', () => true],
];

/** El filtro de origen: las armadas para rematar mercadería por vencer, las que arma la regla sola (0188), o las demás. */
export const FILTROS_ORIGEN = [
  ['', 'Cualquier origen', () => true],
  ['si', 'Por vencimiento', (o) => !!o.porVencer],
  ['auto', 'Automáticas (regla de vencimiento)', (o) => !!o.autoVencimiento],
  ['no', 'Armadas a mano (no por vencimiento)', (o) => !o.porVencer],
];

/** ¿Corre en esta sucursal? Sin sucursales tildadas, corre en todas. */
export const correEnSucursal = (o, sucursalId) => !sucursalId || !o.sucursales
  || String(o.sucursales).split(',').map((x) => x.trim()).includes(String(sucursalId));

/** Los órdenes de la lista. `uso` = el descuento que dio desde que existe. */
export const ORDENES_OFERTA = {
  recientes: { label: 'Las más nuevas', fn: (a, b) => b.id - a.id },
  vencen: {
    label: 'Las que vencen primero',
    fn: (a, b) => (a.hasta ? new Date(a.hasta) : Infinity) - (b.hasta ? new Date(b.hasta) : Infinity) || b.id - a.id,
  },
  uso: { label: 'Las que más descuento dieron', fn: (a, b) => (b.uso?.descuento ?? 0) - (a.uso?.descuento ?? 0) || b.id - a.id },
  nombre: { label: 'Nombre', fn: (a, b) => a.nombre.localeCompare(b.nombre) },
};
