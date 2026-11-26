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
  const keyRef = useRef(key);
  /** La key del dato en memoria: una recarga que falla no borra lo que ya se tenía de ESA key. */
  const keyDelDato = useRef(null);

  fetcherRef.current = fetcher;
  keyRef.current = key;

  const load = useCallback(async () => {
    const id = ++runId.current;
    const k = keyRef.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fetcherRef.current();
      if (id === runId.current) { keyDelDato.current = k; setState({ data, loading: false, error: null }); }
    } catch (e) {
      /* 26/11/2026: un corte al recargar el catálogo de la caja (después de cada venta) lo dejaba vacío,
       * y la venta siguiente se abría con «Producto #… · sin stock». Se queda lo último bueno, con el error a la vista. */
      if (id === runId.current) setState((s) => ({ data: keyDelDato.current === k ? s.data : null, loading: false, error: errorMsg(e) }));
    }
  }, []);

  useEffect(() => {
    // Alias de la ref (no de su valor): al desmontar o cambiar la key se
    // incrementa el contador y la respuesta en vuelo queda descartada.
    const corrida = runId;
    if (!enabled) {
      corrida.current++;
      keyDelDato.current = null;
      setState({ data: null, loading: false, error: null });
      return undefined;
    }
    load();
    return () => { corrida.current++; };
  }, [key, enabled, load]);

  /**
   * Reemplaza el dato en memoria SIN volver a la red, con algo que ya se sabe
   * cierto: la respuesta de un guardado. El punto de venta lo usa después de
   * cada autoguardado del ticket, que hasta ahora venía seguido de una
   * relectura de TODAS las ventas abiertas de la sucursal — una consulta más
   * por tecla para enterarse de lo que el servidor acababa de contestar.
   * Recibe el valor nuevo o una función `(actual) => nuevo`.
   */
  const mutate = useCallback((valor) => {
    setState((s) => ({ ...s, data: typeof valor === 'function' ? valor(s.data) : valor }));
  }, []);

  return { ...state, reload: load, mutate };
}
