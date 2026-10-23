/**
 * PEDIR CADETE (20/10/2026, pedido del dueño): un pedido con envío se le pasa
 * al cadete con un botón. Abre WhatsApp, en la app, en el chat del cadete
 * cargado en Tienda online › Configuración, con el mensaje ya escrito: pedido,
 * cliente, teléfono, dirección, ubicación del mapa, para cuándo (23/10/2026)
 * y cuántos artículos lleva.
 * Queda revisarlo y tocar enviar.
 */
import { abrirWhatsApp } from '@shared/utils/whatsapp.js';
import { num } from '@modules/productos/domain/format.js';
import { direccionOrden, mapaOrden, telLegible, telefonoWa } from './constants.js';
import { cuandoDe, textoCuando } from './cuandoEnvio.js';

/** El pedido se entrega en un domicilio (todo lo que no es retiro en el local). */
export const llevaEnvio = (p) => !!p?.entrega && p.entrega !== 'retiro';

/** El mensaje para el cadete. `cliente` es la ficha, si la orden ya está adjudicada. */
export function textoCadete(p, cliente) {
  const wc = p.webCliente ?? {};
  const nombre = cliente?.nombre || `${wc.nombre ?? ''} ${wc.apellido ?? ''}`.trim() || '—';
  const telCrudo = wc.telefono || cliente?.telefono || '';
  const tel = telefonoWa(telCrudo);
  const direccion = direccionOrden(p) || cliente?.direccion || '';
  const mapa = mapaOrden(p);
  const items = p.items ?? [];
  const articulos = items.reduce((t, it) => t + (Number(it.cantidad) || 0), 0);
  return [
    `🛵 *Pedido para entregar* · ${p.codigo}`,
    `👤 Cliente: ${nombre}`,
    `📞 Teléfono: ${tel ? telLegible(tel.slice(3)) : telCrudo || 'sin teléfono'}`,
    `📍 Dirección: ${direccion || 'a confirmar con el cliente'}`,
    mapa && `🗺️ Ubicación: ${mapa}`,
    cuandoDe(p) && `🕒 Cuándo: ${textoCuando(cuandoDe(p))}`,
    `📦 Artículos: ${num(articulos)} (${items.length} producto${items.length === 1 ? '' : 's'})`,
  ].filter(Boolean).join('\n');
}

/**
 * Abre el chat del cadete con el pedido. Sin un número completo cargado no
 * abre nada: avisa dónde se carga (un chat vacío confunde más que el aviso).
 */
export function pedirCadete(p, { cliente, cadete, toast }) {
  const wa = telefonoWa(cadete);
  if (!wa) {
    toast('Falta el WhatsApp del cadete: cargalo en Tienda online › Configuración › General.', 'err');
    return;
  }
  abrirWhatsApp(wa, textoCadete(p, cliente));
  toast('Se abrió WhatsApp con el pedido para el cadete: revisalo y tocá enviar.', 'ok');
}
