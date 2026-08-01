import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { errorMsg, ventasApi } from '../services/ventas.api.js';

/**
 * VENTAS CONTEXT
 * ============================================================================
 * Hub del módulo. A diferencia de inventario (store singleton compartido entre
 * Compras y Almacén), acá el estado vive en el provider: nadie fuera de Ventas
 * lo necesita, y al salir del módulo se libera solo.
 *
 * Solo guarda los CATÁLOGOS chicos que casi todas las pantallas usan —
 * clientes, configuración, sucursales, usuarios. Los listados que crecen sin
 * techo (ventas, cobranzas) los pide cada panel con `useResource`.
 */
const VentasContext = createContext(null);

/** Estado inicial: evita chequear `?.` en cada consumidor. */
const VACIO = { clientes: [], config: {}, sucursales: [], usuarios: [] };

/** Sucursal y usuario operativos. Es preferencia del puesto, no dato: localStorage. */
const CTX_KEY = 'crm_ventas_ctx';
function leerCtx() {
  try { return JSON.parse(localStorage.getItem(CTX_KEY)) || {}; } catch { return {}; }
}

export function VentasProvider({ children, panels = [], defaultPanel }) {
  const [data, setData] = useState(VACIO);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [ctx, setCtxState] = useState(() => ({ sucursalId: null, usuarioId: null, ...leerCtx() }));

  const [panel, setPanel] = useState(defaultPanel || panels[0]?.id);
  const [panelParams, setPanelParams] = useState({});
  const [modal, setModal] = useState(null); // { type, props }
  const [toastState, setToastState] = useState({ open: false, msg: '', kind: 'ok' });

  /* ------------------------------ Carga ------------------------------ */

  const cargar = useCallback(async () => {
    try {
      const d = await ventasApi.bootstrap();
      const sucursales = d.sucursales ?? [];
      const usuarios = d.usuarios ?? [];
      setData({ clientes: d.clientes ?? [], config: d.config ?? {}, sucursales, usuarios });

      // Primera carga: si no hay puesto elegido, se toma uno razonable.
      setCtxState((c) => ({
        sucursalId: sucursales.some((s) => s.id === c.sucursalId) ? c.sucursalId : (sucursales[0]?.id ?? null),
        usuarioId: usuarios.some((u) => u.id === c.usuarioId) ? c.usuarioId : (usuarios[0]?.id ?? null),
      }));
      setLoadError(null);
    } catch (e) {
      setLoadError(errorMsg(e));
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const setCtx = useCallback((campo, valor) => {
    setCtxState((c) => {
      const next = { ...c, [campo]: valor };
      try { localStorage.setItem(CTX_KEY, JSON.stringify(next)); } catch { /* modo privado */ }
      return next;
    });
  }, []);

  /* --------------------------- UI compartida --------------------------- */

  const closeModal = useCallback(() => setModal(null), []);
  const openModal = useCallback((type, props = {}) => setModal({ type, props }), []);

  const goPanel = useCallback((id, params = {}) => {
    setPanel(id);
    setPanelParams(params);
    setModal(null);
  }, []);

  const toast = useCallback((msg, kind = 'ok') => setToastState({ open: true, msg, kind }), []);
  const closeToast = useCallback(() => setToastState((t) => ({ ...t, open: false })), []);

  /**
   * Ejecuta una mutación y unifica el feedback: avisa, cierra el modal y
   * refresca los catálogos si hace falta. Devuelve el resultado (o null si
   * falló), para que el llamador pueda encadenar.
   */
  const act = useCallback(
    async (promesa, okMsg, { recargar = true } = {}) => {
      try {
        const res = await promesa;
        if (recargar) await cargar();
        toast(okMsg || 'Listo.', 'ok');
        closeModal();
        return res ?? true;
      } catch (e) {
        toast(errorMsg(e), 'err');
        return null;
      }
    },
    [cargar, toast, closeModal],
  );

  /* ------------------------------ Derivados ------------------------------ */

  const getCliente = useCallback((id) => data.clientes.find((c) => c.id === id) || null, [data.clientes]);

  /** Listas de precio configuradas (con fallback si la config aún no cargó). */
  const listasPrecio = useMemo(
    () => (data.config.listasPrecio?.length ? data.config.listasPrecio : ['Minorista']),
    [data.config.listasPrecio],
  );

  const value = useMemo(
    () => ({
      ...data, loaded, loadError, recargar: cargar,
      ctx, setCtx,
      panels, panel, panelParams, goPanel,
      modal, openModal, closeModal,
      toast, toastState, closeToast, act,
      getCliente, listasPrecio,
    }),
    [data, loaded, loadError, cargar, ctx, setCtx, panels, panel, panelParams, goPanel, modal,
      openModal, closeModal, toast, toastState, closeToast, act, getCliente, listasPrecio],
  );

  return <VentasContext.Provider value={value}>{children}</VentasContext.Provider>;
}

export function useVentas() {
  const ctx = useContext(VentasContext);
  if (!ctx) throw new Error('useVentas debe usarse dentro de <VentasProvider>');
  return ctx;
}
