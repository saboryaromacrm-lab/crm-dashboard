/*
 * PEGAR UNA FACTURA (24/11/2026, pedido del dueño): una captura copiada (la
 * planilla de precios del proveedor, una foto de WhatsApp) se pega con Ctrl+V
 * en Procesamiento de facturas y entra como si se hubiera subido el archivo.
 */

const IMAGENES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const dos = (n) => String(n).padStart(2, '0');

/**
 * Las imágenes del portapapeles, con un nombre que diga qué son: el navegador
 * las llama a todas «image.png» y en la bandeja no se distinguían.
 */
export function imagenesPegadas(clipboardData, ahora = new Date()) {
  const sello = `${ahora.getFullYear()}${dos(ahora.getMonth() + 1)}${dos(ahora.getDate())}-${dos(ahora.getHours())}${dos(ahora.getMinutes())}${dos(ahora.getSeconds())}`;
  return Array.from(clipboardData?.files ?? [])
    .filter((f) => IMAGENES.has(f.type))
    .map((f, i, todas) => new File([f], `pegada-${sello}${todas.length > 1 ? `-${i + 1}` : ''}.${f.type.split('/')[1].replace('jpeg', 'jpg')}`, { type: f.type }));
}
