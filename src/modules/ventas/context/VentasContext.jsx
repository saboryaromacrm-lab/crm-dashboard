import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { leerClave, escribirClave, leerSesion } from '@core/auth/sesion.js';
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
const VACIO = {
  clientes: [], config: {}, sucursales: [], usuarios: [], marcas: [],
  listasCatalogo: { modalidades: [], listas: [], reglasMarca: [] },
};

/** Sucursal y usuario operativos. Preferencia del puesto, POR PESTAÑA (sesion.js). */
const CTX_KEY = 'crm_ventas_ctx';
function leerCtx() {
  return leerClave(CTX_KEY) || {};
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
      setData({
        clientes: d.clientes ?? [],
        config: d.config ?? {},
        sucursales,
        usuarios,
        // Catálogo del formato de venta (modalidad › lista + reglas de marca):
        // chico y estable, viaja con el bootstrap para que cotizar no necesite
        // otra llamada.
        listasCatalogo: d.listasCatalogo ?? { modalidades: [], listas: [], reglasMarca: [] },
        marcas: d.marcas ?? [],
      });

      /*
       * LA SESIÓN MANDA: el usuario operativo es el que se logueó — ya no hay
       * selector libre. Admin y superadmin pueden pararse en otra sucursal
       * (desde el menú del perfil); el resto opera donde dijo al entrar.
       */
      const sesion = leerSesion();
      const uSesion = usuarios.find((u) => u.id === sesion?.usuario?.id);
      const esJefe = uSesion?.rolClave === 'admin' || uSesion?.rolClave === 'superadmin';
      setCtxState((c) => ({
        sucursalId: esJefe && sucursales.some((s) => s.id === c.sucursalId)
          ? c.sucursalId
          : (sucursales.find((s) => s.id === sesion?.sucursal?.id)?.id ?? sucursales[0]?.id ?? null),
        usuarioId: uSesion?.id
          ?? (usuarios.some((u) => u.id === c.usuarioId) ? c.usuarioId : (usuarios[0]?.id ?? null)),
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
      escribirClave(CTX_KEY, next);
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

  /** Catálogo del formato de venta que llega con el bootstrap. */
  const listasCatalogo = useMemo(
    () => data.listasCatalogo ?? { modalidades: [], listas: [], reglasMarca: [] },
    [data.listasCatalogo],
  );

  const value = useMemo(
    () => ({
      ...data, loaded, loadError, recargar: cargar,
      ctx, setCtx,
      panels, panel, panelParams, goPanel,
      modal, openModal, closeModal,
      toast, toastState, closeToast, act,
      getCliente, listasCatalogo,
    }),
    [data, loaded, loadError, cargar, ctx, setCtx, panels, panel, panelParams, goPanel, modal,
      openModal, closeModal, toast, toastState, closeToast, act, getCliente, listasCatalogo],
  );

  return <VentasContext.Provider value={value}>{children}</VentasContext.Provider>;
}

export function useVentas() {
  const ctx = useContext(VentasContext);
  if (!ctx) throw new Error('useVentas debe usarse dentro de <VentasProvider>');
  return ctx;
}
