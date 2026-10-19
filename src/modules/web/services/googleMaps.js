/**
 * GOOGLE MAPS EN EL ERP (0185): para dibujar los barrios del envío minorista.
 * Se carga UNA vez, a pedido (recién al abrir el mapa), con la clave de
 * Tienda online › Configuración › Tienda minorista. La misma clave la usa la
 * tienda: en Google Cloud se restringe a los dos dominios.
 */
const CALLBACK = '__erpMapsListo';
let carga = null;
let claveCargada = '';

/** Formosa Capital: donde arranca el mapa cuando no hay nada dibujado. */
export const FORMOSA = { lat: -26.1849, lng: -58.1731 };

/** Resuelve con `google.maps` listo para `importLibrary`. */
export function cargarGoogleMaps(clave) {
  if (!clave) return Promise.reject(new Error('Falta la clave de Google Maps: cargala arriba y guardá.'));
  if (carga) {
    return claveCargada === clave ? carga : Promise.reject(new Error('Cambiaste la clave de Google Maps: recargá la página para usar la nueva.'));
  }
  claveCargada = clave;
  carga = new Promise((resolve, reject) => {
    window[CALLBACK] = () => { delete window[CALLBACK]; resolve(window.google.maps); };
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(clave)}&v=weekly&loading=async&language=es&region=AR&callback=${CALLBACK}`;
    script.async = true;
    script.onerror = () => {
      script.remove();
      carga = null;
      claveCargada = '';
      reject(new Error('No se pudo cargar Google Maps: revisá la conexión.'));
    };
    document.head.appendChild(script);
  });
  return carga;
}
