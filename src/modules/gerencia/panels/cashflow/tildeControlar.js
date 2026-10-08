/**
 * El estado del tilde «Mandar a Cajas a controlar» (0145) y el límite que lo
 * propone. Lo usan el control del sobre (Cash Flow) y el cierre y el control
 * del turno (Ventas › Caja). La pieza visual es `TildeControlar`.
 */
import { useEffect, useRef, useState } from 'react';
import { httpClient } from '@core/services/httpClient.js';
import { useResource } from '@modules/ventas/hooks/useResource.js';

/** Desde qué diferencia se propone el tilde. `null` mientras carga (o sin permiso). */
export function useUmbralControlar(habilitado = true) {
  const { data } = useResource('cashflow:umbral-controlar', () => httpClient.get('/cashflow/a-controlar/umbral'), { enabled: habilitado });
  return data?.umbral ?? null;
}

/**
 * El estado del tilde. Se PROPONE (viene tildado) cuando alguna de las
 * diferencias pasa del límite, y sigue a la propuesta si se vuelve a contar;
 * apenas el dueño lo toca, manda él.
 */
export function useTildeControlar(diferencias, umbral) {
  const [marcar, setMarcarEstado] = useState(false);
  const [nota, setNota] = useState('');
  const tocado = useRef(false);
  const mayor = Math.max(0, ...diferencias.map((d) => Math.abs(Number(d) || 0)));
  const propuesto = umbral != null && mayor > 0.009 && mayor >= umbral;
  useEffect(() => { if (!tocado.current) setMarcarEstado(propuesto); }, [propuesto]);
  const setMarcar = (v) => { tocado.current = true; setMarcarEstado(v); };
  return { marcar, setMarcar, nota, setNota, propuesto, umbral, pedido: marcar ? { nota: nota.trim() } : undefined };
}
