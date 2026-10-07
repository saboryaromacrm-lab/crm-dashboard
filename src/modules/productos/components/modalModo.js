/**
 * MODO CELULAR DE LOS MODALES (7/10/2026).
 *
 * Una pantalla pensada para el celular (Cash Flow en /cashflow) envuelve su
 * contenido con `<ModalModo.Provider value={{ movil: true }}>`: los modales
 * que se abren desde ahí ocupan la pantalla entera, con botones grandes abajo
 * y letra de 16 px en los campos (con menos, el iPhone hace zoom al tocarlos).
 * El resto del ERP no cambia: sin el proveedor, `movil` es false.
 */
import { createContext, useContext } from 'react';

export const ModalModo = createContext({ movil: false });

export const useModalModo = () => useContext(ModalModo);
