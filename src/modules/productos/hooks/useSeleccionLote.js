/**
 * LA SELECCIÓN DE PRODUCTOS PARA LAS ACCIONES EN LOTE (13/10/2026): la usan
 * Almacén › Existencias y Compras › Productos. Se eligen PRODUCTOS (ids): un
 * producto que aparece en varios renglones se elige una vez.
 */
import { useCallback, useState } from 'react';

export function useSeleccionLote() {
  const [sel, setSel] = useState(() => new Set());
  /** Pone o saca varios de una (la casilla de un renglón, la de la página, «elegir los del filtro»). */
  const alternar = useCallback((ids, poner) => setSel((prev) => {
    const nuevo = new Set(prev);
    for (const id of ids) { if (poner) nuevo.add(id); else nuevo.delete(id); }
    return nuevo;
  }), []);
  const limpiar = useCallback(() => setSel(new Set()), []);
  return { sel, alternar, limpiar };
}
