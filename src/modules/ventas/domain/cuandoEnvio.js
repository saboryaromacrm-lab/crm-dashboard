/**
 * ¿PARA CUÁNDO EL ENVÍO? (23/10/2026). El pedido minorista con envío trae en
 * `webCliente.cuando` lo que eligió el cliente: `pronto` (lo antes posible,
 * con su franja de 20 a 40 minutos desde que pidió), `horario` (una franja de
 * 20 minutos) o `whatsapp` (lo coordina). Acá el texto, el día y los filtros
 * de tiempo de Pedidos online. Todo en hora argentina.
 */
const ZONA = 'America/Argentina/Buenos_Aires';
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const hora = (iso) => new Date(iso).toLocaleTimeString('es-AR', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
/** El día en Argentina de un instante, AAAA-MM-DD. */
export const diaAr = (v) => new Date(v).toLocaleDateString('en-CA', { timeZone: ZONA });
const sumarDias = (dia, n) => new Date(Date.parse(`${dia}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export const cuandoDe = (p) => p?.webCliente?.cuando ?? null;

/** «Hoy», «Mañana», «Ayer» o «Lun 27/10», contra `hoy` (AAAA-MM-DD). */
export function nombreDia(dia, hoy) {
  if (dia === hoy) return 'Hoy';
  if (dia === sumarDias(hoy, 1)) return 'Mañana';
  if (dia === sumarDias(hoy, -1)) return 'Ayer';
  return `${DIAS[new Date(`${dia}T12:00:00Z`).getUTCDay()]} ${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
}

/** Lo que eligió, en una línea («Lo antes posible · hoy 10:25 a 10:45»); null si el pedido no lo dice. */
export function textoCuando(c, hoy = diaAr(new Date())) {
  if (!c) return null;
  if (c.tipo === 'whatsapp') return 'Lo coordina por WhatsApp';
  const franja = `${nombreDia(diaAr(c.desde), hoy).toLowerCase()} ${hora(c.desde)} a ${hora(c.hasta)}`;
  return c.tipo === 'pronto' ? `Lo antes posible · ${franja}` : `Para ${franja}`;
}

/** Los filtros de tiempo: cuándo se recibió y para cuándo lo quiere. */
export const RECIBIDOS = [['', 'Recibidos: todos'], ['hoy', 'Recibidos hoy'], ['ayer', 'Recibidos ayer'], ['semana', 'Últimos 7 días']];
export const PARA = [['', 'Envío: cualquier momento'], ['pronto', 'Lo antes posible'], ['hoy', 'Para hoy'], ['manana', 'Para mañana'], ['despues', 'Más adelante'], ['whatsapp', 'A coordinar por WhatsApp']];

export function recibidoEn(p, f, hoy) {
  if (!f) return true;
  const dia = diaAr(p.fecha);
  if (f === 'hoy') return dia === hoy;
  if (f === 'ayer') return dia === sumarDias(hoy, -1);
  return dia >= sumarDias(hoy, -6);
}

export function paraCuando(p, f, hoy) {
  if (!f) return true;
  const c = cuandoDe(p);
  if (!c) return false;
  if (f === 'pronto' || f === 'whatsapp') return c.tipo === f;
  if (c.tipo === 'whatsapp') return false;
  const dia = diaAr(c.desde);
  if (f === 'hoy') return dia === hoy;
  if (f === 'manana') return dia === sumarDias(hoy, 1);
  return dia > sumarDias(hoy, 1);
}

/** Con un filtro de «para cuándo», lo que hay que entregar antes va primero. */
export const porEntrega = (a, b) => Date.parse(cuandoDe(a)?.desde ?? 0) - Date.parse(cuandoDe(b)?.desde ?? 0);
