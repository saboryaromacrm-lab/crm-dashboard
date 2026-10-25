/**
 * PEDIR CADETE (20/10/2026, pedido del dueño): un pedido con envío se le pasa
 * al cadete con un botón. Abre WhatsApp, en la app, en el chat del cadete
 * cargado en Tienda online › Configuración, con el mensaje ya escrito: pedido,
 * cliente, teléfono, dirección, ubicación del mapa, para cuándo (23/10/2026)
 * y cuántos artículos lleva.
 * Queda revisarlo y tocar enviar.
 *
 * EL CLIENTE LE PAGA EL ENVÍO AL CADETE (25/10/2026, pedido del dueño): con
 * un envío que no es gratis, al cliente se le manda un link que abre el chat
 * del cadete con sus datos ya escritos; ahí pregunta cuánto sale y coordina el
 * pago, sin pasar por el local.
 */
import { abrirWhatsApp } from '@shared/utils/whatsapp.js';
import { money, num } from '@modules/productos/domain/format.js';
import { direccionOrden, envioOrden, mapaOrden, telLegible, telefonoWa } from './constants.js';
import { cuandoDe, textoCuando } from './cuandoEnvio.js';

/** El pedido se entrega en un domicilio (todo lo que no es retiro en el local). */
export const llevaEnvio = (p) => !!p?.entrega && p.entrega !== 'retiro';
/** Con envío que paga el cliente: con costo, o que se coordina (el gratis no). */
export const envioAPagar = (p) => llevaEnvio(p) && envioOrden(p) !== 0;

/** El nombre del cliente: el de la ficha si la orden ya está adjudicada, si no el que escribió. */
const nombreDe = (p, cliente) => cliente?.nombre || `${p.webCliente?.nombre ?? ''} ${p.webCliente?.apellido ?? ''}`.trim();

/** El mensaje para el cadete. `cliente` es la ficha, si la orden ya está adjudicada. */
export function textoCadete(p, cliente) {
  const wc = p.webCliente ?? {};
  const nombre = nombreDe(p, cliente) || '—';
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

/**
 * Lo que el cliente le manda al cadete, ya escrito por él: quién es, qué
 * pedido, a dónde, para cuándo y la pregunta. Si el envío ya tiene precio (el
 * del barrio), va el precio y solo pregunta cómo pagarlo.
 */
export function textoClienteACadete(p, cliente) {
  const envio = envioOrden(p);
  const direccion = direccionOrden(p) || cliente?.direccion || '';
  const mapa = mapaOrden(p);
  return [
    `¡Hola! Soy ${nombreDe(p, cliente) || 'cliente'}, del pedido ${p.codigo} de Sabor y Aroma.`,
    `📍 Dirección: ${direccion || 'te la paso por acá'}`,
    mapa && `🗺️ Ubicación: ${mapa}`,
    cuandoDe(p) && `🕒 Cuándo: ${textoCuando(cuandoDe(p))}`,
    envio > 0 && `🛵 Envío: ${money(envio)}`,
    envio > 0 ? '¿Cómo te lo pago?' : '¿Cuánto sale el envío y cómo te lo pago?',
  ].filter(Boolean).join('\n');
}

/**
 * Abre el chat del CLIENTE con el link al chat del cadete. El link va por
 * wa.me (no `whatsapp://`): es el que WhatsApp muestra tocable en un mensaje,
 * y en el celular del cliente abre la app directo.
 */
export function pasarCadeteAlCliente(p, { cliente, cadete, toast }) {
  const waCadete = telefonoWa(cadete);
  if (!waCadete) {
    toast('Falta el WhatsApp del cadete: cargalo en Tienda online › Configuración › General.', 'err');
    return;
  }
  const waCliente = telefonoWa(p.webCliente?.telefono || cliente?.telefono || '');
  if (!waCliente) {
    toast('Este pedido no tiene un WhatsApp completo del cliente.', 'err');
    return;
  }
  const link = `https://wa.me/${waCadete}?text=${encodeURIComponent(textoClienteACadete(p, cliente))}`;
  const nombre = nombreDe(p, cliente).split(' ')[0];
  abrirWhatsApp(waCliente, [
    `¡Hola${nombre ? ` ${nombre}` : ''}! 👋`,
    `Para el envío de tu pedido ${p.codigo}, escribile directo a nuestro cadete: tocá este link y se abre su chat con los datos de tu envío ya escritos. `
      + `Él te dice ${envioOrden(p) > 0 ? 'cómo pagarle' : 'cuánto sale y cómo pagarle'}.`,
    `👉 ${link}`,
  ].join('\n\n'));
  toast('Se abrió WhatsApp con el cliente y el link del cadete: revisalo y tocá enviar.', 'ok');
}
