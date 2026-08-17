import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { leerSesion } from '@core/auth/sesion.js';
import { usePermissions } from '@core/permissions/PermissionContext.jsx';
import { errorMsg, provApi } from '../services/proveedores.api.js';

/**
 * PROVEEDORES CONTEXT (0068)
 * ============================================================================
 * Hub del módulo. El catálogo compartido es UNO: el padrón (todas las
 * pantallas eligen proveedores). Los listados que crecen —compromisos,
 * echeqs, kanban, EDOC— los pide cada panel con `useResource`.
 *
 * `contadores` alimenta los badges del sub-menú: compromisos y echeqs que
 * requieren atención (vencidos + próximos 3 días) y pedidos pendientes.
 */
const ProveedoresContext = createContext(null);

export function ProveedoresProvider({ children, panels = [], defaultPanel }) {
  const [proveedores, setProveedores] = useState([]);
  const [contadores, setContadores] = useState({ ctasctes: 0, echeqs: 0, pedidos: 0 });
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const [panel, setPanel] = useState(defaultPanel || panels[0]?.id);
  const [panelParams, setPanelParams] = useState({});
  const [modal, setModal] = useState(null);
  const [toastState, setToastState] = useState({ open: false, msg: '', kind: 'ok' });

  const sesion = useMemo(leerSesion, []);
  const ctx = useMemo(() => ({
    usuarioId: sesion?.usuario?.id ?? null,
    sucursalId: sesion?.sucursal?.id ?? null,
  }), [sesion]);
  const { esAdmin: esJefe } = usePermissions();

  const cargarContadores = useCallback(async () => {
    try {
      const [k, e, p] = await Promise.all([
        provApi.statsCompromisos(), provApi.statsEcheqs(), provApi.statsPedidos(),
      ]);
      setContadores({
        ctasctes: (k?.vencidos?.n ?? 0) + (k?.prox3?.n ?? 0),
        echeqs: (e?.vencidos?.n ?? 0) + (e?.prox3?.n ?? 0),
        pedidos: p?.pendientes ?? 0,
      });
    } catch { /* API caída: los badges quedan como estaban */ }
  }, []);

  const cargar = useCallback(async () => {
    try {
      setProveedores(await provApi.proveedores());
      setLoadError(null);
    } catch (e) {
      setLoadError(errorMsg(e));
    } finally {
      setLoaded(true);
    }
    cargarContadores();
  }, [cargarContadores]);

  useEffect(() => { cargar(); }, [cargar]);

  const closeModal = useCallback(() => setModal(null), []);
  const openModal = useCallback((type, props = {}) => setModal({ type, props }), []);
  const goPanel = useCallback((id, params = {}) => {
    setPanel(id);
    setPanelParams(params);
    setModal(null);
  }, []);
  const toast = useCallback((msg, kind = 'ok') => setToastState({ open: true, msg, kind }), []);
  const closeToast = useCallback(() => setToastState((t) => ({ ...t, open: false })), []);

  /** Mutación + feedback unificado (mismo contrato que el resto del sistema). */
  const act = useCallback(
    async (promesa, okMsg, { recargar = false } = {}) => {
      try {
        const res = await promesa;
        if (recargar) await cargar();
        else await cargarContadores();
        toast(okMsg || 'Listo.', 'ok');
        closeModal();
        return res ?? true;
      } catch (e) {
        toast(errorMsg(e), 'err');
        return null;
      }
    },
    [cargar, cargarContadores, toast, closeModal],
  );

  const getProveedor = useCallback(
    (id) => proveedores.find((p) => p.id === id) || null,
    [proveedores],
  );

  const value = useMemo(
    () => ({
      proveedores, contadores,
      loaded, loadError, recargar: cargar, recargarContadores: cargarContadores,
      ctx, esJefe,
      panels, panel, panelParams, goPanel,
      modal, openModal, closeModal,
      toast, toastState, closeToast, act,
      getProveedor,
    }),
    [proveedores, contadores, loaded, loadError, cargar, cargarContadores, ctx, esJefe,
      panels, panel, panelParams, goPanel, modal, openModal, closeModal,
      toast, toastState, closeToast, act, getProveedor],
  );

  return <ProveedoresContext.Provider value={value}>{children}</ProveedoresContext.Provider>;
}

export function useProveedores() {
  const ctx = useContext(ProveedoresContext);
  if (!ctx) throw new Error('useProveedores debe usarse dentro de <ProveedoresProvider>');
  return ctx;
}
