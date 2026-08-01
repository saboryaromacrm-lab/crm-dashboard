import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMsg } from '../services/ventas.api.js';

/**
 * Lectura bajo demanda de un recurso de la API.
 *
 * Es la alternativa liviana a meter todo en un store global: el panel pide sus
 * datos cuando se monta y los suelta cuando se va. Nada de listados infinitos
 * viviendo en memoria "por las dudas".
 *
 *  - `key`: identidad del pedido (incluí los filtros). Cambiarla vuelve a pedir.
 *  - `fetcher`: se lee de una ref, así no hace falta memoizarlo en el llamador.
 *  - `enabled`: false evita el pedido (p. ej. hasta que se elija un cliente).
 *
 * Las respuestas viejas se descartan por número de corrida, así una consulta
 * lenta no pisa el resultado de otra más nueva.
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
    // Alias de la ref (no de su valor): al desmontar o cambiar la key se
    // incrementa el contador y la respuesta en vuelo queda descartada.
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
