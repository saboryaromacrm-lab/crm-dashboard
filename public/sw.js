/*
 * ERP SABOR Y AROMA · SERVICE WORKER (30/9/2026)
 * ============================================================================
 * Existe para una sola cosa: que el ERP se pueda INSTALAR como una app (ícono
 * en el escritorio o en el celular, ventana propia, sin la barra del
 * navegador). NO es un ERP "offline":
 *
 *   · El ERP NUNCA se sirve desde acá. Cada vez que se abre, la página se pide
 *     a la red, como en el navegador: un deploy llega a todas las cajas igual
 *     que hoy y nadie puede quedar trabado en una versión vieja.
 *   · La API (otro dominio) ni se toca: precios, stock y ventas van siempre en
 *     vivo. Una venta jamás se guarda acá para "mandarla después".
 *   · Lo único guardado es una página chica de "Sin conexión", para que un
 *     corte de internet muestre qué pasa en vez de la pantalla de error del
 *     navegador.
 *
 * Cambiar este archivo = subir VERSION: el navegador lo detecta, instala el
 * nuevo y borra lo del anterior.
 */
const VERSION = 'erp-v1';
const OFFLINE = '/offline.html';
const GUARDADO = [OFFLINE, '/icons/erp-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(GUARDADO)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Solo la apertura de una pantalla (navegación). Todo lo demás —el
  // JavaScript, las imágenes, la API— sigue su camino normal sin pasar por acá.
  if (request.method !== 'GET' || request.mode !== 'navigate') return;
  event.respondWith(
    fetch(request).catch(() => caches.match(OFFLINE).then((r) => r || Response.error())),
  );
});
