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
export const fechaHora = (v) => (v ? new Date(v).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
export const fechaCorta = (v) => (v ? new Date(v).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');
export const horaCorta = (v) => (v ? new Date(v).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : '');
export const fechaIso = (p) => (p ? `${p.slice(8, 10)}/${p.slice(5, 7)}/${p.slice(0, 4)}` : '—');
export const ORIGEN = { saldo_inicial: 'Saldo inicial', sobre: 'Sobre de caja', concepto: 'Concepto', pago_proveedor: 'Pago a proveedor', gasto: 'Gasto', conteo: 'Conteo' };
export const MEDIO = { efectivo: 'efectivo', deposito: 'depósito' };
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

/** Lo que se anula desde Movimientos (el sobre se deshace desde Sobres; el saldo inicial, desde el arranque). */
export const ANULABLES = ['concepto', 'pago_proveedor', 'gasto', 'conteo'];
/** Días desde el cierre de un sobre (calendario local): «hoy», «1 día», «4 días». */
export const diasDesde = (v) => Math.max(0, Math.round((Date.parse(hoy()) - Date.parse(iso(new Date(v)))) / 86_400_000));
/** Qué es cada movimiento, en una línea. */
export const queEs = (m) => {
  if (m.origen === 'concepto') return m.concepto;
  if (m.origen === 'sobre') return `Sobre ${m.sucursal ?? ''}`;
  if (m.origen === 'pago_proveedor') return `Pago a ${m.proveedor ?? 'proveedor'} (${MEDIO[m.medio] ?? m.medio ?? ''})`;
  if (m.origen === 'gasto') return `Gasto: ${m.concepto ?? m.gastoDescripcion ?? ''}${m.gastoCategoria ? ` · ${m.gastoCategoria}` : ''}`;
  return ORIGEN[m.origen] ?? m.origen;
};
/** El texto con que se anula un movimiento (lo mismo en las dos pantallas). */
export const textoAnular = (m) => `${queEs(m)} del ${fechaCorta(m.fecha)}${m.detalle ? ` (${m.detalle})` : ''}.${m.origen === 'pago_proveedor' ? ' El pago se desaplica de sus facturas y se anula en la cuenta del proveedor.' : m.origen === 'gasto' ? ' El gasto y su pago se anulan también en Gastos.' : m.origen === 'conteo' ? ' El saldo vuelve a lo que decía el libro antes del conteo; el conteo queda registrado.' : ''}`;

/* Reportes: cómo se nombra cada período del gráfico. */
export const etiquetaPeriodo = (p, paso) => (paso === 'mes' ? `${MESES[Number(p.slice(5, 7)) - 1]} ${p.slice(2, 4)}` : `${Number(p.slice(8, 10))}/${Number(p.slice(5, 7))}`);
export const tituloPeriodo = (p, paso) => (paso === 'mes' ? `${MESES[Number(p.slice(5, 7)) - 1]} ${p.slice(0, 4)}` : paso === 'semana' ? `Semana del ${fechaIso(p)}` : fechaIso(p));
export const primerDiaMes = (d = new Date()) => iso(new Date(d.getFullYear(), d.getMonth(), 1));
