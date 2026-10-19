/**
 * LA FOTO EN CHICO: la misma en Tienda online (contenido) y en Compras ›
 * Productos. La dirección la resuelve `srcImagen` (services/imagenes.js).
 */
import { srcImagen } from '../services/imagenes.js';

/** Miniatura con el mismo fondo que usa el sitio; «sin foto» honesto si no hay. */
export function Miniatura({ url, alt, size = 42 }) {
  if (!url) {
    return (
      <span style={{
        width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
        background: 'var(--crm-color-bg)', border: '1px dashed var(--crm-color-border)',
        borderRadius: 8, fontSize: 10, color: 'var(--crm-color-text-muted)', textAlign: 'center',
      }}
      >
        sin foto
      </span>
    );
  }
  return (
    <img
      src={srcImagen(url)} alt={alt} loading="lazy"
      style={{ width: size, height: size, flex: 'none', objectFit: 'contain', background: '#fff', border: '1px solid var(--crm-color-border)', borderRadius: 8 }}
    />
  );
}
