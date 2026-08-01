import { useEffect } from 'react';
import { inventoryStore } from '../services/inventory.store.js';

/**
 * Pide una sección perezosa del store (`movimientos`, `comprobantes`).
 *
 * Esas dos tablas crecen sin techo, así que salieron del bootstrap: se cargan
 * la primera vez que una pantalla las mira y no antes. El store deduplica los
 * pedidos simultáneos y recuerda lo ya cargado, así que llamar a este hook
 * desde varios componentes a la vez cuesta una sola petición.
 *
 *   useSeccion('comprobantes');   // y después leés store.state.comprobantes
 */
export function useSeccion(nombre) {
  useEffect(() => { inventoryStore.cargarSeccion(nombre); }, [nombre]);
}
