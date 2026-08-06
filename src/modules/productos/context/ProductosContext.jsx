import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useInventory } from '../hooks/useInventory.js';

/**
 * PRODUCTOS CONTEXT
 * ============================================================================
 * Hub del módulo. Centraliza lo que paneles y modales necesitan compartir:
 *   - `store`: el motor de inventario (API estable, reactivo).
 *   - navegación interna: `panel`, `panelParams`, `goPanel()`.
 *   - modales: `modal`, `openModal()`, `closeModal()`.
 *   - feedback: `toast()` y `act()` (aplica un resultado del store y avisa).
 *   - permisos/contexto: `can()`, `isAdmin`, `sucOperativa()`.
 *
 * Consumir el contexto suscribe al store: cualquier mutación re-renderiza.
 */
const ProductosContext = createContext(null);

export function ProductosProvider({ children, panels = [], defaultPanel }) {
  const store = useInventory();

  const [panel, setPanel] = useState(defaultPanel || panels[0]?.id || 'dashboard');
  const [panelParams, setPanelParams] = useState({});
  const [modal, setModal] = useState(null); // { type, props }
  const [toastState, setToastState] = useState({ open: false, msg: '', kind: 'ok' });

  const closeModal = useCallback(() => setModal(null), []);
  const openModal = useCallback((type, props = {}) => setModal({ type, props }), []);

  const goPanel = useCallback((id, params = {}) => {
    setPanel(id);
    setPanelParams(params);
    setModal(null);
  }, []);

  const toast = useCallback((msg, kind = 'ok') => {
    setToastState({ open: true, msg, kind });
  }, []);
  const closeToast = useCallback(() => setToastState((t) => ({ ...t, open: false })), []);

  /**
   * Aplica un resultado del store: avisa y cierra el modal si fue ok. Acepta tanto
   * un resultado sincrónico como una Promise (las mutaciones contra la API son async).
   */
  const act = useCallback(
    async (resOrPromise, okMsg) => {
      const res = await resOrPromise;
      if (!res || !res.ok) { toast(res?.error || 'Ocurrió un error.', 'err'); return false; }
      toast(okMsg || 'Listo.', 'ok');
      closeModal();
      return true;
    },
    [toast, closeModal],
  );

  const ctx = store.state.ctx;
  /**
   * La VERSIÓN del store entra en las deps del value: el estado del store es
   * MUTABLE (misma referencia siempre), así que sin la versión una mutación
   * que no viene acompañada de un setState propio (p. ej. `setCtx` al cambiar
   * de usuario o sucursal) re-renderizaba el Provider pero el value memoizado
   * no cambiaba de identidad — y React salteaba a TODOS los consumidores.
   */
  const version = store.getVersion();
  // El superadmin maneja todo: a efectos operativos es un admin más.
  const isAdmin = store.rolActual() === 'admin' || store.rolActual() === 'superadmin';
  const can = useCallback((perm) => store.can(perm), [store]);
  const sucOperativa = useCallback(
    () => ctx.sucursalId || (store.distribuidora() && store.distribuidora().id),
    [ctx.sucursalId, store],
  );

  const value = useMemo(
    () => ({
      store, version,
      panels,
      panel, panelParams, goPanel,
      modal, openModal, closeModal,
      toast, act,
      isAdmin, can, ctx, sucOperativa,
      toastState, closeToast,
    }),
    [store, version, panels, panel, panelParams, goPanel, modal, openModal, closeModal, toast, act, isAdmin, can, ctx, sucOperativa, toastState, closeToast],
  );

  return <ProductosContext.Provider value={value}>{children}</ProductosContext.Provider>;
}

export function useProductos() {
  const ctx = useContext(ProductosContext);
  if (!ctx) throw new Error('useProductos debe usarse dentro de <ProductosProvider>');
  return ctx;
}
