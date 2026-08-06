import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMsg } from '../services/gastos.api.js';

/**
 * Lectura bajo demanda de un recurso de la API — misma pieza que usa Ventas,
 * apuntando al `errorMsg` de este módulo.
 *
 *  - `key`: identidad del pedido (incluí los filtros). Cambiarla vuelve a pedir.
 *  - `fetcher`: se lee de una ref, así no hace falta memoizarlo en el llamador.
 *  - `enabled`: false evita el pedido (p. ej. hasta que se elija un proveedor).
 *
 * Las respuestas viejas se descartan por número de corrida: una consulta lenta
 * no pisa el resultado de otra más nueva.
 */
export function useResource(key, fetcher, { enabled = true } = {}) {
  const [state, setState] = useState({ data: null, loading: enabled, error: null });
  const fetcherRef = useRef(fetcher);
  const runId = useRef(0);

  fetcherRef.current = fetcher;

  const load = useCallback(async () => {
    const id = ++runId.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fetcherRef.current();
      if (id === runId.current) setState({ data, loading: false, error: null });
    } catch (e) {
      if (id === runId.current) setState({ data: null, loading: false, error: errorMsg(e) });
    }
  }, []);

  useEffect(() => {
    const corrida = runId;
    if (!enabled) {
      corrida.current++;
      setState({ data: null, loading: false, error: null });
      return undefined;
    }
    load();
    return () => { corrida.current++; };
  }, [key, enabled, load]);

  return { ...state, reload: load };
}
