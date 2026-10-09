import { useState } from 'react';

/** Los grupos abiertos de la tabla de Resultados (el detalle por rubro), con su alternador. */
export function useAbiertos() {
  const [abiertos, setAbiertos] = useState(() => new Set());
  const alternar = (id) => setAbiertos((a) => {
    const n = new Set(a);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  return [abiertos, alternar];
}
