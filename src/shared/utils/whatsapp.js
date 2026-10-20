/**
 * WHATSAPP SIEMPRE EN LA APP (20/10/2026, pedido del dueño): todo el ERP abre
 * WhatsApp de Windows —o el del celular— con el protocolo `whatsapp://`, no
 * con wa.me, que abre una pestaña del navegador y desde ahí pide pasar a la
 * app. La primera vez el navegador pregunta «¿Abrir WhatsApp?»: tildando
 * «Permitir siempre» ya no vuelve a preguntar.
 *
 * El teléfono va como lo arma `telefonoWa` (549 + área + abonado, solo dígitos).
 */

/** El link al chat, con el mensaje ya escrito si hay. Sin teléfono, abre la app para elegir a quién. */
export function urlWhatsApp(telefono = '', texto = '') {
  const params = [
    telefono && `phone=${String(telefono).replace(/\D/g, '')}`,
    texto && `text=${encodeURIComponent(texto)}`,
  ].filter(Boolean).join('&');
  return `whatsapp://send${params ? `?${params}` : ''}`;
}

/** Abre la app de WhatsApp en ese chat, sin dejar una pestaña en blanco detrás. */
export function abrirWhatsApp(telefono, texto) {
  const a = document.createElement('a');
  a.href = urlWhatsApp(telefono, texto);
  a.rel = 'noopener';
  a.click();
}
