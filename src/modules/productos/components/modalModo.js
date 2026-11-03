/**
 * MODO CELULAR DE LOS MODALES.
 *
 * En modo celular las ventanas ocupan la pantalla entera, con botones grandes
 * abajo y letra de 16 px en los campos (con menos, el iPhone hace zoom al
 * tocarlos).
 *
 *   · 7/10/2026: solo la pantalla del Cash Flow en el celular (/cashflow), que
 *     envuelve su contenido con `<ModalModo.Provider value={{ movil: true }}>`
 *     y maneja ella misma el botón «atrás».
 *   · 3/11/2026 (pedido del dueño: «que quede súper utilizable en el
 *     celular»): sin proveedor, el modo sale del ANCHO de la pantalla. En un
 *     teléfono (menos de 768 px) todas las ventanas del ERP son de pantalla
 *     entera, y el «atrás» del teléfono las cierra (`auto`, ver Modal.jsx).
 */
import { createContext, useContext } from 'react';
import { useMediaQuery } from '@core/hooks/useMediaQuery.js';

export const ModalModo = createContext(null);

/** Lo mismo que `useBreakpoint().isMobile`: el teléfono, no la tablet. */
export const CONSULTA_CELULAR = '(max-width: 767px)';

export function useModalModo() {
  const forzado = useContext(ModalModo);
  const celular = useMediaQuery(CONSULTA_CELULAR);
  return forzado ?? { movil: celular, auto: true };
}
