/**
 * LA SEGUNDA CONFIRMACIÓN DE LO QUE MUEVE PLATA (27/9/2026).
 * ============================================================================
 * Regla del dueño: antes de sacar plata o de tocar la deuda de un proveedor,
 * se confirma dos veces. El primer clic valida y muestra el resumen; recién el
 * segundo ejecuta. Cambiar cualquier dato (la `firma`) vuelve a pedirla.
 *
 * Y el candado del doble clic con `useRef` —no con estado: el estado recién se
 * ve en el render siguiente y dos clics seguidos pasaban los dos (así se
 * pagaban dos veces $400 a un gasto de $1.000).
 *
 * `gemelo` es la respuesta 409 de la API: "ese día ya hay un pago igual". Ahí
 * el siguiente clic manda `confirmarDuplicado` — es la persona diciendo "sí, es
 * otro pago", nunca el sistema adivinando.
 */
import { useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { s } from './ui.jsx';

export function useSegundaConfirmacion(firma) {
  const [confirmando, setConfirmando] = useState(false);
  const [gemelo, setGemelo] = useState(null);
  const firmaConfirmada = useRef('');
  const enVuelo = useRef(false);
  if ((confirmando || gemelo != null) && firmaConfirmada.current !== firma) {
    setConfirmando(false);
    setGemelo(null);
  }

  /** Primer clic: `validar()` y pedir la segunda. Segundo: `ejecutar(confirmarDuplicado)`, una sola vez. */
  const clic = async (validar, ejecutar) => {
    if (enVuelo.current) return;
    if (!confirmando) {
      if (validar() === false) return;
      firmaConfirmada.current = firma;
      setConfirmando(true);
      return;
    }
    enVuelo.current = true;
    try {
      await ejecutar(gemelo != null);
    } finally {
      enVuelo.current = false;
    }
  };

  const alConflicto = (datos) => setGemelo(datos?.duplicado ?? '—');
  return { confirmando, gemelo, clic, alConflicto };
}

/** El cartel de la segunda confirmación (o del pago gemelo). */
export function AvisoSegundaConfirmacion({ confirmando, gemelo, children }) {
  if (gemelo != null) {
    return (
      <div className={cx(s.callout, s.warn)}>
        <strong>¿Es otro pago?</strong> Ese mismo día ya hay un pago igual registrado
        {gemelo !== '—' ? <> (pago #{gemelo})</> : null}. Si es un doble clic o ya se había cargado,
        cancelá. Si de verdad se pagó dos veces lo mismo, confirmalo.
      </div>
    );
  }
  if (!confirmando) return null;
  return (
    <div className={cx(s.callout, s.warn)}>
      <strong>Segunda confirmación.</strong> {children} ¿Confirmás?
    </div>
  );
}

/** El texto del botón según el paso en que está. */
export function textoBoton({ confirmando, gemelo }, primero, segundo) {
  if (gemelo != null) return 'Sí, es otro pago';
  return confirmando ? segundo : primero;
}
