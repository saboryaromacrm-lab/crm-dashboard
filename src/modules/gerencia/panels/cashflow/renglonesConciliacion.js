/**
 * CONCILIACIÓN DE EFECTIVO: los renglones de la pantalla (4/11/2026).
 * Los números los arma el servidor (crm-api/src/cashflow/conciliacion.ts);
 * acá solo se decide qué renglón va, con qué signo y con qué explicación.
 * Cada tramo suma su subtotal: la prueba lo controla.
 * Sin alias de importación: lo prueba `node --test`.
 */
import { money } from '../../../productos/domain/format.js';

const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const nombreMes = (mes) => `${MESES_LARGOS[Number(mes.slice(5, 7)) - 1]} ${mes.slice(0, 4)}`;
/** 'AAAA-MM' corrido `delta` meses. */
export const otroMes = (mes, delta) => {
  const d = new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
export const mesDe = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const cero = (v) => Math.abs(v ?? 0) < 0.005;
/** «faltaron $500» / «sobraron $500». */
const textoDif = (v) => `${v < 0 ? 'faltaron' : 'sobraron'} ${money(Math.abs(v))}`;

/**
 * De lo cobrado a lo contado. `valor` lleva su signo (lo que resta, negativo);
 * `total: true` es un subtotal (la suma de lo de arriba desde el subtotal
 * anterior). Los renglones en cero que no explican nada no se muestran.
 */
export function cascada(t) {
  const fondo = t.fondoAbrieron - t.fondoDejaron;
  const delJefe = [!cero(t.jefeApertura) && `al abrir ${textoDif(t.jefeApertura)}`, !cero(t.jefeDif) && `al cerrar ${textoDif(t.jefeDif)}`].filter(Boolean);
  const r = [
    { clave: 'ventas', texto: 'Ventas cobradas en efectivo', valor: t.ventas, siempre: true, nota: 'Lo que entró en efectivo por ventas en esas cajas. Las devoluciones van más abajo.' },
    { clave: 'cobranzas', texto: 'Cobranzas en efectivo', valor: t.cobranzas, nota: 'Cuentas corrientes que se cobraron en la caja: entra plata que no es venta del mes.' },
    { clave: 'ingresos', texto: 'Otros ingresos en la caja', valor: t.ingresos, detalle: 'ingreso' },
    { clave: 'pagosProveedor', texto: 'Pagos a proveedores desde la caja', valor: -t.pagosProveedor, detalle: 'pago_proveedor' },
    { clave: 'devoluciones', texto: 'Devoluciones a clientes', valor: -t.devoluciones },
    { clave: 'otrosEgresos', texto: 'Gastos y otros egresos', valor: -t.otrosEgresos, detalle: 'otros' },
    { clave: 'sinDetalle', texto: 'Sin detalle', valor: t.sinDetalle, alerta: true, nota: 'El esperado que guardaron las cajas no coincide con su detalle. Abajo dice en qué turnos.' },
    { clave: 'generado', texto: 'Lo que generaron las cajas', valor: t.generado, total: true },
    {
      clave: 'jefe', texto: 'Cerradas con el cierre de siempre, sin sobre', valor: -t.jefeGenerado,
      nota: `${plural(t.porJefe, 'caja cerrada', 'cajas cerradas')} sin armar sobre (por un jefe, o de antes del cierre por envío): esa plata no viajó en sobre. Contaron ${money(t.jefeContado)}, con el fondo${delJefe.length ? `; ${delJefe.join(' y ')}` : ''}.`,
      ...(t.porJefe ? { siempre: true } : {}),
    },
    {
      clave: 'difApertura', texto: 'Diferencia al abrir las cajas', valor: t.difApertura, diferencia: true, siempre: true,
      nota: 'Lo que encontró cada cajero al abrir contra lo que dejó el cierre anterior: lo que falta acá se perdió entre una caja y la otra.',
    },
    {
      clave: 'fondo', texto: 'Fondo de las cajas', valor: fondo, siempre: true,
      nota: cero(fondo)
        ? 'Las cajas dejaron el mismo fondo que encontraron.'
        : fondo < 0
          ? `Las cajas dejaron ${money(-fondo)} más de fondo del que encontraron: esa plata quedó en los cajones y no viajó.`
          : `Las cajas dejaron ${money(fondo)} menos de fondo del que encontraron: esa plata viajó en los sobres.`,
    },
    { clave: 'debia', texto: 'Debía llegar en los sobres', valor: t.debiaSobres, total: true },
    { clave: 'difCajeros', texto: 'Diferencia de los cajeros al contar', valor: t.difCajeros, diferencia: true, siempre: true, nota: 'Lo que contó cada cajero al cerrar contra lo que debía haber.' },
    { clave: 'enviado', texto: 'Mandaron en los sobres', valor: t.enviado, total: true },
    { clave: 'sinRendir', texto: 'Sin rendir todavía', valor: -t.sinRendir, siempre: t.sinRendirN > 0, accion: 'sobres', nota: `${plural(t.sinRendirN, 'sobre', 'sobres')} que todavía no controlaste.` },
    { clave: 'previo', texto: 'Antes de arrancar el Cash Flow', valor: -t.previo, nota: 'Sobres de cuando todavía no se controlaba en el Cash Flow.' },
    { clave: 'noCorresponde', texto: 'Marcados «no corresponde»', valor: -t.noCorresponde, nota: 'Ya estaban en el saldo inicial o se extraviaron: no entraron ni se le cargan al cajero.' },
    { clave: 'difControl', texto: 'Diferencia al controlar los sobres', valor: t.difControl, diferencia: true, siempre: true, nota: 'Lo que contaste vos contra lo que decía el sobre.' },
    { clave: 'contado', texto: 'Contaste en el Cash Flow', valor: t.contado, total: true, final: true },
  ];
  return r.filter((x) => x.total || x.siempre || Math.abs(x.valor) >= 0.005);
}

/** Del «Cómo se cobra» de Métricas (por día de venta) al efectivo de ventas de las cajas. */
export function puenteMetricas(d) {
  if (!d) return [];
  const r = [
    { clave: 'metricas', texto: 'Efectivo vendido en el mes, según Métricas', valor: d.metricas, siempre: true, nota: 'Gerencia › Métricas › «Cómo se cobra», línea Efectivo: cuenta por día de venta.' },
    { clave: 'otrosTurnos', texto: 'Vendido en cajas abiertas o que cierran en otro mes', valor: -d.otrosTurnos },
    { clave: 'sinCaja', texto: 'Cobrado sin caja', valor: -d.sinCaja, alerta: true, nota: 'No entra en ningún sobre: revisá dónde quedó esa plata.' },
    { clave: 'esperandoCae', texto: 'Facturas esperando el CAE', valor: -d.esperandoCae, nota: 'La caja las espera recién cuando ARCA las confirma.' },
    { clave: 'deOtroMes', texto: 'Vendido otro mes, en cajas que cerraron en este', valor: d.deOtroMes },
    { clave: 'resultado', texto: 'Ventas cobradas en efectivo de las cajas', valor: d.resultado, total: true, final: true },
  ];
  return r.filter((x) => x.total || x.siempre || Math.abs(x.valor) >= 0.005);
}

/** El aviso del efectivo que no pasó por ninguna caja (vacío = no hubo). */
export function textoSinCaja(sinCaja) {
  const partes = [sinCaja?.ventas > 0.004 && `ventas por ${money(sinCaja.ventas)}`, sinCaja?.cobranzas > 0.004 && `recibos de cuenta corriente por ${money(sinCaja.cobranzas)}`].filter(Boolean);
  return partes.length ? `En el mes se cobraron en efectivo, sin caja abierta, ${partes.join(' y ')}. Esa plata no entra en ningún sobre: revisá dónde quedó.` : '';
}

/** Un turno que hay que mirar: con diferencia, sin rendir o que no cuadra consigo mismo. */
export const turnoParaMirar = (t) => !cero(t.difApertura) || !cero(t.difCajero) || !cero(t.difControl)
  || t.estado === 'sin_rendir' || (t.descuadre?.length ?? 0) > 0;
