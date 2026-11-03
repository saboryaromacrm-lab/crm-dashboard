import { useEffect, useLayoutEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * LA SECCIÓN DEL MÓDULO EN LA DIRECCIÓN (3/11/2026).
 * ============================================================================
 * Cada módulo (Proveedores, Almacén, Gerencia…) guarda la sección elegida en
 * su propio estado. Así, el «atrás» del teléfono —o del navegador— salía del
 * módulo entero en vez de volver a la sección anterior. Ahora cada toque en el
 * menú del módulo deja un escalón en el historial (`?panel=echeqs`) y «atrás»
 * vuelve a la sección de antes.
 *
 * La sección la sigue decidiendo el módulo: acá solo se copia a la dirección y,
 * al volver atrás, se le pide que cambie (`irA`). `clave` es el nombre que ya
 * usaba cada módulo en sus enlaces (`panel` o `seccion`).
 */
export function useSeccionEnUrl(seccion, irA, validas, clave = 'panel') {
  const [params, setParams] = useSearchParams();
  const enUrl = params.get(clave);

  /* «Atrás» / «adelante» (o un enlace a otra sección del mismo módulo): manda la dirección. */
  useEffect(() => {
    if (enUrl && enUrl !== seccion && validas.includes(enUrl)) irA(enUrl);
    // Solo cuando cambia la dirección: si dependiera de `seccion`, un toque en el menú se desharía.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enUrl]);

  /* Un toque en el menú: un escalón nuevo en el historial (el primero reemplaza, no agrega). */
  useEffect(() => {
    if (!seccion || seccion === enUrl) return;
    /* De la dirección real y no de la del router: alguna pantalla limpia sus
       parámetros a mano (Sistema, al volver de Google) y no hay que revivirlos. */
    const n = new URLSearchParams(window.location.search);
    n.set(clave, seccion);
    setParams(n, { replace: !validas.includes(enUrl) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seccion]);
}

/**
 * EN EL MENÚ DESLIZABLE DEL MÓDULO (tablet y teléfono), LA SECCIÓN ELEGIDA A LA
 * VISTA. Corre la fila de costado —nunca la página— hasta centrar la marcada
 * con `aria-current`.
 */
export function useSubnavALaVista(ref, seccion) {
  useLayoutEffect(() => {
    const nav = ref.current;
    if (!nav || nav.scrollWidth <= nav.clientWidth) return;
    const activo = nav.querySelector('[aria-current="true"], [aria-current="page"]');
    if (!activo) return;
    const n = nav.getBoundingClientRect();
    const a = activo.getBoundingClientRect();
    const izq = nav.scrollLeft + (a.left - n.left) - (n.width - a.width) / 2;
    nav.scrollTo({ left: Math.max(0, izq), behavior: 'smooth' });
  }, [ref, seccion]);
}
