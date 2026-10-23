/**
 * Cash Flow: formatos y nombres compartidos entre el panel de Gerencia y la
 * versión de celular (/cashflow). Viven aparte para que las dos pantallas
 * digan lo mismo con las mismas palabras.
 */
import { iso, MESES } from '../metricas/formato.js';

export const DENOMINACIONES = [20000, 10000, 2000, 1000, 500, 200, 100, 50, 20];
/**
 * LOS QUE SE CUENTAN en Cash Flow (9/10/2026, pedido del dueño): sin $50 ni
 * $20, que casi no circulan; si aparece alguno va en «Monedas y otros».
 * La lista completa de arriba sigue para MOSTRAR lo que el cajero puso en su
 * cierre (la caja del local los sigue contando) y para sumar.
 */
/** La nota con la que queda un sobre confirmado con «Está todo» (sin contar billete por billete). */
export const NOTA_ESTA_TODO = 'Está todo: confirmado sin contar billete por billete.';
export const DENOMINACIONES_A_CONTAR = DENOMINACIONES.filter((d) => ![50, 20].includes(d));

export const hoy = () => iso(new Date());
/**
 * EL DÍA DE LA SEMANA EN CADA FECHA (23/10/2026, pedido del dueño: «aclarame
 * el día, chico nomás: LU, MA, MI, JU, VI, SAB, DOM»). Los formatos de abajo
 * lo llevan adelante, así toda fecha del Cash Flow lo dice sin acordarse en
 * cada pantalla; donde la fecha va sola, `<Fecha>` (Fecha.jsx) lo pone chico.
 * Los «SinDia» quedan para lo que ya nombra el día y para las planillas (CSV).
 */
export const DIAS_SEMANA = ['DOM', 'LU', 'MA', 'MI', 'JU', 'VI', 'SAB'];
/** Un día de calendario ('2026-10-23') se toma al mediodía: a medianoche UTC acá todavía es el día anterior. */
const aFecha = (v) => new Date(typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T12:00:00` : v);
export const diaSemana = (v) => (v ? DIAS_SEMANA[aFecha(v).getDay()] : '');
const conDia = (v, texto) => (v ? `${diaSemana(v)} ${texto}` : texto);
export const fechaHoraSinDia = (v) => (v ? aFecha(v).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
export const fechaCortaSinDia = (v) => (v ? aFecha(v).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');
export const fechaIsoSinDia = (p) => (p ? `${p.slice(8, 10)}/${p.slice(5, 7)}/${p.slice(0, 4)}` : '—');
export const fechaHora = (v) => conDia(v, fechaHoraSinDia(v));
export const fechaCorta = (v) => conDia(v, fechaCortaSinDia(v));
export const fechaIso = (p) => conDia(p, fechaIsoSinDia(p));
export const horaCorta = (v) => (v ? new Date(v).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : '');
export const ORIGEN = { saldo_inicial: 'Saldo inicial', sobre: 'Sobre de caja', concepto: 'Concepto', pago_proveedor: 'Pago a proveedor', gasto: 'Gasto', conteo: 'Conteo' };
/** `cambio` = efectivo por transferencia (0175): en la base queda como transferencia con `cambioPor`. */
export const MEDIO = { efectivo: 'efectivo', deposito: 'depósito', transferencia: 'transferencia', cambio: 'efectivo por transferencia' };
/**
 * LOS FILTROS DE LOS REPORTES (9/10/2026, pedido del dueño), los mismos en la
 * PC y en el celular. `f` = { tipo, origen, conceptoId, sucursalId }.
 */
export const FILTROS_REPORTE_VACIOS = { tipo: '', origen: '', conceptoId: '', sucursalId: '' };
export const ORIGENES_REPORTE = [['sobre', 'Sobres de caja'], ['concepto', 'Conceptos'], ['gasto', 'Gastos'], ['pago_proveedor', 'Pagos a proveedores'], ['conteo', 'Ajustes de conteo']];
/** Un neto con su signo adelante («−$300.000,00», no «$-300.000,00»). */
export const conSigno = (v, money) => `${v < -0.004 ? '−' : ''}${money(Math.abs(v))}`;
export const hayFiltrosReporte = (f) => !!(f.tipo || f.origen || f.conceptoId || f.sucursalId);
export const qsFiltrosReporte = (f) => ['tipo', 'origen', 'conceptoId', 'sucursalId'].filter((k) => f[k]).map((k) => `&${k}=${encodeURIComponent(f[k])}`).join('');
/** En una línea, para el título de la impresión y el nombre del CSV. */
export const textoFiltrosReporte = (f, conceptos = [], sucursales = []) => [
  f.tipo === 'ingreso' ? 'solo ingresos' : f.tipo === 'egreso' ? 'solo egresos' : '',
  ORIGENES_REPORTE.find(([k]) => k === f.origen)?.[1] ?? '',
  conceptos.find((x) => String(x.id) === String(f.conceptoId))?.nombre ?? '',
  sucursales.find((x) => String(x.id) === String(f.sucursalId))?.nombre ?? '',
].filter(Boolean).join(' · ');

/** Un concepto de depósito (16/10/2026): se reconoce por el nombre, igual que en el servidor (`esConceptoDeposito`). */
export const esDeposito = (nombre) => String(nombre ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes('deposito');
/** Un depósito cargado como egreso suelto: todavía se puede aplicar a un proveedor. */
export const depositoAplicable = (m) => !m.anuladoEn && m.origen === 'concepto' && m.tipo === 'egreso' && esDeposito(m.concepto);
/** Lo que se anula desde Movimientos (el sobre se deshace desde Sobres; el saldo inicial, desde el arranque). */
export const ANULABLES = ['concepto', 'pago_proveedor', 'gasto', 'conteo'];
/** Días desde el cierre de un sobre (calendario local): «hoy», «1 día», «4 días». */
export const diasDesde = (v) => Math.max(0, Math.round((Date.parse(hoy()) - Date.parse(iso(new Date(v)))) / 86_400_000));
/**
 * DÓNDE SE USA UN CONCEPTO (0192): la misma lista sirve al Cash Flow y a la
 * caja de los locales. `donde(c)` lo lee; `DONDE_A_CAMPOS` lo vuelve a la API.
 */
export const DONDE = [['ambos', 'Cash Flow y cajas de los locales'], ['cashflow', 'Solo Cash Flow'], ['caja', 'Solo cajas de los locales']];
export const donde = (c) => (c.enCashflow !== false && c.enCaja !== false ? 'ambos' : c.enCaja !== false ? 'caja' : 'cashflow');
export const DONDE_A_CAMPOS = (v) => ({ enCashflow: v !== 'caja', enCaja: v !== 'cashflow' });
export const textoDonde = (c) => DONDE.find(([k]) => k === donde(c))?.[1] ?? '';
/** Un concepto que es en sí un cambio («Cambio a mi cuenta (efectivo por transferencia)», 0191): se elige ya como cambio. */
export const esConceptoCambio = (nombre) => String(nombre ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes('efectivo por transferencia');
/**
 * « (efectivo por transferencia · Juan → mi cuenta del Galicia)» cuando la plata salió como cambio (0191).
 * Si el concepto ya lo dice en el nombre, no se repite: « (Juan → mi cuenta del Galicia)».
 */
const porCambio = (m, yaLoDice = false) => (m.cambioPor ? ` (${yaLoDice ? '' : `${MEDIO.cambio} · `}${m.cambioPor}${m.cambioCuenta ? ` → ${m.cambioCuenta}` : ''})` : '');
/** Qué es cada movimiento, en una línea. */
export const queEs = (m) => {
  if (m.origen === 'concepto') return `${m.concepto}${porCambio(m, esConceptoCambio(m.concepto))}`;
  if (m.origen === 'sobre') return `Sobre ${m.sucursal ?? ''}`;
  if (m.origen === 'pago_proveedor') return `Pago a ${m.proveedor ?? 'proveedor'} (${m.cambioPor ? `${MEDIO.cambio} · ${m.cambioPor}` : MEDIO[m.medio] ?? m.medio ?? ''})`;
  if (m.origen === 'gasto') return `Gasto: ${m.concepto ?? m.gastoDescripcion ?? ''}${m.gastoCategoria ? ` · ${m.gastoCategoria}` : ''}${porCambio(m)}`;
  return ORIGEN[m.origen] ?? m.origen;
};
/** El texto con que se anula un movimiento (lo mismo en las dos pantallas). */
export const textoAnular = (m) => `${queEs(m)} del ${fechaCorta(m.fecha)}${m.detalle ? ` (${m.detalle})` : ''}.${m.origen === 'pago_proveedor' ? ' El pago se desaplica de sus facturas y se anula en la cuenta del proveedor.' : m.origen === 'gasto' ? ' El gasto y su pago se anulan también en Gastos.' : m.origen === 'conteo' ? ' El saldo vuelve a lo que decía el libro antes del conteo; el conteo queda registrado.' : ''}`;

/* Reportes: cómo se nombra cada período del gráfico. */
export const etiquetaPeriodo = (p, paso) => (paso === 'mes' ? `${MESES[Number(p.slice(5, 7)) - 1]} ${p.slice(2, 4)}` : `${Number(p.slice(8, 10))}/${Number(p.slice(5, 7))}`);
export const tituloPeriodo = (p, paso) => (paso === 'mes' ? `${MESES[Number(p.slice(5, 7)) - 1]} ${p.slice(0, 4)}` : paso === 'semana' ? `Semana del ${fechaIso(p)}` : fechaIso(p));
export const primerDiaMes = (d = new Date()) => iso(new Date(d.getFullYear(), d.getMonth(), 1));
