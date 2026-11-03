import { useEffect, useRef } from 'react';

/**
 * EL «ATRÁS» DEL CELULAR CIERRA LA VENTANA ABIERTA (3/11/2026).
 * ============================================================================
 * En el teléfono, el gesto o el botón «atrás» es la forma natural de salir de
 * una ventana. Sin esto salía de la PANTALLA (o de la app instalada) con la
 * ventana abierta y lo que se estaba cargando se perdía.
 *
 * Cada ventana abierta agrega una entrada al historial con la misma dirección.
 * «Atrás» consume la de más arriba y cierra solo esa ventana (una sobre otra se
 * cierran de a una). Si la ventana se cierra con su propio botón, se consume
 * su entrada para que el historial no quede con escalones vacíos.
 *
 * Una pila única para toda la app: varios oyentes de `popstate` cerrarían
 * todas las ventanas abiertas a la vez con un solo «atrás».
 */
const pila = []; // { id, cerrar, puesta, viva }
let porIgnorar = 0; // los «atrás» que dispara este mismo código al cerrar con el botón
let escuchando = false;

function ponerPendientes() {
  if (porIgnorar > 0) return; // hay un «atrás» en vuelo: empujar ahora lo dejaría en el escalón equivocado
  for (const v of pila) {
    if (v.puesta) continue;
    window.history.pushState({ ...(window.history.state ?? {}), ventanaErp: v.id }, '');
    v.puesta = true;
  }
}

function alVolver() {
  if (porIgnorar > 0) {
    porIgnorar -= 1;
    ponerPendientes();
    return;
  }
  for (let i = pila.length - 1; i >= 0; i -= 1) {
    if (!pila[i].puesta) continue;
    const [v] = pila.splice(i, 1);
    v.cerrar();
    /* Una ventana que no se deja cerrar (esperando un cobro, por ejemplo)
       sigue abierta: vuelve a la pila con su escalón, o el próximo «atrás»
       saldría de la pantalla con ella abierta. */
    setTimeout(() => {
      if (!v.viva || pila.includes(v)) return;
      v.puesta = false;
      pila.push(v);
      ponerPendientes();
    }, 60);
    return;
  }
}

/** `activo`: la ventana está abierta y se cierra con «atrás». `cerrar`: lo que hace su botón de cerrar. */
export function useAtrasCierra(activo, cerrar) {
  const ref = useRef(cerrar);
  ref.current = cerrar;

  useEffect(() => {
    if (!activo) return undefined;
    if (!escuchando) {
      window.addEventListener('popstate', alVolver);
      escuchando = true;
    }
    const v = { id: Math.random().toString(36).slice(2), cerrar: () => ref.current?.(), puesta: false, viva: true };
    pila.push(v);
    ponerPendientes();
    return () => {
      v.viva = false;
      const i = pila.indexOf(v);
      if (i === -1) return; // la cerró el «atrás»: su entrada ya no está
      pila.splice(i, 1);
      /* Solo si su entrada sigue siendo la de arriba: si se navegó a otra
         pantalla desde la ventana, volver atrás desharía esa navegación. */
      if (v.puesta && window.history.state?.ventanaErp === v.id) {
        porIgnorar += 1;
        window.history.back();
      }
    };
  }, [activo]);
}
