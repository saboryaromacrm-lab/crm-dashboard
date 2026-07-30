import { useSyncExternalStore } from 'react';
import { inventoryStore } from '../services/inventory.store.js';

/**
 * Suscribe un componente al motor de inventario. Devuelve el store (API estable)
 * y re-renderiza cuando cualquier operación muta el estado (via `getVersion`).
 *
 * El store se inicializa perezosamente la primera vez que se lee el snapshot,
 * para que `useInventory` funcione sin un efecto de arranque en la página.
 */
let _initialized = false;

function ensureInit() {
  if (!_initialized) {
    _initialized = true;
    inventoryStore.init();
  }
  return inventoryStore.getVersion();
}

export function useInventory() {
  // El snapshot es la versión (entero que cambia con cada mutación).
  useSyncExternalStore(inventoryStore.subscribe, ensureInit, ensureInit);
  return inventoryStore;
}
